// src/types/costEngine.ts

export type SkillLevel = 'unskilled' | 'semi_skilled' | 'skilled' | 'specialist';

export interface LaborRateRule {
  id: string;
  role: string;
  hourlyRate: number; // ₹ per hour
  overtimeMultiplier: number; // e.g. 1.5
  skillLevel: SkillLevel;
  efficiencyFactor: number; // default 1.0 (0.8 = 80% pace)
  description?: string;
}

export interface MachineHourRateRule {
  id: string;
  machineName: string;
  code: string;
  hourlyRate: number; // ₹ per hour
  setupHourlyRate: number; // ₹ per hour for machine setup/tool change
  powerRatingKw: number;
  depreciationPerHr?: number;
  toolingAllowancePerHr?: number;
  description?: string;
}

export interface MaterialMarkupRule {
  id: string;
  category: string;
  scrapFactorPercent: number; // e.g. 5% to 15%
  handlingMarkupPercent: number; // e.g. 3% to 8% for warehousing & cutting
  freightPerKg?: number; // ₹/kg freight surcharge
  notes?: string;
}

export type SubcontractPricingBasis = 'per_kg' | 'per_piece' | 'per_sq_meter' | 'fixed_batch_charge';

export interface SubcontractingRule {
  id: string;
  processName: string;
  pricingBasis: SubcontractPricingBasis;
  baseRate: number; // ₹
  handlingMarkupPercent: number; // Vendor coordination, logistics & QC buffer (e.g. 10%)
  standardLeadTimeDays: number;
  preferredVendorName?: string;
  notes?: string;
}

export interface VolumeDiscountTier {
  minQuantity: number;
  marginReductionPercent: number; // e.g. at 500 pcs, margin drops from 18% to 15% (-3%)
}

export interface OverheadAndMarginRule {
  factoryOverheadPercent: number; // Applied on direct mfg cost (e.g. 12%)
  adminSalesOverheadPercent: number; // Applied on factory cost (e.g. 6%)
  defaultMarginPercent: number; // Target profit margin (e.g. 18%)
  rushOrderPremiumPercent: number; // Rush priority surcharge (e.g. 20%)
  minOrderValue: number; // Minimum lot charge (e.g. ₹5,000)
  volumeDiscounts: VolumeDiscountTier[];
}

export interface CostingTemplate {
  id: string;
  tenantId: string;
  plantId?: string;
  name: string;
  version: string; // e.g. 'v1.0', 'v2.1'
  status: 'active' | 'draft' | 'archived';
  isDefault: boolean;
  description: string;
  laborRates: LaborRateRule[];
  machineHourRates: MachineHourRateRule[];
  materialMarkups: MaterialMarkupRule[];
  subcontractingRules: SubcontractingRule[];
  overheads: OverheadAndMarginRule;
  changeLogNotes?: string;
  updatedAt: string;
  updatedBy: string;
  createdAt: string;
}

export interface CostOperationInput {
  id: string;
  description: string;
  machineId?: string;
  cycleTimeMinutes: number;
  setupTimeMinutes?: number;
  laborRoleId?: string;
}

export interface SubcontractItemInput {
  id: string;
  subcontractRuleId: string;
  unitsOrKg?: number;
  overrideCost?: number;
}

export interface CostCalculationInput {
  partName: string;
  quantity: number;
  materialType?: string;
  rawMaterialCostPerUnit: number;
  materialWeightKg?: number;
  operations: CostOperationInput[];
  subcontractProcesses: SubcontractItemInput[];
  rushOrder?: boolean;
  targetMarginOverride?: number;
}

export interface CostCalculationBreakdown {
  quantity: number;
  
  // Direct Material
  unitRawMaterialNet: number;
  unitMaterialScrapAmount: number;
  unitMaterialHandlingAmount: number;
  unitMaterialTotal: number;

  // Direct Machining & Labor
  unitMachiningCost: number;
  unitSetupCost: number;
  unitLaborCost: number;
  unitDirectMfgCost: number; // Material + Machine + Labor

  // Subcontracting
  unitSubcontractingCost: number;
  unitSubcontractHandlingAmount: number;
  unitSubcontractTotal: number;

  // Overheads
  unitFactoryOverhead: number;
  unitAdminOverhead: number;
  unitTotalManufacturingCost: number; // Net total cost to factory

  // Margin & Price
  unitMarginAmount: number;
  unitQuotePrice: number;
  
  // Extended totals for batch
  totalDirectCost: number;
  totalSubcontractCost: number;
  totalOverheadCost: number;
  totalExtendedNetCost: number;
  totalExtendedQuotePrice: number;
  
  effectiveMarginPercent: number;
  estimatedProductionLeadTimeDays: number;
  templateVersionUsed: string;
  templateNameUsed: string;
}
