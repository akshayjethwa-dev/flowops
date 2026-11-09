// src/types/stockReservation.ts

export type StockReservationStatus = 
  | 'active'              // Fully or partially reserved and active
  | 'partially_reserved' // Stock was insufficient at confirmation; shortfall logged
  | 'released'           // Released due to order cancellation, full dispatch, or manual admin release
  | 'written_off'        // Physically damaged or lost stock written off by admin
  | 'consumed';          // Stock consumed upon dispatch

export interface StockReservation {
  id: string;
  tenantId: string;
  orderId: string;
  orderNumber: string;
  customerName?: string;
  orderItemId?: string;
  orderItemName?: string;
  
  // Component & Part Details
  componentId: string;
  componentName: string;
  partNumber: string;
  unit: string;
  
  // Quantities
  requiredQty: number;
  reservedQty: number;
  shortfallQty: number;
  unreservedAvailableAtReservation?: number;
  
  // Timestamps & Lifecycle
  reservedAt: string;
  reservedBy?: string;
  status: StockReservationStatus;
  
  // Release Audit
  releasedAt?: string;
  releasedBy?: string;
  releaseReason?: string;
  
  // Write-Off Audit (Damaged / Lost Stock)
  writtenOffAt?: string;
  writtenOffBy?: string;
  writeOffReason?: string;
  writeOffQty?: number;
  
  // Additional Notes / BOM context
  bomLevel?: number;
  parentProductName?: string;
  notes?: string;
  version?: number;
}

export interface StockReservationSummary {
  orderId: string;
  orderNumber: string;
  reservations: StockReservation[];
  totalComponents: number;
  fullyReservedCount: number;
  partiallyReservedCount: number;
  unreservedCount: number;
  hasShortfall: boolean;
  totalShortfallQty: number;
  isFullyReserved: boolean;
  timestamp: string;
}

export interface ManualReleaseRequest {
  reservationId: string;
  reason: string;
  releasedBy: string;
  userRole: string;
}

export interface WriteOffRequest {
  reservationId: string;
  writeOffQty: number;
  reason: string;
  writtenOffBy: string;
  userRole: string;
}
