// src/types/bomScrubber.ts

export type BomLifecycleStatus = 'ACTIVE' | 'NRND' | 'OBSOLETE' | 'EOL' | 'UNVERIFIED';

export type BomLeadTimeCategory = 'SHORT' | 'STANDARD' | 'LONG_LEAD' | 'CRITICAL';

export type BomStockAvailability = 'IN_STOCK' | 'PARTIAL_STOCK' | 'OUT_OF_STOCK';

export type QuotabilityGrade = 
  | 'A_READY_TO_QUOTE' 
  | 'B_QUOTABLE_WITH_CONDITIONS' 
  | 'C_HIGH_RISK' 
  | 'D_DO_NOT_QUOTE';

export interface RawBomInputItem {
  id?: string;
  itemNumber?: number;
  partNumber: string;
  description: string;
  quantity: number;
  unit?: string;
  materialGrade?: string;
  referenceDesignator?: string;
  targetPrice?: number;
  notes?: string;
}

export interface InventoryMatchResult {
  matched: boolean;
  stockItemId?: string;
  stockCode?: string;
  stockName?: string;
  currentQty: number;
  reorderLevel: number;
  unit: string;
  unitCost: number;
  shortageQty: number;
  status: BomStockAvailability;
  location?: string;
}

export interface PriceTier {
  minQty: number;
  unitPrice: number;
}

export interface AlternateComponent {
  partNumber: string;
  manufacturer: string;
  description: string;
  leadTimeDays: number;
  unitPrice: number;
  lifecycleStatus: 'ACTIVE';
  statusReason: string;
}

export interface SupplierCatalogMatchResult {
  matched: boolean;
  supplierId?: string;
  supplierName: string;
  supplierPartNumber: string;
  manufacturer?: string;
  category: string;
  moq: number;
  leadTimeDays: number;
  unitPrice: number;
  currency: string;
  priceValidity: string;
  isRealtimePushed: boolean;
  realtimeLastChecked: string;
  priceTiers?: PriceTier[];
  alternatePartNumbers?: string[];
}

export interface RiskAnalysisResult {
  lifecycleStatus: BomLifecycleStatus;
  leadTimeCategory: BomLeadTimeCategory;
  isObsolete: boolean;
  isLongLead: boolean;
  isHighRisk: boolean;
  riskFactors: string[];
  recommendedAlternates: AlternateComponent[];
}

export interface ScrubbedBomLineItem {
  id: string;
  itemNumber: number;
  partNumber: string;
  description: string;
  quantity: number;
  unit: string;
  materialGrade?: string;
  referenceDesignator?: string;
  targetPrice?: number;
  notes?: string;
  
  // Validation Results
  inventory: InventoryMatchResult;
  supplier: SupplierCatalogMatchResult;
  risk: RiskAnalysisResult;
  
  // Costing calculations
  selectedSource: 'INVENTORY' | 'SUPPLIER_CATALOG' | 'MANUAL_QUOTE';
  effectiveUnitPrice: number;
  extendedPrice: number;
  effectiveLeadTimeDays: number;
  
  // Status flags
  validationStatus: 'VALID' | 'WARNING' | 'CRITICAL_BLOCKER';
  validationMessage: string;
  isProcurementApproved: boolean;
  userOverridePrice?: number;
  userOverrideLeadTime?: number;
  hasSubstitutedAlternate?: boolean;
  originalPartNumber?: string;
}

export interface ScrubbedBomSummary {
  totalItems: number;
  totalQuantity: number;
  inStockCount: number;
  partialStockCount: number;
  outOfStockCount: number;
  supplierAvailableCount: number;
  obsoleteCount: number;
  longLeadCount: number;
  unverifiedCount: number;
  procurableRate: number; // 0-100%
  quotabilityScore: number; // 0-100
  quotabilityGrade: QuotabilityGrade;
  totalComponentCost: number;
  suggestedQuotePrice: number;
  marginPercent: number;
  scrapBufferPercent: number;
  criticalPathLeadTimeDays: number;
  bottleneckItemName?: string;
  realtimeMarketIndexDelta: number; // e.g. +2.1%
  lastPriceRefreshAt: string;
}

export interface ScrubbedBomRecord {
  id: string;
  tenantId: string;
  rfqId?: string;
  rfqNumber?: string;
  customerName?: string;
  bomTitle: string;
  sourceFileName?: string;
  sourceFileType?: 'excel' | 'pdf' | 'csv' | 'preset' | 'manual';
  items: ScrubbedBomLineItem[];
  summary: ScrubbedBomSummary;
  createdAt: string;
  createdBy: string;
  lastScrubbedAt: string;
}

export interface SupplierCatalogMasterItem {
  id: string;
  supplierName: string;
  supplierLocation: string;
  partNumber: string;
  manufacturer: string;
  description: string;
  materialGrade: string;
  category: 'raw_material' | 'fasteners' | 'bearings' | 'seals_hydraulics' | 'tooling' | 'electrical';
  moq: number;
  leadTimeDays: number;
  baseUnitPrice: number;
  currency: string;
  lifecycleStatus: BomLifecycleStatus;
  alternates: string[];
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}
