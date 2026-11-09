// src/types/eInvoice.ts

export type EInvoiceStatus = 
  | 'not_generated' 
  | 'generated' 
  | 'e_invoice_failed' 
  | 'cancelled';

export type IRPAdapterType = 'nic' | 'cleartax' | 'masters_india';

export interface EInvoiceLineItem {
  itemNumber: number;
  productName: string;
  description?: string;
  hsnCode: string;
  quantity: number;
  uom: string; // 'NOS', 'KGS', 'MTR', 'PCS', 'SET'
  unitPrice: number;
  grossAmount: number;
  discountAmount?: number;
  taxableAmount: number;
  gstRate: number; // e.g. 18
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount?: number;
  totalItemValue: number;
}

export interface EInvoiceSellerDetails {
  gstin: string;
  legalName: string;
  tradeName?: string;
  address: string;
  location: string;
  pincode: string;
  stateCode: string; // 2 digits e.g. "24" or "27"
  stateName?: string;
  phone?: string;
  email?: string;
}

export interface EInvoiceBuyerDetails {
  gstin: string;
  legalName: string;
  tradeName?: string;
  posStateCode: string; // Place of supply 2 digits
  address: string;
  location: string;
  pincode: string;
  stateCode: string;
  phone?: string;
  email?: string;
  isB2B: boolean;
  registrationType?: 'regular' | 'composition' | 'unregistered' | 'consumer';
}

export interface EInvoicePayload {
  version: string; // "1.1"
  irn?: string;
  tranDetails: {
    taxScheme: 'GST';
    supplyType: 'B2B' | 'SEZWP' | 'SEZWOP' | 'EXPWP' | 'EXPWOP' | 'DEXP';
    regRev?: 'Y' | 'N';
    ecommerceGstin?: string;
  };
  docDetails: {
    documentType: 'INV' | 'CRN' | 'DBN';
    documentNumber: string;
    documentDate: string; // DD/MM/YYYY
  };
  sellerDetails: EInvoiceSellerDetails;
  buyerDetails: EInvoiceBuyerDetails;
  itemList: EInvoiceLineItem[];
  valueDetails: {
    assessableValue: number;
    cgstValue: number;
    sgstValue: number;
    igstValue: number;
    cessValue?: number;
    discountValue?: number;
    otherCharges?: number;
    roundOffAmount?: number;
    totalInvoiceValue: number;
  };
}

export interface EInvoiceData {
  irn: string; // 64-character hexadecimal Invoice Reference Number
  ackNo: string; // 15-digit Acknowledgement Number
  ackDate: string; // Formatted YYYY-MM-DD HH:mm:ss
  signedInvoice: string; // Base64 or signed JWT payload
  signedQrCode: string; // Signed verification string
  qrCodeDataUrl?: string; // Rendered Base64 PNG QR code for display & PDF
  status: EInvoiceStatus;
  adapter: IRPAdapterType;
  generatedAt: string;
  generatedBy: string;
  userRole?: string;
  errorMessage?: string;
  errorCode?: string;
  
  // 24-hour cancellation tracking (EC 6)
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: '1' | '2' | '3' | '4'; // 1-Duplicate, 2-Data Entry, 3-Order Cancelled, 4-Others
  cancelRemarks?: string;
  canBeCancelledDirectly?: boolean; // True if <= 24 hours from ackDate
  
  // Payload copy for audit & verification
  payload?: EInvoicePayload;
  irpResponseCode?: string;
  rawJson?: string;
}

export interface CancelEInvoiceParams {
  reasonCode: 1 | 2 | 3 | 4;
  cancelReason: string;
  remarks: string;
}

export interface EInvoiceEligibilityResult {
  isEligible: boolean;
  customerGstinValid: boolean;
  isB2B: boolean;
  hsnValid: boolean;
  thresholdExceeded: boolean;
  reasons: string[];
  errors: string[]; // Alias for reasons
  checks: {
    hasValidGstin: boolean;
    isB2B: boolean;
    hasHsnCodes: boolean;
    exceedsThreshold: boolean;
  };
  errorCode?: 'INVALID_GSTIN' | 'B2C_EXEMPT' | 'INVALID_HSN' | 'THRESHOLD_EXEMPT' | 'MISSING_DATA';
  customerGstin?: string;
  customerRegistrationType?: string;
  missingHsnItems?: string[];
  totalInvoiceValue: number;
  thresholdCr: number;
}

export interface EInvoiceConfig {
  enabled: boolean;
  defaultAdapter: IRPAdapterType;
  turnoverThresholdCr: number; // Default: 5 (₹5 Crore)
  annualTurnoverExempt: boolean; // Toggleable in settings
  autoGenerateOnDispatch: boolean;
  nicEndpoint?: string;
  cleartaxApiKey?: string;
  mastersIndiaApiKey?: string;
  supplierGstin: string;
  supplierLegalName: string;
  supplierTradeName: string;
  supplierAddress: string;
  supplierPincode: string;
  supplierState: string;
  supplierStateCode: string;
  simulateDowntime?: boolean;
  simulateDuplicateIrn?: boolean;
}
