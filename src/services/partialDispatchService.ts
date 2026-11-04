// src/services/partialDispatchService.ts

import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Order, 
  QuoteItem, 
  Dispatch, 
  Backorder, 
  BackorderItemSnapshot, 
  OrderDispatchHistoryEntry, 
  OrderDispatchHistoryItem 
} from '../types';
import { logActivityEvent } from '../utils/activityLogger';

export interface LineDispatchInput {
  lineItemId: string;
  dispatchQty: number;
}

export interface CalculatedLineItem {
  id: string;
  name: string;
  specs?: string;
  unit?: string;
  unitPrice: number;
  gstPercent: number;
  discount?: number;
  orderedQty: number;
  alreadyDispatchedQty: number;
  remainingQty: number;
  invoicedQty: number;
  pendingInvoiceQty: number;
  status: 'pending' | 'partially_dispatched' | 'fully_dispatched';
}

/**
 * Calculates current quantities (Ordered, Already Dispatched, Remaining, Invoiced, Pending Invoice) for all order lines.
 * Uses previous non-cancelled dispatches for audit integrity if line item fields are uninitialized.
 */
export function getOrderLinesQuantities(
  order: Order, 
  existingDispatches: Dispatch[] = []
): CalculatedLineItem[] {
  const activeDispatches = existingDispatches.filter(
    d => (d.orderId === order.id || (order.orderNumber && d.dispatchNumber?.includes(order.orderNumber))) && 
         d.status !== 'Cancelled'
  );

  return (order.items || []).map((item, idx) => {
    const lineId = item.id || `line-${idx}`;
    const orderedQty = typeof item.orderedQty === 'number' 
      ? item.orderedQty 
      : (typeof item.quantity === 'number' ? item.quantity : 0);

    // Sum already dispatched from active past dispatches if not explicitly tracked on line
    let alreadyDispatched = 0;
    if (typeof item.dispatchedQty === 'number') {
      alreadyDispatched = item.dispatchedQty;
    } else {
      activeDispatches.forEach(d => {
        (d.items || []).forEach(dItem => {
          if (dItem.id === lineId || dItem.name === item.name) {
            alreadyDispatched += (dItem.quantity || 0);
          }
        });
      });
    }

    const remainingQty = typeof item.remainingQty === 'number'
      ? item.remainingQty
      : Math.max(0, orderedQty - alreadyDispatched);

    // Running Invoiced Qty vs Ordered Qty
    const invoicedQty = typeof item.invoicedQty === 'number' ? item.invoicedQty : 0;
    const pendingInvoiceQty = typeof item.pendingInvoiceQty === 'number' 
      ? item.pendingInvoiceQty 
      : Math.max(0, orderedQty - invoicedQty);

    let status: 'pending' | 'partially_dispatched' | 'fully_dispatched' = 'pending';
    if (remainingQty <= 0 && alreadyDispatched > 0) {
      status = 'fully_dispatched';
    } else if (alreadyDispatched > 0 && remainingQty > 0) {
      status = 'partially_dispatched';
    }

    return {
      id: lineId,
      name: item.name,
      specs: item.specs,
      unit: item.unit || 'pcs',
      unitPrice: item.unitPrice || 0,
      gstPercent: item.gstPercent || 18,
      discount: item.discount || 0,
      orderedQty,
      alreadyDispatchedQty: alreadyDispatched,
      remainingQty,
      invoicedQty,
      pendingInvoiceQty,
      status
    };
  });
}

/**
 * Validates user-entered dispatch quantities against remaining quantities and acceptance criteria.
 */
export function validateDispatchQuantities(
  linesWithInputs: {
    lineItemId: string;
    itemName: string;
    dispatchQty: number;
    remainingQty: number;
  }[]
): { isValid: boolean; error?: string } {
  // Edge Case 2: User enters Dispatch Qty = 0 on all items
  const totalShippingQty = linesWithInputs.reduce((sum, l) => sum + (Number(l.dispatchQty) || 0), 0);
  if (totalShippingQty <= 0) {
    return {
      isValid: false,
      error: 'Dispatch quantity must be greater than zero. Please enter a valid quantity for at least one item.'
    };
  }

  // Edge Case 1: User enters Dispatch Qty > Remaining Qty (Over-shipment prevention)
  for (const line of linesWithInputs) {
    const qty = Number(line.dispatchQty) || 0;
    if (qty < 0) {
      return {
        isValid: false,
        error: `Dispatch quantity for "${line.itemName}" cannot be negative.`
      };
    }

    if (qty > line.remainingQty) {
      return {
        isValid: false,
        error: `Cannot dispatch more than remaining quantity (${line.remainingQty}).`
      };
    }
  }

  return { isValid: true };
}

/**
 * Core Orchestrator: Creates a partial or full dispatch record, decrements remaining quantities,
 * updates order status to 'Partially Dispatched' or 'Dispatched', and creates a linked Backorder
 * with original locked terms for remaining units.
 */
export async function processPartialDispatch(
  tenantId: string,
  order: Order,
  lineInputs: LineDispatchInput[],
  dispatchDetails: {
    dispatchNumber?: string;
    invoiceNumber?: string;
    transporter?: string;
    vehicleNumber?: string;
    driverName?: string;
    driverPhone?: string;
    lrNumber?: string;
    destination?: string;
    dispatchDate?: string;
    notes?: string;
    cartons?: any[];
  },
  operatorName: string
): Promise<{
  dispatch: Dispatch;
  updatedOrder: Order;
  backorder?: Backorder;
}> {
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
  const timestamp = new Date().toISOString();

  // Load current existing dispatches to accurately calculate remaining quantities
  let existingDispatches: Dispatch[] = [];
  if (isSandbox) {
    const cachedD = localStorage.getItem(`dispatches_${tenantId}`) || '[]';
    existingDispatches = JSON.parse(cachedD);
  }

  const currentLines = getOrderLinesQuantities(order, existingDispatches);

  // Match inputs with current lines
  const validationItems = currentLines.map(line => {
    const input = lineInputs.find(i => i.lineItemId === line.id);
    return {
      lineItemId: line.id,
      itemName: line.name,
      dispatchQty: input ? input.dispatchQty : 0,
      remainingQty: line.remainingQty
    };
  });

  // Validate quantities
  const validation = validateDispatchQuantities(validationItems);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid dispatch quantity specifications.');
  }

  const dispatchId = `disp_${Date.now().toString().slice(-6)}`;
  const dispatchNum = dispatchDetails.dispatchNumber || `DISP-${Date.now().toString().slice(-4)}`;

  // Determine which lines are shipping in this consignment
  const shippedItems: QuoteItem[] = [];
  const historyItems: OrderDispatchHistoryItem[] = [];
  const backorderSnapshots: BackorderItemSnapshot[] = [];

  let anyLineHasRemaining = false;
  let totalDispatchedThisRun = 0;
  let totalRemainingAfterThisRun = 0;

  const updatedOrderItems: QuoteItem[] = order.items.map((rawItem, idx) => {
    const lineId = rawItem.id || `line-${idx}`;
    const calculated = currentLines.find(c => c.id === lineId) || {
      orderedQty: rawItem.quantity,
      alreadyDispatchedQty: 0,
      remainingQty: rawItem.quantity
    };

    const input = lineInputs.find(i => i.lineItemId === lineId);
    const shipQty = input ? Math.max(0, Number(input.dispatchQty) || 0) : 0;
    
    const newAlreadyDispatched = calculated.alreadyDispatchedQty + shipQty;
    const newRemaining = Math.max(0, calculated.orderedQty - newAlreadyDispatched);

    if (shipQty > 0) {
      totalDispatchedThisRun += shipQty;
      // Line item added to this dispatch slip
      shippedItems.push({
        ...rawItem,
        id: lineId,
        quantity: shipQty,
        orderedQty: calculated.orderedQty,
        dispatchedQty: shipQty,
        remainingQty: newRemaining,
        total: shipQty * rawItem.unitPrice
      });

      // Item logged in dispatch history
      historyItems.push({
        lineItemId: lineId,
        name: rawItem.name,
        orderedQty: calculated.orderedQty,
        dispatchedQty: shipQty,
        remainingQtyAfter: newRemaining,
        unitPrice: rawItem.unitPrice,
        unit: rawItem.unit
      });
    }

    if (newRemaining > 0) {
      anyLineHasRemaining = true;
      totalRemainingAfterThisRun += newRemaining;

      // Lock in original terms into Backorder Item Snapshot (Edge Case 4)
      backorderSnapshots.push({
        lineItemId: lineId,
        name: rawItem.name,
        hsn: rawItem.hsn,
        originalOrderedQty: calculated.orderedQty,
        dispatchedQty: newAlreadyDispatched,
        backorderQty: newRemaining,
        unit: rawItem.unit,
        unitPrice: rawItem.unitPrice, // Preserved original price snapshot
        discount: rawItem.discount,
        gstPercent: rawItem.gstPercent,
        total: newRemaining * rawItem.unitPrice,
        specs: rawItem.specs
      });
    }

    let lineStatus: 'pending' | 'partially_dispatched' | 'fully_dispatched' = 'pending';
    if (newRemaining <= 0) {
      lineStatus = 'fully_dispatched';
    } else if (newAlreadyDispatched > 0) {
      lineStatus = 'partially_dispatched';
    }

    return {
      ...rawItem,
      id: lineId,
      orderedQty: calculated.orderedQty,
      dispatchedQty: newAlreadyDispatched,
      remainingQty: newRemaining,
      dispatchStatus: lineStatus
    };
  });

  const isPartial = anyLineHasRemaining;
  const newOrderStatus = isPartial ? 'Partially Dispatched' : 'Dispatched';

  // Create Backorder record if remaining quantities exist
  let newBackorder: Backorder | undefined;
  let backorderId: string | undefined;
  let backorderNumber: string | undefined;

  if (isPartial && backorderSnapshots.length > 0) {
    const existingBackorders = getBackordersSync(tenantId);
    const existingOrderBackorders = existingBackorders.filter(b => b.originalOrderId === order.id);
    const boSequence = (existingOrderBackorders.length + 1).toString().padStart(2, '0');
    
    backorderId = `bo_${Date.now().toString().slice(-6)}`;
    
    // Recursive parent backorder tracking (EC 3: backorder of a backorder)
    const parentBoId = (dispatchDetails as any).parentBackorderId || (dispatchDetails as any).sourceBackorderId;
    const parentBoNumber = (dispatchDetails as any).parentBackorderNumber || (dispatchDetails as any).sourceBackorderNumber;

    backorderNumber = parentBoNumber 
      ? `${parentBoNumber}-SUB${boSequence}`
      : `BO-${order.orderNumber || 'ORD'}-${boSequence}`;

    const totalBoValue = backorderSnapshots.reduce((acc, itm) => acc + (itm.total || 0), 0);

    const originalPromised = (order as any).originalPromisedDate || order.deliveryDate || new Date().toISOString().split('T')[0];
    const initialTargetDate = order.deliveryDate || originalPromised;

    newBackorder = {
      id: backorderId,
      tenantId,
      backorderNumber,
      originalOrderId: order.id,
      originalOrderNumber: order.orderNumber,
      parentBackorderId: parentBoId,
      parentBackorderNumber: parentBoNumber,
      customerPoNumber: order.customerPoNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      phone: order.phone,
      deliveryDate: initialTargetDate,
      originalPromisedDate: originalPromised,
      targetDate: initialTargetDate,
      deliveryTerms: order.termsAndConditions || 'Standard delivery per original terms',
      billingAddress: order.billingAddress,
      shippingAddress: order.shippingAddress,
      plantId: order.plantId,
      items: backorderSnapshots,
      totalRemainingQty: totalRemainingAfterThisRun,
      totalBackorderValue: totalBoValue,
      status: 'pending',
      productionStage: 'cutting',
      sourceDispatchId: dispatchId,
      sourceDispatchNumber: dispatchNum,
      createdAt: timestamp,
      createdBy: operatorName
    };

    // If dispatching against an existing backorder, mark that parent backorder as fulfilled or partially dispatched
    if (parentBoId) {
      const parentBoIndex = existingBackorders.findIndex(b => b.id === parentBoId);
      if (parentBoIndex >= 0) {
        existingBackorders[parentBoIndex] = {
          ...existingBackorders[parentBoIndex],
          status: 'fulfilled',
          updatedAt: timestamp
        };
        localStorage.setItem(`backorders_${tenantId}`, JSON.stringify(existingBackorders));
      }
    }
  }

  // Create Dispatch Record
  const newDispatch: Dispatch = {
    id: dispatchId,
    tenantId,
    orderId: order.id,
    plantId: order.plantId,
    dispatchNumber: dispatchNum,
    invoiceNumber: dispatchDetails.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
    customerId: order.customerId,
    customerName: order.customerName,
    dispatchDate: dispatchDetails.dispatchDate || timestamp.split('T')[0],
    transporter: dispatchDetails.transporter || 'SafeExpress Ltd.',
    vehicleNumber: (dispatchDetails.vehicleNumber || '').toUpperCase().replace(/[^A-Z0-9-]/g, ''),
    driverName: dispatchDetails.driverName || '',
    driverPhone: dispatchDetails.driverPhone || order.phone || '',
    lrNumber: dispatchDetails.lrNumber || `LR-${Math.floor(100000 + Math.random() * 900000)}`,
    LRNumber: dispatchDetails.lrNumber || `LR-${Math.floor(100000 + Math.random() * 900000)}`,
    destination: dispatchDetails.destination || order.shippingAddress || 'Customer Facility',
    itemsSummary: shippedItems.map(i => `${i.name} (Qty: ${i.quantity})`).join(', '),
    items: shippedItems,
    cartons: dispatchDetails.cartons || [],
    totalPackages: (dispatchDetails.cartons || []).length || 1,
    status: 'Dispatched',
    dispatchedAt: timestamp,
    notes: dispatchDetails.notes || (isPartial ? 'Partial consignment dispatched. Backorder generated for balance quantity.' : 'Consignment 100% fulfilled.'),
    isPartialDispatch: isPartial,
    totalRemainingQty: totalRemainingAfterThisRun,
    backorderId,
    backorderNumber
  };

  // Build Dispatch History entry for the order
  const newHistoryEntry: OrderDispatchHistoryEntry = {
    dispatchId,
    dispatchNumber: dispatchNum,
    timestamp,
    dispatchedAt: timestamp,
    transporter: newDispatch.transporter,
    vehicleNumber: newDispatch.vehicleNumber,
    lrNumber: newDispatch.lrNumber,
    dispatchedBy: operatorName,
    isPartial,
    items: historyItems,
    status: 'Dispatched',
    backorderId,
    backorderNumber
  };

  const updatedHistory = [newHistoryEntry, ...(order.dispatchHistory || [])];
  const updatedBackorderIds = backorderId 
    ? [backorderId, ...(order.backorderIds || [])] 
    : (order.backorderIds || []);

  const updatedOrder: Order = {
    ...order,
    items: updatedOrderItems,
    status: newOrderStatus as any,
    dispatchHistory: updatedHistory,
    backorderIds: updatedBackorderIds
  };

  // PERSISTENCE: Sandbox or Firestore
  if (isSandbox) {
    // 1. Save dispatch
    const cachedDispatches = localStorage.getItem(`dispatches_${tenantId}`) || '[]';
    const parsedDispatches = JSON.parse(cachedDispatches);
    localStorage.setItem(`dispatches_${tenantId}`, JSON.stringify([newDispatch, ...parsedDispatches]));

    // 2. Save backorder if generated
    if (newBackorder) {
      const cachedBackorders = localStorage.getItem(`backorders_${tenantId}`) || '[]';
      const parsedBackorders = JSON.parse(cachedBackorders);
      localStorage.setItem(`backorders_${tenantId}`, JSON.stringify([newBackorder, ...parsedBackorders]));
    }

    // 3. Update orders
    const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
    const parsedOrders = JSON.parse(cachedOrders) as Order[];
    const updatedOrdersList = parsedOrders.map(o => o.id === order.id ? updatedOrder : o);
    localStorage.setItem(`orders_${tenantId}`, JSON.stringify(updatedOrdersList));

    // 4. Update customer portal order cache
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('customer_orders_')) {
        try {
          const cachedCO = localStorage.getItem(key) || '[]';
          const parsedCO = JSON.parse(cachedCO) as any[];
          const hasMatch = parsedCO.some(o => o.id === order.id || o.orderNumber === order.orderNumber);
          if (hasMatch) {
            const updatedCO = parsedCO.map(o => {
              if (o.id === order.id || o.orderNumber === order.orderNumber) {
                return {
                  ...o,
                  status: isPartial ? 'Partially Dispatched' : 'Dispatched',
                  dispatchId,
                  dispatchedAt: timestamp,
                  transporter: newDispatch.transporter,
                  lrNumber: newDispatch.lrNumber,
                  remainingQty: totalRemainingAfterThisRun
                };
              }
              return o;
            });
            localStorage.setItem(key, JSON.stringify(updatedCO));
          }
        } catch (e) {
          console.error('Error updating customer portal order in sandbox:', e);
        }
      }
    }
  } else {
    // Live Firestore
    // 1. Write dispatch document
    await setDoc(doc(db, 'tenants', tenantId, 'dispatches', dispatchId), {
      ...newDispatch,
      dispatchedAt: serverTimestamp()
    });

    // 2. Write backorder document if generated
    if (newBackorder) {
      await setDoc(doc(db, 'tenants', tenantId, 'backorders', backorderId!), {
        ...newBackorder,
        createdAt: serverTimestamp()
      });
    }

    // 3. Update order in Firestore
    const orderDocRef = doc(db, 'orders', order.id);
    await updateDoc(orderDocRef, {
      items: updatedOrderItems,
      status: newOrderStatus,
      dispatchHistory: updatedHistory,
      backorderIds: updatedBackorderIds,
      updatedAt: serverTimestamp()
    });
  }

  // Audit activity log
  try {
    await logActivityEvent({
      actionType: 'stage_change',
      entityType: 'order',
      entityId: order.id,
      tenantId,
      actor: {
        userId: 'dispatcher',
        displayName: operatorName
      },
      description: isPartial
        ? `Logged partial dispatch #${dispatchNum} (${totalDispatchedThisRun} units shipped, ${totalRemainingAfterThisRun} remaining). Created Backorder #${backorderNumber}.`
        : `Logged full dispatch #${dispatchNum} (${totalDispatchedThisRun} units shipped, 100% fulfilled).`,
      metadata: {
        orderNumber: order.orderNumber,
        dispatchNumber: dispatchNum,
        isPartial,
        backorderNumber,
        shippedQuantity: totalDispatchedThisRun,
        remainingQuantity: totalRemainingAfterThisRun
      }
    });
  } catch (err) {
    console.warn('Activity logging error:', err);
  }

  return {
    dispatch: newDispatch,
    updatedOrder,
    backorder: newBackorder
  };
}

/**
 * Edge Case 5: User cancels a partial dispatch after saving.
 * The dispatch record is voided; the Remaining Qty is restored;
 * the auto-created backorder is flagged for review (not auto-deleted).
 */
export async function cancelAndVoidDispatch(
  tenantId: string,
  dispatchId: string,
  operatorName: string
): Promise<{
  voidedDispatch: Dispatch;
  restoredOrder: Order;
  flaggedBackorder?: Backorder;
}> {
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
  const timestamp = new Date().toISOString();

  let targetDispatch: Dispatch | null = null;
  let allDispatches: Dispatch[] = [];

  if (isSandbox) {
    const cached = localStorage.getItem(`dispatches_${tenantId}`) || '[]';
    allDispatches = JSON.parse(cached);
    targetDispatch = allDispatches.find(d => d.id === dispatchId) || null;
  } else {
    const dSnap = await getDoc(doc(db, 'tenants', tenantId, 'dispatches', dispatchId));
    if (dSnap.exists()) {
      targetDispatch = { id: dSnap.id, ...dSnap.data() } as Dispatch;
    }
  }

  if (!targetDispatch) {
    throw new Error(`Dispatch with ID ${dispatchId} could not be located.`);
  }

  if (targetDispatch.status === 'Cancelled') {
    throw new Error('This dispatch has already been cancelled.');
  }

  // Find parent order
  let parentOrder: Order | null = null;
  let allOrders: Order[] = [];

  if (isSandbox) {
    const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
    allOrders = JSON.parse(cachedOrders);
    parentOrder = allOrders.find(o => o.id === targetDispatch?.orderId) || null;
  } else {
    const oSnap = await getDoc(doc(db, 'orders', targetDispatch.orderId));
    if (oSnap.exists()) {
      parentOrder = { id: oSnap.id, ...oSnap.data() } as Order;
    }
  }

  if (!parentOrder) {
    throw new Error(`Parent Order for dispatch ${targetDispatch.dispatchNumber} not found.`);
  }

  // Restore quantities on order lines
  const voidedItemsMap = new Map<string, number>();
  (targetDispatch.items || []).forEach(itm => {
    const key = itm.id || itm.name;
    voidedItemsMap.set(key, (voidedItemsMap.get(key) || 0) + (itm.quantity || 0));
  });

  let totalRestoredQty = 0;
  const restoredOrderItems = parentOrder.items.map(rawItem => {
    const key = rawItem.id || rawItem.name;
    const qtyToRestore = voidedItemsMap.get(key) || 0;
    totalRestoredQty += qtyToRestore;

    const currentDispatched = rawItem.dispatchedQty ?? rawItem.quantity;
    const currentRemaining = rawItem.remainingQty ?? 0;
    const ordered = rawItem.orderedQty ?? rawItem.quantity;

    const restoredDispatched = Math.max(0, currentDispatched - qtyToRestore);
    const restoredRemaining = Math.min(ordered, currentRemaining + qtyToRestore);

    let lineStatus: 'pending' | 'partially_dispatched' | 'fully_dispatched' = 'pending';
    if (restoredRemaining <= 0) {
      lineStatus = 'fully_dispatched';
    } else if (restoredDispatched > 0) {
      lineStatus = 'partially_dispatched';
    }

    return {
      ...rawItem,
      orderedQty: ordered,
      dispatchedQty: restoredDispatched,
      remainingQty: restoredRemaining,
      dispatchStatus: lineStatus
    };
  });

  // Re-evaluate parent order status
  const anyRemaining = restoredOrderItems.some(i => (i.remainingQty || 0) > 0);
  const anyDispatched = restoredOrderItems.some(i => (i.dispatchedQty || 0) > 0);

  let restoredOrderStatus: Order['status'] = 'in-production';
  if (!anyRemaining) {
    restoredOrderStatus = 'Dispatched';
  } else if (anyDispatched) {
    restoredOrderStatus = 'Partially Dispatched';
  } else {
    restoredOrderStatus = 'in-production';
  }

  // Update dispatch history on order
  const updatedDispatchHistory = (parentOrder.dispatchHistory || []).map(entry => {
    if (entry.dispatchId === dispatchId || entry.dispatchNumber === targetDispatch?.dispatchNumber) {
      return {
        ...entry,
        status: 'Cancelled' as const
      };
    }
    return entry;
  });

  const restoredOrder: Order = {
    ...parentOrder,
    items: restoredOrderItems,
    status: restoredOrderStatus,
    dispatchHistory: updatedDispatchHistory
  };

  // Void the dispatch
  const voidedDispatch: Dispatch = {
    ...targetDispatch,
    status: 'Cancelled',
    notes: `${targetDispatch.notes || ''} [VOIDED & CANCELLED by ${operatorName} on ${new Date().toLocaleString()} - Restored ${totalRestoredQty} units to parent order]`.trim()
  };

  // Flag linked backorder for review (NOT deleted, preserving audit integrity)
  let flaggedBackorder: Backorder | undefined;
  if (targetDispatch.backorderId || targetDispatch.backorderNumber) {
    const existingBackorders = getBackordersSync(tenantId);
    const matchedBo = existingBackorders.find(
      b => b.id === targetDispatch?.backorderId || 
           b.backorderNumber === targetDispatch?.backorderNumber ||
           b.sourceDispatchId === dispatchId
    );

    if (matchedBo) {
      flaggedBackorder = {
        ...matchedBo,
        status: 'review_required',
        reviewFlagged: true,
        statusReason: `Dispatch #${targetDispatch.dispatchNumber} was voided/cancelled. ${totalRestoredQty} units were restored to Order #${parentOrder.orderNumber}. Supervisor review required before re-routing.`,
        reviewNotes: `Flagged for review on ${timestamp} by ${operatorName}. Backorder retained for audit history (not auto-deleted).`,
        updatedAt: timestamp
      };

      if (isSandbox) {
        const updatedBos = existingBackorders.map(b => b.id === flaggedBackorder?.id ? flaggedBackorder : b);
        localStorage.setItem(`backorders_${tenantId}`, JSON.stringify(updatedBos));
      } else {
        await updateDoc(doc(db, 'tenants', tenantId, 'backorders', matchedBo.id), {
          status: 'review_required',
          reviewFlagged: true,
          statusReason: flaggedBackorder.statusReason,
          reviewNotes: flaggedBackorder.reviewNotes,
          updatedAt: serverTimestamp()
        });
      }
    }
  }

  // Save updated dispatch & order
  if (isSandbox) {
    const updatedDispatches = allDispatches.map(d => d.id === dispatchId ? voidedDispatch : d);
    localStorage.setItem(`dispatches_${tenantId}`, JSON.stringify(updatedDispatches));

    const updatedOrders = allOrders.map(o => o.id === parentOrder?.id ? restoredOrder : o);
    localStorage.setItem(`orders_${tenantId}`, JSON.stringify(updatedOrders));
  } else {
    await updateDoc(doc(db, 'tenants', tenantId, 'dispatches', dispatchId), {
      status: 'Cancelled',
      notes: voidedDispatch.notes,
      updatedAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'orders', parentOrder.id), {
      items: restoredOrderItems,
      status: restoredOrderStatus,
      dispatchHistory: updatedDispatchHistory,
      updatedAt: serverTimestamp()
    });
  }

  // Log activity
  try {
    await logActivityEvent({
      actionType: 'status_change',
      entityType: 'dispatch',
      entityId: dispatchId,
      tenantId,
      actor: {
        userId: 'dispatcher',
        displayName: operatorName
      },
      description: `Cancelled dispatch #${targetDispatch.dispatchNumber}. Restored ${totalRestoredQty} units to Order #${parentOrder.orderNumber}. Backorder ${flaggedBackorder ? '#' + flaggedBackorder.backorderNumber : ''} flagged for review.`,
      metadata: {
        dispatchNumber: targetDispatch.dispatchNumber,
        orderNumber: parentOrder.orderNumber,
        restoredQuantity: totalRestoredQty,
        flaggedBackorderNumber: flaggedBackorder?.backorderNumber
      }
    });
  } catch (err) {
    console.warn('Activity logging error:', err);
  }

  return {
    voidedDispatch,
    restoredOrder,
    flaggedBackorder
  };
}

/**
 * Returns all backorders for a tenant synchronously from sandbox or cached store.
 */
export function getBackordersSync(tenantId: string): Backorder[] {
  try {
    const cached = localStorage.getItem(`backorders_${tenantId}`) || '[]';
    return JSON.parse(cached);
  } catch {
    return [];
  }
}

/**
 * Loads backorders from Firestore or sandbox.
 */
export async function getBackorders(tenantId: string): Promise<Backorder[]> {
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
  if (isSandbox) {
    return getBackordersSync(tenantId);
  }

  try {
    const q = collection(db, 'tenants', tenantId, 'backorders');
    const snap = await getDocs(q);
    const list: Backorder[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as Backorder));
    return list;
  } catch (err) {
    console.warn('Error reading backorders from firestore, falling back to local cache', err);
    return getBackordersSync(tenantId);
  }
}

/**
 * Returns all backorders linked to a specific order ID.
 */
export function getBackordersForOrder(tenantId: string, orderId: string): Backorder[] {
  const all = getBackordersSync(tenantId);
  return all.filter(b => b.originalOrderId === orderId);
}

/**
 * Reschedules a backorder's target date independently of the parent order.
 * Preserves the original contract promised date for audit integrity.
 */
export async function rescheduleBackorder(
  tenantId: string,
  backorderId: string,
  newTargetDate: string,
  reason: string,
  operatorName: string
): Promise<Backorder> {
  const timestamp = new Date().toISOString();
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  const allBackorders = getBackordersSync(tenantId);
  const targetIndex = allBackorders.findIndex(b => b.id === backorderId);

  if (targetIndex === -1) {
    throw new Error(`Backorder #${backorderId} was not found.`);
  }

  const existingBo = allBackorders[targetIndex];
  const updatedBo: Backorder = {
    ...existingBo,
    targetDate: newTargetDate,
    deliveryDate: newTargetDate, // Update target execution date while keeping originalPromisedDate intact
    rescheduledReason: reason,
    rescheduledAt: timestamp,
    rescheduledBy: operatorName,
    updatedAt: timestamp
  };

  allBackorders[targetIndex] = updatedBo;
  localStorage.setItem(`backorders_${tenantId}`, JSON.stringify(allBackorders));

  if (!isSandbox && db) {
    try {
      const boRef = doc(db, 'tenants', tenantId, 'backorders', backorderId);
      await updateDoc(boRef, {
        targetDate: newTargetDate,
        deliveryDate: newTargetDate,
        rescheduledReason: reason,
        rescheduledAt: timestamp,
        rescheduledBy: operatorName,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Could not sync reschedule to Firestore, local store saved.', err);
    }
  }

  try {
    await logActivityEvent({
      actionType: 'status_change',
      entityType: 'order',
      entityId: existingBo.originalOrderId,
      tenantId,
      actor: {
        userId: 'supervisor',
        displayName: operatorName
      },
      description: `Rescheduled Backorder #${existingBo.backorderNumber} target date to ${newTargetDate}. Original promised date: ${existingBo.originalPromisedDate || 'N/A'}. Reason: ${reason}`,
      metadata: {
        backorderNumber: existingBo.backorderNumber,
        orderNumber: existingBo.originalOrderNumber,
        previousTargetDate: existingBo.targetDate || existingBo.deliveryDate,
        newTargetDate,
        reason
      }
    });
  } catch (err) {
    console.warn('Activity logging error:', err);
  }

  return updatedBo;
}

/**
 * Updates backorder production status (e.g. 'in_production', 'ready_for_dispatch', 'completed').
 * When backorder is completed/ready, checks if all sibling backorders for the parent order are closed.
 * Automatically transitions parent order status to 'Ready for Dispatch' or 'Fully Dispatched'.
 */
export async function updateBackorderProductionStatus(
  tenantId: string,
  backorderId: string,
  newStatus: Backorder['status'],
  operatorName: string,
  notes?: string
): Promise<{ updatedBackorder: Backorder; updatedOrder?: Order }> {
  const timestamp = new Date().toISOString();
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  const allBackorders = getBackordersSync(tenantId);
  const targetIndex = allBackorders.findIndex(b => b.id === backorderId);

  if (targetIndex === -1) {
    throw new Error(`Backorder #${backorderId} was not found.`);
  }

  const existingBo = allBackorders[targetIndex];
  const updatedBo: Backorder = {
    ...existingBo,
    status: newStatus,
    productionNotes: notes || existingBo.productionNotes,
    productionStage: newStatus === 'ready_for_dispatch' ? 'ready' : (newStatus === 'in_production' ? 'assembly' : existingBo.productionStage),
    updatedAt: timestamp
  };

  allBackorders[targetIndex] = updatedBo;
  localStorage.setItem(`backorders_${tenantId}`, JSON.stringify(allBackorders));

  if (!isSandbox && db) {
    try {
      const boRef = doc(db, 'tenants', tenantId, 'backorders', backorderId);
      await updateDoc(boRef, {
        status: newStatus,
        productionNotes: updatedBo.productionNotes,
        productionStage: updatedBo.productionStage,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Could not sync backorder status to Firestore, local store saved.', err);
    }
  }

  // Evaluate parent order transition
  let updatedOrder: Order | undefined;
  const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
  const ordersList: Order[] = JSON.parse(cachedOrders);
  const parentOrderIndex = ordersList.findIndex(o => o.id === existingBo.originalOrderId);

  if (parentOrderIndex !== -1) {
    const parentOrder = ordersList[parentOrderIndex];
    // Check all sibling backorders for this parent order
    const siblingBackorders = allBackorders.filter(b => b.originalOrderId === existingBo.originalOrderId);
    
    // Check if ALL backorders are completed, fulfilled or explicitly cancelled
    const allBackordersClosed = siblingBackorders.length > 0 && siblingBackorders.every(
      b => b.status === 'completed' || b.status === 'fulfilled' || b.status === 'cancelled'
    );

    // Check if ALL backorders are at least ready for dispatch or completed/fulfilled/cancelled
    const allBackordersReady = siblingBackorders.length > 0 && siblingBackorders.every(
      b => b.status === 'ready_for_dispatch' || b.status === 'completed' || b.status === 'fulfilled' || b.status === 'cancelled'
    );

    let nextOrderStatus = parentOrder.status;

    if (newStatus === 'ready_for_dispatch' && allBackordersReady) {
      nextOrderStatus = 'Ready for Dispatch' as any;
    } else if ((newStatus === 'completed' || newStatus === 'fulfilled') && allBackordersClosed) {
      // If backorder completed and all sibling backorders are closed:
      // If already dispatched or remaining items are 0, mark as Fully Dispatched
      const remainingUnfulfilled = (parentOrder.items || []).reduce((sum, itm) => sum + (itm.remainingQty || 0), 0);
      if (remainingUnfulfilled === 0 || parentOrder.status === 'Partially Dispatched') {
        nextOrderStatus = 'Fully Dispatched' as any;
      } else {
        nextOrderStatus = 'Ready for Dispatch' as any;
      }
    }

    if (nextOrderStatus !== parentOrder.status) {
      updatedOrder = {
        ...parentOrder,
        status: nextOrderStatus,
        updatedAt: timestamp
      };

      ordersList[parentOrderIndex] = updatedOrder;
      localStorage.setItem(`orders_${tenantId}`, JSON.stringify(ordersList));

      if (!isSandbox && db) {
        try {
          const ordRef = doc(db, 'tenants', tenantId, 'orders', parentOrder.id);
          await updateDoc(ordRef, {
            status: nextOrderStatus,
            updatedAt: serverTimestamp()
          });
        } catch (err) {
          console.warn('Could not sync parent order status update to Firestore', err);
        }
      }
    }
  }

  try {
    await logActivityEvent({
      actionType: 'status_change',
      entityType: 'order',
      entityId: existingBo.originalOrderId,
      tenantId,
      actor: {
        userId: 'supervisor',
        displayName: operatorName
      },
      description: `Backorder #${existingBo.backorderNumber} transitioned to ${newStatus.toUpperCase()}.${updatedOrder ? ` Parent order #${updatedOrder.orderNumber} updated to ${updatedOrder.status}.` : ''}`,
      metadata: {
        backorderNumber: existingBo.backorderNumber,
        newStatus,
        parentOrderNumber: existingBo.originalOrderNumber,
        parentOrderStatus: updatedOrder?.status
      }
    });
  } catch (err) {
    console.warn('Activity logging error:', err);
  }

  return { updatedBackorder: updatedBo, updatedOrder };
}

/**
 * Explicitly cancels a backorder with a required reason code and notes.
 * Used for Edge Case 1: when parent order is cancelled after partial dispatch,
 * backorders remain open and visible until explicitly cancelled with an audit reason code.
 */
export async function cancelBackorderWithReason(
  tenantId: string,
  backorderId: string,
  reasonCode: string,
  reasonNotes: string,
  operatorName: string
): Promise<{ cancelledBackorder: Backorder; updatedOrder?: Order }> {
  const timestamp = new Date().toISOString();
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  const allBackorders = getBackordersSync(tenantId);
  const targetIndex = allBackorders.findIndex(b => b.id === backorderId);

  if (targetIndex === -1) {
    throw new Error(`Backorder #${backorderId} was not found.`);
  }

  const existingBo = allBackorders[targetIndex];
  const cancelledBo: Backorder = {
    ...existingBo,
    status: 'cancelled',
    cancellationCode: reasonCode,
    cancellationReason: reasonNotes,
    cancelledAt: timestamp,
    cancelledBy: operatorName,
    updatedAt: timestamp
  };

  allBackorders[targetIndex] = cancelledBo;
  localStorage.setItem(`backorders_${tenantId}`, JSON.stringify(allBackorders));

  if (!isSandbox && db) {
    try {
      const boRef = doc(db, 'tenants', tenantId, 'backorders', backorderId);
      await updateDoc(boRef, {
        status: 'cancelled',
        cancellationCode: reasonCode,
        cancellationReason: reasonNotes,
        cancelledAt: timestamp,
        cancelledBy: operatorName,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Could not sync backorder cancellation to Firestore', err);
    }
  }

  // Check if all remaining sibling backorders for parent order are now closed
  let updatedOrder: Order | undefined;
  const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
  const ordersList: Order[] = JSON.parse(cachedOrders);
  const parentOrderIndex = ordersList.findIndex(o => o.id === existingBo.originalOrderId);

  if (parentOrderIndex !== -1) {
    const parentOrder = ordersList[parentOrderIndex];
    const siblingBackorders = allBackorders.filter(b => b.originalOrderId === existingBo.originalOrderId);
    const allBackordersClosed = siblingBackorders.length > 0 && siblingBackorders.every(
      b => b.status === 'completed' || b.status === 'fulfilled' || b.status === 'cancelled'
    );

    if (allBackordersClosed && parentOrder.status === 'Partially Dispatched') {
      // If all other backorders are cancelled/fulfilled, order is either Fully Dispatched or Closed
      const nextStatus = 'Fully Dispatched';
      updatedOrder = {
        ...parentOrder,
        status: nextStatus as any,
        updatedAt: timestamp
      };
      ordersList[parentOrderIndex] = updatedOrder;
      localStorage.setItem(`orders_${tenantId}`, JSON.stringify(ordersList));
    }
  }

  try {
    await logActivityEvent({
      actionType: 'status_change',
      entityType: 'order',
      entityId: existingBo.originalOrderId,
      tenantId,
      actor: {
        userId: 'supervisor',
        displayName: operatorName
      },
      description: `Backorder #${existingBo.backorderNumber} explicitly cancelled. Reason [${reasonCode}]: ${reasonNotes}.`,
      metadata: {
        backorderNumber: existingBo.backorderNumber,
        cancellationCode: reasonCode,
        cancellationReason: reasonNotes
      }
    });
  } catch (err) {
    console.warn('Activity logging error:', err);
  }

  return { cancelledBackorder: cancelledBo, updatedOrder };
}

