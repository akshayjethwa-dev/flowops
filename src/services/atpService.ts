// src/services/atpService.ts

import { StockItem, Order } from '../types';
import { MultiLevelBom, MultiLevelBomNode } from '../types/multiLevelBom';
import { PurchaseOrder } from '../types/purchaseOrder';
import { StockReservationService } from './stockReservationService';

// ── Typed State Machine & Domain Errors ──────────────────────────────

export class CircularBOMError extends Error {
  name = 'CircularBOMError';
  productId: string;
  cyclePath: string;

  constructor(productId: string, cyclePath: string = '') {
    const detail = cyclePath ? ` (cycle: ${cyclePath})` : '';
    super(`BOM configuration error on product ${productId}. Circular BOM reference detected${detail}. Contact engineering.`);
    this.productId = productId;
    this.cyclePath = cyclePath;
    Object.setPrototypeOf(this, CircularBOMError.prototype);
  }
}

export class BOMDepthExceededError extends Error {
  name = 'BOMDepthExceededError';
  productId: string;
  depth: number;
  maxDepth: number;

  constructor(productId: string, depth: number, maxDepth: number) {
    super(`BOM depth limit of ${maxDepth} exceeded for product '${productId}' (reached level ${depth}). Recursion capped to prevent runaway queries.`);
    this.productId = productId;
    this.depth = depth;
    this.maxDepth = maxDepth;
    Object.setPrototypeOf(this, BOMDepthExceededError.prototype);
  }
}

export class ValidationError extends Error {
  name = 'ValidationError';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// ── Result & Breakdown Types ────────────────────────────────────────

export type OverallAtpStatus = 'available' | 'partial' | 'unavailable';

export interface AtpShortfall {
  componentId: string;
  componentName: string;
  partNumber?: string;
  required: number;
  available: number;
  shortfall: number;
  expectedReplenishmentDate: string | null;
  unit?: string;
  currentStock?: number;
  reservedStock?: number;
  plannedReceipts?: number;
  committedOrders?: number;
  notes?: string;
}

export interface ExplodedComponentDetail {
  componentId: string;
  componentName: string;
  partNumber: string;
  level: number;
  itemType: string;
  qtyPerParent: number;
  totalRequired: number;
  unit: string;
  currentStock: number;
  reservedStock: number;
  plannedReceipts: number;
  committedOrders: number;
  atp: number;
  shortfall: number;
  isAvailable: boolean;
  expectedReplenishmentDate: string | null;
  leadTimeDays?: number;
}

export interface AtpResult {
  productId: string;
  productName: string;
  requiredQty: number;
  asOfDate: string;
  overallStatus: OverallAtpStatus;
  shortfalls: AtpShortfall[];
  components: ExplodedComponentDetail[];
  earliestPossibleReplenishmentDate: string | null;
  cached: boolean;
  calculatedAt: string;
  staleAfter: string;
  isStale: boolean;
  hasBOM: boolean;
  bomRevision?: string;
  isPurchasedItem?: boolean;
  isNoStockNoBom?: boolean;
  cacheKey: string;
}

export interface AtpCalculationOptions {
  tenantId?: string;
  stockItems?: StockItem[];
  boms?: MultiLevelBom[];
  orders?: Order[];
  purchaseOrders?: PurchaseOrder[];
  maxDepth?: number; // default: 10
  forceRefresh?: boolean;
  allowStale?: boolean;
  isSandboxMode?: boolean;
  simulateTimeout?: boolean;
  simulateDelayMs?: number;
  timeoutMs?: number;
  excludeOrderId?: string;
}

// In-Memory Cache with 5-minute TTL per (productId, qty, asOfDate)
interface CacheEntry {
  result: AtpResult;
  cachedAt: number;
  staleAfter: number;
}

const atpMemoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Fallback Catalog BOM & Stock Data ─────────────────────────────────
// Seeded definitions for demo products including prompt's Gear Box example

interface CatalogComponentDef {
  partNumber: string;
  partName: string;
  qtyPerParent: number;
  unit: string;
  itemType: string;
  leadTimeDays: number;
  stock?: { current: number; reserved: number; planned: number; committed: number };
  children?: CatalogComponentDef[];
}

const CATALOG_PRODUCT_BOMS: Record<string, {
  name: string;
  partNumber: string;
  revision: string;
  components: CatalogComponentDef[];
}> = {
  // Gear Box example from user prompt:
  // 1 Gear Box = 1 Casting + 2 Shafts
  // Casting: Stock 80, Reserved 10, Planned 0 -> ATP 70
  // Shafts: Stock 60, Reserved 0, Planned 0 -> ATP 60 (shortfall 40)
  'gear_box': {
    name: 'Industrial Heavy-Duty Gear Box',
    partNumber: 'ASM-GBX-100',
    revision: 'Rev A.1',
    components: [
      {
        partNumber: 'PRT-CST-50',
        partName: 'Casting (Gear Box Ductile Iron Housing)',
        qtyPerParent: 1,
        unit: 'pcs',
        itemType: 'raw_material',
        leadTimeDays: 7,
        stock: { current: 80, reserved: 10, planned: 0, committed: 0 }
      },
      {
        partNumber: 'PRT-SHF-100',
        partName: 'Shaft (EN24 Alloy Steel Drive Shaft)',
        qtyPerParent: 2,
        unit: 'pcs',
        itemType: 'raw_material',
        leadTimeDays: 10,
        stock: { current: 60, reserved: 0, planned: 0, committed: 0 }
      }
    ]
  },
  'gearbox': {
    name: 'Industrial Heavy-Duty Gear Box',
    partNumber: 'ASM-GBX-100',
    revision: 'Rev A.1',
    components: [
      {
        partNumber: 'PRT-CST-50',
        partName: 'Casting (Gear Box Ductile Iron Housing)',
        qtyPerParent: 1,
        unit: 'pcs',
        itemType: 'raw_material',
        leadTimeDays: 7,
        stock: { current: 80, reserved: 10, planned: 0, committed: 0 }
      },
      {
        partNumber: 'PRT-SHF-100',
        partName: 'Shaft (EN24 Alloy Steel Drive Shaft)',
        qtyPerParent: 2,
        unit: 'pcs',
        itemType: 'raw_material',
        leadTimeDays: 10,
        stock: { current: 60, reserved: 0, planned: 0, committed: 0 }
      }
    ]
  },
  'forged steel spur gear (mod 4, 32t)': {
    name: 'Forged Steel Spur Gear (Mod 4, 32T)',
    partNumber: 'PRT-SPUR-4M',
    revision: 'Rev B.0',
    components: [
      {
        partNumber: 'SA-SPUR-BLANK',
        partName: 'Rough Forged Blank Sub-Assembly',
        qtyPerParent: 1,
        unit: 'pcs',
        itemType: 'sub_assembly',
        leadTimeDays: 5,
        children: [
          {
            partNumber: 'WR-1002',
            partName: 'Wire Rod — High Tensile Steel 8mm',
            qtyPerParent: 0.05,
            unit: 'tonnes',
            itemType: 'raw_material',
            leadTimeDays: 4,
            stock: { current: 12, reserved: 2, planned: 5, committed: 1 }
          },
          {
            partNumber: 'RB-40CS',
            partName: 'Round Bars - Carbon Steel CS45 40mm',
            qtyPerParent: 0.04,
            unit: 'tonnes',
            itemType: 'raw_material',
            leadTimeDays: 6,
            stock: { current: 8, reserved: 1, planned: 0, committed: 0 }
          }
        ]
      },
      {
        partNumber: 'SP-M12B',
        partName: 'M12 Hex Bolts — Grade 8.8 High S',
        qtyPerParent: 4,
        unit: 'pcs',
        itemType: 'hardware',
        leadTimeDays: 2,
        stock: { current: 500, reserved: 50, planned: 200, committed: 100 }
      }
    ]
  },
  'high-density cast iron grate valve (dn150)': {
    name: 'High-Density Cast Iron Grate Valve (DN150)',
    partNumber: 'ASM-VAL-150',
    revision: 'Rev A.0',
    components: [
      {
        partNumber: 'RM-CI-CST',
        partName: 'Heavy Cast Iron Body Casting DN150',
        qtyPerParent: 1,
        unit: 'pcs',
        itemType: 'raw_material',
        leadTimeDays: 12,
        stock: { current: 0, reserved: 0, planned: 0, committed: 0 } // No stock, no planned
      },
      {
        partNumber: 'PRT-SHF-100',
        partName: 'EN24 Alloy Steel Drive Shaft',
        qtyPerParent: 1,
        unit: 'pcs',
        itemType: 'raw_material',
        leadTimeDays: 14,
        stock: { current: 60, reserved: 0, planned: 0, committed: 0 }
      }
    ]
  },
  // Circular reference demo product for EC testing (A -> B -> A)
  'demo_circular_bom': {
    name: 'Circular BOM Demonstration Assembly',
    partNumber: 'DEMO-CIRC-A',
    revision: 'Rev ERR',
    components: [
      {
        partNumber: 'DEMO-CIRC-B',
        partName: 'Sub-tier Module B',
        qtyPerParent: 1,
        unit: 'pcs',
        itemType: 'sub_assembly',
        leadTimeDays: 5,
        children: [
          {
            partNumber: 'DEMO-CIRC-A', // Loops back to parent A!
            partName: 'Circular Root Link A',
            qtyPerParent: 1,
            unit: 'pcs',
            itemType: 'assembly',
            leadTimeDays: 5
          }
        ]
      }
    ]
  },
  // Deep nested BOM demo (12 levels deep) for EC testing
  'demo_deep_bom': {
    name: 'Deep Nested BOM Assembly (12 Levels)',
    partNumber: 'DEMO-DEEP-01',
    revision: 'Rev D12',
    components: [
      {
        partNumber: 'LVL-02',
        partName: 'Level 2 Module',
        qtyPerParent: 1,
        unit: 'pcs',
        itemType: 'sub_assembly',
        leadTimeDays: 2,
        children: [
          {
            partNumber: 'LVL-03',
            partName: 'Level 3 Module',
            qtyPerParent: 1,
            unit: 'pcs',
            itemType: 'sub_assembly',
            leadTimeDays: 2,
            children: [
              {
                partNumber: 'LVL-04',
                partName: 'Level 4 Module',
                qtyPerParent: 1,
                unit: 'pcs',
                itemType: 'sub_assembly',
                leadTimeDays: 2,
                children: [
                  {
                    partNumber: 'LVL-05',
                    partName: 'Level 5 Module',
                    qtyPerParent: 1,
                    unit: 'pcs',
                    itemType: 'sub_assembly',
                    leadTimeDays: 2,
                    children: [
                      {
                        partNumber: 'LVL-06',
                        partName: 'Level 6 Module',
                        qtyPerParent: 1,
                        unit: 'pcs',
                        itemType: 'sub_assembly',
                        leadTimeDays: 2,
                        children: [
                          {
                            partNumber: 'LVL-07',
                            partName: 'Level 7 Module',
                            qtyPerParent: 1,
                            unit: 'pcs',
                            itemType: 'sub_assembly',
                            leadTimeDays: 2,
                            children: [
                              {
                                partNumber: 'LVL-08',
                                partName: 'Level 8 Module',
                                qtyPerParent: 1,
                                unit: 'pcs',
                                itemType: 'sub_assembly',
                                leadTimeDays: 2,
                                children: [
                                  {
                                    partNumber: 'LVL-09',
                                    partName: 'Level 9 Module',
                                    qtyPerParent: 1,
                                    unit: 'pcs',
                                    itemType: 'sub_assembly',
                                    leadTimeDays: 2,
                                    children: [
                                      {
                                        partNumber: 'LVL-10',
                                        partName: 'Level 10 Module',
                                        qtyPerParent: 1,
                                        unit: 'pcs',
                                        itemType: 'sub_assembly',
                                        leadTimeDays: 2,
                                        children: [
                                          {
                                            partNumber: 'LVL-11',
                                            partName: 'Level 11 Module (Exceeds Max Depth)',
                                            qtyPerParent: 1,
                                            unit: 'pcs',
                                            itemType: 'raw_material',
                                            leadTimeDays: 2
                                          }
                                        ]
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};

// Direct purchased items without BOM
const CATALOG_PURCHASED_ITEMS: Record<string, {
  name: string;
  partNumber: string;
  stock: { current: number; reserved: number; planned: number; committed: number };
  unit: string;
  leadTimeDays: number;
}> = {
  'prt-shf-100': {
    name: 'EN24 Alloy Steel Drive Shaft',
    partNumber: 'PRT-SHF-100',
    stock: { current: 60, reserved: 0, planned: 0, committed: 0 },
    unit: 'pcs',
    leadTimeDays: 10
  },
  'prt-cst-50': {
    name: 'Casting (Gear Box Ductile Iron Housing)',
    partNumber: 'PRT-CST-50',
    stock: { current: 80, reserved: 10, planned: 0, committed: 0 },
    unit: 'pcs',
    leadTimeDays: 7
  },
  'std-hex-m12': {
    name: 'M12 Hex Bolts — Grade 8.8 High S',
    partNumber: 'SP-M12B',
    stock: { current: 400, reserved: 50, planned: 100, committed: 20 },
    unit: 'pcs',
    leadTimeDays: 3
  },
  'rm-ci-cst': {
    name: 'Heavy Cast Iron Body Casting DN150',
    partNumber: 'RM-CI-CST',
    stock: { current: 0, reserved: 0, planned: 0, committed: 0 },
    unit: 'pcs',
    leadTimeDays: 0 // No stock, no planned, no replenishment
  }
};

// ── Service Class & Core Methods ─────────────────────────────────────

export class AtpService {

  /**
   * Validates target asOfDate string.
   * Throws ValidationError if date is in the past or invalid. (EC: asOfDate is in the past)
   */
  static validateAsOfDate(asOfDate: string): Date {
    if (!asOfDate) {
      throw new ValidationError('Availability date is required.');
    }

    const targetDate = new Date(asOfDate);
    if (isNaN(targetDate.getTime())) {
      throw new ValidationError(`Invalid availability date format: '${asOfDate}'.`);
    }

    // Compare date midnight to prevent false rejects on today's local date
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();

    if (targetMidnight < todayMidnight) {
      throw new ValidationError('Availability date cannot be in the past.');
    }

    return targetDate;
  }

  /**
   * Generates a 5-minute cache key for (productId, qty, asOfDate).
   */
  static getCacheKey(productId: string, requiredQty: number, asOfDate: string, tenantId: string = 'default'): string {
    const cleanId = (productId || '').trim().toLowerCase();
    const cleanDate = (asOfDate || '').split('T')[0];
    return `${tenantId}::${cleanId}::${requiredQty}::${cleanDate}`;
  }

  /**
   * Clears in-memory ATP calculation cache.
   */
  static clearCache(): void {
    atpMemoryCache.clear();
  }

  /**
   * Recursive BOM Explosion and ATP Calculation Service.
   * Exposes calculateATP(productId, requiredQty, asOfDate, options?).
   *
   * @param productId Unique identifier or part number of product
   * @param requiredQty Quantity requested by the sales order line
   * @param asOfDate Target delivery/availability date (YYYY-MM-DD or ISO string)
   * @param options Additional configuration (tenantId, stockItems, BOMs, maxDepth, forceRefresh)
   *
   * @throws ValidationError if asOfDate is in the past or requiredQty <= 0
   * @throws CircularBOMError if a cycle is detected during explosion
   * @throws BOMDepthExceededError if recursion exceeds maxDepth (default 10)
   */
  static async calculateATP(
    productId: string,
    requiredQty: number,
    asOfDate: string,
    options?: AtpCalculationOptions
  ): Promise<AtpResult> {
    // 1. Parameter Validation
    if (!productId || typeof productId !== 'string' || productId.trim() === '') {
      throw new ValidationError('Product ID is required.');
    }
    if (typeof requiredQty !== 'number' || requiredQty <= 0) {
      throw new ValidationError('Required quantity must be a positive number.');
    }

    // EC: asOfDate is in the past -> Rejected with ValidationError
    const validatedDate = this.validateAsOfDate(asOfDate);
    const dateStr = validatedDate.toISOString().split('T')[0];

    const tenantId = options?.tenantId || 'demo_tenant';
    const maxDepth = options?.maxDepth || 10;
    const cacheKey = this.getCacheKey(productId, requiredQty, dateStr, tenantId);
    const now = Date.now();

    // 2. Cache Check (5-minute TTL per Acceptance Criteria)
    const cachedEntry = atpMemoryCache.get(cacheKey);
    if (cachedEntry && !options?.forceRefresh) {
      const isStale = now >= cachedEntry.staleAfter;
      if (!isStale) {
        return {
          ...cachedEntry.result,
          cached: true,
          isStale: false
        };
      }
      if (options?.allowStale) {
        return {
          ...cachedEntry.result,
          cached: true,
          isStale: true
        };
      }
    }

    // 3. Resolve Stock, BOMs, and Order Pipeline
    const stockItems = options?.stockItems || this.resolveStockItems(tenantId);
    const multiLevelBoms = options?.boms || this.resolveMultiLevelBoms(tenantId);
    const purchaseOrders = options?.purchaseOrders || this.resolvePurchaseOrders(tenantId);
    const orders = options?.orders || this.resolveOrders(tenantId);

    const productClean = productId.trim().toLowerCase();

    // Handle simulated timeout/delay for testing EC 1
    if (options?.simulateTimeout) {
      await new Promise(resolve => setTimeout(resolve, options.simulateDelayMs || 5500));
    } else if (options?.simulateDelayMs && options.simulateDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, options.simulateDelayMs));
    }

    // 4. Locate Product BOM (Multi-level or Catalog fallback)
    const matchingBom = multiLevelBoms.find(b =>
      b.id.toLowerCase() === productClean ||
      b.assemblyPartNumber.toLowerCase() === productClean ||
      b.assemblyName.toLowerCase() === productClean ||
      productClean.includes(b.assemblyPartNumber.toLowerCase())
    );

    const catalogBom = CATALOG_PRODUCT_BOMS[productClean] ||
      Object.entries(CATALOG_PRODUCT_BOMS).find(([key]) => productClean.includes(key) || key.includes(productClean))?.[1];

    let overallStatus: OverallAtpStatus = 'available';
    let shortfalls: AtpShortfall[] = [];
    let componentDetails: ExplodedComponentDetail[] = [];
    let productName = productId;
    let bomRevision: string | undefined = undefined;
    let hasBOM = false;
    let isPurchasedItem = false;
    let isNoStockNoBom = false;

    // ── CASE A: PRODUCT HAS NO BOM (Purchased Item, EC 1 & EC 2) ─────────
    if (!matchingBom && !catalogBom) {
      isPurchasedItem = true;
      hasBOM = false;

      // Locate item in stock or catalog
      const directStockItem = stockItems.find(s =>
        s.id.toLowerCase() === productClean ||
        s.code.toLowerCase() === productClean ||
        s.name.toLowerCase() === productClean ||
        productClean.includes(s.code.toLowerCase())
      );

      const catalogPurchased = CATALOG_PURCHASED_ITEMS[productClean] ||
        Object.entries(CATALOG_PURCHASED_ITEMS).find(([k]) => productClean.includes(k))?.[1];

      // EC 2: Product has no BOM and no stock record
      if (!directStockItem && !catalogPurchased) {
        isNoStockNoBom = true;
      }

      productName = directStockItem?.name || catalogPurchased?.name || productId;
      const partNumber = directStockItem?.code || catalogPurchased?.partNumber || productId;
      const unit = directStockItem?.unit || catalogPurchased?.unit || 'pcs';
      const leadTimeDays = isNoStockNoBom ? 0 : (catalogPurchased?.leadTimeDays ?? 7);

      // Compute ATP: CurrentStock - ReservedStock + PlannedReceipts(by asOfDate) - CommittedOrders(by asOfDate)
      const currentStock = directStockItem?.currentQty ?? (catalogPurchased?.stock.current || 0);
      const activeReservations = StockReservationService.getAlreadyReservedQty(
        options?.tenantId || 'default_tenant',
        partNumber,
        options?.excludeOrderId
      );
      const baseReserved = (directStockItem as any)?.reservedQty ?? (catalogPurchased?.stock.reserved || 0);
      const reservedStock = Math.max(baseReserved, activeReservations);
      const plannedReceipts = this.computePlannedReceipts(partNumber, dateStr, purchaseOrders, catalogPurchased?.stock.planned);
      const committedOrders = this.computeCommittedOrders(partNumber, dateStr, orders, catalogPurchased?.stock.committed);

      const atp = Math.max(0, currentStock - reservedStock + plannedReceipts - committedOrders);
      const shortfall = Math.max(0, requiredQty - atp);
      const isAvailable = atp >= requiredQty;

      // Replenishment date calculation
      let expectedReplenishmentDate: string | null = null;
      if (shortfall > 0) {
        if (leadTimeDays > 0) {
          const repDate = new Date();
          repDate.setDate(repDate.getDate() + leadTimeDays);
          expectedReplenishmentDate = repDate.toISOString().split('T')[0];
        } else {
          // EC: Component has no stock and no planned receipts -> null (UI shows "No replenishment scheduled.")
          expectedReplenishmentDate = null;
        }
      }

      const compDetail: ExplodedComponentDetail = {
        componentId: directStockItem?.id || partNumber,
        componentName: productName,
        partNumber,
        level: 0,
        itemType: 'bought_out',
        qtyPerParent: 1,
        totalRequired: requiredQty,
        unit,
        currentStock,
        reservedStock,
        plannedReceipts,
        committedOrders,
        atp,
        shortfall,
        isAvailable,
        expectedReplenishmentDate,
        leadTimeDays
      };

      componentDetails.push(compDetail);

      if (isAvailable) {
        overallStatus = 'available';
      } else if (atp > 0) {
        overallStatus = 'partial';
        shortfalls.push({
          componentId: compDetail.componentId,
          componentName: compDetail.componentName,
          partNumber,
          required: requiredQty,
          available: atp,
          shortfall,
          expectedReplenishmentDate,
          unit,
          currentStock,
          reservedStock,
          plannedReceipts,
          committedOrders
        });
      } else {
        overallStatus = 'unavailable';
        shortfalls.push({
          componentId: compDetail.componentId,
          componentName: compDetail.componentName,
          partNumber,
          required: requiredQty,
          available: atp,
          shortfall,
          expectedReplenishmentDate,
          unit,
          currentStock,
          reservedStock,
          plannedReceipts,
          committedOrders,
          notes: isNoStockNoBom ? 'No stock record found for this product.' : undefined
        });
      }
    } 
    // ── CASE B: PRODUCT HAS BOM (Recursive Explosion) ───────────────────
    else {
      hasBOM = true;
      isPurchasedItem = false;

      // Set product info & revision
      if (matchingBom) {
        productName = matchingBom.assemblyName;
        bomRevision = matchingBom.activeRevisionCode || matchingBom.revisions[0]?.revision || 'Rev A.0';
      } else if (catalogBom) {
        productName = catalogBom.name;
        bomRevision = catalogBom.revision;
      }

      // Root identifier for cycle tracking
      const rootIdentifier = matchingBom?.assemblyPartNumber || catalogBom?.partNumber || productId;
      const initialPath = [rootIdentifier.toLowerCase()];

      // Aggregated requirements for leaf components: key = partNumber
      const aggregatedLeafRequirements = new Map<string, {
        componentId: string;
        componentName: string;
        partNumber: string;
        unit: string;
        itemType: string;
        level: number;
        qtyPerParent: number;
        totalRequired: number;
        leadTimeDays: number;
        catalogStock?: { current: number; reserved: number; planned: number; committed: number };
      }>();

      // Recursive Explosion Helper for MultiLevelBomNode
      const explodeNode = (
        node: MultiLevelBomNode,
        parentEffectiveQty: number,
        currentDepth: number,
        pathStack: string[]
      ) => {
        // EC: BOM is 5+ levels deep -> Capped at maxDepth (default 10)
        if (currentDepth > maxDepth) {
          throw new BOMDepthExceededError(productId, currentDepth, maxDepth);
        }

        const nodeKey = (node.partNumber || node.id).toLowerCase();

        // EC: BOM has a circular reference (A -> B -> A) -> Throws CircularBOMError
        if (pathStack.includes(nodeKey)) {
          const cyclePath = [...pathStack, nodeKey].join(' -> ');
          throw new CircularBOMError(productId, cyclePath);
        }

        const newPath = [...pathStack, nodeKey];
        const scrapMultiplier = 1 + ((node.scrapFactorPercent || 0) / 100);
        const effectiveQty = parentEffectiveQty * Number(node.quantityPerParent || 1) * scrapMultiplier;

        // If node has children, it is a sub-assembly: recurse into children
        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            explodeNode(child, effectiveQty, currentDepth + 1, newPath);
          }
        } 
        // Leaf component (Purchased, raw material, bought_out, hardware)
        else {
          const existing = aggregatedLeafRequirements.get(nodeKey);
          if (existing) {
            existing.totalRequired += effectiveQty;
          } else {
            aggregatedLeafRequirements.set(nodeKey, {
              componentId: node.id || node.partNumber,
              componentName: node.partName,
              partNumber: node.partNumber,
              unit: node.unit || 'pcs',
              itemType: node.itemType,
              level: currentDepth,
              qtyPerParent: node.quantityPerParent,
              totalRequired: effectiveQty,
              leadTimeDays: node.leadTimeDays ?? 7
            });
          }
        }
      };

      // Recursive Explosion Helper for Catalog Component Defs
      const explodeCatalogComponent = (
        comp: CatalogComponentDef,
        parentEffectiveQty: number,
        currentDepth: number,
        pathStack: string[]
      ) => {
        if (currentDepth > maxDepth) {
          throw new BOMDepthExceededError(productId, currentDepth, maxDepth);
        }

        const compKey = comp.partNumber.toLowerCase();

        if (pathStack.includes(compKey)) {
          const cyclePath = [...pathStack, compKey].join(' -> ');
          throw new CircularBOMError(productId, cyclePath);
        }

        const newPath = [...pathStack, compKey];
        const effectiveQty = parentEffectiveQty * Number(comp.qtyPerParent || 1);

        if (comp.children && comp.children.length > 0) {
          for (const child of comp.children) {
            explodeCatalogComponent(child, effectiveQty, currentDepth + 1, newPath);
          }
        } else {
          const existing = aggregatedLeafRequirements.get(compKey);
          if (existing) {
            existing.totalRequired += effectiveQty;
          } else {
            aggregatedLeafRequirements.set(compKey, {
              componentId: comp.partNumber,
              componentName: comp.partName,
              partNumber: comp.partNumber,
              unit: comp.unit || 'pcs',
              itemType: comp.itemType,
              level: currentDepth,
              qtyPerParent: comp.qtyPerParent,
              totalRequired: effectiveQty,
              leadTimeDays: comp.leadTimeDays ?? 7,
              catalogStock: comp.stock
            });
          }
        }
      };

      // Execute Explosion based on matching source
      if (matchingBom) {
        const activeRevision = matchingBom.revisions.find(r => r.id === matchingBom.currentRevisionId) || matchingBom.revisions[0];
        if (activeRevision && activeRevision.rootNode && activeRevision.rootNode.children) {
          for (const child of activeRevision.rootNode.children) {
            explodeNode(child, requiredQty, 1, initialPath);
          }
        }
      } else if (catalogBom) {
        for (const comp of catalogBom.components) {
          explodeCatalogComponent(comp, requiredQty, 1, initialPath);
        }
      }

      // Compute ATP for each exploded leaf component
      let fullyAvailableCount = 0;
      let partiallyAvailableCount = 0;
      let unavailableCount = 0;
      const totalLeafComponents = aggregatedLeafRequirements.size;

      for (const [, req] of aggregatedLeafRequirements) {
        // Find stock item matching partNumber
        const stockItem = stockItems.find(s =>
          s.code.toLowerCase() === req.partNumber.toLowerCase() ||
          s.name.toLowerCase() === req.componentName.toLowerCase() ||
          s.id.toLowerCase() === req.componentId.toLowerCase()
        );

        const currentStock = stockItem?.currentQty ?? (req.catalogStock?.current || 0);
        const activeReservations = StockReservationService.getAlreadyReservedQty(
          options?.tenantId || 'default_tenant',
          req.partNumber,
          options?.excludeOrderId
        );
        const baseReserved = (stockItem as any)?.reservedQty ?? (req.catalogStock?.reserved || 0);
        const reservedStock = Math.max(baseReserved, activeReservations);
        const plannedReceipts = this.computePlannedReceipts(req.partNumber, dateStr, purchaseOrders, req.catalogStock?.planned);
        const committedOrders = this.computeCommittedOrders(req.partNumber, dateStr, orders, req.catalogStock?.committed);

        // Formula: ATP = CurrentStock − ReservedStock + PlannedReceipts(by asOfDate) − CommittedOrders(by asOfDate)
        const atp = Math.max(0, currentStock - reservedStock + plannedReceipts - committedOrders);
        const roundedRequired = Math.round(req.totalRequired * 100) / 100;
        const shortfall = Math.max(0, roundedRequired - atp);
        const isAvailable = atp >= roundedRequired;

        // Determine expected replenishment date
        let expectedReplenishmentDate: string | null = null;
        if (shortfall > 0) {
          if (req.leadTimeDays > 0) {
            // Calculate earliest date when supplier lead time completes
            const repDate = new Date();
            repDate.setDate(repDate.getDate() + req.leadTimeDays);
            expectedReplenishmentDate = repDate.toISOString().split('T')[0];
          } else {
            // EC: Component has no stock and no planned receipts -> null (UI shows "No replenishment scheduled.")
            expectedReplenishmentDate = null;
          }
        }

        const compDetail: ExplodedComponentDetail = {
          componentId: req.componentId,
          componentName: req.componentName,
          partNumber: req.partNumber,
          level: req.level,
          itemType: req.itemType,
          qtyPerParent: req.qtyPerParent,
          totalRequired: roundedRequired,
          unit: req.unit,
          currentStock,
          reservedStock,
          plannedReceipts,
          committedOrders,
          atp,
          shortfall,
          isAvailable,
          expectedReplenishmentDate,
          leadTimeDays: req.leadTimeDays
        };

        componentDetails.push(compDetail);

        if (isAvailable) {
          fullyAvailableCount++;
        } else if (atp > 0) {
          partiallyAvailableCount++;
          shortfalls.push({
            componentId: req.componentId,
            componentName: req.componentName,
            partNumber: req.partNumber,
            required: roundedRequired,
            available: atp,
            shortfall,
            expectedReplenishmentDate,
            unit: req.unit,
            currentStock,
            reservedStock,
            plannedReceipts,
            committedOrders
          });
        } else {
          unavailableCount++;
          shortfalls.push({
            componentId: req.componentId,
            componentName: req.componentName,
            partNumber: req.partNumber,
            required: roundedRequired,
            available: atp,
            shortfall,
            expectedReplenishmentDate,
            unit: req.unit,
            currentStock,
            reservedStock,
            plannedReceipts,
            committedOrders
          });
        }
      }

      // Determine Overall Status:
      // "The overall status must be available if all components have ATP ≥ required, partial if some do, unavailable if none do."
      if (fullyAvailableCount === totalLeafComponents && totalLeafComponents > 0) {
        overallStatus = 'available';
      } else if (fullyAvailableCount === 0 && (unavailableCount === totalLeafComponents || componentDetails.every(c => c.atp === 0))) {
        overallStatus = 'unavailable';
      } else {
        overallStatus = 'partial';
      }
    }

    // Earliest Possible Replenishment Date (longest lead time among shortfall components)
    let earliestPossibleReplenishmentDate: string | null = null;
    if (shortfalls.length > 0) {
      const datesWithShortfall = shortfalls
        .map(s => s.expectedReplenishmentDate)
        .filter((d): d is string => d !== null && d !== undefined)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Latest date is the gating constraint

      earliestPossibleReplenishmentDate = datesWithShortfall[0] || null;
    }

    // 5. Construct Final Result & Cache
    const calculatedAt = new Date().toISOString();
    const staleAfterDate = new Date(now + CACHE_TTL_MS);
    const staleAfter = staleAfterDate.toISOString();

    const result: AtpResult = {
      productId,
      productName,
      requiredQty,
      asOfDate: dateStr,
      overallStatus,
      shortfalls,
      components: componentDetails,
      earliestPossibleReplenishmentDate,
      cached: false,
      calculatedAt,
      staleAfter,
      isStale: false,
      hasBOM,
      bomRevision,
      isPurchasedItem,
      isNoStockNoBom,
      cacheKey
    };

    // Save to in-memory cache
    atpMemoryCache.set(cacheKey, {
      result,
      cachedAt: now,
      staleAfter: now + CACHE_TTL_MS
    });

    return result;
  }

  // ── Helper Resolvers ────────────────────────────────────────────────

  private static computePlannedReceipts(
    partNumber: string,
    asOfDateStr: string,
    purchaseOrders: PurchaseOrder[],
    catalogPlanned: number = 0
  ): number {
    const asOfTime = new Date(asOfDateStr).getTime();
    let totalPlanned = catalogPlanned;

    const pClean = partNumber.toLowerCase();

    for (const po of purchaseOrders) {
      if (po.status === 'cancelled' || po.status === 'received') continue;

      const poArrival = po.expectedDeliveryDate || po.needByDate || po.supplierAck?.confirmedExpectedDate;
      if (poArrival && new Date(poArrival).getTime() <= asOfTime) {
        for (const item of po.items || []) {
          const itemSku = (item.stockItemCode || item.stockItemName || item.stockItemId || '').toLowerCase();
          if (itemSku === pClean || itemSku.includes(pClean) || pClean.includes(itemSku)) {
            const pendingQty = Math.max(0, (item.orderedQty || 0) - (item.receivedQty || 0));
            totalPlanned += pendingQty;
          }
        }
      }
    }

    return totalPlanned;
  }

  private static computeCommittedOrders(
    partNumber: string,
    asOfDateStr: string,
    orders: Order[],
    catalogCommitted: number = 0
  ): number {
    const asOfTime = new Date(asOfDateStr).getTime();
    let totalCommitted = catalogCommitted;

    const pClean = partNumber.toLowerCase();

    for (const order of orders) {
      if (order.status === 'cancelled' || order.status === 'closed' || order.status === 'fully_dispatched') continue;

      const orderDue = order.deliveryDate;
      if (orderDue && new Date(orderDue).getTime() <= asOfTime) {
        for (const item of order.items || []) {
          const itemSku = (item.name || '').toLowerCase();
          if (itemSku === pClean || itemSku.includes(pClean)) {
            const remaining = Math.max(0, (item.quantity || 0) - (item.dispatchedQty || 0));
            totalCommitted += remaining;
          }
        }
      }
    }

    return totalCommitted;
  }

  private static resolveStockItems(tenantId: string): StockItem[] {
    try {
      const raw = localStorage.getItem(`stock_items_${tenantId}`) || localStorage.getItem('stock_items_demo_tenant');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static resolveMultiLevelBoms(tenantId: string): MultiLevelBom[] {
    try {
      const raw = localStorage.getItem(`multilevel_boms_${tenantId}`) || localStorage.getItem('multilevel_boms_demo_tenant');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static resolvePurchaseOrders(tenantId: string): PurchaseOrder[] {
    try {
      const raw = localStorage.getItem(`purchase_orders_${tenantId}`) || localStorage.getItem('purchase_orders_demo_tenant');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static resolveOrders(tenantId: string): Order[] {
    try {
      const raw = localStorage.getItem(`orders_${tenantId}`) || localStorage.getItem('orders_demo_tenant');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

// ── Top-Level Functional Export per Acceptance Criteria ───────────────

/**
 * Top-level convenience export matching acceptance criteria:
 * calculateATP(productId, requiredQty, asOfDate, options?)
 */
export async function calculateATP(
  productId: string,
  requiredQty: number,
  asOfDate: string,
  options?: AtpCalculationOptions
): Promise<AtpResult> {
  return AtpService.calculateATP(productId, requiredQty, asOfDate, options);
}
