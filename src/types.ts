// src/types.ts

export type UserRole = 'admin' | 'sales' | 'production' | 'dispatch' | 'management';

export interface Tenant {
  id: string;
  companyName: string;
  gstin?: string;
  address?: string;
  currency: string;
  createdAt: any; // Firebase Timestamp or string
  isActive?: boolean; // soft lockout
}

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
  assignedPlantIds?: string[]; // Scoped Plant assignments
  assignedStageIds?: string[]; // Scoped Process Stage assignments
}

export interface RFQItem {
  id: string;
  name: string;
  quantity: number;
  specs?: string;
}

export type RfqStatus = 'New' | 'In Progress' | 'Quoted' | 'Won' | 'Lost' | 'pending' | 'quoted' | 'declined';

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
  source?: 'Phone' | 'Email' | 'WhatsApp' | 'Walk-in';
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
}

export type RFQ = Rfq;

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

export interface Quote {
  id: string;
  tenantId: string;
  rfqId: string;
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
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  plantId?: string;
  createdBy: string;
  createdAt: any;
}

export interface Order {
  id: string;
  tenantId: string;
  quoteId: string;
  orderNumber: string;
  plantId?: string; // Scoped Plant
  customerName: string;
  phone?: string;
  items: QuoteItem[];
  totalAmount: number;
  deliveryDate?: string;
  status: 'pending' | 'in-production' | 'produced' | 'dispatched' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: any;
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
  plantId?: string; // Scoped Plant
  itemName: string;
  quantity: number;
  currentStage: string;
  stagesHistory: ProductionStageChange[];
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
  driverName?: string;
  driverPhone?: string;
  lrNumber?: string; // Lorry Receipt tracking
  LRNumber?: string; // LRNumber uppercase variant
  destination?: string;
  itemsSummary?: string;
  items: QuoteItem[];
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
  teamMembers: { name: string; email: string; role: 'admin' | 'sales' | 'production' | 'dispatch' | 'management' }[];
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
  | 'whatsapp_queue'
  | 'whatsapp_sent'
  | 'whatsapp_delivered'
  | 'whatsapp_failed';

export type ActivityEntityType =
  | 'rfq'
  | 'quotation'
  | 'job'
  | 'dispatch'
  | 'user'
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

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue';

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
  plantId?: string; // Scoped Plant
  customerId: string;
  customerName: string;
  customerPhone?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  taxAmount?: number;
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
  | "reminder_sent";

export interface AppNotification {
  id: string;
  tenantId: string;
  userId: string; // recipient uid or "all"
  type: NotificationType;
  title: string;
  message: string;
  entityId: string;
  entityType: 'payment' | 'order' | 'rfq' | 'inventory';
  link: string;
  read: boolean;
  createdAt: any;
}

export interface Plant {
  id: string;
  tenantId: string;
  name: string;
  location: string;
  gstin?: string;
  processStages: ProductionStageConfig[];
  createdAt: string;
<<<<<<< HEAD
}

// ==========================================
// MASTER DATA & FOUNDATION TYPES
// ==========================================

export interface UomMaster {
  id: string;
  name: string;
  base_unit?: string; // Matches Prisma String?
  category?: string; // Matches Prisma String?
  createdAt?: string;
  updatedAt?: string;
}

export interface UomConversion {
  id: string;
  from_uom_id: string;
  to_uom_id: string;
  multiplier: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  gst?: string;
  contact?: string;
  payment_terms?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  sku: string;
  default_uom_id: string;
  standard_cost: number;
  reorder_level: number;
  supplier_id?: string; // Matches Prisma String?
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductMaterial {
  id: string;
  product_id: string;
  raw_material_id: string;
  quantity_per_unit: number;
  wastage_percent: number;
  consumption_stage_id?: string;
  createdAt?: string;
  updatedAt?: string;
=======
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
}