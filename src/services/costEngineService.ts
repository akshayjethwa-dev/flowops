// src/services/costEngineService.ts

import {
  CostingTemplate,
  CostCalculationInput,
  CostCalculationBreakdown
} from '../types/costEngine';

/**
 * Calculates complete bottom-up industrial manufacturing cost & quote price
 * based on the active versioned CostingTemplate.
 */
export function calculatePartCost(
  input: CostCalculationInput,
  template: CostingTemplate
): CostCalculationBreakdown {
  const qty = Math.max(1, input.quantity || 1);
  const rawMaterialNet = Math.max(0, input.rawMaterialCostPerUnit || 0);

  // 1. Material Markup & Scrap Calculation
  let scrapPercent = 5;
  let handlingPercent = 4;
  let freightPerKg = 0;

  if (input.materialType && template.materialMarkups.length > 0) {
    const matchedCategory = template.materialMarkups.find(m => 
      input.materialType?.toLowerCase().includes(m.category.toLowerCase()) ||
      m.category.toLowerCase().includes(input.materialType?.toLowerCase() || '')
    );
    if (matchedCategory) {
      scrapPercent = matchedCategory.scrapFactorPercent;
      handlingPercent = matchedCategory.handlingMarkupPercent;
      freightPerKg = matchedCategory.freightPerKg || 0;
    }
  } else if (template.materialMarkups.length > 0) {
    // Default to first rule
    scrapPercent = template.materialMarkups[0].scrapFactorPercent;
    handlingPercent = template.materialMarkups[0].handlingMarkupPercent;
    freightPerKg = template.materialMarkups[0].freightPerKg || 0;
  }

  const scrapAmount = rawMaterialNet * (scrapPercent / 100);
  const handlingAmount = rawMaterialNet * (handlingPercent / 100);
  const freightAmount = (input.materialWeightKg || 0) * freightPerKg;
  const unitMaterialTotal = rawMaterialNet + scrapAmount + handlingAmount + freightAmount;

  // 2. Machining & Setup Cost Calculation
  let totalMachiningCost = 0;
  let totalSetupCost = 0;
  let totalLaborCost = 0;
  let totalCycleMinutes = 0;

  for (const op of input.operations) {
    totalCycleMinutes += op.cycleTimeMinutes || 0;

    // Find machine rate
    const machine = template.machineHourRates.find(m => m.id === op.machineId);
    const mhr = machine ? machine.hourlyRate : 500;
    const setupRate = machine ? machine.setupHourlyRate : 350;

    // Cycle machining cost per unit
    const opCycleCost = ((op.cycleTimeMinutes || 0) / 60) * mhr;
    totalMachiningCost += opCycleCost;

    // Setup cost allocated across batch quantity
    const setupMinutes = op.setupTimeMinutes || 0;
    if (setupMinutes > 0) {
      const opSetupCost = ((setupMinutes / 60) * setupRate) / qty;
      totalSetupCost += opSetupCost;
    }

    // Find labor rate
    const labor = template.laborRates.find(l => l.id === op.laborRoleId);
    const laborHourly = labor ? labor.hourlyRate : 300;
    const efficiency = labor && labor.efficiencyFactor > 0 ? labor.efficiencyFactor : 1.0;

    const opLaborCost = (((op.cycleTimeMinutes || 0) / 60) * laborHourly) / efficiency;
    const opLaborSetupCost = (((setupMinutes / 60) * laborHourly) / efficiency) / qty;
    totalLaborCost += opLaborCost + opLaborSetupCost;
  }

  const unitDirectMfgCost = unitMaterialTotal + totalMachiningCost + totalSetupCost + totalLaborCost;

  // 3. Subcontracting / Outside Processing
  let unitSubcontractBase = 0;
  let unitSubcontractHandling = 0;

  for (const sub of input.subcontractProcesses) {
    const rule = template.subcontractingRules.find(r => r.id === sub.subcontractRuleId);
    let processCost = 0;
    let markupPercent = 10;

    if (sub.overrideCost !== undefined && sub.overrideCost > 0) {
      processCost = sub.overrideCost;
      markupPercent = rule ? rule.handlingMarkupPercent : 10;
    } else if (rule) {
      markupPercent = rule.handlingMarkupPercent;
      if (rule.pricingBasis === 'per_kg') {
        const weight = sub.unitsOrKg || input.materialWeightKg || 1;
        processCost = rule.baseRate * weight;
      } else if (rule.pricingBasis === 'per_piece') {
        processCost = rule.baseRate * (sub.unitsOrKg || 1);
      } else if (rule.pricingBasis === 'per_sq_meter') {
        processCost = rule.baseRate * (sub.unitsOrKg || 0.1);
      } else if (rule.pricingBasis === 'fixed_batch_charge') {
        processCost = rule.baseRate / qty;
      }
    }

    const processHandling = processCost * (markupPercent / 100);
    unitSubcontractBase += processCost;
    unitSubcontractHandling += processHandling;
  }

  const unitSubcontractTotal = unitSubcontractBase + unitSubcontractHandling;

  // 4. Factory & Administrative Overheads
  const factoryOverheadPercent = template.overheads.factoryOverheadPercent || 12;
  const adminSalesOverheadPercent = template.overheads.adminSalesOverheadPercent || 6;

  // Factory overhead applies to direct internal manufacturing
  const unitFactoryOverhead = unitDirectMfgCost * (factoryOverheadPercent / 100);
  
  // Admin overhead applies to combined factory cost
  const factoryCostWithOverhead = unitDirectMfgCost + unitSubcontractTotal + unitFactoryOverhead;
  const unitAdminOverhead = factoryCostWithOverhead * (adminSalesOverheadPercent / 100);

  const unitTotalManufacturingCost = factoryCostWithOverhead + unitAdminOverhead;

  // 5. Margin & Final Quotation Pricing
  let effectiveMarginPercent = template.overheads.defaultMarginPercent || 18;

  // Volume discount check
  if (template.overheads.volumeDiscounts && template.overheads.volumeDiscounts.length > 0) {
    const applicableTiers = template.overheads.volumeDiscounts
      .filter(t => qty >= t.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity);
    
    if (applicableTiers.length > 0) {
      effectiveMarginPercent = Math.max(5, effectiveMarginPercent - applicableTiers[0].marginReductionPercent);
    }
  }

  // Rush order premium
  if (input.rushOrder) {
    const rushPremium = template.overheads.rushOrderPremiumPercent || 20;
    effectiveMarginPercent += rushPremium;
  }

  // User override
  if (input.targetMarginOverride !== undefined && input.targetMarginOverride >= 0) {
    effectiveMarginPercent = input.targetMarginOverride;
  }

  // Unit Quote Price formula: Cost / (1 - Margin%) or Cost * (1 + Margin%)
  // Standard pricing formula: Price = Cost * (1 + Margin / 100)
  const unitMarginAmount = unitTotalManufacturingCost * (effectiveMarginPercent / 100);
  let unitQuotePrice = unitTotalManufacturingCost + unitMarginAmount;

  // Minimum Order Value check
  const minOrderVal = template.overheads.minOrderValue || 0;
  if (minOrderVal > 0 && (unitQuotePrice * qty) < minOrderVal) {
    unitQuotePrice = minOrderVal / qty;
  }

  // Lead Time estimation
  // Machining days + subcontract days + 2 buffer days
  let maxSubcontractLeadDays = 0;
  for (const sub of input.subcontractProcesses) {
    const rule = template.subcontractingRules.find(r => r.id === sub.subcontractRuleId);
    if (rule && rule.standardLeadTimeDays > maxSubcontractLeadDays) {
      maxSubcontractLeadDays = rule.standardLeadTimeDays;
    }
  }
  const totalShopFloorHours = (totalCycleMinutes * qty) / 60;
  const shopFloorDays = Math.ceil(totalShopFloorHours / 16); // 2 shifts of 8 hours
  const estimatedLeadTimeDays = Math.max(2, shopFloorDays + maxSubcontractLeadDays + 2);

  return {
    quantity: qty,
    unitRawMaterialNet: Math.round(rawMaterialNet * 100) / 100,
    unitMaterialScrapAmount: Math.round(scrapAmount * 100) / 100,
    unitMaterialHandlingAmount: Math.round(handlingAmount * 100) / 100,
    unitMaterialTotal: Math.round(unitMaterialTotal * 100) / 100,

    unitMachiningCost: Math.round(totalMachiningCost * 100) / 100,
    unitSetupCost: Math.round(totalSetupCost * 100) / 100,
    unitLaborCost: Math.round(totalLaborCost * 100) / 100,
    unitDirectMfgCost: Math.round(unitDirectMfgCost * 100) / 100,

    unitSubcontractingCost: Math.round(unitSubcontractBase * 100) / 100,
    unitSubcontractHandlingAmount: Math.round(unitSubcontractHandling * 100) / 100,
    unitSubcontractTotal: Math.round(unitSubcontractTotal * 100) / 100,

    unitFactoryOverhead: Math.round(unitFactoryOverhead * 100) / 100,
    unitAdminOverhead: Math.round(unitAdminOverhead * 100) / 100,
    unitTotalManufacturingCost: Math.round(unitTotalManufacturingCost * 100) / 100,

    unitMarginAmount: Math.round(unitMarginAmount * 100) / 100,
    unitQuotePrice: Math.round(unitQuotePrice * 100) / 100,

    totalDirectCost: Math.round(unitDirectMfgCost * qty),
    totalSubcontractCost: Math.round(unitSubcontractTotal * qty),
    totalOverheadCost: Math.round((unitFactoryOverhead + unitAdminOverhead) * qty),
    totalExtendedNetCost: Math.round(unitTotalManufacturingCost * qty),
    totalExtendedQuotePrice: Math.round(unitQuotePrice * qty),

    effectiveMarginPercent,
    estimatedProductionLeadTimeDays: estimatedLeadTimeDays,
    templateVersionUsed: template.version,
    templateNameUsed: template.name
  };
}

/**
 * Increment version for a template (e.g. v2.1 -> v2.2 or major v3.0)
 */
export function createNextTemplateVersion(
  base: CostingTemplate,
  options: {
    changeLog?: string;
    isMajor?: boolean;
    authorName?: string;
  } = {}
): CostingTemplate {
  const versionMatch = base.version.match(/v?(\d+)\.(\d+)/i);
  let major = 1;
  let minor = 0;

  if (versionMatch) {
    major = parseInt(versionMatch[1], 10);
    minor = parseInt(versionMatch[2], 10);
  }

  const nextVersion = options.isMajor
    ? `v${major + 1}.0`
    : `v${major}.${minor + 1}`;

  return {
    ...base,
    id: `tpl-${Date.now()}`,
    version: nextVersion,
    status: 'active',
    changeLogNotes: options.changeLog || `Created version ${nextVersion} revision.`,
    updatedAt: new Date().toISOString(),
    updatedBy: options.authorName || 'Business Owner',
    createdAt: new Date().toISOString()
  };
}

/**
 * Clone template under a new title
 */
export function cloneTemplate(
  base: CostingTemplate,
  newName: string,
  authorName = 'Business Owner'
): CostingTemplate {
  return {
    ...base,
    id: `tpl-clone-${Date.now()}`,
    name: newName,
    version: 'v1.0',
    isDefault: false,
    status: 'active',
    changeLogNotes: `Cloned from "${base.name} (${base.version})"`,
    updatedAt: new Date().toISOString(),
    updatedBy: authorName,
    createdAt: new Date().toISOString()
  };
}
