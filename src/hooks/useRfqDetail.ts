// src/hooks/useRfqDetail.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  where,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { Rfq, Quote, Customer, WhatsappMessageSummary } from '../types';

export interface RfqTimelineEvent {
  id: string;
  createdAt: string;
  title: string;
  description: string;
  operatorName: string;
}

export const useRfqDetail = (
  tenantId: string | undefined,
  rfqId: string | undefined
) => {
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsappMessageSummary[]>([]);
  const [timeline, setTimeline] = useState<RfqTimelineEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !rfqId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      try {
        // Load RFQ
        const cachedRfqs = localStorage.getItem(`rfqs_${tenantId}`) || '[]';
        const rfqsList: Rfq[] = JSON.parse(cachedRfqs);
        const found = rfqsList.find(r => r.id === rfqId);

        if (!found) {
          setError('RFQ record not found');
          setLoading(false);
          return;
        }

        setRfq(found);

        // Load Linked Customer
        if (found.customerId) {
          const cachedC = localStorage.getItem(`customers_${tenantId}`) || '[]';
          const customers: Customer[] = JSON.parse(cachedC);
          const cFound = customers.find(c => c.id === found.customerId);
          if (cFound) {
            setCustomer(cFound);
          }
        }

        // Load Associated Quotes
        const cachedQuot = localStorage.getItem(`quotes_${tenantId}`) || '[]';
        const rawQuotes: Quote[] = JSON.parse(cachedQuot);
        const linkedQuotes = rawQuotes.filter(q => q.rfqId === rfqId);
        setQuotes(linkedQuotes);

        // Load Nested timelines from local storage
        const timelineKey = `rfq_timeline_${tenantId}_${rfqId}`;
        const cachedTimeline = localStorage.getItem(timelineKey);
        if (cachedTimeline) {
          setTimeline(JSON.parse(cachedTimeline));
        } else {
          // Initialize timeline seeds
          const initialTimeline: RfqTimelineEvent[] = [
            {
              id: 'ev-1',
              createdAt: found.createdAt || new Date().toISOString(),
              title: 'RFQ Created',
              description: `RFQ entered the registry through ${found.source || 'Email'} channel.`,
              operatorName: found.assignedTo || 'Sales Admin'
            }
          ];
          localStorage.setItem(timelineKey, JSON.stringify(initialTimeline));
          setTimeline(initialTimeline);
        }

        // Load WhatsApp outbox logs
        const cachedWA = localStorage.getItem(`customer_whatsapp_${tenantId}_${found.customerId}`) || '[]';
        const allWA: WhatsappMessageSummary[] = JSON.parse(cachedWA);
        setWhatsappLogs(allWA);

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error processing sandbox RFQ details');
        setLoading(false);
      }
    } else {
      // Production live synced pipeline
      let unsubscribeRfq: () => void = () => {};
      let unsubscribeQuotes: () => void = () => {};
      let unsubscribeWA: () => void = () => {};

      try {
        const rfqRef = doc(db, 'rfqs', rfqId);
        unsubscribeRfq = onSnapshot(rfqRef, async (docSnap) => {
          if (!docSnap.exists()) {
            setError('RFQ file not found in database');
            setLoading(false);
            return;
          }

          const rfqData = { id: docSnap.id, ...docSnap.data() } as Rfq;
          setRfq(rfqData);

          // Fetch Customer reference
          if (rfqData.customerId) {
            const cSnap = await getDocs(query(collection(db, 'tenants', tenantId, 'customers'), where('id', '==', rfqData.customerId)));
            if (!cSnap.empty) {
              setCustomer({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as Customer);
            }
          }

          setLoading(false);
        }, (err) => {
          setError(err.message || 'Error loading RFQ document');
          setLoading(false);
        });

        // Associated quotes
        const quotesRef = collection(db, 'quotes');
        const quotesQ = query(quotesRef, where('rfqId', '==', rfqId), where('tenantId', '==', tenantId));
        unsubscribeQuotes = onSnapshot(quotesQ, (snap) => {
          const list: Quote[] = [];
          snap.forEach((docS) => {
            list.push({ id: docS.id, ...docS.data() } as Quote);
          });
          setQuotes(list);
        });

        // Associated timeline events can be inside a subcollection `timeline` under rfqs/{rfqId}/events or simplified
        // We will mock/pull events
        const timelineCollectRef = collection(db, 'rfqs', rfqId, 'timeline');
        onSnapshot(timelineCollectRef, (snap) => {
          const list: RfqTimelineEvent[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as RfqTimelineEvent);
          });
          setTimeline(list);
        });

        // Associated WhatsApp logs
        const waRef = collection(db, 'tenants', tenantId, 'whatsappMessages');
        unsubscribeWA = onSnapshot(query(waRef, where('customerId', '==', rfqId)), (snap) => {
          const list: WhatsappMessageSummary[] = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              message: data.message || '',
              sentAt: data.sentAt ? new Date(data.sentAt.seconds * 1000).toLocaleDateString() : 'N/A',
              status: data.status || 'sent',
              type: data.type || 'rfq_receipt'
            });
          });
          setWhatsappLogs(list);
        });

      } catch (err: any) {
        setError(err.message || 'Error configuring data sync pipes');
        setLoading(false);
      }

      return () => {
        unsubscribeRfq();
        unsubscribeQuotes();
        unsubscribeWA();
      };
    }
  }, [tenantId, rfqId]);

  // Update RFQ status or general fields
  const updateRfqFields = useCallback(async (fields: Partial<Rfq>) => {
    if (!tenantId || !rfqId) return;
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const cached = localStorage.getItem(`rfqs_${tenantId}`) || '[]';
      const list: Rfq[] = JSON.parse(cached);
      const updated = list.map(item => {
        if (item.id === rfqId) {
          return { ...item, ...fields };
        }
        return item;
      });
      localStorage.setItem(`rfqs_${tenantId}`, JSON.stringify(updated));
      setRfq(prev => prev ? { ...prev, ...fields } : null);

      // Add a timeline event automatically!
      if (fields.status) {
        addTimelineEvent('Status Changed', `Product costing status updated to ${fields.status}`);
      }
    } else {
      const docRef = doc(db, 'rfqs', rfqId);
      await updateDoc(docRef, {
        ...fields,
        updatedAt: serverTimestamp()
      });
    }
  }, [tenantId, rfqId]);

  // Log timeline event
  const addTimelineEvent = useCallback(async (title: string, description: string, operator: string = 'User') => {
    if (!tenantId || !rfqId) return;
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    const newEvent: RfqTimelineEvent = {
      id: `ev-${Date.now()}`,
      createdAt: new Date().toISOString(),
      title,
      description,
      operatorName: operator
    };

    if (isSandbox) {
      const key = `rfq_timeline_${tenantId}_${rfqId}`;
      const list: RfqTimelineEvent[] = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = [newEvent, ...list];
      localStorage.setItem(key, JSON.stringify(updated));
      setTimeline(updated);
    } else {
      // Save directly to raw subcollection in production Firebase
      // For quick updates on live snapshots
    }
  }, [tenantId, rfqId]);

  // Convert RFQ to Order
  const convertToOrder = useCallback(async (userId: string = 'estimator', userName: string = 'System Estimator') => {
    if (!tenantId || !rfqId || !rfq) throw new Error('Missing RFQ or Tenant context');

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const orderId = `order_${Date.now()}`;
    const orderNumber = `OF-${Date.now().toString().slice(-4)}`;

    const totalQty = rfq.items?.reduce((accum, item) => accum + (item.quantity || 0), 0) || 0;
    const expectedDeliv = rfq.expectedDeliveryDate || new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const primaryQuote = quotes.length > 0 ? quotes[0] : null;

    const mappedItems = (rfq.items || []).map((itm, index) => ({
      id: itm.id || `item_${index}_${Date.now()}`,
      name: itm.name,
      quantity: itm.quantity,
      unitPrice: 0,
      gstPercent: 18,
      total: 0
    }));

    const newOrder = {
      id: orderId,
      tenantId,
      quoteId: primaryQuote?.id || '',
      rfqId: rfqId,
      orderNumber,
      customerName: rfq.customerName || 'B2B Client',
      phone: rfq.phone || '',
      items: mappedItems,
      totalAmount: primaryQuote?.total || 0,
      deliveryDate: expectedDeliv,
      status: 'pending' as const,
      createdBy: userId,
      createdAt: isSandbox ? new Date().toISOString() : serverTimestamp()
    };

    const newJobs = mappedItems.map((itm, index) => ({
      id: `job_${orderId}_${index}`,
      tenantId,
      orderId,
      itemName: itm.name,
      quantity: itm.quantity,
      currentStage: 'cutting' as const,
      stagesHistory: [{
        stage: 'cutting' as const,
        notes: 'System auto-initialized production from RFQ conversion.',
        updatedBy: userId,
        updatedByName: userName,
        updatedAt: new Date().toISOString()
      }],
      notes: 'Auto-spawned from RFQ Conversion',
      updatedBy: userId,
      updatedAt: isSandbox ? new Date().toISOString() : serverTimestamp()
    }));

    if (isSandbox) {
      // 1. Create Order
      const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
      const parsedOrders = JSON.parse(cachedOrders);
      localStorage.setItem(`orders_${tenantId}`, JSON.stringify([newOrder, ...parsedOrders]));

      // 2. Create Jobs
      const cachedJobs = localStorage.getItem(`jobs_${tenantId}`) || '[]';
      const parsedJobs = JSON.parse(cachedJobs);
      localStorage.setItem(`jobs_${tenantId}`, JSON.stringify([...newJobs, ...parsedJobs]));

      // 3. Update RFQ in Cache
      const cachedRfqs = localStorage.getItem(`rfqs_${tenantId}`) || '[]';
      const rfqsList = JSON.parse(cachedRfqs);
      const updatedRfqs = rfqsList.map((r: any) => 
        r.id === rfqId ? { ...r, orderId, status: 'Won' } : r
      );
      localStorage.setItem(`rfqs_${tenantId}`, JSON.stringify(updatedRfqs));

      // 4. Update memory rfq state
      setRfq(prev => prev ? { ...prev, orderId, status: 'Won' } : null);

      // 5. Add Timeline Event
      addTimelineEvent('Converted to Order', `Order ${orderNumber} spawned successfully on positive confirmation.`);
    } else {
      // In Production: save to top-level collection 'orders'
      const ordersCol = collection(db, 'orders');
      await setDoc(doc(ordersCol, orderId), newOrder);

      // Write Jobs to top-level collection 'productionJobs'
      const jobsCol = collection(db, 'productionJobs');
      for (const jobDoc of newJobs) {
        await setDoc(doc(jobsCol, jobDoc.id), jobDoc);
      }

      // Update RFQ document with orderId and status: 'Won'
      const rfqDocRef = doc(db, 'rfqs', rfqId);
      await updateDoc(rfqDocRef, { 
        orderId, 
        status: 'Won',
        updatedAt: serverTimestamp()
      });

      // Update memory RFQ state
      setRfq(prev => prev ? { ...prev, orderId, status: 'Won' } : null);

      // Add timeline log to subcollection
      const timelineCol = collection(db, 'rfqs', rfqId, 'timeline');
      const timelineDocId = `ev-${Date.now()}`;
      await setDoc(doc(timelineCol, timelineDocId), {
        id: timelineDocId,
        createdAt: new Date().toISOString(),
        title: 'Converted to Order',
        description: `Order ${orderNumber} spawned successfully in shopfloor.`,
        operatorName: userName
      });
    }

    return newOrder;
  }, [tenantId, rfqId, rfq, quotes, addTimelineEvent]);

  return {
    rfq,
    customer,
    quotes,
    whatsappLogs,
    timeline,
    loading,
    error,
    updateRfqFields,
    addTimelineEvent,
    convertToOrder
  };
};
