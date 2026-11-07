// src/types/jobWork.ts

export type GatePassType = 'outward' | 'inward';

export type GatePassStatus = 
  | 'issued'              // Newly issued, material dispatched from store
  | 'in_transit'          // En route with transporter
  | 'with_vendor'         // Acknowledged by job worker, work in progress
  | 'partially_returned'  // Partial return received back
  | 'fully_returned'      // All dispatched materials accounted & received back
  | 'completed'           // Fully closed out
  | 'short_closed'        // Short closed due to approved scrap/consumption variance
  | 'cancelled';          // Cancelled

export interface GatePassItem {
  id: string;
  materialId?: string;       // StockItem id in internal inventory
  materialCode: string;      // SKU e.g. "MS-CAST-01", "WR-1002"
  materialName: string;      // e.g. "MS Casting Grade FG260", "Wire Rod 8mm"
  quantity: number;          // Dispatched quantity (Sent Qty)
  uom: string;               // e.g. "Kg", "Pcs", "Tonnes", "Units"
  batchHeatNo?: string;      // Batch / Heat / Lot number
  ratePerUnit?: number;      // Indicative value for insurance/E-Way bill
  totalValue?: number;       // quantity * ratePerUnit
  natureOfWork?: string;     // Line-specific process if varied
  remarks?: string;
  
  // Tracking returns and rejections (Cumulative across returns)
  returnedQty?: number;      // Good Processed quantity received back into Own Stock
  rejectedQty?: number;      // Quantity rejected / damaged (not added to own stock)
  rejectionReason?: string;  // Detailed reason for rejection
  shortClosedQty?: number;   // Quantity written off (scrap/burn loss)
  balanceWithVendor?: number;// quantity - (returnedQty + rejectedQty + shortClosedQty)
}

export interface VehicleAndTransporterDetails {
  modeOfTransport: 'road' | 'courier' | 'hand_delivery' | 'rail' | 'air';
  transporterName: string;   // e.g. "VRL Logistics", "Direct Factory Tempo", "Self / Hand Delivery"
  vehicleNumber?: string;    // e.g. "MH-12-FG-4491", "KA-04-AB-1234"
  driverName?: string;       // e.g. "Ramesh Kumar"
  driverPhone?: string;      // e.g. "+91 98765 43210"
  lrNumber?: string;         // Lorry Receipt / Docket No e.g. "LR-99214"
  lrDate?: string;
  ewayBillNumber?: string;   // GST E-Way Bill No (if value > ₹50,000)
}

export interface JobWorkGatePass {
  id: string;
  tenantId: string;
  plantId?: string;
  gatePassNumber: string;    // e.g. "GP/OUT/2026/0001" or "GP/IN/2026/0001"
  type: GatePassType;
  
  // Vendor / Job Worker details
  jobWorkerId: string;
  jobWorkerName: string;     // e.g. "XYZ Heat Treatment", "Pragati Heat Treaters"
  jobWorkerGst?: string;     // e.g. "27AAACX9921M1Z5"
  jobWorkerAddress?: string;
  jobWorkerPhone?: string;
  jobWorkerContactPerson?: string;
  
  // Job Work Specification
  natureOfWork: string;      // e.g. "Heat Treatment (Hardening & Tempering)", "Electroplating", "CNC Milling"
  expectedReturnDate: string;// e.g. "2026-11-10"
  dispatchedDate: string;    // Date of gate pass issuance
  
  // Linkages
  linkedJobWorkOrderNumber?: string; // Optional Job Work Order (e.g. "JWO-2026-0042", "SPO-2026-0018")
  linkedJobWorkOrderId?: string;
  linkedWorkOrderNumber?: string;    // Shopfloor Work Order (e.g. "WO-2026-001")
  linkedOutwardGatePassId?: string;  // If this is an Inward GP, points to original Outward GP
  linkedOutwardGatePassNumber?: string;
  grnNumber?: string;                // Linked Goods Receipt Note number (e.g. "GRN/JW/2026/0001")
  grnId?: string;
  
  // Financials & Processing Charges
  processingCharges?: number;        // e.g. ₹5,000
  isProcessingChargeDisputed?: boolean; // EC: Processing charges are disputed flag
  disputeReason?: string;            // Reason for dispute review by finance
  disputeStatus?: 'none' | 'disputed' | 'under_review' | 'approved' | 'settled';
  
  // Logistics
  vehicleDetails: VehicleAndTransporterDetails;
  
  // Dispatched / Inward items
  items: GatePassItem[];
  totalDispatchedQty: number;        // Total quantity dispatched or received
  totalProcessedQty?: number;        // Good accepted qty
  totalRejectedQty?: number;         // Rejected damaged qty
  totalEstimatedValue: number;
  
  // Status and Lifecycle
  status: GatePassStatus;
  
  // Cancellation details (Acceptance Criteria & Edge Case)
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  materialPhysicallyLeft?: boolean; // If true when cancelled, stock is NOT reversed into own stock!
  
  // Short-close details
  shortCloseReason?: string;
  shortClosedAt?: string;
  shortClosedBy?: string;
  shortClosedByName?: string;
  
  // General Notes & Statutory
  gstChallanRule?: string;   // e.g. "Delivery Challan issued under Rule 45 of CGST Rules, 2017"
  internalRemarks?: string;
  vendorDeliveryChallanNo?: string;
  vendorInvoiceNo?: string;
  
  // Audit stamps
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Auto-Generated Goods Receipt Note (GRN) for received Job Work items
 */
export interface JobWorkGRN {
  id: string;
  tenantId: string;
  plantId?: string;
  grnNumber: string;                 // e.g. "GRN/JW/2026/0001"
  inwardGatePassId: string;
  inwardGatePassNumber: string;      // e.g. "GP/IN/2026/0001"
  outwardGatePassId: string;
  outwardGatePassNumber: string;     // e.g. "GP/OUT/2026/0001"
  jobWorkerId: string;
  jobWorkerName: string;
  jobWorkerGst?: string;
  receiptDate: string;
  
  items: Array<{
    materialId?: string;
    materialCode: string;
    materialName: string;
    uom: string;
    sentQty: number;                 // Sent on outward GP
    receivedQty: number;             // Total physical count at dock (processed + rejected)
    processedQty: number;            // Good accepted quantity added to Own Stock
    rejectedQty: number;             // Damaged / defective rejected quantity (NOT in Own Stock)
    rejectionReason?: string;
    scrapReworkDisposition?: 'scrap' | 'rework' | 'vendor_debit' | 'quarantine';
  }>;

  totalProcessedQty: number;
  totalRejectedQty: number;

  // Processing charges and finance audit
  processingCharges: number;         // e.g. 5000
  isProcessingChargeDisputed: boolean; // Flagged for finance review before payment
  disputeReason?: string;
  disputeStatus: 'none' | 'disputed' | 'under_review' | 'approved' | 'settled';
  disputeResolvedAt?: string;
  disputeResolvedBy?: string;

  vendorChallanNo?: string;
  vendorInvoiceNo?: string;
  vehicleNumber?: string;
  receivedBy: string;
  receivedByName: string;
  inspectionRemarks?: string;
  createdAt: string;
}

/**
 * Tracks current physical inventory held at an external vendor / job worker
 */
export interface JobWorkerStockBalance {
  id: string;                // e.g. "vendorId_materialId"
  tenantId: string;
  plantId?: string;
  vendorId: string;
  vendorName: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  uom: string;
  quantityWithVendor: number;// Current balance
  totalOutwardQty: number;   // Cumulative Sent Qty
  totalReturnedQty: number;  // Cumulative Returned Qty (Good/Processed)
  totalRejectedQty: number;  // Cumulative Rejected Qty
  totalShortClosedQty: number;
  lastGatePassNumber: string;
  lastDispatchedDate: string;
  expectedReturnDate?: string;
  lastUpdated: string;
}

/**
 * Detailed chronological transaction ledger for a vendor & material
 */
export interface VendorStockLedgerTransaction {
  id: string;
  tenantId: string;
  vendorId: string;
  vendorName: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  uom: string;
  timestamp: string;
  transactionType: 
    | 'outward_dispatch'      // Outward Gate Pass issued (Sent Qty)
    | 'inward_processed'      // Inward return accepted (Returned Qty)
    | 'inward_rejected'       // Damaged / rejected material received
    | 'short_close_writeoff'  // Burn loss / scrap write-off
    | 'cancellation_reversal';// Gate pass cancelled before leaving
  refNumber: string;          // GP/OUT/..., GP/IN/..., GRN/JW/...
  sentQty: number;
  returnedQty: number;
  rejectedQty: number;
  balanceQty: number;         // Balance with vendor after transaction
  remarks?: string;
  performedBy: string;
  performedByName: string;
}

/**
 * Inward return receipt transaction input
 */
export interface InwardReturnInput {
  outwardGatePassId: string;
  jobWorkerId: string;
  jobWorkerName: string;
  inwardDate: string;
  vehicleDetails?: Partial<VehicleAndTransporterDetails>;
  vendorDeliveryChallanNo?: string;
  vendorInvoiceNo?: string;
  inspectionStatus: 'accepted' | 'accepted_with_deviation' | 'rejected_by_vendor' | 'rework_needed';
  
  // Line items with exact Processed Qty and Rejected Qty
  items: {
    gatePassItemId: string;
    materialId?: string;
    materialCode: string;
    materialName: string;
    uom: string;
    sentQty: number;
    receivedQty: number;     // Physical count at gate
    processedQty: number;    // Good accepted into own stock
    rejectedQty: number;     // Damaged / rejected (excluded from own stock)
    rejectionReason?: string;
    rejectionDisposition?: 'scrap' | 'rework' | 'vendor_debit' | 'quarantine';
    scrapQty?: number;       // Process loss / scrap
    remarks?: string;
  }[];

  // Financial processing charges and dispute flag
  processingCharges: number;
  isProcessingChargeDisputed: boolean;
  disputeReason?: string;
  generalRemarks?: string;
}

export interface JobWorkKPIs {
  totalActiveGatePasses: number;
  totalDispatchedToday: number;
  totalPendingReturns: number;
  totalOverdueGatePasses: number;
  totalActiveVendorsCount: number;
  totalStockItemsWithVendors: number;
  totalGrnsGenerated?: number;
  totalDisputedChargesCount?: number;
}

/**
 * ITC-04 GST Filing Definitions
 */
export type ITC04Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type ITC04FilingMode = 'principal' | 'job_worker';

export interface ITC04Table4Entry {
  id: string;
  gatePassId: string;
  gatePassNumber: string;
  challanDate: string; // DD-MM-YYYY
  jobWorkerId: string;
  jobWorkerName: string;
  jobWorkerGstin: string;
  stateCode: string; // e.g. "27"
  materialId?: string;
  materialCode: string;
  materialDescription: string;
  uqc: string; // GST UQC code: "KGS", "TON", "NOS", etc.
  quantitySent: number;
  taxableValue: number;
  natureOfJobWork: string;
  typeOfGoods: 'Inputs' | 'Capital goods';
  returnStatus: 'fully_returned' | 'partially_returned' | 'pending';
  quantityReturned: number;
  quantityPending: number;
  isValidGstin: boolean;
  gstinValidationError?: string;
  isMismatch?: boolean;
  mismatchReason?: string;
}

export interface ITC04Table5AEntry {
  id: string;
  inwardGatePassId: string;
  inwardGatePassNumber: string;
  inwardReceiptDate: string; // DD-MM-YYYY
  originalChallanNumber: string;
  originalChallanDate: string; // DD-MM-YYYY
  jobWorkerId: string;
  jobWorkerName: string;
  jobWorkerGstin: string;
  stateCode: string;
  materialId?: string;
  materialCode: string;
  materialDescription: string;
  uqc: string;
  quantityReceived: number;
  quantityRejected: number;
  natureOfJobWork: string;
  typeOfGoods: 'Inputs' | 'Capital goods';
  grnNumber?: string;
  isValidGstin: boolean;
  gstinValidationError?: string;
}

export interface ITC04ReportSummary {
  quarter: ITC04Quarter;
  financialYear: string; // e.g. "2026-2027"
  periodLabel: string; // e.g. "Q3 FY2026 (Oct - Dec 2026)"
  filingMode: ITC04FilingMode;
  principalGstin: string;
  totalOutwardPasses: number;
  totalReturnedPasses: number;
  totalPendingPasses: number;
  totalTable4Items: number;
  totalTable5AItems: number;
  totalQuantitySent: number;
  totalQuantityReturned: number;
  totalQuantityPending: number;
  totalTaxableValue: number;
  invalidGstinCount: number;
  mismatchCount: number;
  canExport: boolean;
  warnings: string[];
  blockingErrors: string[];
  table4: ITC04Table4Entry[];
  table5A: ITC04Table5AEntry[];
}
