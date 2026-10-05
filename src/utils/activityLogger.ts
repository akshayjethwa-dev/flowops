// src/utils/activityLogger.ts

import { db } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ActivityEvent, ActivityActionType, ActivityEntityType } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

interface LogActivityParams {
  tenantId: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: string;
  actor: {
    userId: string;
    displayName: string;
    email?: string;
  };
  description: string;
  metadata?: {
    fromStage?: string;
    toStage?: string;
    fromStatus?: string;
    toStatus?: string;
    customerName?: string;
    rfqNumber?: string;
    jobCode?: string;
    role?: string;
    invoiceNumber?: string;
    dispatchCode?: string;
    [key: string]: any;
  };
  isSandboxMode?: boolean;

  // Manual overrides for Workflow 8
  module?: 'rfq' | 'order' | 'dispatch' | 'payment' | 'inventory' | 'whatsapp';
  action?: string;
  entityLabel?: string;
}

export async function logActivityEvent({
  tenantId,
  actionType,
  entityType,
  entityId,
  actor,
  description,
  metadata,
  isSandboxMode = false,
  module: customModule,
  action: customAction,
  entityLabel: customEntityLabel
}: LogActivityParams): Promise<boolean> {
  if (!tenantId) return false;

  // Derive module matching schema: "rfq" | "order" | "dispatch" | "payment" | "inventory" | "whatsapp"
  let derivedModule: 'rfq' | 'order' | 'dispatch' | 'payment' | 'inventory' | 'whatsapp' = 'rfq';
  const eType = entityType?.toLowerCase();
  
  if (customModule) {
    derivedModule = customModule;
  } else if (eType === 'rfq' || eType === 'quotation' || eType === 'customer') {
    derivedModule = 'rfq';
  } else if (eType === 'order' || eType === 'job') {
    derivedModule = 'order';
  } else if (eType === 'dispatch') {
    derivedModule = 'dispatch';
  } else if (eType === 'invoice' || eType === 'payment') {
    derivedModule = 'payment';
  } else if (eType === 'inventory' || eType === 'stock' || eType === 'material') {
    derivedModule = 'inventory';
  } else if (eType === 'whatsapp') {
    derivedModule = 'whatsapp';
  }

  // Derive action matching examples e.g. "rfq_created", "order_stage_changed", "dispatch_sent"
  let derivedAction = customAction || `${eType}_${actionType}`;
  if (!customAction) {
    if (eType === 'rfq' && actionType === 'create') derivedAction = 'rfq_created';
    if (eType === 'job' && actionType === 'update') derivedAction = 'order_stage_changed';
    if (eType === 'dispatch' && actionType === 'create') derivedAction = 'dispatch_sent';
    if (eType === 'payment' && actionType === 'create') derivedAction = 'payment_received';
    if (eType === 'whatsapp' && actionType === 'whatsapp_sent') derivedAction = 'whatsapp_sent';
  }

  // Derive human-readable entity label e.g. "RFQ #RFQ-2024-047"
  let derivedEntityLabel = customEntityLabel || `${entityType?.toUpperCase()} #${entityId}`;
  if (!customEntityLabel) {
    if (metadata?.rfqNumber) {
      derivedEntityLabel = `RFQ #${metadata.rfqNumber}`;
    } else if (metadata?.orderNumber) {
      derivedEntityLabel = `Order #${metadata.orderNumber}`;
    } else if (metadata?.jobCode) {
      derivedEntityLabel = `Job #${metadata.jobCode}`;
    } else if (metadata?.invoiceNumber) {
      derivedEntityLabel = `Invoice #${metadata.invoiceNumber}`;
    } else if (metadata?.dispatchCode) {
      derivedEntityLabel = `Dispatch #${metadata.dispatchCode}`;
    }
  }

  const actorId = actor.userId || 'system';
  const actorName = actor.displayName || 'System Process';

  const baseEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    tenantId,
    actorId,
    actorName,
    module: derivedModule,
    action: derivedAction,
    entityId,
    entityLabel: derivedEntityLabel,
    description,
    metadata: metadata || {},
    
    // Maintain backwards compatibility fields
    actionType,
    entityType,
    actor: {
      userId: actorId,
      displayName: actorName,
      email: actor.email || ''
    }
  };

  if (isSandboxMode) {
    try {
      const sandboxEvent = {
        ...baseEvent,
        timestamp: new Date().toISOString()
      };

      // Write to both storage keys to update all components in real-time
      const syncKeys = [`activity_logs_${tenantId}`, `flowops_activity_${tenantId}`];
      syncKeys.forEach(storageKey => {
        const cached = localStorage.getItem(storageKey);
        const currentList = cached ? JSON.parse(cached) : [];
        const updatedList = [sandboxEvent, ...currentList].slice(0, 500);
        localStorage.setItem(storageKey, JSON.stringify(updatedList));
      });

      return true;
    } catch (err) {
      console.error('Local Activity Log storage failed:', err);
      return false;
    }
  } else {
    try {
      const eventId = baseEvent.id;

      // Create documents under both paths for complete backwards compatibility
      const liveEventWithTimestamp = {
        ...baseEvent,
        timestamp: serverTimestamp()
      };

      // 1. Root collection 'activityLog'
      const rootDocRef = doc(collection(db, 'activityLog'), eventId);
      await setDoc(rootDocRef, liveEventWithTimestamp);

      // 2. Tenant subcollection 'tenants/${tenantId}/activity'
      const legacyDocRef = doc(collection(db, 'tenants', tenantId, 'activity'), eventId);
      await setDoc(legacyDocRef, liveEventWithTimestamp);

      return true;
    } catch (err) {
      console.error('Firestore logActivityEvent failed:', err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `activityLog/${baseEvent.id}`);
      } catch (logErr) {
        // Suppress failure propagation to not interrupt transactions
      }
      return false;
    }
  }
}
