// src/services/bomScrubberService.ts

import * as XLSX from 'xlsx';
import { StockItem } from '../types';
import {
  RawBomInputItem,
  ScrubbedBomLineItem,
  ScrubbedBomSummary,
  ScrubbedBomRecord,
  SupplierCatalogMasterItem,
  InventoryMatchResult,
  SupplierCatalogMatchResult,
  RiskAnalysisResult,
  AlternateComponent,
  QuotabilityGrade
} from '../types/bomScrubber';
import { DEFAULT_SUPPLIER_CATALOG, MARKET_COMMODITY_INDICES } from './supplierCatalogData';

/**
 * Intelligent Column Detection Dictionary
 */
const COLUMN_ALIASES = {
  partNumber: ['part', 'part number', 'part #', 'part_no', 'mpn', 'sku', 'code', 'drawing no', 'item code', 'component code'],
  description: ['description', 'desc', 'part name', 'item name', 'name', 'component', 'component description', 'material description', 'title'],
  quantity: ['qty', 'quantity', 'count', 'nos', 'pcs', 'req qty', 'units', 'pieces', 'order qty'],
  unit: ['unit', 'uom', 'measure', 'unit of measure'],
  materialGrade: ['material', 'grade', 'material grade', 'spec', 'specs', 'specification', 'alloy'],
  referenceDesignator: ['ref', 'ref des', 'reference', 'designator', 'tag', 'pos', 'item no', 'sl no'],
  targetPrice: ['target price', 'target cost', 'price', 'budget', 'rate', 'target rate'],
  notes: ['notes', 'remarks', 'comment', 'special instructions']
};

/**
 * Find matching column index from a header row
 */
function findColIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(h => (h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ' '));
  return normalized.findIndex(header => {
    return aliases.some(alias => header.includes(alias) || alias.includes(header));
  });
}

/**
 * Parse an Excel file (.xlsx, .xls, .csv) into structured RawBomInputItem array
 */
export async function parseExcelBomFile(file: File): Promise<{
  items: RawBomInputItem[];
  sheetName: string;
  notes: string[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded Excel spreadsheet contains no visible sheets.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert worksheet to 2D array of string/number values
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  if (rawRows.length === 0) {
    throw new Error('The worksheet is empty.');
  }

  const notes: string[] = [];
  
  // Look for header row in first 10 rows
  let headerRowIndex = -1;
  let colMap = {
    partNumber: -1,
    description: -1,
    quantity: -1,
    unit: -1,
    materialGrade: -1,
    referenceDesignator: -1,
    targetPrice: -1,
    notes: -1
  };

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r].map((cell: any) => String(cell || '').trim());
    const pIdx = findColIndex(row, COLUMN_ALIASES.partNumber);
    const dIdx = findColIndex(row, COLUMN_ALIASES.description);
    const qIdx = findColIndex(row, COLUMN_ALIASES.quantity);

    // If we have at least description/part and quantity, consider this the header row
    if ((pIdx !== -1 || dIdx !== -1) && qIdx !== -1) {
      headerRowIndex = r;
      colMap = {
        partNumber: pIdx,
        description: dIdx !== -1 ? dIdx : (pIdx !== -1 ? pIdx : 0),
        quantity: qIdx,
        unit: findColIndex(row, COLUMN_ALIASES.unit),
        materialGrade: findColIndex(row, COLUMN_ALIASES.materialGrade),
        referenceDesignator: findColIndex(row, COLUMN_ALIASES.referenceDesignator),
        targetPrice: findColIndex(row, COLUMN_ALIASES.targetPrice),
        notes: findColIndex(row, COLUMN_ALIASES.notes)
      };
      notes.push(`Detected header row at line ${r + 1} with columns: ${row.filter(Boolean).slice(0, 5).join(', ')}`);
      break;
    }
  }

  // Fallback defaults if no explicit header discovered
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colMap = {
      partNumber: 0,
      description: 1,
      quantity: 2,
      unit: 3,
      materialGrade: 4,
      referenceDesignator: -1,
      targetPrice: -1,
      notes: -1
    };
    notes.push('Using standard column defaults: Col 1=Part Number, Col 2=Description, Col 3=Quantity.');
  }

  const items: RawBomInputItem[] = [];
  let itemCounter = 1;

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const partNumRaw = colMap.partNumber !== -1 ? String(row[colMap.partNumber] || '').trim() : '';
    const descRaw = colMap.description !== -1 ? String(row[colMap.description] || '').trim() : '';
    
    // Skip empty lines or summary rows
    if (!partNumRaw && !descRaw) continue;
    const combined = `${partNumRaw} ${descRaw}`.toLowerCase();
    if (combined.includes('total') || combined.includes('subtotal') || combined.includes('authorized by')) continue;

    // Parse Quantity
    let qty = 1;
    if (colMap.quantity !== -1 && row[colMap.quantity] !== undefined && row[colMap.quantity] !== '') {
      const parsed = parseFloat(String(row[colMap.quantity]).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        qty = parsed;
      }
    }

    const unit = colMap.unit !== -1 && row[colMap.unit] ? String(row[colMap.unit]).trim() : 'pcs';
    const materialGrade = colMap.materialGrade !== -1 && row[colMap.materialGrade] ? String(row[colMap.materialGrade]).trim() : undefined;
    const refDes = colMap.referenceDesignator !== -1 && row[colMap.referenceDesignator] ? String(row[colMap.referenceDesignator]).trim() : undefined;
    
    let targetPrice: number | undefined = undefined;
    if (colMap.targetPrice !== -1 && row[colMap.targetPrice]) {
      const parsedPrice = parseFloat(String(row[colMap.targetPrice]).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        targetPrice = parsedPrice;
      }
    }

    const itemNotes = colMap.notes !== -1 && row[colMap.notes] ? String(row[colMap.notes]).trim() : undefined;

    items.push({
      id: `raw-item-${Date.now()}-${itemCounter}`,
      itemNumber: itemCounter++,
      partNumber: partNumRaw || `PART-${itemCounter.toString().padStart(3, '0')}`,
      description: descRaw || partNumRaw,
      quantity: Math.round(qty),
      unit,
      materialGrade,
      referenceDesignator: refDes,
      targetPrice,
      notes: itemNotes
    });
  }

  notes.push(`Extracted ${items.length} BOM component rows from "${sheetName}".`);
  return { items, sheetName, notes };
}

/**
 * Parse plain-text or PDF extracted text BOM into RawBomInputItem array
 */
export function parseTextOrPdfBom(rawText: string): {
  items: RawBomInputItem[];
  notes: string[];
} {
  const notes: string[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) {
    return { items: [], notes: ['The provided text content is empty.'] };
  }

  // Detect delimiter: tab, comma, semicolon, or vertical pipe |
  let delimiter = '\t';
  const pipeCount = (rawText.match(/\|/g) || []).length;
  const tabCount = (rawText.match(/\t/g) || []).length;
  const commaCount = (rawText.match(/,/g) || []).length;
  const semiCount = (rawText.match(/;/g) || []).length;

  if (pipeCount > 5) delimiter = '|';
  else if (tabCount > 5) delimiter = '\t';
  else if (commaCount > 10) delimiter = ',';
  else if (semiCount > 5) delimiter = ';';
  else delimiter = /\s{2,}/ as any; // Multiple spaces

  const items: RawBomInputItem[] = [];
  let itemCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip common header strings
    if (/(item|part|qty|quantity|description|sl\s*no)/i.test(line) && i < 4) continue;
    if (/(total|subtotal|page\s*\d+|drawing\s*rev)/i.test(line)) continue;

    let tokens: string[] = [];
    if (typeof delimiter === 'string') {
      tokens = line.split(delimiter).map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      tokens = line.split(/\s{2,}|\t/).map(t => t.trim()).filter(Boolean);
    }

    if (tokens.length < 2) {
      // Regex pattern for typical line: "1. EN8 Splined Shaft 45mm - 250 nos - Grade EN8"
      const freePattern = /^(?:(\d+)[\.\)]\s*)?([A-Za-z0-9#\-_/]+)\s*[-:]?\s*([^0-9\-]+)?\s*(?:[-–]|qty:?|quantity:?)?\s*(\d+)\s*(?:nos|pcs|units|kg|mtrs)?(?:\s*[-–]\s*(.*))?$/i;
      const match = line.match(freePattern);
      if (match) {
        items.push({
          id: `raw-item-free-${Date.now()}-${itemCounter}`,
          itemNumber: itemCounter++,
          partNumber: match[2].trim(),
          description: match[3]?.trim() || match[2].trim(),
          quantity: parseInt(match[4], 10) || 1,
          unit: 'pcs',
          materialGrade: match[5]?.trim()
        });
        continue;
      }
      continue;
    }

    // Try finding quantity token
    let qty = 1;
    let qtyTokenIdx = tokens.findIndex(t => /^\d+$/.test(t.replace(/,/g, '')));
    if (qtyTokenIdx !== -1) {
      qty = parseInt(tokens[qtyTokenIdx].replace(/,/g, ''), 10) || 1;
    }

    // Assume token 0 or 1 is part number
    let partNumber = tokens[0];
    let description = tokens[1] || tokens[0];
    
    // If token 0 is just an index (e.g. "1"), shift
    if (/^\d+$/.test(tokens[0]) && tokens.length > 2) {
      partNumber = tokens[1];
      description = tokens[2];
      if (qtyTokenIdx === 0 && tokens.length > 3) {
        // Find next numeric
        const nextNum = tokens.findIndex((t, idx) => idx > 0 && /^\d+$/.test(t));
        qty = nextNum !== -1 ? parseInt(tokens[nextNum], 10) : 1;
      }
    }

    items.push({
      id: `raw-item-text-${Date.now()}-${itemCounter}`,
      itemNumber: itemCounter++,
      partNumber: partNumber.trim(),
      description: description.trim(),
      quantity: qty,
      unit: 'pcs',
      materialGrade: tokens[3]?.trim()
    });
  }

  notes.push(`Parsed ${items.length} BOM lines from unstructured text format.`);
  return { items, notes };
}

/**
 * Normalize strings for fuzzy matching
 */
function cleanKey(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Match a BOM item against current tenant inventory
 */
export function matchInventoryItem(
  bomItem: RawBomInputItem,
  stockItems: StockItem[] = []
): InventoryMatchResult {
  if (!stockItems || stockItems.length === 0) {
    return {
      matched: false,
      currentQty: 0,
      reorderLevel: 0,
      unit: bomItem.unit || 'pcs',
      unitCost: 0,
      shortageQty: bomItem.quantity,
      status: 'OUT_OF_STOCK'
    };
  }

  const pKey = cleanKey(bomItem.partNumber);
  const dKey = cleanKey(bomItem.description);
  const mKey = bomItem.materialGrade ? cleanKey(bomItem.materialGrade) : '';

  // 1. Direct SKU / Code match
  let matchedStock = stockItems.find(s => {
    const sCode = cleanKey(s.code);
    return sCode === pKey || (pKey.length > 3 && sCode.includes(pKey));
  });

  // 2. Name / Description match
  if (!matchedStock) {
    matchedStock = stockItems.find(s => {
      const sName = cleanKey(s.name);
      return sName.includes(dKey) || dKey.includes(sName);
    });
  }

  // 3. Keyword / Grade match (e.g. 'EN8', 'SS 304', 'M12')
  if (!matchedStock && (mKey || pKey)) {
    matchedStock = stockItems.find(s => {
      const combined = cleanKey(`${s.name} ${s.code}`);
      return (mKey && combined.includes(mKey)) || (pKey.length > 4 && combined.includes(pKey));
    });
  }

  if (matchedStock) {
    const currentQty = matchedStock.currentQty || 0;
    const requiredQty = bomItem.quantity;
    const shortageQty = Math.max(0, requiredQty - currentQty);
    
    let status: 'IN_STOCK' | 'PARTIAL_STOCK' | 'OUT_OF_STOCK' = 'OUT_OF_STOCK';
    if (currentQty >= requiredQty) {
      status = 'IN_STOCK';
    } else if (currentQty > 0) {
      status = 'PARTIAL_STOCK';
    }

    // Standard assumed inventory carrying valuation if not recorded
    const estimatedCost = (matchedStock as any).unitCost || (matchedStock as any).lastPurchasePrice || 120;

    return {
      matched: true,
      stockItemId: matchedStock.id,
      stockCode: matchedStock.code,
      stockName: matchedStock.name,
      currentQty,
      reorderLevel: matchedStock.reorderLevel || 0,
      unit: matchedStock.unit || bomItem.unit || 'pcs',
      unitCost: estimatedCost,
      shortageQty,
      status
    };
  }

  return {
    matched: false,
    currentQty: 0,
    reorderLevel: 0,
    unit: bomItem.unit || 'pcs',
    unitCost: 0,
    shortageQty: bomItem.quantity,
    status: 'OUT_OF_STOCK'
  };
}

/**
 * Match a BOM item against approved supplier catalogs with real-time pricing
 */
export function matchSupplierCatalog(
  bomItem: RawBomInputItem,
  customCatalog: SupplierCatalogMasterItem[] = []
): SupplierCatalogMatchResult {
  const combinedCatalog = [...DEFAULT_SUPPLIER_CATALOG, ...customCatalog];
  
  const pKey = cleanKey(bomItem.partNumber);
  const dKey = cleanKey(bomItem.description);
  const mKey = bomItem.materialGrade ? cleanKey(bomItem.materialGrade) : '';

  // 1. Exact Part Number match
  let match = combinedCatalog.find(c => {
    const cPart = cleanKey(c.partNumber);
    return cPart === pKey || (pKey.length > 4 && cPart.includes(pKey));
  });

  // 2. Alternate / cross-reference match
  if (!match) {
    match = combinedCatalog.find(c => {
      return (c.alternates || []).some(alt => cleanKey(alt) === pKey);
    });
  }

  // 3. Keyword & Grade match
  if (!match) {
    match = combinedCatalog.find(c => {
      const cSearch = cleanKey(`${c.description} ${c.materialGrade} ${c.partNumber}`);
      return (mKey && cSearch.includes(mKey)) || (dKey && cSearch.includes(dKey)) || (dKey && dKey.includes(cleanKey(c.manufacturer)));
    });
  }

  if (match) {
    // Apply real-time commodity delta
    let categoryDelta = 1.0;
    if (match.category === 'raw_material') {
      categoryDelta = 1 + (MARKET_COMMODITY_INDICES.steelHotRolled.indexDeltaPercent / 100);
    } else if (match.category === 'fasteners') {
      categoryDelta = 1 + (MARKET_COMMODITY_INDICES.logisticsFreight.indexDeltaPercent / 100);
    } else if (match.category === 'seals_hydraulics') {
      categoryDelta = 1.01;
    }

    const liveUnitPrice = Math.round(match.baseUnitPrice * categoryDelta * 100) / 100;

    return {
      matched: true,
      supplierId: match.id,
      supplierName: match.supplierName,
      supplierPartNumber: match.partNumber,
      manufacturer: match.manufacturer,
      category: match.category,
      moq: match.moq,
      leadTimeDays: match.leadTimeDays,
      unitPrice: liveUnitPrice,
      currency: match.currency || 'INR',
      priceValidity: '30 Days Guaranteed',
      isRealtimePushed: true,
      realtimeLastChecked: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      alternatePartNumbers: match.alternates || []
    };
  }

  // Fallback estimation for custom engineered parts
  return {
    matched: false,
    supplierName: 'Unassigned Supplier (RFQ Needed)',
    supplierPartNumber: bomItem.partNumber,
    category: 'custom_fabrication',
    moq: 1,
    leadTimeDays: 14,
    unitPrice: bomItem.targetPrice || 150,
    currency: 'INR',
    priceValidity: 'Spot Rate Estimate',
    isRealtimePushed: false,
    realtimeLastChecked: 'Estimated'
  };
}

/**
 * Analyze obsolescence risk, lead times, and find FFF (form-fit-function) alternates
 */
export function analyzeObsolescenceAndRisk(
  bomItem: RawBomInputItem,
  inventory: InventoryMatchResult,
  supplier: SupplierCatalogMatchResult,
  customCatalog: SupplierCatalogMasterItem[] = []
): RiskAnalysisResult {
  const combinedCatalog = [...DEFAULT_SUPPLIER_CATALOG, ...customCatalog];
  const combinedText = `${bomItem.partNumber} ${bomItem.description} ${bomItem.materialGrade || ''}`.toLowerCase();

  const riskFactors: string[] = [];
  let isObsolete = false;
  let isLongLead = false;
  let isHighRisk = false;
  let lifecycleStatus: 'ACTIVE' | 'NRND' | 'OBSOLETE' | 'EOL' | 'UNVERIFIED' = 'ACTIVE';

  // Check matched catalog item lifecycle
  const matchedCatalogItem = combinedCatalog.find(c => c.partNumber === supplier.supplierPartNumber);
  if (matchedCatalogItem?.lifecycleStatus) {
    lifecycleStatus = matchedCatalogItem.lifecycleStatus;
  }

  // Detect obsolete keywords
  if (
    lifecycleStatus === 'OBSOLETE' || 
    lifecycleStatus === 'EOL' || 
    combinedText.includes('cadmium') || 
    combinedText.includes('obsolete') || 
    combinedText.includes('discontinued') ||
    combinedText.includes('lead-lined') ||
    combinedText.includes('legacy')
  ) {
    isObsolete = true;
    lifecycleStatus = lifecycleStatus === 'ACTIVE' ? 'OBSOLETE' : lifecycleStatus;
    riskFactors.push('Component is flagged OBSOLETE / End-of-Life by manufacturer or non-RoHS compliant.');
  }

  // Not Recommended for New Designs
  if (combinedText.includes('nrnd') || lifecycleStatus === 'NRND') {
    lifecycleStatus = 'NRND';
    riskFactors.push('Component is NRND (Not Recommended for New Designs); supply chain risk high.');
  }

  // Lead time classification
  const leadDays = supplier.leadTimeDays;
  let leadTimeCategory: 'SHORT' | 'STANDARD' | 'LONG_LEAD' | 'CRITICAL' = 'STANDARD';

  if (leadDays <= 7) {
    leadTimeCategory = 'SHORT';
  } else if (leadDays > 60) {
    leadTimeCategory = 'CRITICAL';
    isLongLead = true;
    riskFactors.push(`Critical procurement lead time of ${leadDays} days exceeds standard production cycle.`);
  } else if (leadDays > 21) {
    leadTimeCategory = 'LONG_LEAD';
    isLongLead = true;
    riskFactors.push(`Long lead item (${leadDays} days). Advance procurement requisition mandatory.`);
  }

  // Check unverified parts
  if (!inventory.matched && !supplier.matched) {
    lifecycleStatus = 'UNVERIFIED';
    riskFactors.push('Component not indexed in inventory or supplier catalog. Requires engineering quote.');
  }

  // Check shortage
  if (inventory.status === 'OUT_OF_STOCK' && !supplier.matched) {
    riskFactors.push('Zero stock on hand and no qualified vendor catalog item found.');
  }

  isHighRisk = isObsolete || leadTimeCategory === 'CRITICAL' || (isLongLead && inventory.status === 'OUT_OF_STOCK');

  // Find recommended alternates
  const recommendedAlternates: AlternateComponent[] = [];
  
  // 1. From catalog item alternates
  if (matchedCatalogItem && matchedCatalogItem.alternates?.length) {
    for (const altPart of matchedCatalogItem.alternates) {
      const altCatalog = combinedCatalog.find(c => c.partNumber === altPart && c.lifecycleStatus === 'ACTIVE');
      if (altCatalog) {
        recommendedAlternates.push({
          partNumber: altCatalog.partNumber,
          manufacturer: altCatalog.manufacturer,
          description: altCatalog.description,
          leadTimeDays: altCatalog.leadTimeDays,
          unitPrice: altCatalog.baseUnitPrice,
          lifecycleStatus: 'ACTIVE',
          statusReason: 'Qualified Active Form-Fit-Function Drop-in Replacement'
        });
      }
    }
  }

  // 2. Generic rule-based alternates for known obsolete items
  if (recommendedAlternates.length === 0 && isObsolete) {
    if (combinedText.includes('cadmium') || combinedText.includes('m10')) {
      recommendedAlternates.push({
        partNumber: 'UNB-M10-FLANGE-ZN-NI',
        manufacturer: 'Unbrako GreenLine',
        description: 'M10 All-Metal Flange Nut Zinc-Nickel (RoHS Compliant)',
        leadTimeDays: 4,
        unitPrice: 18.5,
        lifecycleStatus: 'ACTIVE',
        statusReason: 'Eco-compliant RoHS alternative to cadmium plated hardware'
      });
    } else if (combinedText.includes('6205')) {
      recommendedAlternates.push({
        partNumber: 'SKF-6205-2RSH',
        manufacturer: 'SKF',
        description: 'Deep Groove Ball Bearing 25x52x15mm Dual Nitrile Seals',
        leadTimeDays: 3,
        unitPrice: 215,
        lifecycleStatus: 'ACTIVE',
        statusReason: 'Current generation high-durability sealed bearing'
      });
    } else if (combinedText.includes('glycodur') || combinedText.includes('bushing')) {
      recommendedAlternates.push({
        partNumber: 'GLY-PG-252830-LF',
        manufacturer: 'Glycodur',
        description: 'Lead-Free Composite Dry Bushing 25x28x30mm',
        leadTimeDays: 4,
        unitPrice: 135,
        lifecycleStatus: 'ACTIVE',
        statusReason: 'Lead-free REACH/RoHS certified composite bushing'
      });
    }
  }

  return {
    lifecycleStatus,
    leadTimeCategory,
    isObsolete,
    isLongLead,
    isHighRisk,
    riskFactors,
    recommendedAlternates
  };
}

/**
 * Main Scrubbing & Validation Engine
 */
export function scrubAndValidateBom(
  rawItems: RawBomInputItem[],
  stockItems: StockItem[] = [],
  customCatalog: SupplierCatalogMasterItem[] = [],
  options: {
    marginPercent?: number;
    scrapBufferPercent?: number;
  } = {}
): {
  scrubbedItems: ScrubbedBomLineItem[];
  summary: ScrubbedBomSummary;
} {
  const marginPercent = options.marginPercent ?? 18;
  const scrapBufferPercent = options.scrapBufferPercent ?? 3;

  let inStockCount = 0;
  let partialStockCount = 0;
  let outOfStockCount = 0;
  let supplierAvailableCount = 0;
  let obsoleteCount = 0;
  let longLeadCount = 0;
  let unverifiedCount = 0;
  let totalComponentCost = 0;
  let criticalPathLeadTimeDays = 0;
  let bottleneckItemName = '';

  const scrubbedItems: ScrubbedBomLineItem[] = rawItems.map((raw, idx) => {
    const inventory = matchInventoryItem(raw, stockItems);
    const supplier = matchSupplierCatalog(raw, customCatalog);
    const risk = analyzeObsolescenceAndRisk(raw, inventory, supplier, customCatalog);

    // Track counts
    if (inventory.status === 'IN_STOCK') inStockCount++;
    else if (inventory.status === 'PARTIAL_STOCK') partialStockCount++;
    else outOfStockCount++;

    if (supplier.matched) supplierAvailableCount++;
    if (risk.isObsolete) obsoleteCount++;
    if (risk.isLongLead) longLeadCount++;
    if (risk.lifecycleStatus === 'UNVERIFIED') unverifiedCount++;

    // Pricing selection
    let selectedSource: 'INVENTORY' | 'SUPPLIER_CATALOG' | 'MANUAL_QUOTE' = 'SUPPLIER_CATALOG';
    let effectiveUnitPrice = supplier.unitPrice;

    if (inventory.status === 'IN_STOCK' && inventory.unitCost > 0) {
      selectedSource = 'INVENTORY';
      effectiveUnitPrice = inventory.unitCost;
    } else if (supplier.matched) {
      selectedSource = 'SUPPLIER_CATALOG';
      effectiveUnitPrice = supplier.unitPrice;
    } else if (raw.targetPrice) {
      selectedSource = 'MANUAL_QUOTE';
      effectiveUnitPrice = raw.targetPrice;
    }

    const extendedPrice = Math.round(effectiveUnitPrice * raw.quantity * 100) / 100;
    totalComponentCost += extendedPrice;

    // Effective lead time (0 if already in stock, else supplier lead time)
    const effectiveLeadTimeDays = inventory.status === 'IN_STOCK' ? 0 : supplier.leadTimeDays;
    if (effectiveLeadTimeDays > criticalPathLeadTimeDays) {
      criticalPathLeadTimeDays = effectiveLeadTimeDays;
      bottleneckItemName = raw.description || raw.partNumber;
    }

    // Determine validation message and status
    let validationStatus: 'VALID' | 'WARNING' | 'CRITICAL_BLOCKER' = 'VALID';
    let validationMessage = 'Readily Available: Verified against active supply chain.';

    if (risk.isObsolete) {
      validationStatus = 'CRITICAL_BLOCKER';
      validationMessage = `BLOCKED: Obsolete/EOL component. Substitute with approved alternate (${risk.recommendedAlternates[0]?.partNumber || 'RFQ required'}).`;
    } else if (risk.leadTimeCategory === 'CRITICAL') {
      validationStatus = 'CRITICAL_BLOCKER';
      validationMessage = `CRITICAL LEAD TIME: ${supplier.leadTimeDays} days procurement cycle. May delay customer delivery commitment.`;
    } else if (risk.isLongLead) {
      validationStatus = 'WARNING';
      validationMessage = `LONG LEAD: ${supplier.leadTimeDays} days. Early purchase order required upon quotation approval.`;
    } else if (inventory.status === 'PARTIAL_STOCK') {
      validationStatus = 'WARNING';
      validationMessage = `PARTIAL STOCK: Warehouse holds ${inventory.currentQty} ${inventory.unit}. Procuring shortage of ${inventory.shortageQty} ${inventory.unit}.`;
    } else if (!inventory.matched && !supplier.matched) {
      validationStatus = 'WARNING';
      validationMessage = 'UNVERIFIED COMPONENT: Drawing specs require manual cost estimation by engineer.';
    }

    return {
      id: raw.id || `scrubbed-${idx}-${Date.now()}`,
      itemNumber: raw.itemNumber || idx + 1,
      partNumber: raw.partNumber,
      description: raw.description,
      quantity: raw.quantity,
      unit: raw.unit || 'pcs',
      materialGrade: raw.materialGrade,
      referenceDesignator: raw.referenceDesignator,
      targetPrice: raw.targetPrice,
      notes: raw.notes,
      inventory,
      supplier,
      risk,
      selectedSource,
      effectiveUnitPrice,
      extendedPrice,
      effectiveLeadTimeDays,
      validationStatus,
      validationMessage,
      isProcurementApproved: validationStatus !== 'CRITICAL_BLOCKER'
    };
  });

  // Calculate Quotability Score (0 - 100)
  const totalItems = rawItems.length;
  let quotabilityScore = 100;
  
  if (totalItems > 0) {
    const penaltyObsolete = (obsoleteCount / totalItems) * 45;
    const penaltyUnverified = (unverifiedCount / totalItems) * 20;
    const penaltyLongLead = (longLeadCount / totalItems) * 15;
    const stockBonus = (inStockCount / totalItems) * 10;
    
    quotabilityScore = Math.max(10, Math.min(100, Math.round(100 - penaltyObsolete - penaltyUnverified - penaltyLongLead + stockBonus)));
  }

  let quotabilityGrade: QuotabilityGrade = 'A_READY_TO_QUOTE';
  if (obsoleteCount > 0) {
    quotabilityGrade = 'D_DO_NOT_QUOTE';
  } else if (quotabilityScore < 60) {
    quotabilityGrade = 'C_HIGH_RISK';
  } else if (quotabilityScore < 85 || longLeadCount > 0) {
    quotabilityGrade = 'B_QUOTABLE_WITH_CONDITIONS';
  }

  const procurableRate = totalItems > 0 
    ? Math.round(((totalItems - obsoleteCount) / totalItems) * 100) 
    : 100;

  // Landed Cost & Suggested Quote Price calculation
  const bufferAmount = totalComponentCost * (scrapBufferPercent / 100);
  const costWithBuffer = totalComponentCost + bufferAmount;
  const suggestedQuotePrice = Math.round(costWithBuffer * (1 + marginPercent / 100));

  const summary: ScrubbedBomSummary = {
    totalItems,
    totalQuantity: rawItems.reduce((sum, i) => sum + i.quantity, 0),
    inStockCount,
    partialStockCount,
    outOfStockCount,
    supplierAvailableCount,
    obsoleteCount,
    longLeadCount,
    unverifiedCount,
    procurableRate,
    quotabilityScore,
    quotabilityGrade,
    totalComponentCost: Math.round(totalComponentCost),
    suggestedQuotePrice,
    marginPercent,
    scrapBufferPercent,
    criticalPathLeadTimeDays,
    bottleneckItemName: bottleneckItemName || 'None (All In Stock)',
    realtimeMarketIndexDelta: MARKET_COMMODITY_INDICES.steelHotRolled.indexDeltaPercent,
    lastPriceRefreshAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };

  return { scrubbedItems, summary };
}

/**
 * Generate a downloadable sample Excel BOM file with realistic engineering parts
 */
export function generateSampleExcelBomWorkbook(presetType: 'hydraulic' | 'transmission' | 'piping'): Uint8Array {
  const wb = XLSX.utils.book_new();

  let rows: any[] = [];
  let sheetName = 'Customer_BOM';

  if (presetType === 'hydraulic') {
    sheetName = 'Hydraulic_Cylinder_BOM';
    rows = [
      ['Item #', 'Part Number / MPN', 'Component Description', 'Qty', 'UoM', 'Material Grade / Spec', 'Target Unit Price (₹)', 'Engineering Remarks'],
      [1, 'WR-1002', 'High Tensile Wire Rod 8mm Core Wire', 25, 'tonnes', 'HT Steel Grade 1008', 45000, 'Verify factory stock in bay 3'],
      [2, 'TS-EN8-RD45', 'Precision Piston Rod Dia 45mm x 450mm Length', 120, 'pcs', 'EN8 Normalized', 950, 'Hard chrome plated 25 micron finish'],
      [3, 'KAL-VAC-INGOT-42CR', 'Cylinder Barrel Forging Billet Dia 160mm', 15, 'pcs', '42CrMo4 ESR', 18500, 'Long lead forging item - check schedule'],
      [4, 'PKR-POLYPAK-B-1250', 'Hydraulic Piston Polypak Seal 1.25" ID', 240, 'pcs', 'Molythane 95A', 150, 'Standard hydraulic seal pack'],
      [5, 'PKR-VITON-OR-AS568-214', 'End Cap Viton O-Ring 0.984" ID x 0.139"', 240, 'pcs', 'Viton FKM 75A', 35, 'High temperature seal grade'],
      [6, 'UNB-M10-PRE-LOCK-CAD', 'M10 Flange Locknut Cadmium Plated', 500, 'pcs', 'Steel Class 10 Cadmium', 25, 'OBSOLETE SPEC: Customer drawing specifies legacy Cadmium finish!'],
      [7, 'UNB-M12X50-10.9', 'M12 x 50mm Socket Head Cap Screw Gr 10.9', 480, 'pcs', 'Alloy Steel 10.9', 28, 'Black phosphated finish']
    ];
  } else if (presetType === 'transmission') {
    sheetName = 'Transmission_Gearbox_BOM';
    rows = [
      ['Item #', 'Part Number / MPN', 'Component Description', 'Qty', 'UoM', 'Material Grade / Spec', 'Target Unit Price (₹)', 'Engineering Remarks'],
      [1, 'TS-EN19-RD60', 'Input Splined Pinion Shaft Dia 60mm x 320mm', 85, 'pcs', 'EN19 / 4140 Annealed', 2400, 'Spline hobbing & gas carburized'],
      [2, 'SKF-6205-2RSH', 'Deep Groove Ball Bearing 25x52x15mm Dual Sealed', 170, 'pcs', '100Cr6 Chromium Steel', 230, 'Active standard bearing'],
      [3, 'SKF-6205-RS-DISC', 'Secondary Idler Ball Bearing (Single Seal)', 85, 'pcs', '100Cr6 Classic', 220, 'OBSOLETE SPEC: Older single seal drawing reference'],
      [4, 'TIM-30206-TAPER', 'Output Differential Tapered Roller Bearing', 170, 'pcs', 'Carburized Alloy Steel', 550, 'High torque bearing assembly'],
      [5, 'GLY-PG-252830-PB', 'Reverse Gearbox Sliding Bushing 25x28x30mm', 85, 'pcs', 'CuSn8 Lead-Alloy Bronze', 160, 'DISCONTINUED / EOL: Legacy lead formula'],
      [6, 'TVS-M16X80-8.8', 'Gearbox Casing Hex Bolt M16 x 80mm Gr 8.8', 680, 'pcs', 'Medium Carbon Steel 8.8', 42, 'Yellow zinc passivated'],
      [7, 'SND-CNMG-120408-PM-4325', 'Carbide Turning Insert for Casing Bore Machining', 30, 'pcs', 'Tungsten Carbide 4325', 450, 'Machine shop tooling consumable']
    ];
  } else {
    sheetName = 'Stainless_Piping_BOM';
    rows = [
      ['Item #', 'Part Number / MPN', 'Component Description', 'Qty', 'UoM', 'Material Grade / Spec', 'Target Unit Price (₹)', 'Engineering Remarks'],
      [1, 'JSL-SS316L-RD50', 'SS 316L Solid Flange Hub Round Bar 50mm', 140, 'pcs', 'SS 316L / 1.4404', 3200, 'Marine environment sour service NACE MR0175'],
      [2, 'JSL-SS304-PL10', 'Base Flange Laser Cutting Sheet 10mm', 45, 'pcs', 'SS 304 / 1.4301', 5400, 'Laser cut profile with 8 PCD holes'],
      [3, 'SM-INCONEL-718-BAR', 'High Pressure Relief Valve Spool 35mm', 12, 'pcs', 'Inconel 718 Aged Bar', 18000, 'CRITICAL LEAD TIME: Exotic superalloy import'],
      [4, 'UNB-M12X50-10.9', 'SS Heavy Studs M12 x 50mm with Twin Nuts', 560, 'pcs', 'Alloy Steel 10.9', 45, 'PTFE coated studs for offshore skid']
    ];
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 45 },
    { wch: 10 },
    { wch: 10 },
    { wch: 28 },
    { wch: 22 },
    { wch: 45 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}

/**
 * Export scrubbed BOM report to Excel
 */
export function exportScrubbedBomReportToExcel(
  record: {
    bomTitle: string;
    items: ScrubbedBomLineItem[];
    summary: ScrubbedBomSummary;
  }
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Detailed Scrubbed Items
  const itemsData: any[][] = [
    [
      'Item #',
      'Part Number',
      'Description',
      'Req Qty',
      'UoM',
      'Specs / Grade',
      'Warehouse Stock Status',
      'Stock Qty',
      'Shortage Qty',
      'Approved Supplier',
      'Supplier Part #',
      'Lead Time (Days)',
      'Lifecycle Status',
      'Obsolescence / Risk Flag',
      'Effective Unit Price (₹)',
      'Extended Total Cost (₹)',
      'Validation Status',
      'Engineering Action Message'
    ]
  ];

  for (const item of record.items) {
    itemsData.push([
      item.itemNumber,
      item.partNumber,
      item.description,
      item.quantity,
      item.unit,
      item.materialGrade || '-',
      item.inventory.status,
      item.inventory.currentQty,
      item.inventory.shortageQty,
      item.supplier.supplierName,
      item.supplier.supplierPartNumber,
      item.effectiveLeadTimeDays,
      item.risk.lifecycleStatus,
      item.risk.isObsolete ? 'OBSOLETE / EOL' : (item.risk.isLongLead ? 'LONG LEAD' : 'ACTIVE'),
      item.effectiveUnitPrice,
      item.extendedPrice,
      item.validationStatus,
      item.validationMessage
    ]);
  }

  const wsItems = XLSX.utils.aoa_to_sheet(itemsData);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Validated_BOM_Components');

  // Sheet 2: Executive Costing Summary
  const summaryData: any[][] = [
    ['ASHREY FLOWOPS - AUTOMATED BOM SCRUBBING & COSTING AUDIT REPORT'],
    ['BOM Title:', record.bomTitle],
    ['Audit Timestamp:', new Date().toLocaleString('en-IN')],
    ['Market Commodity Index Delta:', `${record.summary.realtimeMarketIndexDelta}%`],
    [''],
    ['EXECUTIVE VALIDATION METRICS', 'VALUE'],
    ['Total Component Line Items', record.summary.totalItems],
    ['Total Components Quantity', record.summary.totalQuantity],
    ['Warehouse In-Stock Items', record.summary.inStockCount],
    ['Partial Stock Items', record.summary.partialStockCount],
    ['Procurement Shortage Items', record.summary.outOfStockCount],
    ['Flagged Obsolete / EOL Items', record.summary.obsoleteCount],
    ['Flagged Long-Lead Items (>21d)', record.summary.longLeadCount],
    ['Unverified Custom Drawing Items', record.summary.unverifiedCount],
    ['Procurable Feasibility Rate', `${record.summary.procurableRate}%`],
    ['Quotability Health Score', `${record.summary.quotabilityScore} / 100`],
    ['Overall Quotability Grade', record.summary.quotabilityGrade],
    ['Critical Path Procurement Lead Time', `${record.summary.criticalPathLeadTimeDays} Days`],
    ['Lead Time Bottleneck Part', record.summary.bottleneckItemName || 'None'],
    [''],
    ['COMMERCIAL COSTING ROLLUP', 'AMOUNT (INR ₹)'],
    ['Total Net Component Procurement Cost', record.summary.totalComponentCost],
    ['Scrap & Buffer Reserve Percentage', `${record.summary.scrapBufferPercent}%`],
    ['Target Profit Margin Percentage', `${record.summary.marginPercent}%`],
    ['Suggested Customer Quotation Value', record.summary.suggestedQuotePrice]
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Commercial_Summary');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}
