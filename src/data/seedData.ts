// src/data/seedData.ts

import { 
  Customer, 
  Rfq, 
  Order, 
  ProductionJob, 
  Dispatch, 
  StockItem, 
  Invoice, 
  WhatsAppConversation, 
  WhatsAppMessage, 
  ActivityEvent,
  TenantConfig
} from '../types';

export const SEED_TENANT_ID = "demo-tenant-001";

// 1. Customers
export const seedCustomers: Customer[] = [
  {
    id: "demo-customer-001",
    tenantId: SEED_TENANT_ID,
    name: "Mahindra Tractors Ltd",
    type: "dealer",
    contactPerson: "Rajesh Kumar",
    phone: "+919876543210",
    email: "rajesh.kumar@mahindra.com",
    gstNumber: "24AADCM0012B1Z1",
    billingAddress: "Plot No. 45-48, GIDC Industrial Estate, Kandla Road, Gandhidham, Gujarat 370201",
    shippingAddress: "Yard B, GIDC, Gandhidham, Gujarat 370201",
    city: "Gandhidham",
    notes: "Key dealer account. Strict on delivery timelines.",
    createdAt: "2026-05-10T08:00:00Z"
  },
  {
    id: "demo-customer-002",
    tenantId: SEED_TENANT_ID,
    name: "Bharat Heavy Electricals Ltd",
    type: "customer",
    contactPerson: "Amit Sharma",
    phone: "+919123456780",
    email: "a.sharma@bhel.in",
    gstNumber: "07AADCB2204H1Z2",
    billingAddress: "BHEL House, Siri Fort, New Delhi, Delhi 110049",
    shippingAddress: "Haridwar Plant Yard, BHEL, Uttarakhand 249403",
    city: "Delhi",
    notes: "Industrial PSU account. Requires standard bidding and verification documentation.",
    createdAt: "2026-05-01T09:30:00Z"
  },
  {
    id: "demo-customer-003",
    tenantId: SEED_TENANT_ID,
    name: "Cement Corp India",
    type: "customer",
    contactPerson: "S. K. Joshi",
    phone: "+919555123456",
    email: "sk.joshi@cci.gov.in",
    gstNumber: "08AADCC3305K1Z3",
    billingAddress: "CCI Building, Core-V, SCOPE Complex, New Delhi 110003",
    shippingAddress: "Adityapuram Cement Factory, Nimbahera, Rajasthan 312601",
    city: "Rajasthan",
    notes: "Requires high-durability bevel and helical gear setups for heavy conveyor systems.",
    createdAt: "2026-05-12T11:45:00Z"
  },
  {
    id: "demo-customer-004",
    tenantId: SEED_TENANT_ID,
    name: "Atlas Engineering Works",
    type: "dealer",
    contactPerson: "Milind Kulkarni",
    phone: "+919822012345",
    email: "info@atlasengineering.co.in",
    gstNumber: "27AADCA8844D1Z4",
    billingAddress: "S-55, MIDC Bhosari, Pune, Maharashtra 411026",
    shippingAddress: "S-55, MIDC Bhosari, Pune, Maharashtra 411026",
    city: "Pune",
    notes: "Regular dealer matching Pune industrial clients with custom spares.",
    createdAt: "2026-05-15T14:15:00Z"
  }
];

// 2. RFQs
export const seedRfqs: Rfq[] = [
  {
    id: "demo-rfq-001",
    rfqNumber: "RFQ-001",
    tenantId: SEED_TENANT_ID,
    customerId: "demo-customer-001",
    customerName: "Mahindra Tractors Ltd",
    contactName: "Rajesh Kumar",
    phone: "+919876543210",
    email: "rajesh.kumar@mahindra.com",
    source: "Email",
    status: "New",
    priority: "High",
    description: "Helical Gearbox 5T, high-frequency usage in rough agriculture conditions.",
    items: [
      {
        id: "rfq-item-001",
        name: "Helical Gearbox 5T",
        quantity: 3,
        specs: "Input 1440 RPM, output 50 RPM, foot mounted, service factor 1.5"
      }
    ],
    createdBy: "demo-user-001",
    createdAt: "2026-05-29T10:00:00Z"
  },
  {
    id: "demo-rfq-002",
    rfqNumber: "RFQ-002",
    tenantId: SEED_TENANT_ID,
    customerId: "demo-customer-002",
    customerName: "Bharat Heavy Electricals Ltd",
    contactName: "Amit Sharma",
    phone: "+919123456780",
    email: "a.sharma@bhel.in",
    source: "WhatsApp",
    status: 'quoted',
    priority: "Medium",
    description: "Worm Gear Reducer assembly components matching industrial specifications.",
    items: [
      {
        id: "rfq-item-002",
        name: "Worm Gear Reducer",
        quantity: 10,
        specs: "Ratio 40:1, center distance 3.0 inches, solid shaft input and output"
      }
    ],
    createdBy: "demo-user-001",
    createdAt: "2026-05-02T12:00:00Z"
  },
  {
    id: "demo-rfq-003",
    rfqNumber: "RFQ-003",
    tenantId: SEED_TENANT_ID,
    customerId: "demo-customer-003",
    customerName: "Cement Corp India",
    contactName: "S. K. Joshi",
    phone: "+919555123456",
    email: "sk.joshi@cci.gov.in",
    source: "Phone",
    status: 'declined', // maps to 'Won' / won state after being converted
    priority: "High",
    description: "Bevel Gearbox for stone crushers at the Nimbahera site yards.",
    items: [
      {
        id: "rfq-item-003",
        name: "Bevel Gearbox",
        quantity: 2,
        specs: "90-degree transmission, ratio 1:1, case hardened steel housing"
      }
    ],
    orderId: "demo-order-001",
    createdBy: "demo-user-001",
    createdAt: "2026-05-10T14:30:00Z"
  },
  {
    id: "demo-rfq-004",
    rfqNumber: "RFQ-004",
    tenantId: SEED_TENANT_ID,
    customerId: "demo-customer-004",
    customerName: "Atlas Engineering Works",
    contactName: "Milind Kulkarni",
    phone: "+919822012345",
    email: "info@atlasengineering.co.in",
    source: "Email",
    status: 'declined', // Lost
    priority: "Low",
    description: "Conveyor Drive Units to match third-party assembly frames.",
    items: [
      {
        id: "rfq-item-004",
        name: "Conveyor Drive Unit",
        quantity: 5,
        specs: "3HP electric motor linked with inline helical gear transmission"
      }
    ],
    createdBy: "demo-user-001",
    createdAt: "2026-05-15T15:00:00Z"
  },
  {
    id: "demo-rfq-005",
    rfqNumber: "RFQ-005",
    tenantId: SEED_TENANT_ID,
    customerId: "demo-customer-001",
    customerName: "Mahindra Tractors Ltd",
    contactName: "Rajesh Kumar",
    phone: "+919876543210",
    email: "rajesh.kumar@mahindra.com",
    source: "Walk-in",
    status: "New",
    priority: "Medium",
    description: "Custom Gearbox Assembly for specific prototype tractors.",
    items: [
      {
        id: "rfq-item-005",
        name: "Custom Gearbox Assembly",
        quantity: 1,
        specs: "Heavy duty planetary gearbox layout with 4-way shaft splitter"
      }
    ],
    createdBy: "demo-user-001",
    createdAt: "2026-06-02T16:00:00Z"
  }
];

// Update status representation for RFQ-003 and RFQ-004 to cleanly match type limits
seedRfqs[2].status = "Won" as any;
seedRfqs[3].status = "Lost" as any;

// Helper quote items used to build nested fields in orders
const quoteItemsOF001 = [
  { id: "qi-1", name: "Bevel Gearbox", hsn: "8483", quantity: 2, unit: "pcs", unitPrice: 50212, total: 100424, gstPercent: 18 }
];
const quoteItemsOF002 = [
  { id: "qi-2", name: "Helical Gear Set", hsn: "8483", quantity: 6, unit: "set", unitPrice: 34604, total: 207624, gstPercent: 18 }
];
const quoteItemsOF003 = [
  { id: "qi-3", name: "Pinion Shaft", hsn: "8483", quantity: 10, unit: "pcs", unitPrice: 7372, total: 73720, gstPercent: 18 }
];
const quoteItemsOF004 = [
  { id: "qi-4", name: "Worm Shaft Assembly", hsn: "8483", quantity: 1, unit: "set", unitPrice: 271186, total: 271186, gstPercent: 18 }
];

// 3. Orders
export const seedOrders: Order[] = [
  {
    id: "demo-order-001",
    tenantId: SEED_TENANT_ID,
    quoteId: "demo-quote-001",
    orderNumber: "OF-2024-001",
    customerName: "Cement Corp India",
    phone: "+919555123456",
    items: quoteItemsOF001,
    totalAmount: 118500,
    deliveryDate: "2026-06-15",
    status: "in-production",
    createdBy: "demo-user-001",
    createdAt: "2026-05-14T12:00:00Z"
  },
  {
    id: "demo-order-002",
    tenantId: SEED_TENANT_ID,
    quoteId: "demo-quote-002",
    orderNumber: "OF-2024-002",
    customerName: "Bharat Heavy Electricals Ltd",
    phone: "+919123456780",
    items: quoteItemsOF002,
    totalAmount: 245000,
    deliveryDate: "2026-06-25",
    status: "in-production",
    createdBy: "demo-user-001",
    createdAt: "2026-05-04T12:00:00Z"
  },
  {
    id: "demo-order-003",
    tenantId: SEED_TENANT_ID,
    quoteId: "demo-quote-003",
    orderNumber: "OF-2024-003",
    customerName: "Atlas Engineering Works",
    phone: "+919822012345",
    items: quoteItemsOF003,
    totalAmount: 87000,
    deliveryDate: "2026-06-01",
    status: "dispatched",
    createdBy: "demo-user-001",
    createdAt: "2026-05-29T12:00:00Z"
  },
  {
    id: "demo-order-004",
    tenantId: SEED_TENANT_ID,
    quoteId: "demo-quote-004",
    orderNumber: "OF-2024-004",
    customerName: "Mahindra Tractors Ltd",
    phone: "+919876543210",
    items: quoteItemsOF004,
    totalAmount: 320000,
    deliveryDate: "2026-06-03",
    status: "dispatched",
    createdBy: "demo-user-001",
    createdAt: "2026-05-15T12:00:00Z"
  }
];

// 4. Production Jobs (tied to Orders and representing their shopfloor stage)
export const seedProductionJobs: ProductionJob[] = [
  {
    id: "demo-job-001",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-001",
    itemName: "Bevel Gearbox",
    quantity: 2,
    currentStage: "machining",
    stagesHistory: [
      {
        stage: "cutting",
        notes: "Raw forging items sized and block prepared on band saw.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-05-15T09:00:00Z"
      },
      {
        stage: "machining",
        notes: "Precision CNC housing facing and pilot bore calibration underway.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-05-16T14:30:00Z"
      }
    ],
    notes: "Requires exact dimensional match for stone crusher drive hubs.",
    updatedBy: "demo-user-001",
    updatedAt: "2026-05-16T14:30:00Z"
  },
  {
    id: "demo-job-002",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-002",
    itemName: "Helical Gear Set",
    quantity: 6,
    currentStage: "welding", // Represents Heat Treatment / Pre-Heating
    stagesHistory: [
      {
        stage: "cutting",
        notes: "6 gears blanks cut out of EN24 alloy bars.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-05-05T09:00:00Z"
      },
      {
        stage: "welding",
        notes: "Carbonization case-hardening in primary salt bath furnace.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-05-07T11:00:00Z"
      }
    ],
    notes: "Achieve deep wear hardness depth exceeding 1.2 mil.",
    updatedBy: "demo-user-001",
    updatedAt: "2026-05-07T11:00:00Z"
  },
  {
    id: "demo-job-003",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-003",
    itemName: "Pinion Shaft",
    quantity: 10,
    currentStage: "quality_check", // QC / Inspection
    stagesHistory: [
      {
        stage: "cutting",
        notes: "Alloy steel cut to custom layout lengths.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-05-30T09:00:00Z"
      },
      {
        stage: "machining",
        notes: "Teeth hobbing and spline milling run.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-05-31T12:00:00Z"
      },
      {
        stage: "quality_check",
        notes: "Surface roughness (Ra 0.8) and concentricity inspection.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-06-01T15:00:00Z"
      }
    ],
    notes: "High fidelity required for heavy machinery linkages.",
    updatedBy: "demo-user-001",
    updatedAt: "2026-06-01T15:00:00Z"
  },
  {
    id: "demo-job-004",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-004",
    itemName: "Worm Shaft Assembly",
    quantity: 1,
    currentStage: "ready", // Ready for Dispatch
    stagesHistory: [
      {
        stage: "cutting",
        notes: "Grounded blank sized.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-05-16T09:00:00Z"
      },
      {
        stage: "machining",
        notes: "High efficiency lead thread grinding done.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2025-05-20T11:00:00Z"
      },
      {
        stage: "assembly",
        notes: "Bearings pressed and assembled onto the primary hub.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-05-28T16:00:00Z"
      },
      {
        stage: "ready",
        notes: "Quality clearance stamped.",
        updatedBy: "demo-user-001",
        updatedByName: "Amit Sharma",
        updatedAt: "2026-06-03T10:00:00Z"
      }
    ],
    notes: "Tolerances verified on profile projection unit.",
    updatedBy: "demo-user-001",
    updatedAt: "2026-06-03T10:00:00Z"
  }
];

// 5. Dispatches
export const seedDispatches: Dispatch[] = [
  {
    id: "demo-dispatch-001",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-003",
    jobId: "demo-job-003",
    dispatchNumber: "DSP-2024-001",
    invoiceNumber: "INV-003",
    customerId: "demo-customer-004",
    customerName: "Atlas Engineering Works",
    dispatchDate: "2026-06-01",
    transporter: "Shree Mahalaxmi Transport",
    vehicleNumber: "MH-12-PQ-4451",
    driverName: "Dharmesh Pal",
    driverPhone: "+919988112233",
    lrNumber: "SML-4421",
    LRNumber: "SML-4421",
    destination: "Pune Yard",
    itemsSummary: "Pinion Shaft x10",
    items: quoteItemsOF003,
    status: "Dispatched",
    dispatchedAt: "2026-06-01T10:00:00Z",
    notes: "Freight paid on delivery basis."
  },
  {
    id: "demo-dispatch-002",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-004",
    jobId: "demo-job-004",
    dispatchNumber: "DSP-2024-002",
    invoiceNumber: "INV-004",
    customerId: "demo-customer-001",
    customerName: "Mahindra Tractors Ltd",
    dispatchDate: "2026-06-03",
    transporter: "Blue Dart",
    vehicleNumber: "MH-14-BD-8821",
    driverName: "Satish Rao",
    driverPhone: "+919922334455",
    lrNumber: "BD-8821",
    LRNumber: "BD-8821",
    destination: "Gandhidham Plant",
    itemsSummary: "Worm Shaft Assembly x1",
    items: quoteItemsOF004,
    status: "Dispatched",
    dispatchedAt: "2026-06-03T15:00:00Z",
    notes: "Priority air dispatch overnight."
  }
];

// 6. StockItems/Inventory Items
export const seedStockItems: StockItem[] = [
  {
    id: "demo-stock-001",
    tenantId: SEED_TENANT_ID,
    name: "EN8 Steel Bar",
    code: "RM-EN8-001",
    category: 'raw_material',
    currentQty: 45,
    unit: "kg",
    reorderLevel: 20,
    lastUpdated: "2026-06-01T09:00:00Z",
    updatedBy: "demo-user-001",
    updatedByName: "Amit Sharma"
  },
  {
    id: "demo-stock-002",
    tenantId: SEED_TENANT_ID,
    name: "Alloy Steel Billet",
    code: "RM-ASB-002",
    category: 'raw_material',
    currentQty: 12,
    unit: "pcs",
    reorderLevel: 10,
    lastUpdated: "2026-06-02T11:00:00Z",
    updatedBy: "demo-user-001",
    updatedByName: "Amit Sharma"
  },
  {
    id: "demo-stock-003",
    tenantId: SEED_TENANT_ID,
    name: "Copper Bushing",
    code: "SP-CB-003",
    category: 'spare',
    currentQty: 8,
    unit: "pcs",
    reorderLevel: 15, // Below min -> warning
    lastUpdated: "2026-06-03T10:15:00Z",
    updatedBy: "demo-user-001",
    updatedByName: "Amit Sharma"
  },
  {
    id: "demo-stock-004",
    tenantId: SEED_TENANT_ID,
    name: "Bearing SKF 6205",
    code: "SP-BRG-004",
    category: 'spare',
    currentQty: 32,
    unit: "pcs",
    reorderLevel: 10,
    lastUpdated: "2026-06-03T09:45:00Z",
    updatedBy: "demo-user-001",
    updatedByName: "Amit Sharma"
  },
  {
    id: "demo-stock-005",
    tenantId: SEED_TENANT_ID,
    name: "Gear Blank 200mm",
    code: "RM-GB-005",
    category: 'raw_material',
    currentQty: 6,
    unit: "pcs",
    reorderLevel: 8, // Below min -> warning
    lastUpdated: "2026-06-01T15:30:00Z",
    updatedBy: "demo-user-001",
    updatedByName: "Amit Sharma"
  },
  {
    id: "demo-stock-006",
    tenantId: SEED_TENANT_ID,
    name: "Moly Grease 5kg",
    code: "CO-MG-006",
    category: 'consumable',
    currentQty: 18,
    unit: "tins",
    reorderLevel: 5,
    lastUpdated: "2026-05-28T08:00:00Z",
    updatedBy: "demo-user-001",
    updatedByName: "Amit Sharma"
  }
];

// 7. Payment (Invoices) Records
export const seedInvoices: Invoice[] = [
  {
    id: "demo-invoice-001",
    invoiceNumber: "INV-001",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-002",
    orderNumber: "OF-2024-002",
    customerId: "demo-customer-002",
    customerName: "Bharat Heavy Electricals Ltd",
    customerPhone: "+919123456780",
    invoiceDate: "2026-05-04",
    dueDate: "2026-05-19", // Due 15 days ago (since today is June 3, 2026) -> OVERDUE
    amount: 207627,
    taxAmount: 37373,
    total: 245000,
    totalPaid: 0,
    outstanding: 245000,
    status: "overdue",
    createdBy: "system",
    createdByName: "System Process",
    createdAt: "2026-05-04T12:00:00Z"
  },
  {
    id: "demo-invoice-002",
    invoiceNumber: "INV-002",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-001",
    orderNumber: "OF-2024-001",
    customerId: "demo-customer-003",
    customerName: "Cement Corp India",
    customerPhone: "+919555123456",
    invoiceDate: "2026-05-14",
    dueDate: "2026-05-29", // Due 5 days ago -> OVERDUE
    amount: 100424,
    taxAmount: 18076,
    total: 118500,
    totalPaid: 0,
    outstanding: 118500,
    status: "overdue",
    createdBy: "system",
    createdByName: "System Process",
    createdAt: "2026-05-14T12:00:00Z"
  },
  {
    id: "demo-invoice-003",
    invoiceNumber: "INV-003",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-003",
    orderNumber: "OF-2024-003",
    customerId: "demo-customer-004",
    customerName: "Atlas Engineering Works",
    customerPhone: "+919822012345",
    invoiceDate: "2026-05-29",
    dueDate: "2026-06-13", // Due in 10 days -> PENDING
    amount: 73729,
    taxAmount: 13271,
    total: 87000,
    totalPaid: 0,
    outstanding: 87000,
    status: "sent",
    createdBy: "system",
    createdByName: "System Process",
    createdAt: "2026-05-29T12:00:00Z"
  },
  {
    id: "demo-invoice-004",
    invoiceNumber: "INV-004",
    tenantId: SEED_TENANT_ID,
    orderId: "demo-order-004",
    orderNumber: "OF-2024-004",
    customerId: "demo-customer-001",
    customerName: "Mahindra Tractors Ltd",
    customerPhone: "+919876543210",
    invoiceDate: "2026-05-15",
    dueDate: "2026-05-30", // Paid 3 days ago
    amount: 271186,
    taxAmount: 48814,
    total: 320000,
    totalPaid: 320000,
    outstanding: 0,
    status: "paid",
    createdBy: "system",
    createdByName: "System Process",
    createdAt: "2026-05-15T12:00:00Z"
  }
];

// 8. WhatsApp Chats (Threads + Messages subcollections)
export const seedWhatsAppConversations: WhatsAppConversation[] = [
  {
    id: "919876543210", // Mahindra phone
    tenantId: SEED_TENANT_ID,
    customerId: "demo-customer-001",
    customerName: "Mahindra Tractors Ltd",
    phone: "+919876543210",
    lastMessage: 'Update: Worm Shaft Assembly is now in the "Ready for Dispatch" stage.',
    lastTimestamp: "2026-06-03T10:05:00Z",
    unreadCount: 0,
    status: "active",
    createdAt: "2026-05-15T12:00:00Z"
  },
  {
    id: "919123456780", // BHEL phone
    tenantId: SEED_TENANT_ID,
    customerId: "demo-customer-002",
    customerName: "Bharat Heavy Electricals Ltd",
    phone: "+919123456780",
    lastMessage: "Dear Amit, this is a friendly reminder that Invoice INV-001 is now overdue.",
    lastTimestamp: "2026-05-31T11:00:00Z",
    unreadCount: 1,
    status: "unread",
    createdAt: "2026-05-02T12:00:00Z"
  },
  {
    id: "919555123456", // Cement Corp phone
    tenantId: SEED_TENANT_ID,
    customerId: "demo-customer-003",
    customerName: "Cement Corp India",
    phone: "+919555123456",
    lastMessage: "Hello Joshi, your dispatch for Bevel Gearbox x2 has been shipped via Shree Mahalaxmi Transport, LR: SML-4421.",
    lastTimestamp: "2026-06-01T10:20:00Z",
    unreadCount: 0,
    status: "resolved",
    createdAt: "2026-05-10T14:30:00Z"
  },
  {
    id: "919822012345", // Atlas phone
    tenantId: SEED_TENANT_ID,
    customerId: "demo-customer-004",
    customerName: "Atlas Engineering Works",
    phone: "+919822012345",
    lastMessage: "Thanks Milind, we have received your RFQ and it is currently being evaluated by our engineering team.",
    lastTimestamp: "2026-06-02T15:30:00Z",
    unreadCount: 0,
    status: "active",
    createdAt: "2026-05-15T15:00:00Z"
  },
  {
    id: "919000000000", // Internal phone for Purchasing alerts
    tenantId: SEED_TENANT_ID,
    customerName: "Internal Procurement Node",
    phone: "+919000000000",
    lastMessage: "ALERT: 'Copper Bushing' is below minimum stock limit. Proceed with PO verification.",
    lastTimestamp: "2026-06-03T11:00:00Z",
    unreadCount: 0,
    status: "active",
    createdAt: "2026-05-20T08:00:00Z"
  }
];

// WhatsAppMessages
export const seedWhatsAppMessages: WhatsAppMessage[] = [
  // 1. Mahindra Chat
  {
    id: "demo-msg-001",
    tenantId: SEED_TENANT_ID,
    conversationId: "919876543210",
    customerId: "demo-customer-001",
    customerName: "Mahindra Tractors Ltd",
    senderPhone: "+912261234567",
    recipientPhone: "+919876543210",
    direction: "outbound",
    message: "Hi Rajesh, your order OF-2024-004 has been received and confirmed. We're on it!",
    timestamp: "2026-05-30T10:00:00Z",
    status: "read",
    mediaType: "text"
  },
  {
    id: "demo-msg-002",
    tenantId: SEED_TENANT_ID,
    conversationId: "919876543210",
    customerId: "demo-customer-001",
    customerName: "Mahindra Tractors Ltd",
    senderPhone: "+912261234567",
    recipientPhone: "+919876543210",
    direction: "outbound",
    message: 'Update: Worm Shaft Assembly is now in the "Ready for Dispatch" stage. We will notify you once dispatched.',
    timestamp: "2026-06-03T10:05:00Z",
    status: "read",
    mediaType: "text"
  },
  // 2. BHEL Chat
  {
    id: "demo-msg-003",
    tenantId: SEED_TENANT_ID,
    conversationId: "919123456780",
    customerId: "demo-customer-002",
    customerName: "Bharat Heavy Electricals Ltd",
    senderPhone: "+912261234567",
    recipientPhone: "+919123456780",
    direction: "outbound",
    message: "Dear Amit, this is a friendly reminder that Invoice INV-001 is now overdue. Please let us know if you need any assistance.",
    timestamp: "2026-05-31T11:00:00Z",
    status: "delivered",
    mediaType: "text"
  },
  // 3. Cement Corp Chat
  {
    id: "demo-msg-004",
    tenantId: SEED_TENANT_ID,
    conversationId: "919555123456",
    customerId: "demo-customer-003",
    customerName: "Cement Corp India",
    senderPhone: "+912261234567",
    recipientPhone: "+919555123456",
    direction: "outbound",
    message: "Hello Joshi, your dispatch for Bevel Gearbox x2 has been shipped via Shree Mahalaxmi Transport, LR: SML-4421. Thank you!",
    timestamp: "2026-06-01T10:20:00Z",
    status: "read",
    mediaType: "text"
  },
  // 4. Atlas Chat
  {
    id: "demo-msg-005",
    tenantId: SEED_TENANT_ID,
    conversationId: "919822012345",
    customerId: "demo-customer-004",
    customerName: "Atlas Engineering Works",
    senderPhone: "+919822012345",
    recipientPhone: "+912261234567",
    direction: "inbound",
    message: "Hi, we have shared an RFQ for 5 Conveyor Drive Units. Please review and send a quote.",
    timestamp: "2026-06-02T15:15:00Z",
    status: "read",
    mediaType: "text"
  },
  {
    id: "demo-msg-006",
    tenantId: SEED_TENANT_ID,
    conversationId: "919822012345",
    customerId: "demo-customer-004",
    customerName: "Atlas Engineering Works",
    senderPhone: "+912261234567",
    recipientPhone: "+919822012345",
    direction: "outbound",
    message: "Thanks Milind, we have received your RFQ and it is currently being evaluated by our engineering team.",
    timestamp: "2026-06-02T15:30:00Z",
    status: "read",
    mediaType: "text"
  },
  // 5. Internal Logistics / Procurement Node Chat
  {
    id: "demo-msg-007",
    tenantId: SEED_TENANT_ID,
    conversationId: "919000000000",
    senderPhone: "+912261234567",
    recipientPhone: "+919000000000",
    direction: "outbound",
    message: "ALERT: 'Copper Bushing' is below the minimum stock limit of 15. Current Qty: 8. Trigger purchase order.",
    timestamp: "2026-06-03T11:00:00Z",
    status: "read",
    mediaType: "text"
  }
];

// 9. Activity Log entries
export const seedActivities: ActivityEvent[] = [
  {
    id: "demo-act-001",
    tenantId: SEED_TENANT_ID,
    actionType: "create",
    entityType: "rfq",
    entityId: "demo-rfq-001",
    module: "rfq",
    action: "rfq_created",
    entityLabel: "RFQ #RFQ-001",
    actorId: "demo-user-001",
    actorName: "Amit Sharma",
    actor: {
      userId: "demo-user-001",
      displayName: "Amit Sharma",
      email: "a.sharma@bhel.in"
    },
    description: "New RFQ for 3 helical gearboxes received from Mahindra Tractors Ltd.",
    timestamp: "2026-05-29T10:00:00Z",
    metadata: {
      rfqNumber: "RFQ-001",
      customerName: "Mahindra Tractors Ltd"
    }
  },
  {
    id: "demo-act-002",
    tenantId: SEED_TENANT_ID,
    actionType: "update",
    entityType: "job",
    entityId: "demo-job-004",
    module: "order",
    action: "order_stage_changed",
    entityLabel: "Job #OF-2024-004",
    actorId: "demo-user-002",
    actorName: "Production Manager",
    actor: {
      userId: "demo-user-002",
      displayName: "Production Manager",
      email: "prod@vulcan.com"
    },
    description: "Worm Shaft Assembly transitioned to stage 'Ready for Dispatch'.",
    timestamp: "2026-06-03T10:00:00Z",
    metadata: {
      orderNumber: "OF-2024-004",
      jobCode: "demo-job-004",
      role: "production"
    }
  },
  {
    id: "demo-act-003",
    tenantId: SEED_TENANT_ID,
    actionType: "create",
    entityType: "dispatch",
    entityId: "demo-dispatch-002",
    module: "dispatch",
    action: "dispatch_sent",
    entityLabel: "Dispatch #INV-004",
    actorId: "demo-user-002",
    actorName: "Production Manager",
    actor: {
      userId: "demo-user-002",
      displayName: "Production Manager",
      email: "prod@vulcan.com"
    },
    description: "Worm Shaft Assembly shipped to Mahindra Tractors Ltd via Blue Dart.",
    timestamp: "2026-06-03T15:00:00Z",
    metadata: {
      dispatchCode: "DSP-2024-002",
      invoiceNumber: "INV-004",
      orderNumber: "OF-2024-004"
    }
  },
  {
    id: "demo-act-004",
    tenantId: SEED_TENANT_ID,
    actionType: "sent",
    entityType: "whatsapp",
    entityId: "demo-msg-003",
    module: "whatsapp",
    action: "whatsapp_sent", // Representing payment_reminder_sent
    entityLabel: "WhatsApp Thread #BHEL",
    actorId: "system",
    actorName: "System Process",
    actor: {
      userId: "system",
      displayName: "System Process",
      email: ""
    },
    description: "Payment reminder for overdue Invoice INV-001 automatically pushed to WhatsApp.",
    timestamp: "2026-05-31T11:00:00Z",
    metadata: {
      invoiceNumber: "INV-001",
      customerName: "Bharat Heavy Electricals Ltd"
    }
  },
  {
    id: "demo-act-005",
    tenantId: SEED_TENANT_ID,
    actionType: "update",
    entityType: "job",
    entityId: "demo-stock-003",
    module: "inventory",
    action: "inventory_low_stock",
    entityLabel: "Copper Bushing",
    actorId: "system",
    actorName: "System Process",
    actor: {
      userId: "system",
      displayName: "System Process",
      email: ""
    },
    description: "ALERT: Stock level for 'Copper Bushing' is below minimum threshold (Current Qty: 8 / Min: 15).",
    timestamp: "2026-06-03T11:00:00Z",
    metadata: {
      productCode: "SP-CB-003",
      qty: 8,
      minStock: 15
    }
  },
  {
    id: "demo-act-006",
    tenantId: SEED_TENANT_ID,
    actionType: "update",
    entityType: "rfq",
    entityId: "demo-rfq-003",
    module: "rfq",
    action: "rfq_converted_to_order",
    entityLabel: "RFQ #RFQ-003",
    actorId: "demo-user-001",
    actorName: "Amit Sharma",
    actor: {
      userId: "demo-user-001",
      displayName: "Amit Sharma",
      email: "a.sharma@bhel.in"
    },
    description: "RFQ-003 successfully converted to Order OF-2024-001 with 2 Bevel Gearboxes.",
    timestamp: "2026-05-14T12:00:00Z",
    metadata: {
      rfqNumber: "RFQ-003",
      orderNumber: "OF-2024-001",
      customerName: "Cement Corp India"
    }
  },
  {
    id: "demo-act-007",
    tenantId: SEED_TENANT_ID,
    actionType: "sent",
    entityType: "quotation",
    entityId: "demo-quote-002",
    module: "rfq",
    action: "quotation_sent",
    entityLabel: "Quote #Q-002",
    actorId: "demo-user-001",
    actorName: "Amit Sharma",
    actor: {
      userId: "demo-user-001",
      displayName: "Amit Sharma",
      email: "a.sharma@bhel.in"
    },
    description: "Quotation #Q-002 for Worm Gear Reducer sent to BHEL.",
    timestamp: "2026-05-02T13:00:00Z",
    metadata: {
      rfqNumber: "RFQ-002",
      customerName: "Bharat Heavy Electricals Ltd"
    }
  },
  {
    id: "demo-act-008",
    tenantId: SEED_TENANT_ID,
    actionType: "update",
    entityType: "customer",
    entityId: "demo-customer-001",
    module: "payment",
    action: "payment_received",
    entityLabel: "Invoice #INV-004",
    actorId: "system",
    actorName: "System Process",
    actor: {
      userId: "system",
      displayName: "System Process",
      email: ""
    },
    description: "Received payment of ₹3,20,000 for Invoice INV-004 from Mahindra Tractors Ltd.",
    timestamp: "2026-05-31T15:30:00Z",
    metadata: {
      invoiceNumber: "INV-004",
      amountPaid: 320000,
      customerName: "Mahindra Tractors Ltd"
    }
  }
];

// 10. Tenant Config
export const seedTenantConfig: TenantConfig = {
  tenantId: SEED_TENANT_ID,
  tenantName: "Vulcan Gears Pvt. Ltd.",
  gstNumber: "27AADCV1111A1Z1",
  address: "Plot 12, Sector 4, Industrial Area, Thane, Mumbai, Maharashtra 400604",
  contactEmail: "admin@vulcan-gears.com",
  contactPhone: "+912261234567",
  timeZone: "Asia/Kolkata",
  defaultCurrency: "INR (₹)",
  updatedAt: "2026-06-03T16:00:00Z"
} as any;
