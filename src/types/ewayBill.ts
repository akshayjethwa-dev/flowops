// src/types/ewayBill.ts

export type EWayBillStatus = 'active' | 'expiring_soon' | 'expired' | 'cancelled' | 'pending';

export type EwbVehicleType = 'regular' | 'over_dimensional';

export type EwbTransportMode = 'road' | 'rail' | 'air' | 'ship';

export interface EWayBillPartBHistory {
  id?: string;
  vehicleNumber: string;
  fromPlace: string;
  fromState: string;
  fromPincode?: string;
  transDocNo?: string;
  transDocDate?: string;
  reasonCode: '1' | '2' | '3' | '4'; // 1-Breakdown, 2-Transshipment, 3-Others, 4-First Time
  reasonDescription: string;
  remarks?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface EWayBillExtensionHistory {
  id?: string;
  extendedAt: string;
  extendedBy: string;
  previousValidUntil: string;
  newValidUntil: string;
  remainingDistanceKm: number;
  currentLocation: string;
  currentPincode?: string;
  reason: string;
  consignmentStatus: 'in_transit' | 'in_movement';
  transitDelayHours?: number;
}

export interface EWayBillData {
  ewayBillNumber: string; // 12-digit statutory number e.g. "241088294102"
  ewbNumber?: string; // convenient alias
  generatedAt: string;
  validUntil: string;
  validUpto?: string; // convenient alias
  status: EWayBillStatus;
  distanceKm: number;
  transporterId: string; // Transporter GSTIN or 15-char ID
  transporterName: string;
  vehicleNumber: string;
  vehicleType: EwbVehicleType;
  transportMode: EwbTransportMode;
  
  // Consignor (Supplier)
  fromGstin: string;
  fromTradeName: string;
  fromAddress: string;
  fromPincode: string;
  fromState: string;
  fromStateCode: string;

  // Consignee (Recipient)
  toGstin: string;
  toTradeName: string;
  toAddress: string;
  toPincode: string;
  toState: string;
  toStateCode: string;

  // Document & Linkage
  docType: 'INV' | 'CHL' | 'OTH';
  docNumber: string;
  docDate: string;
  linkedIrn?: string; // 64-char IRN if e-invoiced

  // Financials
  mainHsnCode: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount?: number;
  totalInvoiceValue: number;

  // Multi-leg & Life cycle
  partBHistory: EWayBillPartBHistory[];
  extensions: EWayBillExtensionHistory[];
  
  // Cancellation
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  
  // Barcode / QR Payload
  barcodeData?: string;
  qrCodeDataUrl?: string;
}

export interface EWayBillValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    thresholdExceeded: boolean;
    vehicleFormatValid: boolean;
    transporterIdValid: boolean;
    distanceValid: boolean;
    irnOrInvoicePresent: boolean;
  };
  dispatchValue: number;
  threshold: number;
  normalizedVehicleNumber?: string;
}

export interface EWayBillConfig {
  thresholdValue: number; // Default: 50000 (₹50,000)
  autoNotifyExpiryHours: number; // Default: 4 hours
  simulateDistanceMismatch?: boolean;
}
