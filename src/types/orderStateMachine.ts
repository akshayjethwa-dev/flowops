// src/types/orderStateMachine.ts

import { UserRole } from '../types';

/**
 * Finite set of states for Order State Machine lifecycle:
 * Enquiry → Quoted → Order Confirmed → In Production → Partially Dispatched → Fully Dispatched → Invoiced → Payment Received → Closed
 * + Cancelled
 */
export type OrderLifecycleState = 
  | 'enquiry'
  | 'quoted'
  | 'order_confirmed'
  | 'in_production'
  | 'partially_dispatched'
  | 'fully_dispatched'
  | 'invoiced'
  | 'payment_received'
  | 'closed'
  | 'cancelled';

export interface OrderStatusHistoryItem {
  id: string;
  orderId: string;
  orderNumber: string;
  previousState: OrderLifecycleState | string;
  newState: OrderLifecycleState;
  userId: string;
  userName: string;
  userRole: UserRole | string;
  timestamp: string; // ISO 8601
  remarks?: string;
  isOverride?: boolean;
  overrideReason?: string;
  version: number;
  // Specific metadata for audit
  metadata?: {
    dispatchedQty?: number;
    remainingQty?: number;
    invoiceNumber?: string;
    paymentRef?: string;
    partialDispatchResolution?: 'invoice_dispatched_and_cancel_balance' | 'return_dispatched_and_cancel';
    [key: string]: any;
  };
}

export interface StateTransitionRule {
  from: OrderLifecycleState;
  to: OrderLifecycleState;
  actionId: string;
  actionLabel: string;
  description: string;
  allowedRoles: UserRole[];
  isReversible?: boolean; // e.g. Quoted -> Enquiry for quote revision
  requiresRemarks?: boolean;
  requiresSpecialResolution?: boolean; // e.g. cancelling from partially_dispatched
}

export const ORDER_LIFECYCLE_STATES: { 
  id: OrderLifecycleState; 
  label: string; 
  description: string; 
  stepOrder: number;
  badgeClass: string;
  iconName: string;
}[] = [
  { 
    id: 'enquiry', 
    label: 'Enquiry', 
    description: 'Initial customer requirement / request for quote received.', 
    stepOrder: 1, 
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    iconName: 'HelpCircle'
  },
  { 
    id: 'quoted', 
    label: 'Quoted', 
    description: 'Commercial quotation & BOM costing shared with client.', 
    stepOrder: 2, 
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    iconName: 'FileText'
  },
  { 
    id: 'order_confirmed', 
    label: 'Order Confirmed', 
    description: 'Customer purchase order acknowledged & booked into schedule.', 
    stepOrder: 3, 
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    iconName: 'CheckCircle'
  },
  { 
    id: 'in_production', 
    label: 'In Production', 
    description: 'Shopfloor machining, assembly, welding, and NDT inspections active.', 
    stepOrder: 4, 
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    iconName: 'Cpu'
  },
  { 
    id: 'partially_dispatched', 
    label: 'Partially Dispatched', 
    description: 'Partial quantity shipped with DC/LR; balance in progress.', 
    stepOrder: 5, 
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-300',
    iconName: 'Truck'
  },
  { 
    id: 'fully_dispatched', 
    label: 'Fully Dispatched', 
    description: '100% of order items physically dispatched from warehouse dock.', 
    stepOrder: 6, 
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-300',
    iconName: 'CheckCheck'
  },
  { 
    id: 'invoiced', 
    label: 'Invoiced', 
    description: 'Tax Invoice / GST E-Way Bill raised and issued to buyer.', 
    stepOrder: 7, 
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    iconName: 'Receipt'
  },
  { 
    id: 'payment_received', 
    label: 'Payment Received', 
    description: 'Settlement cleared through accounts / bank remittance confirmed.', 
    stepOrder: 8, 
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconName: 'CreditCard'
  },
  { 
    id: 'closed', 
    label: 'Closed', 
    description: 'Order fully fulfilled, settled, and formally archived.', 
    stepOrder: 9, 
    badgeClass: 'bg-slate-900 text-white border-slate-900',
    iconName: 'Archive'
  },
  { 
    id: 'cancelled', 
    label: 'Cancelled', 
    description: 'Order terminated prior to completion with audit trail.', 
    stepOrder: -1, 
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
    iconName: 'XCircle'
  }
];

/**
 * Canonical state machine transition rules.
 * Governs permitted forward steps, explicitly allowed reversible steps, and role-based permissions.
 */
export const ORDER_STATE_TRANSITIONS: StateTransitionRule[] = [
  // 1. Enquiry -> Quoted (Sales, Admin, Manager, Management)
  {
    from: 'enquiry',
    to: 'quoted',
    actionId: 'submit_quote',
    actionLabel: 'Submit Commercial Quote',
    description: 'Issue official quotation and technical specifications to client.',
    allowedRoles: ['sales', 'admin', 'manager', 'management'],
    isReversible: false
  },
  // 2. Quoted -> Order Confirmed (Sales, Admin, Manager, Management)
  {
    from: 'quoted',
    to: 'order_confirmed',
    actionId: 'confirm_order',
    actionLabel: 'Confirm Order (PO Received)',
    description: 'Attach customer PO number and book order onto factory schedule.',
    allowedRoles: ['sales', 'admin', 'manager', 'management'],
    isReversible: false
  },
  // 2b. Reversible: Quoted -> Enquiry (Quote revision / commercial renegotiation)
  {
    from: 'quoted',
    to: 'enquiry',
    actionId: 'revise_quote',
    actionLabel: 'Revert to Enquiry for Revision',
    description: 'Client requested price/specifications revision. Return quote to negotiation.',
    allowedRoles: ['sales', 'admin', 'manager', 'management'],
    isReversible: true,
    requiresRemarks: true
  },
  // 3. Order Confirmed -> In Production (Production, Admin, Manager, Management)
  {
    from: 'order_confirmed',
    to: 'in_production',
    actionId: 'start_production',
    actionLabel: 'Release to Shopfloor Production',
    description: 'Generate work orders, route raw materials, and activate machine routing.',
    allowedRoles: ['production', 'admin', 'manager', 'management'],
    isReversible: false
  },
  // 4a. In Production -> Partially Dispatched (Dispatch, Admin, Manager)
  {
    from: 'in_production',
    to: 'partially_dispatched',
    actionId: 'dispatch_partial',
    actionLabel: 'Create Partial Dispatch Lot',
    description: 'Ship initial lot of finished components; remaining lot stays in production.',
    allowedRoles: ['dispatch', 'admin', 'manager'],
    isReversible: false
  },
  // 4b. In Production -> Fully Dispatched (Dispatch, Admin, Manager)
  {
    from: 'in_production',
    to: 'fully_dispatched',
    actionId: 'dispatch_full',
    actionLabel: 'Create Full Dispatch',
    description: 'Ship 100% of finished goods with delivery challan & LR.',
    allowedRoles: ['dispatch', 'admin', 'manager'],
    isReversible: false
  },
  // 5a. Partially Dispatched -> Fully Dispatched (Dispatch, Admin, Manager)
  {
    from: 'partially_dispatched',
    to: 'fully_dispatched',
    actionId: 'complete_dispatch',
    actionLabel: 'Dispatch Remaining Balance',
    description: 'Final shipment complete; 100% of order items dispatched.',
    allowedRoles: ['dispatch', 'admin', 'manager'],
    isReversible: false
  },
  // 6. Fully Dispatched -> Invoiced (Sales, Admin, Manager, Management)
  {
    from: 'fully_dispatched',
    to: 'invoiced',
    actionId: 'generate_invoice',
    actionLabel: 'Generate Tax Invoice',
    description: 'Generate GST Tax Invoice and E-Way Bill for delivered lot.',
    allowedRoles: ['sales', 'admin', 'manager', 'management'],
    isReversible: false
  },
  // 7. Invoiced -> Payment Received (Sales, Admin, Manager, Management)
  {
    from: 'invoiced',
    to: 'payment_received',
    actionId: 'record_payment',
    actionLabel: 'Record Payment Clearance',
    description: 'Customer payment recorded, reconciled against bank statement.',
    allowedRoles: ['sales', 'admin', 'manager', 'management'],
    isReversible: false
  },
  // 8. Payment Received -> Closed (Admin, Manager, Management)
  {
    from: 'payment_received',
    to: 'closed',
    actionId: 'close_order',
    actionLabel: 'Close & Archive Order',
    description: 'Order fully fulfilled, billed, and accounts cleared. Formally archive.',
    allowedRoles: ['admin', 'manager', 'management'],
    isReversible: false
  },
  // CANCELLATION TRANSITIONS:
  // Cancel from Enquiry
  {
    from: 'enquiry',
    to: 'cancelled',
    actionId: 'cancel_order',
    actionLabel: 'Cancel Enquiry',
    description: 'Customer withdrew RFQ/enquiry.',
    allowedRoles: ['sales', 'admin', 'manager', 'management'],
    requiresRemarks: true
  },
  // Cancel from Quoted
  {
    from: 'quoted',
    to: 'cancelled',
    actionId: 'cancel_order',
    actionLabel: 'Cancel Quoted Order',
    description: 'Quote lost or customer declined offer.',
    allowedRoles: ['sales', 'admin', 'manager', 'management'],
    requiresRemarks: true
  },
  // Cancel from Order Confirmed
  {
    from: 'order_confirmed',
    to: 'cancelled',
    actionId: 'cancel_order',
    actionLabel: 'Cancel Confirmed Order',
    description: 'Cancellation before shopfloor cutting/machining began.',
    allowedRoles: ['sales', 'admin', 'manager', 'management'],
    requiresRemarks: true
  },
  // Cancel from In Production
  {
    from: 'in_production',
    to: 'cancelled',
    actionId: 'cancel_order',
    actionLabel: 'Cancel Order in Production',
    description: 'Halt WIP and reassign or scrap materials.',
    allowedRoles: ['admin', 'manager', 'management', 'production'],
    requiresRemarks: true
  },
  // Cancel from Partially Dispatched (Requires explicit resolution to avoid orphan partial dispatches - EC 2)
  {
    from: 'partially_dispatched',
    to: 'cancelled',
    actionId: 'cancel_partial_order',
    actionLabel: 'Cancel Partially Dispatched Order',
    description: 'Cancel undelivered balance. Requires confirmation on handling dispatched lot.',
    allowedRoles: ['admin', 'manager', 'management'],
    requiresRemarks: true,
    requiresSpecialResolution: true
  }
];

/**
 * Normalizes legacy order statuses to canonical OrderLifecycleState
 */
export function normalizeOrderState(rawStatus: string | undefined): OrderLifecycleState {
  if (!rawStatus) return 'in_production';
  const s = rawStatus.toLowerCase().trim().replace(/[\s-]+/g, '_');
  
  if (s === 'enquiry' || s === 'rfq' || s === 'draft') return 'enquiry';
  if (s === 'quoted' || s === 'quote_sent') return 'quoted';
  if (s === 'order_confirmed' || s === 'confirmed' || s === 'booked' || s === 'pending') return 'order_confirmed';
  if (s === 'in_production' || s === 'produced' || s === 'wip') return 'in_production';
  if (s === 'partially_dispatched' || s === 'partial_dispatch' || s === 'ready_for_dispatch') return 'partially_dispatched';
  if (s === 'fully_dispatched' || s === 'dispatched' || s === 'shipped') return 'fully_dispatched';
  if (s === 'invoiced' || s === 'billed') return 'invoiced';
  if (s === 'payment_received' || s === 'paid') return 'payment_received';
  if (s === 'closed' || s === 'completed' || s === 'archived') return 'closed';
  if (s === 'cancelled' || s === 'rejected') return 'cancelled';
  
  return 'in_production';
}
