// src/types/quoteApproval.ts

import { QuoteItem } from '../types';

export interface QuoteApprovalRule {
  id: string;
  name: string;
  minAmount: number;
  maxAmount?: number;
  maxDiscountPercent?: number; // e.g. 15%
  requiredRole: 'sales' | 'manager' | 'management' | 'admin';
  approverTitle: string; // e.g. "Director", "Sales Manager", "Managing Director"
  level: number;
  description: string;
}

export interface QuoteApprovalWorkflowConfig {
  tenantId: string;
  enabled: boolean;
  preventUnauthorizedDispatch: boolean;
  rules: QuoteApprovalRule[];
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_APPROVAL_CONFIG: QuoteApprovalWorkflowConfig = {
  tenantId: 'default',
  enabled: true,
  preventUnauthorizedDispatch: true,
  rules: [
    {
      id: 'rule-std',
      name: 'Standard Sales Authority',
      minAmount: 0,
      maxAmount: 50000,
      maxDiscountPercent: 5,
      requiredRole: 'sales',
      approverTitle: 'Sales Engineer',
      level: 1,
      description: 'Standard baseline authorization for quotes up to ₹50,000 with ≤5% discount.'
    },
    {
      id: 'rule-mgr',
      name: 'Sales Manager Review',
      minAmount: 50000,
      maxAmount: 100000,
      maxDiscountPercent: 15,
      requiredRole: 'manager',
      approverTitle: 'Sales Manager',
      level: 2,
      description: 'Quotes between ₹50,000 and ₹1,00,000 or with discounts up to 15% require Sales Manager review.'
    },
    {
      id: 'rule-dir',
      name: 'Director Authorization (>₹1 Lakh / High Discount)',
      minAmount: 100000,
      maxAmount: 500000,
      maxDiscountPercent: 25,
      requiredRole: 'management',
      approverTitle: 'Director / Commercial Head',
      level: 3,
      description: 'Quotes exceeding ₹1,00,000 (>₹1L) or with discounts above 15% require Director approval.'
    },
    {
      id: 'rule-md',
      name: 'Managing Director Authorization (>₹5 Lakh)',
      minAmount: 500000,
      requiredRole: 'admin',
      approverTitle: 'Managing Director',
      level: 4,
      description: 'High-value enterprise contracts exceeding ₹5,00,000 require Managing Director sign-off.'
    }
  ]
};

export interface QuoteApprovalStepRecord {
  stepId: string;
  ruleId: string;
  ruleName: string;
  level: number;
  approverTitle: string;
  requiredRole: 'sales' | 'manager' | 'management' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  actionBy?: {
    uid: string;
    name: string;
    email: string;
    role: string;
  };
  actionAt?: string;
  comments?: string;
}

export interface QuoteApprovalState {
  requiresApproval: boolean;
  currentStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'converted';
  currentLevel: number;
  totalLevels: number;
  pendingRole: 'sales' | 'manager' | 'management' | 'admin' | null;
  pendingRoleTitle: string | null;
  steps: QuoteApprovalStepRecord[];
  highestTriggeredRuleName?: string;
  rejectionReason?: string;
  submittedAt?: string;
  submittedBy?: {
    uid: string;
    name: string;
    email: string;
  };
}

export interface QuoteVersionRecord {
  version: number;
  versionLabel: string; // e.g. "v1.0", "v2.0"
  createdAt: string;
  createdBy: {
    uid: string;
    name: string;
    email: string;
  };
  changeSummary: string;
  items: QuoteItem[];
  subtotal: number;
  discountTotal: number;
  gstAmount: number;
  total: number;
  approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'converted';
  pdfUrl?: string;
}
