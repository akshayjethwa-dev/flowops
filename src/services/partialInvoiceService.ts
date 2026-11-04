// src/services/partialInvoiceService.ts

import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Dispatch, 
  Order, 
  Invoice, 
  CreditNote, 
  CreditNoteItem, 
  QuoteItem,
  ActivityEvent
} from '../types';

const checkIsSandbox = () => {
  return localStorage.getItem('isSandboxMode') === 'true' || !db;
};

export interface InvoiceLineItemInput {
  lineItemId: string;
  name: string;
  hsn: string;
  dispatchedQty: number;
  unitPrice: number;
  gstPercent: number; // Configurable / prevailing GST rate at time of dispatch
  discount?: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstAmount: number;
  total: number;
}

export interface PartialInvoiceCalculationResult {
  items: InvoiceLineItemInput[];
  subtotal: number;
  taxAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  total: number;
  taxType: 'intra_state' | 'inter_state';
  hsnSummary: Array<{
    hsn: string;
    description: string;
    taxable: number;
    rate: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }>;
}

/**
 * Calculates line-by-line taxable values and GST breakdown for only the dispatched quantity.
 * Allows custom GST rate per line so that rate changes between dispatches are respected (Acceptance Criteria EC 3).
 */
export function calculatePartialInvoiceBreakdown(
  dispatch: Dispatch,
  order?: Order | null,
  options?: {
    customGstRates?: Record<string, number>; // LineItemId -> GST %
    customHsns?: Record<string, number | string>;
    supplierStateCode?: string;
    customerStateCode?: string;
  }
): PartialInvoiceCalculationResult {
  const items = dispatch.items || [];
  const supplierState = options?.supplierStateCode || '24'; // Gujarat default
  const customerState = options?.customerStateCode || '24';
  const isIntraState = supplierState === customerState;
  const taxType: 'intra_state' | 'inter_state' = isIntraState ? 'intra_state' : 'inter_state';

  let subtotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const hsnMap: Record<string, { description: string; taxable: number; rate: number; cgst: number; sgst: number; igst: number; totalTax: number }> = {};

  const lineItems: InvoiceLineItemInput[] = items.map((itm, idx) => {
    const lineId = itm.id || `line-${idx}`;
    // Dispatched quantity only (from dispatch record)
    const qty = Number(itm.quantity) || 0;
    const unitPrice = Number(itm.unitPrice) || 0;
    const discount = Number(itm.discount) || 0;

    // Use customized GST rate at time of dispatch if provided, otherwise item's gstPercent, default to 18%
    const gstRate = options?.customGstRates?.[lineId] !== undefined 
      ? Number(options.customGstRates[lineId]) 
      : (typeof itm.gstPercent === 'number' ? itm.gstPercent : 18);

    // HSN resolution
    const hsn = String(options?.customHsns?.[lineId] || itm.hsn || '8483');

    // Taxable Value = (Quantity * Rate) - Discount
    const lineTaxable = Math.max(0, (qty * unitPrice) - discount);
    subtotal += lineTaxable;

    let lineCgst = 0;
    let lineSgst = 0;
    let lineIgst = 0;
    let lineGstAmount = 0;

    if (isIntraState) {
      const halfRate = gstRate / 2;
      lineCgst = Math.round((lineTaxable * halfRate) / 100);
      lineSgst = Math.round((lineTaxable * halfRate) / 100);
      lineGstAmount = lineCgst + lineSgst;
      cgstTotal += lineCgst;
      sgstTotal += lineSgst;
    } else {
      lineIgst = Math.round((lineTaxable * gstRate) / 100);
      lineGstAmount = lineIgst;
      igstTotal += lineIgst;
    }

    const lineTotal = lineTaxable + lineGstAmount;

    // Aggregate in HSN summary
    if (!hsnMap[hsn]) {
      hsnMap[hsn] = {
        description: itm.name || 'Industrial Component',
        taxable: 0,
        rate: gstRate,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0
      };
    }
    hsnMap[hsn].taxable += lineTaxable;
    hsnMap[hsn].cgst += lineCgst;
    hsnMap[hsn].sgst += lineSgst;
    hsnMap[hsn].igst += lineIgst;
    hsnMap[hsn].totalTax += lineGstAmount;

    return {
      lineItemId: lineId,
      name: itm.name,
      hsn,
      dispatchedQty: qty,
      unitPrice,
      gstPercent: gstRate,
      discount,
      taxableValue: lineTaxable,
      cgst: lineCgst,
      sgst: lineSgst,
      igst: lineIgst,
      gstAmount: lineGstAmount,
      total: lineTotal
    };
  });

  const taxAmount = isIntraState ? (cgstTotal + sgstTotal) : igstTotal;
  const total = subtotal + taxAmount;

  const hsnSummary = Object.entries(hsnMap).map(([hsn, data]) => ({
    hsn,
    ...data
  }));

  return {
    items: lineItems,
    subtotal,
    taxAmount,
    cgstTotal,
    sgstTotal,
    igstTotal,
    total,
    taxType,
    hsnSummary
  };
}

/**
 * Checks if an invoice has already been generated for this dispatch record.
 * Required for Acceptance Criteria EC 1: "User attempts to generate a second invoice for the same dispatch -> System blocks; shows: 'An invoice already exists for this dispatch.'"
 */
export async function checkInvoiceExistsForDispatch(
  tenantId: string,
  dispatch: Dispatch
): Promise<{ exists: boolean; invoice?: Invoice; invoiceNumber?: string }> {
  // Check direct flags on dispatch
  if (dispatch.isInvoiced && dispatch.invoiceNumber) {
    return {
      exists: true,
      invoiceNumber: dispatch.invoiceNumber
    };
  }

  const isSandbox = checkIsSandbox();

  if (isSandbox) {
    try {
      const cached = localStorage.getItem(`invoices_${tenantId}`);
      if (cached) {
        const list: Invoice[] = JSON.parse(cached);
        const match = list.find(inv => 
          inv.dispatchId === dispatch.id || 
          (inv.dispatchNumber && (inv.dispatchNumber === dispatch.dispatchNumber || inv.dispatchNumber === dispatch.invoiceNumber)) ||
          inv.invoiceNumber === dispatch.invoiceNumber
        );
        if (match) {
          return { exists: true, invoice: match, invoiceNumber: match.invoiceNumber };
        }
      }
    } catch (e) {
      console.error('Error checking local invoice cache:', e);
    }
  } else {
    try {
      // Query firestore
      const colRef = collection(db, 'invoices');
      const q = query(colRef, where('tenantId', '==', tenantId), where('dispatchId', '==', dispatch.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const invDoc = snap.docs[0];
        const invData = { id: invDoc.id, ...invDoc.data() } as Invoice;
        return { exists: true, invoice: invData, invoiceNumber: invData.invoiceNumber };
      }
    } catch (e) {
      console.warn('Firestore invoice lookup check:', e);
    }
  }

  return { exists: false };
}

/**
 * Generates a Tax Invoice for ONLY the quantity dispatched.
 * Enforces:
 * 1. Zero quantity guard: If total dispatched qty <= 0, blocks generation.
 * 2. Duplicate invoice guard: If an invoice already exists for this dispatch, blocks generation.
 * 3. Accurate taxable value, HSN, and GST breakdown for only the dispatched quantity.
 * 4. Updates running total of Invoiced Qty vs. Ordered Qty per parent order line.
 * 5. Uses prevailing GST rate at the time of dispatch / invoicing (EC 3).
 */
export async function generatePartialInvoiceFromDispatch(params: {
  tenantId: string;
  dispatch: Dispatch;
  order: Order;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  customGstRates?: Record<string, number>;
  customHsns?: Record<string, string>;
  notes?: string;
  createdBy: string;
  createdByName: string;
}): Promise<{ invoice: Invoice; updatedOrder: Order; updatedDispatch: Dispatch }> {
  const {
    tenantId,
    dispatch,
    order,
    customGstRates,
    customHsns,
    notes,
    createdBy,
    createdByName
  } = params;

  // 1. Acceptance Criteria: "If the dispatched quantity is zero (e.g., a return), no invoice is generated."
  const totalDispatchedQty = (dispatch.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  if (totalDispatchedQty <= 0) {
    throw new Error('Cannot generate an invoice for a dispatch with zero dispatched quantity.');
  }

  // 2. Acceptance Criteria EC 1: "User attempts to generate a second invoice for the same dispatch. System blocks; shows: 'An invoice already exists for this dispatch.'"
  const existingCheck = await checkInvoiceExistsForDispatch(tenantId, dispatch);
  if (existingCheck.exists) {
    throw new Error(`An invoice already exists for this dispatch (${existingCheck.invoiceNumber || dispatch.invoiceNumber}).`);
  }

  // 3. Compute tax breakdown and line items for ONLY the dispatched quantity
  const breakdown = calculatePartialInvoiceBreakdown(dispatch, order, {
    customGstRates,
    customHsns
  });

  const invoiceNumber = params.invoiceNumber || dispatch.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`;
  const invoiceDate = params.invoiceDate || dispatch.dispatchDate || new Date().toISOString().split('T')[0];
  
  // Default due date: +30 days
  const dueDate = params.dueDate || (() => {
    const d = new Date(invoiceDate);
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  })();

  const isSandbox = checkIsSandbox();
  const createdAtIso = new Date().toISOString();

  // 4. Construct Invoice Record
  const newInvoice: Invoice = {
    id: invoiceNumber,
    invoiceNumber,
    tenantId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    dispatchId: dispatch.id,
    dispatchNumber: dispatch.dispatchNumber || dispatch.invoiceNumber,
    ewayBillNumber: dispatch.ewayBill?.billNumber,
    lrNumber: dispatch.lrNumber || dispatch.LRNumber,
    transporter: dispatch.transporter,
    vehicleNumber: dispatch.vehicleNumber,
    plantId: dispatch.plantId || order.plantId,
    customerId: order.customerId || 'CUST-001',
    customerName: order.customerName,
    customerPhone: order.phone,
    invoiceDate,
    dueDate,
    amount: breakdown.subtotal,
    taxAmount: breakdown.taxAmount,
    taxBreakdown: {
      cgst: breakdown.cgstTotal,
      sgst: breakdown.sgstTotal,
      igst: breakdown.igstTotal,
      taxType: breakdown.taxType,
      rate: breakdown.items[0]?.gstPercent || 18,
      hsnSummary: breakdown.hsnSummary
    },
    total: breakdown.total,
    totalPaid: 0,
    outstanding: breakdown.total,
    status: 'sent',
    isPartialInvoice: dispatch.isPartialDispatch || breakdown.items.some(i => (order.items || []).find(oi => oi.id === i.lineItemId)?.quantity !== i.dispatchedQty),
    creditNoteIds: [],
    totalCredited: 0,
    items: breakdown.items.map(it => ({
      lineItemId: it.lineItemId,
      id: it.lineItemId,
      name: it.name,
      hsn: it.hsn,
      quantity: it.dispatchedQty, // Dispatched quantity ONLY
      unitPrice: it.unitPrice,
      discount: it.discount,
      gstPercent: it.gstPercent,
      taxableValue: it.taxableValue,
      cgst: it.cgst,
      sgst: it.sgst,
      igst: it.igst,
      gstAmount: it.gstAmount,
      total: it.total
    })),
    createdByName,
    createdBy,
    createdAt: isSandbox ? createdAtIso : serverTimestamp()
  };

  // 5. Update running total of Invoiced Qty vs. Ordered Qty on the Parent Order
  // "The system must maintain a running total of Invoiced Qty vs. Ordered Qty per order line."
  // "Order Line updated: Invoiced Qty = 60, Pending Invoice Qty = 40"
  const updatedOrderItems = (order.items || []).map(orderItem => {
    const matchedDispatchItem = breakdown.items.find(
      di => di.lineItemId === orderItem.id || di.name === orderItem.name
    );

    const orderedQty = typeof orderItem.orderedQty === 'number' 
      ? orderItem.orderedQty 
      : (typeof orderItem.quantity === 'number' ? orderItem.quantity : 0);

    const currentInvoiced = typeof orderItem.invoicedQty === 'number' ? orderItem.invoicedQty : 0;
    const additionalInvoiced = matchedDispatchItem ? matchedDispatchItem.dispatchedQty : 0;
    const newInvoicedQty = currentInvoiced + additionalInvoiced;
    const newPendingInvoiceQty = Math.max(0, orderedQty - newInvoicedQty);

    return {
      ...orderItem,
      invoicedQty: newInvoicedQty,
      pendingInvoiceQty: newPendingInvoiceQty
    };
  });

  const updatedOrder: Order = {
    ...order,
    items: updatedOrderItems
  };

  // 6. Update Dispatch record to mark as invoiced
  const updatedDispatch: Dispatch = {
    ...dispatch,
    isInvoiced: true,
    invoiceId: newInvoice.id,
    invoiceNumber: newInvoice.invoiceNumber,
    invoicedAt: isSandbox ? createdAtIso : serverTimestamp()
  };

  // 7. Persist to storage
  if (isSandbox) {
    // 7.1 Save Invoice
    const invKey = `invoices_${tenantId}`;
    const cachedInvoices = localStorage.getItem(invKey);
    const invoiceList: Invoice[] = cachedInvoices ? JSON.parse(cachedInvoices) : [];
    const existingIndex = invoiceList.findIndex(i => i.id === newInvoice.id);
    if (existingIndex >= 0) {
      invoiceList[existingIndex] = newInvoice;
    } else {
      invoiceList.unshift(newInvoice);
    }
    localStorage.setItem(invKey, JSON.stringify(invoiceList));

    // 7.2 Update Dispatch
    const dispKey = `dispatches_${tenantId}`;
    const cachedDispatches = localStorage.getItem(dispKey);
    if (cachedDispatches) {
      const dispatchList: Dispatch[] = JSON.parse(cachedDispatches);
      const dIdx = dispatchList.findIndex(d => d.id === dispatch.id);
      if (dIdx >= 0) {
        dispatchList[dIdx] = updatedDispatch;
        localStorage.setItem(dispKey, JSON.stringify(dispatchList));
      }
    }

    // 7.3 Update Order
    const ordKey = `orders_${tenantId}`;
    const cachedOrders = localStorage.getItem(ordKey);
    if (cachedOrders) {
      const orderList: Order[] = JSON.parse(cachedOrders);
      const oIdx = orderList.findIndex(o => o.id === order.id);
      if (oIdx >= 0) {
        orderList[oIdx] = updatedOrder;
        localStorage.setItem(ordKey, JSON.stringify(orderList));
      }
    }

    // Trigger local updates
    window.dispatchEvent(new Event('storage'));
  } else {
    // Live Firestore
    // 1. Write invoice doc
    await setDoc(doc(db, 'invoices', newInvoice.id), newInvoice);

    // 2. Update dispatch
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'dispatches', dispatch.id), {
        isInvoiced: true,
        invoiceId: newInvoice.id,
        invoiceNumber: newInvoice.invoiceNumber,
        invoicedAt: serverTimestamp()
      });
    } catch {
      // Fallback top-level collection if exists
      try {
        await updateDoc(doc(db, 'dispatches', dispatch.id), {
          isInvoiced: true,
          invoiceId: newInvoice.id,
          invoiceNumber: newInvoice.invoiceNumber,
          invoicedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Could not update live dispatch doc:', err);
      }
    }

    // 3. Update order line items
    await updateDoc(doc(db, 'orders', order.id), {
      items: updatedOrderItems,
      updatedAt: serverTimestamp()
    });
  }

  // 8. Log Audit Event
  try {
    await logActivityEvent({
      actionType: 'create',
      entityType: 'order',
      entityId: order.id,
      tenantId,
      actor: {
        userId: createdBy,
        displayName: createdByName
      },
      description: `Generated Partial Tax Invoice #${invoiceNumber} for Dispatch #${dispatch.dispatchNumber || dispatch.invoiceNumber} (Dispatched: ${totalDispatchedQty} units, Taxable: ₹${breakdown.subtotal.toLocaleString('en-IN')}, GST: ₹${breakdown.taxAmount.toLocaleString('en-IN')}, Total: ₹${breakdown.total.toLocaleString('en-IN')}).`,
      metadata: {
        invoiceNumber,
        dispatchId: dispatch.id,
        dispatchNumber: dispatch.dispatchNumber,
        orderNumber: order.orderNumber,
        totalDispatchedQty,
        taxableAmount: breakdown.subtotal,
        gstAmount: breakdown.taxAmount,
        totalAmount: breakdown.total
      }
    });
  } catch (e) {
    console.warn('Activity logging failed:', e);
  }

  return {
    invoice: newInvoice,
    updatedOrder,
    updatedDispatch
  };
}

/**
 * Issues a Sales Return Credit Note against an existing invoice.
 * Acceptance Criteria EC 2: "Partial dispatch is later returned (sales return). Expected Behaviour: A Credit Note must be generated against the specific invoice; the Invoiced Qty is reduced accordingly."
 */
export async function issueSalesReturnCreditNote(params: {
  tenantId: string;
  invoice: Invoice;
  order: Order;
  returnItems: Array<{
    lineItemId: string;
    returnQty: number;
    reason?: string;
  }>;
  reason: string;
  createdBy: string;
  createdByName: string;
}): Promise<{ creditNote: CreditNote; updatedInvoice: Invoice; updatedOrder: Order }> {
  const { tenantId, invoice, order, returnItems, reason, createdBy, createdByName } = params;

  // Validate return quantities
  const totalReturnQty = returnItems.reduce((sum, item) => sum + (Number(item.returnQty) || 0), 0);
  if (totalReturnQty <= 0) {
    throw new Error('Please specify at least one item with a return quantity greater than zero.');
  }

  const isSandbox = checkIsSandbox();
  const timestamp = new Date().toISOString();
  const creditNoteNumber = `CN-${invoice.invoiceNumber}-${Date.now().toString().slice(-4)}`;

  let subtotalCredited = 0;
  let taxCredited = 0;

  const creditNoteItems: CreditNoteItem[] = returnItems.map(retItem => {
    // Find matched item in invoice
    const invItem = (invoice.items || []).find(
      it => it.lineItemId === retItem.lineItemId || it.id === retItem.lineItemId || it.name === retItem.lineItemId
    );

    const name = invItem ? invItem.name : 'Component';
    const unitPrice = invItem ? Number(invItem.unitPrice) || 0 : 0;
    const gstPercent = invItem ? Number(invItem.gstPercent) || 18 : 18;
    const hsn = invItem ? invItem.hsn : '8483';

    const taxableAmount = Math.round(retItem.returnQty * unitPrice);
    const gstAmount = Math.round((taxableAmount * gstPercent) / 100);
    const totalAmount = taxableAmount + gstAmount;

    subtotalCredited += taxableAmount;
    taxCredited += gstAmount;

    return {
      lineItemId: retItem.lineItemId,
      name,
      hsn,
      returnQty: retItem.returnQty,
      unitPrice,
      gstPercent,
      taxableAmount,
      gstAmount,
      totalAmount,
      reason: retItem.reason || reason
    };
  });

  const totalCreditedAmount = subtotalCredited + taxCredited;

  const newCreditNote: CreditNote = {
    id: creditNoteNumber,
    creditNoteNumber,
    tenantId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    dispatchId: invoice.dispatchId,
    dispatchNumber: invoice.dispatchNumber,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    issueDate: timestamp.split('T')[0],
    reason,
    items: creditNoteItems,
    subtotal: subtotalCredited,
    taxAmount: taxCredited,
    totalAmount: totalCreditedAmount,
    status: 'issued',
    createdBy,
    createdByName,
    createdAt: timestamp
  };

  // 1. Update Invoice with Credit Note linkage and reduced outstanding
  const updatedCreditNoteIds = [...(invoice.creditNoteIds || []), newCreditNote.id];
  const newTotalCredited = (invoice.totalCredited || 0) + totalCreditedAmount;
  const newOutstanding = Math.max(0, invoice.outstanding - totalCreditedAmount);

  const updatedInvoice: Invoice = {
    ...invoice,
    creditNoteIds: updatedCreditNoteIds,
    totalCredited: newTotalCredited,
    outstanding: newOutstanding,
    status: newOutstanding === 0 && invoice.totalPaid > 0 ? 'paid' : invoice.status
  };

  // 2. Acceptance Criteria EC 2: "the Invoiced Qty is reduced accordingly."
  const updatedOrderItems = (order.items || []).map(orderItem => {
    const matchedReturn = returnItems.find(
      r => r.lineItemId === orderItem.id || r.lineItemId === orderItem.name
    );

    if (matchedReturn && matchedReturn.returnQty > 0) {
      const currentInvoiced = typeof orderItem.invoicedQty === 'number' ? orderItem.invoicedQty : 0;
      const reducedInvoiced = Math.max(0, currentInvoiced - matchedReturn.returnQty);
      const orderedQty = typeof orderItem.orderedQty === 'number' 
        ? orderItem.orderedQty 
        : (typeof orderItem.quantity === 'number' ? orderItem.quantity : 0);
      const pendingInvoiceQty = Math.max(0, orderedQty - reducedInvoiced);

      return {
        ...orderItem,
        invoicedQty: reducedInvoiced,
        pendingInvoiceQty
      };
    }
    return orderItem;
  });

  const updatedOrder: Order = {
    ...order,
    items: updatedOrderItems
  };

  // 3. Persist
  if (isSandbox) {
    // Save Credit Note
    const cnKey = `credit_notes_${tenantId}`;
    const cachedCns = localStorage.getItem(cnKey);
    const cnList: CreditNote[] = cachedCns ? JSON.parse(cachedCns) : [];
    cnList.unshift(newCreditNote);
    localStorage.setItem(cnKey, JSON.stringify(cnList));

    // Update Invoice
    const invKey = `invoices_${tenantId}`;
    const cachedInvoices = localStorage.getItem(invKey);
    if (cachedInvoices) {
      const invList: Invoice[] = JSON.parse(cachedInvoices);
      const iIdx = invList.findIndex(i => i.id === invoice.id);
      if (iIdx >= 0) {
        invList[iIdx] = updatedInvoice;
        localStorage.setItem(invKey, JSON.stringify(invList));
      }
    }

    // Update Order
    const ordKey = `orders_${tenantId}`;
    const cachedOrders = localStorage.getItem(ordKey);
    if (cachedOrders) {
      const ordList: Order[] = JSON.parse(cachedOrders);
      const oIdx = ordList.findIndex(o => o.id === order.id);
      if (oIdx >= 0) {
        ordList[oIdx] = updatedOrder;
        localStorage.setItem(ordKey, JSON.stringify(ordList));
      }
    }

    window.dispatchEvent(new Event('storage'));
  } else {
    // Firestore writes
    await setDoc(doc(db, 'tenants', tenantId, 'creditNotes', newCreditNote.id), newCreditNote);
    await updateDoc(doc(db, 'invoices', invoice.id), {
      creditNoteIds: updatedCreditNoteIds,
      totalCredited: newTotalCredited,
      outstanding: newOutstanding
    });
    await updateDoc(doc(db, 'orders', order.id), {
      items: updatedOrderItems,
      updatedAt: serverTimestamp()
    });
  }

  // Activity log
  try {
    await logActivityEvent({
      actionType: 'create',
      entityType: 'order',
      entityId: order.id,
      tenantId,
      actor: {
        userId: createdBy,
        displayName: createdByName
      },
      description: `Issued Sales Return Credit Note #${creditNoteNumber} against Invoice #${invoice.invoiceNumber}. Invoiced Qty reduced by ${totalReturnQty} units (Credited Value: ₹${totalCreditedAmount.toLocaleString('en-IN')}).`,
      metadata: {
        creditNoteNumber,
        invoiceNumber: invoice.invoiceNumber,
        totalReturnQty,
        totalCreditedAmount,
        reason
      }
    });
  } catch (e) {
    console.warn('Activity log failed:', e);
  }

  return {
    creditNote: newCreditNote,
    updatedInvoice,
    updatedOrder
  };
}

/**
 * Loads credit notes associated with an invoice
 */
export async function getCreditNotesForInvoice(tenantId: string, invoiceId: string): Promise<CreditNote[]> {
  const isSandbox = checkIsSandbox();
  if (isSandbox) {
    try {
      const cached = localStorage.getItem(`credit_notes_${tenantId}`);
      if (cached) {
        const list: CreditNote[] = JSON.parse(cached);
        return list.filter(cn => cn.invoiceId === invoiceId || cn.invoiceNumber === invoiceId);
      }
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Helper to log activity events into tenant activity history
 */
async function logActivityEvent(event: Omit<ActivityEvent, 'id' | 'timestamp'>) {
  const isSandbox = checkIsSandbox();
  const timestamp = new Date().toISOString();
  const eventId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullEvent: ActivityEvent = {
    ...event,
    id: eventId,
    timestamp
  };

  if (isSandbox) {
    try {
      const key = `activities_${event.tenantId}`;
      const cached = localStorage.getItem(key);
      const list: ActivityEvent[] = cached ? JSON.parse(cached) : [];
      list.unshift(fullEvent);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
    } catch {
      // ignore
    }
  } else {
    try {
      await setDoc(doc(db, 'tenants', event.tenantId, 'activity', eventId), fullEvent);
    } catch (e) {
      console.warn('Could not record live activity:', e);
    }
  }
}
