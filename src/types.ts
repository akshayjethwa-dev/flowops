// src/types.ts

export type UserRole = 
  | 'admin'
  | 'manager'
  | 'operator'
  | 'quality_inspector'
  | 'store_keeper'
  | 'viewer'
  | 'sales'
  | 'production'
  | 'dispatch'
  | 'management';

export interface CustomClaims {
  role: UserRole;
  tenantId: string;
  isSuperAdmin?: boolean;
  assignedPlantIds?: string[];
  [key: string]: any;
}

export interface LoginAuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: UserRole;
  loginTimestamp: any;
  ipAddress?: string;
  userAgent?: string;
  authProvider: 'password' | 'google' | 'custom' | 'sandbox';
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  customClaims?: CustomClaims;
}

export interface Tenant {
  id: string;
  companyName: string;
  name?: string;
  plantName?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  currency: string;
  createdAt: any; // Firebase Timestamp or string
  isActive?: boolean; // soft lockout
}

// ═════════════════════════════════════════════════════════════
// STEP 2 CHANGE #1 + #2 — UserProfile
//   • assignedPlantIds  → required (was optional)
//   • defaultPlantId    → new required field
// ═════════════════════════════════════════════════════════════
export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  tenantId: string;
  role: UserRole;
  phone?: string;
  createdAt: any;
  isSuperAdmin?: boolean;
  plantId?: string;

  /** Plants this user may access. Empty array = all plants in the tenant. */
  assignedPlantIds: string[];

  /** Plant the user lands on after sign-in. Must be in assignedPlantIds (if non-empty). */
  defaultPlantId: string;

  assignedStageIds?: string[]; // Scoped Process Stage assignments
  customClaims?: CustomClaims;
}

export interface RFQItem {
  id: string;
  name: string;
  quantity: number;
  specs?: string;
}

export type RfqStatus = 'New' | 'In Progress' | 'Quoted' | 'Won' | 'Lost' | 'pending' | 'quoted' | 'declined';

export type RfqSource = 'Phone' | 'Email' | 'WhatsApp' | 'Walk-in' | 'Web Form';

export interface Rfq {
  id: string;
  rfqNumber?: string;
  tenantId: string;
  plantId?: string; // Scoped Plant
  customerId?: string;
  customerName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  source?: RfqSource;
  dateReceived?: string;
  status: RfqStatus;
  priority?: 'Low' | 'Medium' | 'High';
  description?: string;
  attachments?: string[];
  assignedTo?: string;
  items: RFQItem[];
  requirements?: string;
  createdBy: string;
  createdAt: any;
  orderId?: string;
  expectedDeliveryDate?: string;
  quantity?: number;
  intakeInquiryId?: string;
}

export type RFQ = Rfq;

export type IntakeChannel = 'Email' | 'WhatsApp' | 'Web Form';
export type IntakeStatus = 'pending' | 'converted' | 'archived';

export interface IntakeAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  storagePath?: string;
  contentBase64?: string;
}

export interface IntakeInquiry {
  id: string;
  tenantId: string;
  plantId?: string;
  channel: IntakeChannel;
  sourceIdentifier: string; // e.g., email address, WhatsApp number, web session
  subject?: string;
  rawContent: string;
  receivedAt: string;
  status: IntakeStatus;
  
  // Parsed metadata
  customerName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  city?: string;
  gstNumber?: string;
  priority?: 'Low' | 'Medium' | 'High';
  expectedDeliveryDate?: string;
  description?: string;
  items: RFQItem[];
  attachments: IntakeAttachment[];
  
  // Conversion traces
  convertedRfqId?: string;
  convertedRfqNumber?: string;
  convertedAt?: string;
  convertedBy?: string;
}

export interface EmailInboxConfig {
  protocol: 'IMAP' | 'Graph API';
  host?: string;
  port?: number;
  ssl?: boolean;
  username?: string;
  folder?: string;
  graphTenantId?: string;
  graphClientId?: string;
  lastSyncAt?: string;
  autoSyncEnabled?: boolean;
}

export interface QuoteItem {
  id: string;
  name: string;
  hsn?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  gstPercent: number; // e.g. 18
  total: number;
  specs?: string;
  bomLines?: any[];
  routingStages?: string[];
  orderedQty?: number;
  dispatchedQty?: number;
  dispatchQty?: number;
  remainingQty?: number;
  invoicedQty?: number;
  pendingInvoiceQty?: number;
  dispatchStatus?: 'pending' | 'partially-dispatched' | 'partially_dispatched' | 'fully_dispatched' | 'fulfilled';
  lineItemStatus?: string; // e.g. 'enquiry' | 'quoted' | 'order_confirmed' | 'in_production' | 'partially_dispatched' | 'fully_dispatched' | 'invoiced' | 'payment_received' | 'closed';
  producedQty?: number;
  materialAvailability?: 'available' | 'partially_available' | 'unavailable';
  atpShortfalls?: any[];
  atpSnapshot?: any;
  atpAcknowledgement?: {
    acknowledgedBy: string;
    acknowledgedAt: string;
    reason: string;
  };
}

export interface QuotationTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface QuotationPDFConfig {
  logoUrl?: string;
  themeColor?: string;
  footerText?: string;
}

export interface QuotationVersion {
  version: number;
  downloadUrl: string;
  createdAt: string;
}

import { QuoteApprovalState, QuoteVersionRecord } from './types/quoteApproval';
export * from './types/quoteApproval';

export interface Quote {
  id: string;
  tenantId: string;
  rfqId: string;
  rfqNumber?: string;
  customerId?: string;
  quoteNumber: string;
  customerName: string;
  email?: string;
  phone?: string;
  items: QuoteItem[];
  subtotal: number;
  gstAmount: number;
  discountTotal?: number;
  total: number;
  validUntil?: string;
  date?: string;
  termsAndConditions?: string;
  notes?: string;
  pdfVersion?: number;
  pdfVersions?: QuotationVersion[];
  downloadUrl?: string;
  status: 'draft' | 'pending_approval' | 'sent' | 'approved' | 'rejected' | 'converted';
  plantId?: string;
  createdBy: string;
  createdAt: any;
  approvalState?: QuoteApprovalState;
  versions?: QuoteVersionRecord[];
  currentVersion?: number;
  orderId?: string;
  orderNumber?: string;
  customerPoNumber?: string;
  convertedAt?: string;
  convertedBy?: string;
  bomData?: any;
  routingData?: any;
}

export interface OrderDispatchHistoryItem {
  lineItemId: string;
  name: string;
  orderedQty: number;
  dispatchedQty: number;
  remainingQtyAfter: number;
  unitPrice: number;
  unit?: string;
}

export interface OrderDispatchHistoryEntry {
  dispatchId: string;
  dispatchNumber: string;
  timestamp: string;
  dispatchedAt: string;
  transporter?: string;
  vehicleNumber?: string;
  lrNumber?: string;
  dispatchedBy?: string;
  isPartial: boolean;
  items: OrderDispatchHistoryItem[];
  status: 'Dispatched' | 'Delivered' | 'Cancelled' | 'shipped' | 'delivered';
  backorderId?: string;
  backorderNumber?: string;
}

export interface BackorderItemSnapshot {
  lineItemId: string;
  name: string;
  hsn?: string;
  originalOrderedQty: number;
  dispatchedQty: number;
  backorderQty: number; // Remaining Qty at time of creation
  remainingQty?: number; // Alias for backorderQty
  unit?: string;
  unitPrice: number; // Locked-in pricing terms at time of original order
  discount?: number;
  gstPercent: number;
  total: number;
  specs?: string;
}

export type BackorderStatus = 'open' | 'pending' | 'in_production' | 'ready_for_dispatch' | 'completed' | 'review_required' | 'cancelled' | 'fulfilled';

export interface Backorder {
  id: string;
  tenantId: string;
  backorderNumber: string; // e.g. "BO-ORD-991-01"
  originalOrderId: string;
  orderId?: string; // alias for originalOrderId
  originalOrderNumber: string;
  orderNumber?: string; // alias for originalOrderNumber
  customerPoNumber?: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  phone?: string;
  deliveryDate?: string;
  originalPromisedDate?: string; // Original contract delivery date from parent order
  targetDate?: string; // Independent shopfloor target date (can be rescheduled)
  rescheduledAt?: string;
  rescheduledBy?: string;
  rescheduledReason?: string;
  parentBackorderId?: string; // For recursive backorders (backorder of a backorder)
  parentBackorderNumber?: string;
  deliveryTerms?: string; // original delivery terms preserved
  billingAddress?: string;
  shippingAddress?: string;
  plantId?: string;
  items: BackorderItemSnapshot[];
  totalRemainingQty?: number; // Total units backordered
  totalBackorderValue: number;
  status: BackorderStatus;
  statusReason?: string; // e.g. "Flagged for review due to dispatch cancellation"
  reviewReason?: string; // alias for statusReason
  reviewFlagged?: boolean;
  reviewNotes?: string;
  cancellationCode?: string; // Explicit cancellation reason code
  cancellationReason?: string; // Detailed cancellation notes
  cancelledAt?: string;
  cancelledBy?: string;
  productionStage?: string; // e.g. 'cutting', 'machining', 'ready_for_dispatch'
  productionNotes?: string;
  sourceDispatchId: string;
  sourceDispatchNumber: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export interface Order {
  id: string;
  tenantId: string;
  quoteId: string;
  quoteNumber?: string;
  rfqId?: string;
  rfqNumber?: string;
  customerId?: string;
  orderNumber: string;
  customerPoNumber?: string;
  poDate?: string;
  plantId?: string; // Scoped Plant
  customerName: string;
  customerEmail?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  items: QuoteItem[];
  subtotal?: number;
  taxAmount?: number;
  discountTotal?: number;
  totalAmount: number;
  deliveryDate?: string;
  status: 'pending' | 'in-production' | 'produced' | 'Ready for Dispatch' | 'Partially Dispatched' | 'partially-dispatched' | 'partially_dispatched' | 'Dispatched' | 'dispatched' | 'Fully Dispatched' | 'completed' | 'cancelled' | 'enquiry' | 'quoted' | 'order_confirmed' | 'in_production' | 'fully_dispatched' | 'invoiced' | 'payment_received' | 'closed';
  version?: number; // Optimistic concurrency control for state transitions (EC 3)
  statusHistory?: any[]; // OrderStatusHistoryItem[]
  isOnHold?: boolean; // EC: Order on hold
  holdReason?: string;
  holdActor?: string;
  holdTimestamp?: string;
  cancellationReason?: string; // EC: Order cancelled
  cancellationActor?: string;
  cancellationTimestamp?: string;
  assignedOwner?: string; // Assigned sales / operations owner
  assignedOwnerName?: string;
  dispatchHistory?: OrderDispatchHistoryEntry[];
  backorderIds?: string[];
  bomData?: any;
  routingData?: any;
  termsAndConditions?: string;
  notes?: string;
  hasOverride?: boolean;
  isForceOverridden?: boolean;
  unmetPreconditionWarning?: string;
  lastOverrideReason?: string;
  lastOverrideBy?: string;
  lastOverrideAt?: string;
  shortfallAcknowledgementReason?: string;
  atpSnapshot?: any;
  hasAtpShortfall?: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
}

export interface ProductionStageChange {
  stage: string;
  notes?: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: any;
}

export interface ProductionJob {
  id: string;
  tenantId: string;
  orderId: string;
  orderNumber?: string;
  quoteNumber?: string;
  customerPoNumber?: string;
  plantId?: string; // Scoped Plant
  itemName: string;
  quantity: number;
  currentStage: string;
  stagesHistory: ProductionStageChange[];
  routingStages?: string[];
  bomComponents?: any[];
  unitPrice?: number;
  specs?: string;
  notes?: string;
  updatedBy: string;
  updatedAt: any;
}

export interface Dispatch {
  id: string;
  tenantId: string;
  orderId: string;
  plantId?: string; // Scoped Plant
  jobId?: string;
  dispatchNumber?: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  dispatchDate?: string;
  transporter?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  driverDlNumber?: string;
  dispatchBay?: string;
  carrierGstin?: string;
  carrierDetails?: any;
  ewayBill?: any;
  lrNumber?: string; // Lorry Receipt tracking
  LRNumber?: string; // LRNumber uppercase variant
  destination?: string;
  itemsSummary?: string;
  items: QuoteItem[];
  cartons?: any[];
  totalPackages?: number;
  totalGrossWeightKg?: number;
  totalNetWeightKg?: number;
  totalVolumeCbm?: number;
  trackingRef?: string;
  trackingUrl?: string;
  carrierTrackingUrl?: string;
  deliveredAt?: any;
  deliveredBy?: string;
  deliveryConfirmation?: any;
  whatsappSent?: boolean;
  whatsappSentAt?: any;
  whatsappMessageId?: string;
  isPartialDispatch?: boolean;
  totalRemainingQty?: number;
  backorderId?: string;
  backorderNumber?: string;
  invoiceId?: string;
  isInvoiced?: boolean;
  invoicedAt?: any;
  // GST e-Invoice (IRP) tracking fields
  eInvoice?: any;
  eInvoiceStatus?: 'pending' | 'generated' | 'cancelled' | 'e_invoice_failed' | string;
  eInvoiceFailedReason?: string;
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  signedQrCode?: string;
  // GST e-Way Bill tracking fields
  ewbNumber?: string;
  ewbValidUntil?: string;
  ewbStatus?: 'active' | 'expiring_soon' | 'expired' | 'cancelled' | string;
  ewbDistanceKm?: number;
  transporterId?: string;
  distanceKm?: number;
  // Sales Return & Credit Note tracking fields
  creditNoteIssued?: boolean;
  creditNotesCount?: number;
  lastCreditNoteNumber?: string;
  lastCreditNoteIrn?: string;
  salesReturnRecorded?: boolean;
  salesReturnReason?: string;
  salesReturnDate?: string;
  salesReturnItems?: Array<{ lineItemId: string; returnQty: number; reason?: string }>;
  lines?: any[];
  totalValue?: number;
  status: 'Planned' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'shipped' | 'delivered';
  dispatchedAt: any;
  notes?: string;
}

export interface WhatsAppLog {
  id: string;
  tenantId: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  type: string; // e.g. "order_status", "quote_send", "rfq_receipt"
  sentAt: any;
}

export interface OverdueJobSummary {
  orderId: string;
  orderNumber: string;
  customerName: string;
  itemName: string;
  quantity: number;
  deliveryDate: string;
  overdueDays: number;
  currentStage?: string;
}

export interface DashboardSummary {
  openRfqsCount: number;
  quotesSentLast7DaysCount: number;
  quotesPendingCount: number;
  ordersInProductionCount: number;
  dispatchesTodayCount: number;
  overduePaymentsCount: number;
  lowStockItemsCount: number;
  ordersInProductionByStage: {
    cutting: number;
    welding: number;
    machining: number;
    assembly: number;
    quality_check: number;
    ready: number;
  };
  dispatchesDueTodayCount: number;
  overdueJobsCount: number;
  topOpenRfqs: RFQ[];
  overdueJobs: OverdueJobSummary[];
  recentActivities?: any[];
}

export interface Customer {
  id?: string;
  tenantId: string;
  plantId?: string; // Optional: empty or 'all' means company-wide, otherwise plant-specific
  name: string;
  type: 'customer' | 'dealer';
  contactPerson: string;
  phone: string;
  email: string;
  gstNumber?: string;
  gstin?: string;
  registrationType?: 'regular' | 'composition' | 'unregistered' | 'consumer';
  billingAddress: string;
  shippingAddress: string;
  city: string;
  notes?: string;
  tags?: string[];
  assignedSalesUserId?: string;
  createdAt?: any;
}

export interface CommunicationLogEntry {
  id: string;
  tenantId: string;
  customerId: string;
  channel: 'whatsapp' | 'email' | 'call' | 'note' | 'meeting';
  direction: 'inbound' | 'outbound' | 'internal';
  message: string;
  timestamp: any;
  author?: {
    userId: string;
    displayName: string;
  };
  linkedEntityId?: string;
  linkedEntityType?: 'rfq' | 'order' | 'quote' | 'dispatch' | 'payment';
}

export interface CustomerSummaryStats {
  totalOrders: number;
  openQuotations: number;
  totalBilled: number;
  outstandingBalance: number;
}

export interface RfqSummary {
  id: string;
  createdAt: string;
  status: string;
  itemsCount: number;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  totalAmount: number;
  deliveryDate?: string;
}

export interface WhatsappMessageSummary {
  id: string;
  message: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'pending';
  type: string;
}

export interface QuotationItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number; // e.g. 18 for 18% tax
  lineTotal: number;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected';

export interface Quotation {
  id: string;
  quotationNumber: string;
  tenantId: string;
  rfqId: string;
  customerId: string;
  customerName?: string;
  date: string;
  validityDays: number;
  items: QuotationItem[];
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  status: QuotationStatus;
  notes?: string;
  createdBy?: string;
  createdAt: any;
}

export interface TenantConfig {
  tenantName: string;
  address: string;
  gstNumber: string;
  contactEmail: string;
  contactPhone: string;
  timeZone: string;
  defaultCurrency: string;
  onboardingCompleted?: boolean;
  onboardingState?: OnboardingState;
}

export interface OnboardingState {
  currentStep: number;
  companyName: string;
  address: string;
  gstNumber: string;
  contactEmail: string;
  contactPhone: string;
  defaultCurrency: string;
  productionStages: { id?: string; name: string; color: string; isFinalStage: boolean; order?: number }[];
  firstCustomer: { name: string; contactPerson?: string; email?: string; phone?: string; address?: string; city?: string; billingAddress?: string };
  teamMembers: { name: string; email: string; role: UserRole }[];
  whatsappEnabled: boolean;
  whatsappApiKey?: string;
  whatsappSenderPhone?: string;
  whatsappPhone?: string;
  whatsappBsp?: string;
}

export interface ProductionStageConfig {
  id: string;
  name: string;
  color?: string; // color hex/class e.g., 'blue', 'emerald'
  isFinalStage: boolean;
  order: number;
}

export interface WhatsappConfig {
  bspType: 'AiSensy' | 'Interakt' | 'Other';
  apiKey: string;
  senderPhoneNumber: string;
  status: 'connected' | 'disconnected' | 'pending';
}

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive' | 'Invited';
  lastLogin?: string;
  invitedAt?: string;
  createdAt: any;
  plantId?: string;
}

export type ActivityActionType =
  | 'create'
  | 'update'
  | 'status_change'
  | 'stage_change'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'invited'
  | 'role_change'
  | 'deactivate'
  | 'login'
  | 'logout'
  | 'auth_failure'
  | 'whatsapp_queue'
  | 'whatsapp_sent'
  | 'whatsapp_delivered'
  | 'whatsapp_failed';

export type ActivityEntityType =
  | 'rfq'
  | 'quotation'
  | 'job'
  | 'order'
  | 'dispatch'
  | 'user'
  | 'auth'
  | 'session'
  | 'whatsapp'
  | 'customer';

export interface ActivityEvent {
  id: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: string;
  tenantId: string;
  actor: {
    userId: string;
    displayName: string;
    email?: string;
  };
  timestamp: string;
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
    [key: string]: any;
  };
  
  // Workflow 8 fields
  actorId?: string;
  actorName?: string;
  module?: 'rfq' | 'order' | 'dispatch' | 'payment' | 'inventory' | 'whatsapp';
  action?: string;
  entityLabel?: string;
  isSandboxMode?: boolean;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  uploadedBy: {
    userId: string;
    displayName: string;
    email?: string;
  };
  uploadedAt: string;
  tenantId: string;
  entityType: 'rfq' | 'quotation' | 'job' | 'dispatch';
  entityId: string;
  storagePath?: string;
  downloadUrl: string;
  isLocalSimulated?: boolean;
}

export interface SavedView {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  entityType: 'rfqs' | 'customers' | 'jobs' | 'dispatches';
  filters: Record<string, any>;
  createdAt: string;
}

export interface TenantSummary {
  id: string;
  companyName: string;
  createdAt: any;
  activeUsersCount: number;
  rfqsCount: number;
  jobsCount: number;
  lastActivityAt?: any;
  onboardingStatus?: string; // e.g. 'completed' | 'onboarding'
  isActive: boolean;
}

export interface WhatsAppMessage {
  id: string;
  tenantId: string;
  conversationId: string;
  customerId?: string; // matched customer
  customerName?: string; // matched customer name if found
  senderPhone: string;
  recipientPhone: string;
  direction: 'inbound' | 'outbound';
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video' | 'text';
  mediaName?: string;
  timestamp: any; // Firestore timestamp or string Date
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  templateName?: string;
  templateVariables?: string[];
}

export interface WhatsAppConversation {
  id: string; // usually customer's phone number or customerId
  tenantId: string;
  customerId?: string;
  customerName?: string;
  phone: string;
  lastMessage: string;
  lastTimestamp: any;
  unreadCount: number;
  status: 'unread' | 'unassigned' | 'resolved' | 'active';
  assignedSalesUserId?: string; // sales rep ID
  createdAt: any;
}

export interface WhatsAppTemplate {
  id: string;
  tenantId: string;
  name: string;
  category: 'utility' | 'marketing' | 'authentication' | 'order_status' | 'billing_summary' | 'campaign';
  body: string;
  variables: string[]; // e.g. ["customer_name", "order_no"]
}

export type StockCategory = 'raw_material' | 'finished_goods' | 'consumable' | 'spare';

export interface StockItem {
  id: string;
  tenantId: string;
  plantId?: string; // Scoped Plant
  name: string;
  code: string;
  category: StockCategory;
  currentQty: number;
  unit: string;
  reorderLevel: number;
  lastUpdated: any; // timestamp or string ISO
  updatedBy?: string;
  updatedByName?: string;
}

export interface StockLedgerEntry {
  id: string;
  tenantId: string;
  itemId: string;
  timestamp: any; // timestamp or string ISO
  type: 'inward' | 'outward' | 'adjustment';
  qty: number;
  reason: string;
  updatedBy: string;
  updatedByName: string;
  qtyAfter: number;
}

export interface StockEntryInput {
  type: 'inward' | 'outward' | 'adjustment';
  qty: number;
  reason: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'issued' | 'cancelled';

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  paymentMode: 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'other';
  referenceNo?: string;
  notes?: string;
  recordedBy: string;
  recordedByName: string;
}

export interface Invoice {
  id: string; // matches invoiceNo or generated UUID/ID
  invoiceNumber: string;
  tenantId: string;
  orderId: string;
  orderNumber: string;
  dispatchId?: string;
  dispatchNumber?: string;
  ewayBillNumber?: string;
  lrNumber?: string;
  transporter?: string;
  vehicleNumber?: string;
  plantId?: string; // Scoped Plant
  customerId: string;
  customerName: string;
  customerPhone?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  subtotal?: number;
  taxAmount?: number;
  taxBreakdown?: {
    cgst?: number;
    sgst?: number;
    igst?: number;
    hsnCode?: string;
    rate?: number;
    [key: string]: any;
  };
  total: number;
  totalPaid: number;
  outstanding: number;
  status: InvoiceStatus;
  createdByName: string;
  createdBy: string;
  createdAt: any;
  sentAt?: string;
  reminderSentAt?: string;
  lastReminderSentAt?: string;
  reminderCount?: number;
  items?: any[];
  lines?: any[];
  currency?: string;
  type?: string;
  irn?: string;
  eInvoice?: any;
  isPartialInvoice?: boolean;
  creditNoteIds?: string[];
  totalCredited?: number;
  tallySyncStatus?: string;
  tallySyncRef?: string;
  tallySyncedAt?: string;
  oracleSyncStatus?: string;
  oracleSyncRef?: string;
  oracleSyncedAt?: string;
  erpSyncLogs?: any[];
}

export interface CreditNoteItem {
  lineItemId: string;
  name: string;
  hsn?: string;
  returnQty: number;
  unitPrice: number;
  gstPercent: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmount: number;
  reason?: string;
}

export interface CreditNote {
  id: string; // e.g. "CN-INV-1001-01"
  creditNoteNumber: string;
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
  dispatchId?: string;
  dispatchNumber?: string;
  orderId?: string;
  orderNumber?: string;
  customerId?: string;
  customerName?: string;
  issueDate: string;
  reason: string;
  items: CreditNoteItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: 'issued' | 'applied' | 'cancelled';
  createdBy: string;
  createdByName: string;
  createdAt: string;
  originalIrn?: string; // Referenced parent invoice IRN
  creditNoteIrn?: string; // Statutory 64-hex Credit Note IRN from IRP
  ackNo?: string;
  ackDate?: string;
  signedQrCode?: string;
  qrCodeDataUrl?: string;
  irpResponse?: any;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  customerName: string;
  dueDate: string;
  total: number;
  paid: number;
  outstanding: number;
  status: InvoiceStatus;
}

export interface OutstandingStats {
  totalOutstanding: number;
  totalOverdue: number;
  totalBilled: number;
  totalCollectedThisMonth: number;
}

// ==========================================
// CUSTOMER & DEALER SELF-SERVICE PORTAL TYPES
// ==========================================

export interface PortalUser {
  uid: string;
  phone: string;
  customerId: string; // references customer record in customers collection
  customerName: string;
  tenantId: string;
  createdAt: string;
  lastLoginAt?: string;
  email?: string;
}

export type CustomerOrderStatus = 'pending_confirmation' | 'confirmed' | 'cancelled' | 'Dispatched' | 'dispatched';

export interface CustomerOrderComponent {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  total?: number;
}

export interface CustomerOrder {
  id: string; // Unique order or path ID
  orderNumber: string; // Branded incremental number e.g. C-ORD-83921
  tenantId: string;
  customerId: string;
  customerName: string;
  items: CustomerOrderComponent[];
  deliveryAddress: string;
  requestedDeliveryDate: string;
  notes?: string;
  status: CustomerOrderStatus;
  isBotOrder: boolean; // True if created via the WhatsApp code flow matches
  createdByDevice?: 'web' | 'whatsapp';
  createdAt: string;
  convertedToInternalOrderId?: string; // Links to internal orders table once confirmed
}

export type BotFlowStep = 
  | 'IDLE' 
  | 'AWAITING_ORDER_PARTICULARS' 
  | 'AWAITING_ADDRESS_RESOLUTION' 
  | 'AWAITING_DELIVERY_DATE' 
  | 'COMPLETED';

export interface BotSession {
  phone: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  currentStep: BotFlowStep;
  lastActiveAt: string; // ISO string to gauge 30min expiration
  collectedOrderItems?: { productName: string; qtyStr: string }[];
  collectedAddress?: string;
  collectedDeliveryDate?: string;
}

export type NotificationType = 
  | "payment_overdue" 
  | "low_stock" 
  | "order_delayed" 
  | "new_rfq" 
  | "dispatch_sent" 
  | "stage_changed" 
  | "order_override"
  | "reminder_sent"
  | "quote_approval_request"
  | "quote_approved"
  | "quote_rejected";

export interface AppNotification {
  id: string;
  tenantId: string;
  userId: string; // recipient uid or "all"
  type: NotificationType;
  title: string;
  message: string;
  entityId: string;
  entityType: 'payment' | 'order' | 'rfq' | 'inventory' | 'quote' | 'quotation';
  link: string;
  read: boolean;
  createdAt: any;
}

/**
 * @deprecated Use `PlantExtended` (re-exported below and defined in ./types/plant).
 *             The two types overlap but `PlantExtended` adds `timezone` and
 *             `shiftPatterns`. Kept for backward compatibility with existing code.
 */
export interface Plant {
  id: string;
  tenantId: string;
  name: string;
  location: string;
  gstin?: string;
  processStages: ProductionStageConfig[];
  createdAt: string;
}

// ═════════════════════════════════════════════════════════════
// STEP 2 CHANGE #3 — Re-exports from ./types/plant
//   Lets AuthContext (and any future code) import PlantExtended,
//   WorkCenter, ShiftPattern, and Organization from a single place.
// ═════════════════════════════════════════════════════════════
export type {
  PlantExtended,
  WorkCenter,
  ShiftPattern,
  Organization,
} from './types/plant';

export * from './types/subcontractor';
export * from './types/workOrder';
export * from './types/inventoryLocation';
export * from './types/barcodeMovement';
export * from './types/mrp';
export * from './types/purchaseOrder';
export * from './types/dispatchManagement';
export type {
  StockReservationStatus,
  StockReservationSummary,
  ManualReleaseRequest,
  WriteOffRequest
} from './types/stockReservation';
export type {
  EwbVehicleType,
  EwbTransportMode,
  EWayBillPartBHistory,
  EWayBillExtensionHistory,
  EWayBillData,
  EWayBillValidationResult,
  EWayBillConfig
} from './types/ewayBill';