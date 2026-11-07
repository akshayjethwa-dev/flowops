// src/types/materialAvailability.ts

export type AtpAvailabilityStatus = 'available' | 'partially_available' | 'unavailable';

export interface AtpComponentBreakdown {
  id: string;
  partNumber: string;
  partName: string;
  level: number;
  itemType: 'assembly' | 'sub_assembly' | 'manufactured' | 'raw_material' | 'bought_out' | 'hardware' | 'purchased_item';
  requiredQty: number;
  unit: string;
  currentStock: number;
  plannedReceipts: number;
  committedOrders: number;
  unreservedAvailableStock: number; // ATP formula: Current Stock + Planned Production Receipts - Already Committed Orders
  shortfall: number; // Math.max(0, requiredQty - unreservedAvailableStock)
  status: AtpAvailabilityStatus;
  expectedReplenishmentDate?: string; // YYYY-MM-DD
  isManufacturedBOM: boolean;
  notes?: string;
}

export interface AtpCheckResult {
  orderItemId: string;
  productName: string;
  orderedQty: number;
  overallStatus: AtpAvailabilityStatus;
  hasBOM: boolean;
  bomRevision?: string;
  components: AtpComponentBreakdown[];
  limitingComponent?: AtpComponentBreakdown;
  worstCaseShortfall: number;
  earliestAvailableDate?: string;
  lastSyncedTimestamp: string;
  isStale: boolean; // EC 4: last synced > 15 minutes ago
  stalenessMinutes: number;
  summaryText: string;
  isNoStockNoBom?: boolean;
}

export interface AtpAcknowledgementPayload {
  orderId: string;
  itemId: string;
  acknowledgedBy: string;
  acknowledgedByName: string;
  acknowledgedAt: string;
  reason: string;
}

export interface OrderAtpLineSummary {
  lineIndex: number;
  itemId: string;
  productName: string;
  orderedQty: number;
  unit: string;
  status: AtpAvailabilityStatus;
  hasBOM: boolean;
  isNoStockNoBom: boolean;
  shortfallComponents: {
    partNumber: string;
    partName: string;
    shortfall: number;
    unit: string;
    currentStock: number;
    leadTimeDays: number;
    expectedReplenishmentDate?: string;
  }[];
  limitingComponent?: AtpComponentBreakdown;
  earliestAvailableDate?: string;
  summaryText: string;
  atpResult: AtpCheckResult;
}

export interface OrderAtpSummary {
  orderId: string;
  orderNumber: string;
  checkTimestamp: string;
  cacheKey: string;
  totalLines: number;
  availableLinesCount: number;
  partiallyAvailableLinesCount: number;
  unavailableLinesCount: number;
  lineResults: OrderAtpLineSummary[];
  earliestPossibleFulfilmentDate?: string;
  longestLeadTimeDays: number;
  criticalBottleneckComponent?: {
    partName: string;
    partNumber: string;
    leadTimeDays: number;
    shortfall: number;
    unit: string;
    productName: string;
  };
  overallStatus: AtpAvailabilityStatus;
  isStaleFromEdit?: boolean;
}
