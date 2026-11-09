// src/services/stockReservationService.ts

import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  runTransaction,
  writeBatch,
  addDoc
} from 'firebase/firestore';
import { Order, QuoteItem, StockItem, AppNotification } from '../types';
import { 
  StockReservation, 
  StockReservationStatus, 
  StockReservationSummary,
  ManualReleaseRequest,
  WriteOffRequest 
} from '../types/stockReservation';
import { MultiLevelBom } from '../types/multiLevelBom';
import { logActivityEvent } from '../utils/activityLogger';

// Mutex / Lock manager for concurrency (EC 4: prevent double-reservation when two orders confirm simultaneously)
class AsyncLockManager {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(key, lockPromise);

    return () => {
      this.locks.delete(key);
      resolveLock();
    };
  }
}

const reservationMutex = new AsyncLockManager();

// In-memory event listeners for stock reservation updates
export type StockReservationsChangedListener = (tenantId: string, orderId?: string) => void;
const reservationChangeListeners: Set<StockReservationsChangedListener> = new Set();

export function onStockReservationsChanged(listener: StockReservationsChangedListener): () => void {
  reservationChangeListeners.add(listener);
  return () => {
    reservationChangeListeners.delete(listener);
  };
}

export function emitStockReservationsChanged(tenantId: string, orderId?: string): void {
  reservationChangeListeners.forEach((fn) => {
    try {
      fn(tenantId, orderId);
    } catch (e) {
      console.warn('Reservation listener error', e);
    }
  });

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('stock.reservations.changed', { detail: { tenantId, orderId } }));
    } catch (e) {
      console.warn('Failed to dispatch stock.reservations.changed', e);
    }
  }
}

// Fallback Catalog BOM mapping for demo products
const CATALOG_BOM_MAP: Record<string, {
  partNumber: string;
  components: {
    partNumber: string;
    partName: string;
    qtyPerParent: number;
    unit: string;
    leadTimeDays: number;
    itemType: string;
  }[];
}> = {
  // Gear Box example from prompt: "Product Gear Box (Qty 50) -> Requires: Casting 50, Shafts 100"
  'gear box': {
    partNumber: 'ASM-GBX-DEMO',
    components: [
      { partNumber: 'PRT-CST-50', partName: 'Ductile Iron Gear Box Casing', qtyPerParent: 1, unit: 'pcs', leadTimeDays: 7, itemType: 'raw_material' },
      { partNumber: 'PRT-SHF-100', partName: 'EN24 Alloy Steel Drive Shaft', qtyPerParent: 2, unit: 'pcs', leadTimeDays: 14, itemType: 'raw_material' }
    ]
  },
  'gearbox': {
    partNumber: 'ASM-GBX-DEMO',
    components: [
      { partNumber: 'PRT-CST-50', partName: 'Ductile Iron Gear Box Casing', qtyPerParent: 1, unit: 'pcs', leadTimeDays: 7, itemType: 'raw_material' },
      { partNumber: 'PRT-SHF-100', partName: 'EN24 Alloy Steel Drive Shaft', qtyPerParent: 2, unit: 'pcs', leadTimeDays: 14, itemType: 'raw_material' }
    ]
  },
  'casting': {
    partNumber: 'PRT-CST-50',
    components: [
      { partNumber: 'RAW-DI-INGOT', partName: 'Ductile Iron Ingot Grade 60-40-18', qtyPerParent: 1.1, unit: 'kg', leadTimeDays: 5, itemType: 'raw_material' }
    ]
  },
  'forged steel spur gear': {
    partNumber: 'ASM-SGR-004',
    components: [
      { partNumber: 'RAW-EN8-RND', partName: 'EN8 Carbon Steel Round Bar 120mm', qtyPerParent: 1, unit: 'kg', leadTimeDays: 5, itemType: 'raw_material' },
      { partNumber: 'HDW-PIN-M8', partName: 'Hardened Dowel Pin M8x40', qtyPerParent: 2, unit: 'pcs', leadTimeDays: 3, itemType: 'hardware' }
    ]
  }
};

export class StockReservationService {
  /**
   * Generates a storage key for tenant reservations in localStorage
   */
  private static getStorageKey(tenantId: string): string {
    return `stock_reservations_${tenantId}`;
  }

  /**
   * Retrieves all reservations from localStorage (sandbox or offline cache)
   */
  static getLocalReservations(tenantId: string): StockReservation[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(tenantId));
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading local reservations', e);
      return [];
    }
  }

  /**
   * Saves reservations to localStorage
   */
  private static saveLocalReservations(tenantId: string, list: StockReservation[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(tenantId), JSON.stringify(list));
      emitStockReservationsChanged(tenantId);
    } catch (e) {
      console.warn('Error writing local reservations', e);
    }
  }

  /**
   * Retrieves stock items for a tenant from localStorage or fallback
   */
  private static getLocalStockItems(tenantId: string): StockItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`stock_${tenantId}`) || localStorage.getItem(`inventory_${tenantId}`);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  /**
   * Updates reservedQty on a stock item in localStorage to maintain ledger coherence
   */
  private static updateLocalStockItemReservedQty(tenantId: string, partNumber: string, deltaReserved: number): void {
    if (typeof window === 'undefined') return;
    try {
      const stockKey = `stock_${tenantId}`;
      const raw = localStorage.getItem(stockKey);
      if (raw) {
        const items: StockItem[] = JSON.parse(raw);
        const idx = items.findIndex(s => s.code?.toLowerCase() === partNumber.toLowerCase() || s.name?.toLowerCase() === partNumber.toLowerCase());
        if (idx !== -1) {
          const currentReserved = (items[idx] as any).reservedQty || 0;
          (items[idx] as any).reservedQty = Math.max(0, currentReserved + deltaReserved);
          localStorage.setItem(stockKey, JSON.stringify(items));
        }
      }
    } catch (e) {
      console.warn('Error updating local stock item reserved qty', e);
    }
  }

  /**
   * Dispatches an in-app notification to production planners / management
   */
  static async sendReservationNotification(
    tenantId: string,
    title: string,
    message: string,
    orderId: string,
    orderNumber: string,
    severity: 'info' | 'warning' | 'error' = 'info'
  ): Promise<void> {
    const notif: AppNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId,
      userId: 'all',
      title,
      message,
      type: 'low_stock',
      entityId: orderId,
      entityType: 'order',
      read: false,
      createdAt: new Date().toISOString(),
      link: `/orders?id=${orderId}`
    };

    if (typeof window !== 'undefined') {
      try {
        const notifKey = `notifications_${tenantId}`;
        const existing: AppNotification[] = JSON.parse(localStorage.getItem(notifKey) || '[]');
        localStorage.setItem(notifKey, JSON.stringify([notif, ...existing]));
      } catch (e) {
        console.warn('Failed to store notification locally', e);
      }
    }

    if (db) {
      try {
        const notifCol = collection(db, 'notifications');
        await addDoc(notifCol, notif);
      } catch (e) {
        // Ignored in sandbox
      }
    }
  }

  /**
   * Explodes an order's lines into flat leaf component requirements
   */
  static explodeOrderComponents(
    order: { items: QuoteItem[] },
    multiLevelBoms: MultiLevelBom[] = []
  ): {
    componentId: string;
    componentName: string;
    partNumber: string;
    totalRequiredQty: number;
    unit: string;
    orderItemId?: string;
    orderItemName?: string;
    leadTimeDays: number;
  }[] {
    const componentMap = new Map<string, {
      componentId: string;
      componentName: string;
      partNumber: string;
      totalRequiredQty: number;
      unit: string;
      orderItemId?: string;
      orderItemName?: string;
      leadTimeDays: number;
    }>();

    for (const item of order.items || []) {
      const orderQty = Number(item.quantity) || 1;
      const productNameLower = (item.name || '').toLowerCase().trim();

      // 1. Try matching with custom multiLevelBoms
      const matchingBom = multiLevelBoms.find(b => 
        b.assemblyName?.toLowerCase().includes(productNameLower) || 
        b.assemblyPartNumber?.toLowerCase() === productNameLower ||
        productNameLower.includes(b.assemblyName?.toLowerCase() || '')
      );

      // 2. Try matching with Catalog BOM map
      const catalogBom = Object.entries(CATALOG_BOM_MAP).find(([key]) => 
        productNameLower.includes(key) || key.includes(productNameLower)
      )?.[1];

      if (matchingBom) {
        const activeRev = matchingBom.revisions.find(r => r.id === matchingBom.currentRevisionId) || matchingBom.revisions[0];
        if (activeRev?.rootNode?.children) {
          const recurse = (node: any, multiplier: number) => {
            const req = (Number(node.quantityPerParent) || 1) * multiplier;
            if (node.children && node.children.length > 0) {
              for (const child of node.children) {
                recurse(child, req);
              }
            } else {
              const key = (node.partNumber || node.partName || node.id).toLowerCase();
              const existing = componentMap.get(key);
              if (existing) {
                existing.totalRequiredQty += req;
              } else {
                componentMap.set(key, {
                  componentId: node.id || node.partNumber,
                  componentName: node.partName,
                  partNumber: node.partNumber || node.partName,
                  totalRequiredQty: req,
                  unit: node.unit || 'pcs',
                  orderItemId: item.id,
                  orderItemName: item.name,
                  leadTimeDays: node.leadTimeDays || 7
                });
              }
            }
          };
          for (const child of activeRev.rootNode.children) {
            recurse(child, orderQty);
          }
          continue;
        }
      }

      if (catalogBom) {
        for (const comp of catalogBom.components) {
          const req = Number(comp.qtyPerParent || 1) * orderQty;
          const key = comp.partNumber.toLowerCase();
          const existing = componentMap.get(key);
          if (existing) {
            existing.totalRequiredQty += req;
          } else {
            componentMap.set(key, {
              componentId: comp.partNumber,
              componentName: comp.partName,
              partNumber: comp.partNumber,
              totalRequiredQty: req,
              unit: comp.unit || 'pcs',
              orderItemId: item.id,
              orderItemName: item.name,
              leadTimeDays: comp.leadTimeDays || 7
            });
          }
        }
        continue;
      }

      // Default: Direct part / bought-out component without multi-level BOM
      const key = (item.id || item.name).toLowerCase();
      const existing = componentMap.get(key);
      if (existing) {
        existing.totalRequiredQty += orderQty;
      } else {
        componentMap.set(key, {
          componentId: item.id,
          componentName: item.name,
          partNumber: (item as any).hsn || item.id,
          totalRequiredQty: orderQty,
          unit: item.unit || 'pcs',
          orderItemId: item.id,
          orderItemName: item.name,
          leadTimeDays: 7
        });
      }
    }

    return Array.from(componentMap.values());
  }

  /**
   * Calculates already-reserved stock for a component across ALL other active orders
   */
  static getAlreadyReservedQty(
    tenantId: string,
    partNumber: string,
    excludeOrderId?: string
  ): number {
    const allReservations = this.getLocalReservations(tenantId);
    return allReservations
      .filter(r => 
        (r.status === 'active' || r.status === 'partially_reserved') &&
        (!excludeOrderId || r.orderId !== excludeOrderId) &&
        (r.partNumber.toLowerCase() === partNumber.toLowerCase() || 
         r.componentName.toLowerCase() === partNumber.toLowerCase() || 
         r.componentId.toLowerCase() === partNumber.toLowerCase())
      )
      .reduce((sum, r) => sum + (Number(r.reservedQty) || 0), 0);
  }

  /**
   * Evaluates current unreserved stock available for reservation
   */
  static getUnreservedAvailableStock(
    tenantId: string,
    partNumber: string,
    stockItems: StockItem[] = [],
    excludeOrderId?: string
  ): { currentStock: number; alreadyReserved: number; unreservedAvailable: number } {
    // 1. Locate stock item
    const stockItem = stockItems.find(s => 
      s.code?.toLowerCase() === partNumber.toLowerCase() || 
      s.name?.toLowerCase() === partNumber.toLowerCase() ||
      s.id?.toLowerCase() === partNumber.toLowerCase()
    );

    // Fallback catalog stock values
    let currentStock = stockItem?.currentQty ?? 0;
    if (!stockItem) {
      const lower = partNumber.toLowerCase();
      if (lower.includes('casting') || lower.includes('prt-cst-50')) {
        currentStock = 80;
      } else if (lower.includes('shaft') || lower.includes('prt-shf-100')) {
        currentStock = 60;
      } else {
        currentStock = 50;
      }
    }

    const alreadyReserved = this.getAlreadyReservedQty(tenantId, partNumber, excludeOrderId);
    const unreservedAvailable = Math.max(0, currentStock - alreadyReserved);

    return { currentStock, alreadyReserved, unreservedAvailable };
  }

  /**
   * Reserves stock when an order is confirmed.
   * Concurrency Safe: Uses an async mutex key per tenant to prevent simultaneous double-reservations (EC 4).
   */
  static async reserveStockForOrder(
    order: Order,
    options?: {
      tenantId?: string;
      stockItems?: StockItem[];
      multiLevelBoms?: MultiLevelBom[];
      actor?: { uid?: string; userId?: string; name: string; role: string };
      isSandboxMode?: boolean;
    }
  ): Promise<StockReservationSummary> {
    const tenantId = options?.tenantId || order.tenantId || 'default_tenant';
    const releaseLock = await reservationMutex.acquire(`reserve_${tenantId}`);

    try {
      const stockItems = options?.stockItems || this.getLocalStockItems(tenantId);
      const multiLevelBoms = options?.multiLevelBoms || [];
      const actorName = options?.actor?.name || 'Production Planner';

      const explodedComps = this.explodeOrderComponents(order, multiLevelBoms);
      const allReservations = this.getLocalReservations(tenantId);

      // Exclude previous existing reservations for this order if re-confirming
      const otherReservations = allReservations.filter(r => r.orderId !== order.id);
      const createdReservations: StockReservation[] = [];

      for (const comp of explodedComps) {
        const { currentStock, unreservedAvailable } = this.getUnreservedAvailableStock(
          tenantId,
          comp.partNumber,
          stockItems,
          order.id
        );

        const requiredQty = comp.totalRequiredQty;
        const reservedQty = Math.min(requiredQty, unreservedAvailable);
        const shortfallQty = Math.max(0, requiredQty - reservedQty);
        const status: StockReservationStatus = shortfallQty > 0 ? 'partially_reserved' : 'active';

        const reservationRecord: StockReservation = {
          id: `res_${order.id}_${comp.partNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tenantId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          orderItemId: comp.orderItemId,
          orderItemName: comp.orderItemName,
          componentId: comp.componentId,
          componentName: comp.componentName,
          partNumber: comp.partNumber,
          unit: comp.unit,
          requiredQty,
          reservedQty,
          shortfallQty,
          unreservedAvailableAtReservation: unreservedAvailable,
          reservedAt: new Date().toISOString(),
          reservedBy: actorName,
          status,
          notes: shortfallQty > 0 
            ? `Partial reservation: ${reservedQty}/${requiredQty} ${comp.unit} allocated. Shortfall of ${shortfallQty} logged.`
            : `Fully reserved ${reservedQty} ${comp.unit} from unreserved stock.`
        };

        createdReservations.push(reservationRecord);
        this.updateLocalStockItemReservedQty(tenantId, comp.partNumber, reservedQty);
      }

      const updatedAll = [...otherReservations, ...createdReservations];
      this.saveLocalReservations(tenantId, updatedAll);

      // Also persist to Firestore if online
      if (db && !options?.isSandboxMode) {
        try {
          const batch = writeBatch(db);
          for (const res of createdReservations) {
            const docRef = doc(collection(db, 'stock_reservations'), res.id);
            batch.set(docRef, res);
          }
          await batch.commit();
        } catch (e) {
          console.warn('Firestore reservation sync warning (local cache retained)', e);
        }
      }

      // If any shortfall was logged, trigger a notification for production planners
      const shortfalls = createdReservations.filter(r => r.shortfallQty > 0);
      if (shortfalls.length > 0) {
        const shortfallList = shortfalls.map(s => `${s.componentName}: ${s.reservedQty}/${s.requiredQty} (shortfall ${s.shortfallQty})`).join(', ');
        await this.sendReservationNotification(
          tenantId,
          `⚠️ Partial Stock Reservation on Order #${order.orderNumber}`,
          `Insufficient stock at confirmation time. ${shortfalls.length} component(s) partially reserved: ${shortfallList}`,
          order.id,
          order.orderNumber,
          'warning'
        );
      }

      logActivityEvent({
        tenantId,
        actionType: 'create',
        entityType: 'order',
        entityId: order.id,
        actor: {
          userId: options?.actor?.uid || 'system',
          displayName: actorName,
          email: ''
        },
        description: `Reserved raw materials for Order #${order.orderNumber}. Fully reserved: ${createdReservations.filter(r => r.shortfallQty === 0).length}/${createdReservations.length}.`,
        metadata: {
          orderNumber: order.orderNumber,
          totalComponents: createdReservations.length,
          hasShortfall: shortfalls.length > 0
        },
        isSandboxMode: options?.isSandboxMode
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        reservations: createdReservations,
        totalComponents: createdReservations.length,
        fullyReservedCount: createdReservations.filter(r => r.shortfallQty === 0).length,
        partiallyReservedCount: shortfalls.length,
        unreservedCount: createdReservations.filter(r => r.reservedQty === 0).length,
        hasShortfall: shortfalls.length > 0,
        totalShortfallQty: shortfalls.reduce((sum, r) => sum + r.shortfallQty, 0),
        isFullyReserved: shortfalls.length === 0,
        timestamp: new Date().toISOString()
      };
    } finally {
      releaseLock();
    }
  }

  /**
   * Releases all reservations for an order.
   * Triggered on Order Cancellation (EC 2: released within 1s) or Full Dispatch (AC 5: consumed).
   */
  static async releaseReservationsForOrder(
    orderId: string,
    reason: string,
    options?: {
      tenantId?: string;
      markConsumed?: boolean;
      actor?: { uid?: string; userId?: string; name: string; role: string };
      isSandboxMode?: boolean;
    }
  ): Promise<{ releasedCount: number }> {
    const tenantId = options?.tenantId || 'default_tenant';
    const releaseLock = await reservationMutex.acquire(`release_${tenantId}`);

    try {
      const allReservations = this.getLocalReservations(tenantId);
      const actorName = options?.actor?.name || 'System / Admin';
      const timestamp = new Date().toISOString();
      const targetStatus: StockReservationStatus = options?.markConsumed ? 'consumed' : 'released';

      let releasedCount = 0;
      const updatedList = allReservations.map(res => {
        if (res.orderId === orderId && (res.status === 'active' || res.status === 'partially_reserved')) {
          releasedCount++;
          // Release reservedQty back from inventory ledger
          this.updateLocalStockItemReservedQty(tenantId, res.partNumber, -res.reservedQty);

          return {
            ...res,
            status: targetStatus,
            releasedAt: timestamp,
            releasedBy: actorName,
            releaseReason: reason || (options?.markConsumed ? 'Order fully dispatched' : 'Order cancelled')
          };
        }
        return res;
      });

      this.saveLocalReservations(tenantId, updatedList);

      if (db && !options?.isSandboxMode) {
        try {
          const batch = writeBatch(db);
          for (const res of updatedList.filter(r => r.orderId === orderId)) {
            const docRef = doc(collection(db, 'stock_reservations'), res.id);
            batch.set(docRef, res, { merge: true });
          }
          await batch.commit();
        } catch (e) {
          console.warn('Firestore reservation release warning', e);
        }
      }

      logActivityEvent({
        tenantId,
        actionType: 'update',
        entityType: 'order',
        entityId: orderId,
        actor: {
          userId: options?.actor?.uid || 'system',
          displayName: actorName,
          email: ''
        },
        description: `Released ${releasedCount} component reservation(s) for Order #${orderId}. Reason: ${reason}`,
        metadata: { orderId, reason, releasedCount },
        isSandboxMode: options?.isSandboxMode
      });

      return { releasedCount };
    } finally {
      releaseLock();
    }
  }

  /**
   * Admin manually releases a specific reservation with a mandatory justification (EC 3).
   * Immediately updates stock and ATP for all other orders.
   */
  static async manualReleaseReservation(
    req: ManualReleaseRequest,
    options?: { tenantId?: string; isSandboxMode?: boolean }
  ): Promise<StockReservation> {
    if (!req.reason || req.reason.trim().length < 5) {
      throw new Error('A valid justification of at least 5 characters is required to release stock reservations.');
    }

    const tenantId = options?.tenantId || 'default_tenant';
    const allReservations = this.getLocalReservations(tenantId);
    const targetIdx = allReservations.findIndex(r => r.id === req.reservationId);

    if (targetIdx === -1) {
      throw new Error(`Reservation #${req.reservationId} was not found.`);
    }

    const target = allReservations[targetIdx];
    if (target.status === 'released' || target.status === 'consumed') {
      throw new Error(`Reservation is already ${target.status}.`);
    }

    const timestamp = new Date().toISOString();
    const updated: StockReservation = {
      ...target,
      status: 'released',
      releasedAt: timestamp,
      releasedBy: `${req.releasedBy} (${req.userRole})`,
      releaseReason: req.reason.trim()
    };

    // Release reservedQty from stock item ledger
    this.updateLocalStockItemReservedQty(tenantId, target.partNumber, -target.reservedQty);

    allReservations[targetIdx] = updated;
    this.saveLocalReservations(tenantId, allReservations);

    if (db && !options?.isSandboxMode) {
      try {
        const docRef = doc(collection(db, 'stock_reservations'), req.reservationId);
        await runTransaction(db, async (t) => {
          t.set(docRef, updated, { merge: true });
        });
      } catch (e) {
        console.warn('Firestore manual release warning', e);
      }
    }

    logActivityEvent({
      tenantId,
      actionType: 'update',
      entityType: 'order',
      entityId: target.orderId,
      actor: {
        userId: req.releasedBy,
        displayName: req.releasedBy,
        email: ''
      },
      description: `[Manual Release] Stock reservation for ${target.componentName} (${target.reservedQty} ${target.unit}) released by ${req.releasedBy}. Reason: ${req.reason}`,
      metadata: { reservationId: req.reservationId, reason: req.reason },
      isSandboxMode: options?.isSandboxMode
    });

    return updated;
  }

  /**
   * Admin writes off physically damaged or lost reserved stock with mandatory reason (EC 5).
   * Updates order shortfall and alerts production planners.
   */
  static async writeOffReservation(
    req: WriteOffRequest,
    options?: { tenantId?: string; isSandboxMode?: boolean }
  ): Promise<StockReservation> {
    if (!req.reason || req.reason.trim().length < 5) {
      throw new Error('A valid reason of at least 5 characters is required to write off reserved stock.');
    }
    if (!req.writeOffQty || req.writeOffQty <= 0) {
      throw new Error('Write-off quantity must be greater than zero.');
    }

    const tenantId = options?.tenantId || 'default_tenant';
    const allReservations = this.getLocalReservations(tenantId);
    const targetIdx = allReservations.findIndex(r => r.id === req.reservationId);

    if (targetIdx === -1) {
      throw new Error(`Reservation #${req.reservationId} was not found.`);
    }

    const target = allReservations[targetIdx];
    if (req.writeOffQty > target.reservedQty) {
      throw new Error(`Cannot write off ${req.writeOffQty} ${target.unit}. Maximum reserved quantity available is ${target.reservedQty} ${target.unit}.`);
    }

    const timestamp = new Date().toISOString();
    const newReservedQty = Math.max(0, target.reservedQty - req.writeOffQty);
    const newShortfallQty = target.shortfallQty + req.writeOffQty;
    const newStatus: StockReservationStatus = newReservedQty === 0 ? 'written_off' : 'partially_reserved';

    const updated: StockReservation = {
      ...target,
      reservedQty: newReservedQty,
      shortfallQty: newShortfallQty,
      status: newStatus,
      writtenOffAt: timestamp,
      writtenOffBy: `${req.writtenOffBy} (${req.userRole})`,
      writeOffReason: req.reason.trim(),
      writeOffQty: (target.writeOffQty || 0) + req.writeOffQty,
      notes: `Write-off of ${req.writeOffQty} ${target.unit} logged on ${new Date().toLocaleDateString()}: ${req.reason}`
    };

    // Remove physically lost quantity from stock item ledger
    this.updateLocalStockItemReservedQty(tenantId, target.partNumber, -req.writeOffQty);

    allReservations[targetIdx] = updated;
    this.saveLocalReservations(tenantId, allReservations);

    // Send production & management alert
    await this.sendReservationNotification(
      tenantId,
      `🚨 Stock Damaged/Lost Write-Off on Order #${target.orderNumber}`,
      `${req.writeOffQty} ${target.unit} of ${target.componentName} was written off. Remaining reserved: ${newReservedQty}, new shortfall: ${newShortfallQty}. Reason: ${req.reason}`,
      target.orderId,
      target.orderNumber,
      'error'
    );

    logActivityEvent({
      tenantId,
      actionType: 'update',
      entityType: 'order',
      entityId: target.orderId,
      actor: {
        userId: req.writtenOffBy,
        displayName: req.writtenOffBy,
        email: ''
      },
      description: `[Stock Write-off] ${req.writeOffQty} ${target.unit} of ${target.componentName} written off for Order #${target.orderNumber}. Reason: ${req.reason}`,
      metadata: { reservationId: req.reservationId, writeOffQty: req.writeOffQty, reason: req.reason },
      isSandboxMode: options?.isSandboxMode
    });

    return updated;
  }

  /**
   * Syncs reservations when a confirmed order is edited (EC 1: quantity increased).
   * Attempts to reserve additional quantity; if unavailable, logs partial reservation and alerts production.
   */
  static async syncOrderReservationsOnEdit(
    order: Order,
    options?: {
      tenantId?: string;
      stockItems?: StockItem[];
      multiLevelBoms?: MultiLevelBom[];
      actor?: { uid?: string; userId?: string; name: string; role: string };
      isSandboxMode?: boolean;
    }
  ): Promise<StockReservationSummary> {
    const tenantId = options?.tenantId || order.tenantId || 'default_tenant';
    const releaseLock = await reservationMutex.acquire(`edit_sync_${tenantId}`);

    try {
      const stockItems = options?.stockItems || this.getLocalStockItems(tenantId);
      const multiLevelBoms = options?.multiLevelBoms || [];
      const actorName = options?.actor?.name || 'Production Planner';

      const explodedComps = this.explodeOrderComponents(order, multiLevelBoms);
      const allReservations = this.getLocalReservations(tenantId);
      const existingForOrder = allReservations.filter(r => r.orderId === order.id);
      const otherReservations = allReservations.filter(r => r.orderId !== order.id);

      const updatedForOrder: StockReservation[] = [];
      let hadIncrementalShortfall = false;

      for (const comp of explodedComps) {
        const existing = existingForOrder.find(r => 
          r.partNumber.toLowerCase() === comp.partNumber.toLowerCase() ||
          r.componentName.toLowerCase() === comp.componentName.toLowerCase()
        );

        const currentStockCheck = this.getUnreservedAvailableStock(
          tenantId,
          comp.partNumber,
          stockItems,
          order.id
        );

        const newRequiredQty = comp.totalRequiredQty;

        if (existing) {
          const delta = newRequiredQty - existing.requiredQty;
          let newReserved = existing.reservedQty;

          if (delta > 0) {
            // Need to reserve more
            const additionalAvailable = Math.min(delta, currentStockCheck.unreservedAvailable);
            newReserved += additionalAvailable;
            if (additionalAvailable < delta) {
              hadIncrementalShortfall = true;
            }
            this.updateLocalStockItemReservedQty(tenantId, comp.partNumber, additionalAvailable);
          } else if (delta < 0) {
            // Requirement decreased -> release excess
            const excess = Math.min(existing.reservedQty, Math.abs(delta));
            newReserved -= excess;
            this.updateLocalStockItemReservedQty(tenantId, comp.partNumber, -excess);
          }

          const shortfallQty = Math.max(0, newRequiredQty - newReserved);
          const status: StockReservationStatus = shortfallQty > 0 ? 'partially_reserved' : 'active';

          updatedForOrder.push({
            ...existing,
            requiredQty: newRequiredQty,
            reservedQty: newReserved,
            shortfallQty,
            status,
            notes: `Updated on order edit: required ${newRequiredQty}, reserved ${newReserved}, shortfall ${shortfallQty}`
          });
        } else {
          // Brand new component added during edit
          const reservedQty = Math.min(newRequiredQty, currentStockCheck.unreservedAvailable);
          const shortfallQty = Math.max(0, newRequiredQty - reservedQty);
          if (shortfallQty > 0) hadIncrementalShortfall = true;

          updatedForOrder.push({
            id: `res_${order.id}_${comp.partNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            tenantId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            orderItemId: comp.orderItemId,
            orderItemName: comp.orderItemName,
            componentId: comp.componentId,
            componentName: comp.componentName,
            partNumber: comp.partNumber,
            unit: comp.unit,
            requiredQty: newRequiredQty,
            reservedQty,
            shortfallQty,
            unreservedAvailableAtReservation: currentStockCheck.unreservedAvailable,
            reservedAt: new Date().toISOString(),
            reservedBy: actorName,
            status: shortfallQty > 0 ? 'partially_reserved' : 'active',
            notes: `Added on order edit: required ${newRequiredQty}, reserved ${reservedQty}`
          });

          this.updateLocalStockItemReservedQty(tenantId, comp.partNumber, reservedQty);
        }
      }

      const merged = [...otherReservations, ...updatedForOrder];
      this.saveLocalReservations(tenantId, merged);

      if (hadIncrementalShortfall) {
        await this.sendReservationNotification(
          tenantId,
          `⚠️ Order #${order.orderNumber} Edited — Incremental Shortfall`,
          `Order line quantities were increased after confirmation, but raw material stock was insufficient to cover the delta. Review Reserved Materials panel.`,
          order.id,
          order.orderNumber,
          'warning'
        );
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        reservations: updatedForOrder,
        totalComponents: updatedForOrder.length,
        fullyReservedCount: updatedForOrder.filter(r => r.shortfallQty === 0).length,
        partiallyReservedCount: updatedForOrder.filter(r => r.shortfallQty > 0).length,
        unreservedCount: updatedForOrder.filter(r => r.reservedQty === 0).length,
        hasShortfall: updatedForOrder.some(r => r.shortfallQty > 0),
        totalShortfallQty: updatedForOrder.reduce((sum, r) => sum + r.shortfallQty, 0),
        isFullyReserved: updatedForOrder.every(r => r.shortfallQty === 0),
        timestamp: new Date().toISOString()
      };
    } finally {
      releaseLock();
    }
  }

  /**
   * Retrieves all reservations for an order
   */
  static getReservationsForOrder(tenantId: string, orderId: string): StockReservation[] {
    return this.getLocalReservations(tenantId).filter(r => r.orderId === orderId);
  }
}
