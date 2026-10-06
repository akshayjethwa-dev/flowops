// src/services/rfqOrderConversionService.ts

import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { Quote, Order, ProductionJob, QuoteItem, Rfq } from '../types';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { logActivityEvent } from '../utils/activityLogger';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

export interface ConvertQuoteToOrderOptions {
  quote: Quote;
  customerPoNumber?: string;
  poDate?: string;
  deliveryDate?: string;
  soNumberOverride?: string;
  notes?: string;
  tenantId: string;
  tenantName?: string;
  actor: {
    userId: string;
    displayName: string;
    email?: string;
  };
  isSandboxMode?: boolean;
}

export interface ConvertQuoteResult {
  order: Order;
  jobs: ProductionJob[];
  updatedQuote: Quote;
}

/**
 * Standard sequential Sales Order Number generator:
 * Produces format: SO-YYYY-XXXX (e.g., SO-2026-0001)
 */
export async function generateNextSalesOrderNumber(tenantId: string, isSandboxMode: boolean = false): Promise<string> {
  const currentYear = new Date().getFullYear();
  let maxSeq = 0;

  if (isSandboxMode || !db) {
    try {
      const cached = localStorage.getItem(`orders_${tenantId}`) || '[]';
      const orders: Order[] = JSON.parse(cached);
      orders.forEach(o => {
        if (!o.orderNumber) return;
        // Match SO-2026-0042 or SO-0042 or OD-0042
        const matchYear = o.orderNumber.match(/SO-(\d{4})-(\d+)/i);
        if (matchYear && parseInt(matchYear[1], 10) === currentYear) {
          const num = parseInt(matchYear[2], 10);
          if (num > maxSeq) maxSeq = num;
        } else {
          const matchSimple = o.orderNumber.match(/(?:SO|OD)-(\d+)/i);
          if (matchSimple) {
            const num = parseInt(matchSimple[1], 10);
            if (num > maxSeq && num < 100000) maxSeq = num;
          }
        }
      });
    } catch (e) {
      console.warn('Error reading cached orders for SO sequence:', e);
    }
  } else {
    try {
      const q = query(collection(db, 'orders'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      snap.forEach(d => {
        const data = d.data() as Partial<Order>;
        if (!data.orderNumber) return;
        const matchYear = data.orderNumber.match(/SO-(\d{4})-(\d+)/i);
        if (matchYear && parseInt(matchYear[1], 10) === currentYear) {
          const num = parseInt(matchYear[2], 10);
          if (num > maxSeq) maxSeq = num;
        } else {
          const matchSimple = data.orderNumber.match(/(?:SO|OD)-(\d+)/i);
          if (matchSimple) {
            const num = parseInt(matchSimple[1], 10);
            if (num > maxSeq && num < 100000) maxSeq = num;
          }
        }
      });
    } catch (e) {
      console.warn('Firestore query for SO sequence failed, using timestamp fallback:', e);
    }
  }

  const nextSeq = maxSeq + 1;
  const paddedSeq = nextSeq.toString().padStart(4, '0');
  return `SO-${currentYear}-${paddedSeq}`;
}

/**
 * Standard Shopfloor routing sequence for manufacturing SME components
 */
const DEFAULT_ROUTING_STAGES = [
  'cutting',
  'welding',
  'machining',
  'assembly',
  'quality_check',
  'ready'
];

/**
 * Executes 1-click conversion from an Approved Quote into a confirmed Sales Order (SO).
 * Guarantees that all BOM, routing, commercial pricing, and Customer PO references
 * carry forward completely without duplicate data entry.
 */
export async function convertApprovedQuoteToSalesOrder(options: ConvertQuoteToOrderOptions): Promise<ConvertQuoteResult> {
  const {
    quote,
    customerPoNumber = '',
    poDate,
    deliveryDate,
    soNumberOverride,
    notes,
    tenantId,
    tenantName = 'Ashrey FlowOps',
    actor,
    isSandboxMode = false
  } = options;

  if (!quote || !quote.items || quote.items.length === 0) {
    throw new Error('Cannot convert empty quotation. At least one line item is required.');
  }

  // 1. Generate or validate SO Number
  const soNumber = soNumberOverride?.trim() || await generateNextSalesOrderNumber(tenantId, isSandboxMode);
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Default expected delivery date: 21 days from now, or quote validity date
  const finalDeliveryDate = deliveryDate?.trim() || 
    (quote.validUntil ? quote.validUntil.split('T')[0] : 
    new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().split('T')[0]);

  const cleanCustomerPo = customerPoNumber.trim();
  const cleanPoDate = poDate?.trim() || new Date().toISOString().split('T')[0];

  // 2. Map all line items and carry forward BOM and routing specifications
  const mappedItems: QuoteItem[] = quote.items.map((item, idx) => ({
    id: item.id || `item_${orderId}_${idx}`,
    name: item.name,
    hsn: item.hsn || '',
    quantity: item.quantity,
    unit: item.unit || 'pcs',
    unitPrice: item.unitPrice,
    discount: item.discount || 0,
    gstPercent: item.gstPercent ?? 18,
    total: item.total,
    specs: item.specs || '',
    bomLines: item.bomLines || (quote.bomData?.items ? quote.bomData.items.filter((b: any) => b.partNumber?.includes(item.name) || item.name.includes(b.partNumber)) : []),
    routingStages: item.routingStages || DEFAULT_ROUTING_STAGES
  }));

  // 3. Assemble Confirmed Sales Order (SO)
  const newOrder: Order = {
    id: orderId,
    tenantId,
    plantId: quote.plantId || 'all',
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    rfqId: quote.rfqId || '',
    rfqNumber: quote.rfqNumber || '',
    customerId: quote.customerId || '',
    orderNumber: soNumber,
    customerPoNumber: cleanCustomerPo,
    poDate: cleanPoDate,
    customerName: quote.customerName,
    customerEmail: quote.email || '',
    phone: quote.phone || '',
    items: mappedItems,
    subtotal: quote.subtotal,
    discountTotal: quote.discountTotal || 0,
    taxAmount: quote.gstAmount,
    totalAmount: quote.total,
    deliveryDate: finalDeliveryDate,
    status: 'pending',
    bomData: quote.bomData || {
      attachedAt: new Date().toISOString(),
      itemCount: mappedItems.length,
      lines: mappedItems.flatMap(m => m.bomLines || [])
    },
    routingData: quote.routingData || {
      standardSequence: DEFAULT_ROUTING_STAGES,
      totalOperations: mappedItems.length * DEFAULT_ROUTING_STAGES.length
    },
    termsAndConditions: quote.termsAndConditions || '',
    notes: notes ? (quote.notes ? `${quote.notes}\nConversion Note: ${notes}` : notes) : (quote.notes || ''),
    createdBy: actor.userId,
    createdAt: isSandboxMode ? new Date().toISOString() : serverTimestamp()
  };

  // 4. Spawn Live Production Jobs for shopfloor execution
  const newJobs: ProductionJob[] = mappedItems.map((item, idx) => {
    const routingSequence = item.routingStages && item.routingStages.length > 0
      ? item.routingStages 
      : DEFAULT_ROUTING_STAGES;
    const initialStage = routingSequence[0] || 'cutting';

    return {
      id: `job_${orderId}_${idx}`,
      tenantId,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      quoteNumber: quote.quoteNumber,
      customerPoNumber: cleanCustomerPo,
      plantId: newOrder.plantId,
      itemName: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      specs: item.specs || '',
      currentStage: initialStage,
      routingStages: routingSequence,
      bomComponents: item.bomLines || [],
      stagesHistory: [
        {
          stage: initialStage,
          notes: `Auto-initialized from Approved Quote #${quote.quoteNumber}${cleanCustomerPo ? ` (Customer PO: ${cleanCustomerPo})` : ''}. All BOM components, routing stages, and pricing carry forward locked.`,
          updatedBy: actor.userId,
          updatedByName: actor.displayName,
          updatedAt: new Date().toISOString()
        }
      ],
      notes: `Spawned via 1-Click RFQ-to-Order Conversion from Quote #${quote.quoteNumber}`,
      updatedBy: actor.userId,
      updatedAt: isSandboxMode ? new Date().toISOString() : serverTimestamp()
    };
  });

  // 5. Updated Quote Record
  const updatedQuote: Quote = {
    ...quote,
    status: 'approved',
    orderId: newOrder.id,
    orderNumber: soNumber,
    customerPoNumber: cleanCustomerPo,
    convertedAt: new Date().toISOString(),
    convertedBy: actor.userId
  };

  // 6. Persistence
  if (isSandboxMode || !db) {
    // Save Order
    const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
    const parsedOrders = JSON.parse(cachedOrders);
    localStorage.setItem(`orders_${tenantId}`, JSON.stringify([newOrder, ...parsedOrders]));

    // Save Jobs
    const cachedJobs = localStorage.getItem(`jobs_${tenantId}`) || '[]';
    const parsedJobs = JSON.parse(cachedJobs);
    localStorage.setItem(`jobs_${tenantId}`, JSON.stringify([...newJobs, ...parsedJobs]));

    // Update Quote
    const cachedQuotes = localStorage.getItem(`quotes_${tenantId}`) || '[]';
    const parsedQuotes: Quote[] = JSON.parse(cachedQuotes);
    const updatedQuotes = parsedQuotes.map(q => q.id === quote.id ? updatedQuote : q);
    localStorage.setItem(`quotes_${tenantId}`, JSON.stringify(updatedQuotes));

    // Update RFQ if attached
    if (quote.rfqId) {
      const cachedRfqs = localStorage.getItem(`rfqs_${tenantId}`) || '[]';
      const parsedRfqs: Rfq[] = JSON.parse(cachedRfqs);
      const updatedRfqs = parsedRfqs.map(r => r.id === quote.rfqId ? { ...r, status: 'Won' as const, orderId: newOrder.id } : r);
      localStorage.setItem(`rfqs_${tenantId}`, JSON.stringify(updatedRfqs));
    }
  } else {
    try {
      // 1. Create Order
      await setDoc(doc(db, 'orders', newOrder.id), newOrder);

      // 2. Create Production Jobs
      for (const job of newJobs) {
        await setDoc(doc(db, 'productionJobs', job.id), job);
      }

      // 3. Update Quotation doc
      await updateDoc(doc(db, 'quotes', quote.id), {
        status: 'approved',
        orderId: newOrder.id,
        orderNumber: soNumber,
        customerPoNumber: cleanCustomerPo,
        convertedAt: new Date().toISOString(),
        convertedBy: actor.userId
      });

      // 4. Update RFQ doc if present
      if (quote.rfqId) {
        try {
          await updateDoc(doc(db, 'rfqs', quote.rfqId), {
            status: 'Won',
            orderId: newOrder.id
          });
        } catch (rfqErr) {
          console.warn('Could not update parent RFQ doc, continuing:', rfqErr);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'orders');
    }
  }

  // 7. Traceable Enterprise Activity Logging
  logActivityEvent({
    tenantId,
    actionType: 'create',
    entityType: 'order',
    entityId: newOrder.id,
    actor: {
      userId: actor.userId,
      displayName: actor.displayName,
      email: actor.email
    },
    description: `1-Click Converted Approved Quote #${quote.quoteNumber} into Sales Order #${soNumber}${cleanCustomerPo ? ` with Customer PO #${cleanCustomerPo}` : ''}. Locked ${mappedItems.length} BOM lines & routing operations into shopfloor WIP.`,
    metadata: {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      orderNumber: soNumber,
      customerPoNumber: cleanCustomerPo,
      customerName: quote.customerName,
      totalAmount: quote.total,
      lineItemsCount: mappedItems.length
    },
    isSandboxMode
  });

  // 8. Automated WhatsApp confirmation notification to Customer
  if (quote.phone) {
    try {
      await sendWhatsAppNotification({
        recipientName: quote.customerName,
        recipientPhone: quote.phone,
        templateName: 'order_confirmed',
        tenantId,
        orderId: newOrder.id,
        customerId: quote.customerId,
        parameters: {
          orderNumber: soNumber,
          customerPoNumber: cleanCustomerPo || 'N/A',
          deliveryDate: new Date(finalDeliveryDate).toLocaleDateString('en-IN'),
          companyName: tenantName,
          total: quote.total.toLocaleString('en-IN')
        }
      });
    } catch (waErr) {
      console.warn('WhatsApp dispatch error during order conversion (non-blocking):', waErr);
    }
  }

  return {
    order: newOrder,
    jobs: newJobs,
    updatedQuote
  };
}
