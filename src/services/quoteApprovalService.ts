// src/services/quoteApprovalService.ts

import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { Quote, QuoteItem, AppNotification } from '../types';
import { 
  QuoteApprovalRule, 
  QuoteApprovalWorkflowConfig, 
  DEFAULT_APPROVAL_CONFIG, 
  QuoteApprovalState, 
  QuoteApprovalStepRecord,
  QuoteVersionRecord
} from '../types/quoteApproval';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { logActivityEvent } from '../utils/activityLogger';

const CONFIG_STORAGE_PREFIX = 'flowops_approval_config_';

/**
 * Retrieves the tenant's Quote Approval Workflow Configuration
 */
export async function getApprovalWorkflowConfig(tenantId: string): Promise<QuoteApprovalWorkflowConfig> {
  if (!tenantId) return DEFAULT_APPROVAL_CONFIG;

  const storageKey = `${CONFIG_STORAGE_PREFIX}${tenantId}`;
  const localCached = localStorage.getItem(storageKey);

  if (db) {
    try {
      const docRef = doc(db, 'tenants', tenantId, 'approvalWorkflowConfig', 'default');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const config = snap.data() as QuoteApprovalWorkflowConfig;
        localStorage.setItem(storageKey, JSON.stringify(config));
        return config;
      }
    } catch (err) {
      console.warn('Could not fetch approval config from Firestore, falling back to local/default:', err);
    }
  }

  if (localCached) {
    try {
      return JSON.parse(localCached);
    } catch (e) {
      console.warn('Failed to parse cached approval config:', e);
    }
  }

  return { ...DEFAULT_APPROVAL_CONFIG, tenantId };
}

/**
 * Saves tenant Quote Approval Workflow Configuration
 */
export async function saveApprovalWorkflowConfig(
  tenantId: string, 
  config: QuoteApprovalWorkflowConfig,
  userId?: string
): Promise<void> {
  const updated: QuoteApprovalWorkflowConfig = {
    ...config,
    tenantId,
    updatedAt: new Date().toISOString(),
    updatedBy: userId || 'Sales Management'
  };

  const storageKey = `${CONFIG_STORAGE_PREFIX}${tenantId}`;
  localStorage.setItem(storageKey, JSON.stringify(updated));

  if (db) {
    try {
      const docRef = doc(db, 'tenants', tenantId, 'approvalWorkflowConfig', 'default');
      await setDoc(docRef, {
        ...updated,
        timestamp: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore sync failed for approvalWorkflowConfig:', err);
    }
  }
}

/**
 * Computes discount percentage across the quote
 */
export function computeEffectiveDiscount(quote: { total: number; discountTotal?: number; subtotal: number }): number {
  const subtotal = Math.max(0, quote.subtotal || 0);
  const discount = Math.max(0, quote.discountTotal || 0);
  if (subtotal <= 0 && discount <= 0) return 0;
  
  const originalGross = subtotal + discount;
  if (originalGross <= 0) return 0;
  return Math.round((discount / originalGross) * 100);
}

/**
 * Evaluates a Quote against value and discount thresholds to determine
 * if an approval chain is required, and constructs the steps.
 */
export function evaluateQuoteApproval(
  quote: { total: number; discountTotal?: number; subtotal: number; items?: QuoteItem[] },
  config: QuoteApprovalWorkflowConfig,
  submitter?: { uid: string; name: string; email: string }
): QuoteApprovalState {
  if (!config.enabled) {
    return {
      requiresApproval: false,
      currentStatus: 'approved',
      currentLevel: 1,
      totalLevels: 1,
      pendingRole: null,
      pendingRoleTitle: null,
      steps: []
    };
  }

  const grandTotal = Math.max(0, quote.total || 0);
  const effectiveDiscountPercent = computeEffectiveDiscount(quote);

  // Filter rules that are applicable based on amount or discount thresholds
  const triggeredRules: QuoteApprovalRule[] = [];

  // Sort rules ascending by level
  const sortedRules = [...config.rules].sort((a, b) => a.level - b.level);

  for (const rule of sortedRules) {
    let matchesAmount = false;
    let matchesDiscount = false;

    // Check if grandTotal triggers this rule
    if (rule.minAmount !== undefined && grandTotal >= rule.minAmount) {
      if (rule.maxAmount === undefined || grandTotal <= rule.maxAmount) {
        matchesAmount = true;
      } else if (rule.maxAmount !== undefined && grandTotal > rule.maxAmount) {
        // If it exceeds the max, an even higher rule will trigger, but we include this tier in multi-level chains
        matchesAmount = true;
      }
    }

    // Check if discount triggers this rule
    if (rule.maxDiscountPercent !== undefined && effectiveDiscountPercent > rule.maxDiscountPercent) {
      matchesDiscount = true;
    }

    if (matchesAmount || matchesDiscount) {
      // Don't include baseline level 1 standard auto-sales approval if higher escalation rules triggered
      if (rule.level > 1 || (grandTotal <= 50000 && effectiveDiscountPercent <= 5)) {
        triggeredRules.push(rule);
      }
    }
  }

  // If only standard tier or none, quote does not require managerial escalation
  const managerialRules = triggeredRules.filter(r => r.level > 1);

  if (managerialRules.length === 0) {
    return {
      requiresApproval: false,
      currentStatus: 'approved',
      currentLevel: 1,
      totalLevels: 1,
      pendingRole: null,
      pendingRoleTitle: null,
      steps: []
    };
  }

  // Construct multi-level approval steps
  const steps: QuoteApprovalStepRecord[] = managerialRules.map(r => ({
    stepId: `step-${r.id}-${Date.now()}`,
    ruleId: r.id,
    ruleName: r.name,
    level: r.level,
    approverTitle: r.approverTitle,
    requiredRole: r.requiredRole,
    status: 'pending'
  }));

  const highestRule = managerialRules[managerialRules.length - 1];

  return {
    requiresApproval: true,
    currentStatus: 'pending_approval',
    currentLevel: steps[0].level,
    totalLevels: steps.length,
    pendingRole: steps[0].requiredRole,
    pendingRoleTitle: steps[0].approverTitle,
    steps,
    highestTriggeredRuleName: highestRule.name,
    submittedAt: new Date().toISOString(),
    submittedBy: submitter
  };
}

/**
 * Processes an Approver's action (Approve or Reject) on a Quote
 */
export function processApprovalStepAction(
  quote: Quote,
  action: 'approved' | 'rejected',
  user: { uid: string; name: string; email: string; role: string },
  comments?: string
): { updatedQuote: Quote; isFullyApproved: boolean; nextStep?: QuoteApprovalStepRecord } {
  if (!quote.approvalState) {
    throw new Error('This quotation does not have an active approval state.');
  }

  const state = { ...quote.approvalState };
  const currentStepIndex = state.steps.findIndex(s => s.status === 'pending');

  if (currentStepIndex === -1) {
    throw new Error('No pending approval steps remaining on this quotation.');
  }

  const currentStep = { ...state.steps[currentStepIndex] };
  const actionTime = new Date().toISOString();

  // Apply action
  currentStep.actionBy = {
    uid: user.uid,
    name: user.name || user.email || 'Approver',
    email: user.email,
    role: user.role
  };
  currentStep.actionAt = actionTime;
  currentStep.comments = comments?.trim() || undefined;

  if (action === 'rejected') {
    currentStep.status = 'rejected';
    state.steps[currentStepIndex] = currentStep;
    state.currentStatus = 'rejected';
    state.rejectionReason = comments?.trim() || 'No explicit reason provided.';
    state.pendingRole = null;
    state.pendingRoleTitle = null;

    const updatedQuote: Quote = {
      ...quote,
      status: 'rejected',
      approvalState: state
    };

    return { updatedQuote, isFullyApproved: false };
  }

  // Approved
  currentStep.status = 'approved';
  state.steps[currentStepIndex] = currentStep;

  // Check if there are further pending steps
  const nextPendingStep = state.steps.find((s, idx) => idx > currentStepIndex && s.status === 'pending');

  if (nextPendingStep) {
    state.currentLevel = nextPendingStep.level;
    state.pendingRole = nextPendingStep.requiredRole;
    state.pendingRoleTitle = nextPendingStep.approverTitle;

    const updatedQuote: Quote = {
      ...quote,
      status: 'pending_approval',
      approvalState: state
    };

    return { updatedQuote, isFullyApproved: false, nextStep: nextPendingStep };
  }

  // Chain completely satisfied!
  state.currentStatus = 'approved';
  state.pendingRole = null;
  state.pendingRoleTitle = null;

  const updatedQuote: Quote = {
    ...quote,
    status: 'approved',
    approvalState: state
  };

  return { updatedQuote, isFullyApproved: true };
}

/**
 * Creates a new version revision of a Quote (e.g., v1 -> v2)
 */
export function createQuoteRevision(
  existingQuote: Quote,
  updatedFields: Partial<Quote>,
  user: { uid: string; name: string; email: string },
  changeSummary: string,
  config: QuoteApprovalWorkflowConfig
): Quote {
  const currentVerNumber = existingQuote.currentVersion || 1;
  const nextVerNumber = currentVerNumber + 1;

  // Snapshot the current state into version history
  const previousSnapshot: QuoteVersionRecord = {
    version: currentVerNumber,
    versionLabel: `v${currentVerNumber}.0`,
    createdAt: existingQuote.createdAt ? (typeof existingQuote.createdAt === 'string' ? existingQuote.createdAt : new Date().toISOString()) : new Date().toISOString(),
    createdBy: {
      uid: existingQuote.createdBy,
      name: user.name || 'Sales Representative',
      email: user.email || ''
    },
    changeSummary: existingQuote.notes || `Initial drafted version ${currentVerNumber}.0`,
    items: existingQuote.items,
    subtotal: existingQuote.subtotal,
    discountTotal: existingQuote.discountTotal || 0,
    gstAmount: existingQuote.gstAmount,
    total: existingQuote.total,
    approvalStatus: existingQuote.status,
    pdfUrl: existingQuote.downloadUrl
  };

  const existingVersions = existingQuote.versions || [];
  const updatedVersionsList = [...existingVersions, previousSnapshot];

  // Merge updated fields
  const candidateQuote: Quote = {
    ...existingQuote,
    ...updatedFields,
    currentVersion: nextVerNumber,
    versions: updatedVersionsList
  };

  // Re-evaluate approval requirements with the new prices/discounts
  const newApprovalState = evaluateQuoteApproval(
    candidateQuote,
    config,
    { uid: user.uid, name: user.name, email: user.email }
  );

  candidateQuote.approvalState = newApprovalState;
  candidateQuote.status = newApprovalState.requiresApproval ? 'pending_approval' : 'draft';

  return candidateQuote;
}

/**
 * Dispatches an in-app and simulated WhatsApp notification for Quote Approval
 */
export async function dispatchApprovalNotification(params: {
  tenantId: string;
  type: 'approval_requested' | 'approved' | 'rejected';
  quote: Quote;
  actor: { uid: string; name: string; email: string; role?: string };
  recipientRole?: string;
  recipientUserId?: string;
  comments?: string;
}): Promise<void> {
  const { tenantId, type, quote, actor, recipientRole, recipientUserId, comments } = params;
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  let title = '';
  let message = '';
  let notifType: any = 'quote_approval_request';

  if (type === 'approval_requested') {
    title = `Quote Approval Requested: ${quote.quoteNumber}`;
    message = `Quote for "${quote.customerName}" (₹${quote.total.toLocaleString('en-IN')}) requires ${quote.approvalState?.pendingRoleTitle || 'Director'} approval. Triggered: ${quote.approvalState?.highestTriggeredRuleName || 'Value threshold'}.`;
    notifType = 'quote_approval_request';
  } else if (type === 'approved') {
    title = `Quote Approved: ${quote.quoteNumber}`;
    message = `Quote for "${quote.customerName}" has been authorized by ${actor.name}. Ready for client dispatch & PDF publishing.${comments ? ` Note: "${comments}"` : ''}`;
    notifType = 'quote_approved';
  } else if (type === 'rejected') {
    title = `Quote Rejected: ${quote.quoteNumber}`;
    message = `Quote for "${quote.customerName}" was rejected by ${actor.name}. Reason: ${comments || 'Price/discount adjustment needed'}. Please review and submit a revision.`;
    notifType = 'quote_rejected';
  }

  const notification: AppNotification = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    tenantId,
    userId: recipientUserId || 'all',
    type: notifType,
    title,
    message,
    entityId: quote.id,
    entityType: 'quote',
    link: `/rfqs?tab=quotes&quoteId=${quote.id}`,
    read: false,
    createdAt: new Date().toISOString()
  };

  // 1. Store in localStorage cache
  try {
    const key = `flowops_notifications_${tenantId}`;
    const cached = localStorage.getItem(key);
    const list: AppNotification[] = cached ? JSON.parse(cached) : [];
    localStorage.setItem(key, JSON.stringify([notification, ...list]));
  } catch (err) {
    console.warn('Could not cache notification locally:', err);
  }

  // 2. Store in Firestore if available
  if (db && !isSandbox) {
    try {
      await addDoc(collection(db, 'notifications'), notification);
    } catch (err) {
      console.warn('Firestore notification write warning:', err);
    }
  }

  // 3. Log activity event
  logActivityEvent({
    tenantId,
    actionType: type === 'approved' ? 'accepted' : type === 'rejected' ? 'status_change' : 'create',
    entityType: 'quotation',
    entityId: quote.id,
    actor: {
      userId: actor.uid,
      displayName: actor.name || actor.email || 'Commercial Lead',
      email: actor.email
    },
    description: message,
    metadata: {
      quoteNumber: quote.quoteNumber,
      total: quote.total,
      customerName: quote.customerName,
      status: quote.status,
      comments: comments || undefined
    },
    isSandboxMode: isSandbox
  });
}
