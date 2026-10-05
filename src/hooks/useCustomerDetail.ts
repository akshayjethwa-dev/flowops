// src/hooks/useCustomerDetail.ts

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  serverTimestamp,
  getDoc 
} from 'firebase/firestore';
import { Customer, RfqSummary, OrderSummary, WhatsappMessageSummary } from '../types';

export const useCustomerDetail = (
  tenantId: string | undefined,
  customerId: string | undefined
) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [rfqs, setRfqs] = useState<RfqSummary[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsappMessageSummary[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !customerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      try {
        // 1. Get customer from localStorage customers list
        const cachedCusts = localStorage.getItem(`customers_${tenantId}`) || '[]';
        const customers: Customer[] = JSON.parse(cachedCusts);
        const found = customers.find(c => c.id === customerId);

        if (!found) {
          setError('Customer profile not found');
          setLoading(false);
          return;
        }

        setCustomer(found);

        // 2. Fetch or initialize nested RFQs for this customer id
        const rfqKey = `customer_rfqs_${tenantId}_${customerId}`;
        let cachedRfqs = localStorage.getItem(rfqKey);
        let rfqList: RfqSummary[] = [];

        if (cachedRfqs) {
          rfqList = JSON.parse(cachedRfqs);
        } else {
          // Initialize some nice seed RFQs for demonstration
          rfqList = [
            {
              id: `RFQ-MOCK-${Date.now() - 3600000 * 24 * 5}`,
              createdAt: new Date(Date.now() - 3600000 * 24 * 5).toLocaleDateString(),
              status: 'pending',
              itemsCount: 2
            },
            {
              id: `RFQ-MOCK-${Date.now() - 3600000 * 24 * 12}`,
              createdAt: new Date(Date.now() - 3600000 * 24 * 12).toLocaleDateString(),
              status: 'quoted',
              itemsCount: 1
            }
          ];
          localStorage.setItem(rfqKey, JSON.stringify(rfqList));
        }
        setRfqs(rfqList);

        // 3. Fetch or initialize nested Orders for this customer id
        const orderKey = `customer_orders_${tenantId}_${customerId}`;
        let cachedOrders = localStorage.getItem(orderKey);
        let orderList: OrderSummary[] = [];

        if (cachedOrders) {
          orderList = JSON.parse(cachedOrders);
        } else {
          orderList = [
            {
              id: `ORD-MOCK-${Date.now() - 3600000 * 24 * 10}`,
              orderNumber: 'ORD-2026-1011',
              createdAt: new Date(Date.now() - 3600000 * 24 * 10).toLocaleDateString(),
              status: 'in-production',
              totalAmount: 185000,
              deliveryDate: new Date(Date.now() + 3600000 * 24 * 4).toISOString().split('T')[0]
            }
          ];
          localStorage.setItem(orderKey, JSON.stringify(orderList));
        }
        setOrders(orderList);

        // 4. Fetch or initialize nested WhatsApp messages for this customer id
        const waKey = `customer_whatsapp_${tenantId}_${customerId}`;
        let cachedWa = localStorage.getItem(waKey);
        let waList: WhatsappMessageSummary[] = [];

        if (cachedWa) {
          waList = JSON.parse(cachedWa);
        } else {
          waList = [
            {
              id: `WA-MSG-${Date.now() - 3600050 * 24 * 10}`,
              message: `Hi ${found.contactPerson}, we have received your purchase allocation. Order ORD-2026-1011 is officially loaded on the Shopfloor pipeline!`,
              sentAt: new Date(Date.now() - 3600000 * 24 * 10).toLocaleDateString(),
              status: 'sent',
              type: 'order_status'
            }
          ];
          localStorage.setItem(waKey, JSON.stringify(waList));
        }
        setWhatsappMessages(waList);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error processing sandbox detail information');
        setLoading(false);
      }
    } else {
      // Live Firestore stream pipeline
      let unsubscribeCust: () => void = () => {};
      let unsubscribeRfqs: () => void = () => {};
      let unsubscribeOrders: () => void = () => {};
      let unsubscribeWA: () => void = () => {};

      try {
        const custDocRef = doc(db, 'tenants', tenantId, 'customers', customerId);
        unsubscribeCust = onSnapshot(custDocRef, (docSnap) => {
          if (!docSnap.exists()) {
            setError('Customer profile not found in live database');
            setLoading(false);
            return;
          }
          setCustomer({ id: docSnap.id, ...docSnap.data() } as Customer);
        }, (err) => {
          setError(err.message || 'Error syncing customer profile');
        });

        // Query nested /tenants/{tenantId}/rfqs filtered by customerId
        const rfqsColRef = collection(db, 'tenants', tenantId, 'rfqs');
        const rfqsQuery = query(rfqsColRef, where('customerId', '==', customerId));
        unsubscribeRfqs = onSnapshot(rfqsQuery, (snapshot) => {
          const list: RfqSummary[] = [];
          snapshot.forEach((subDoc) => {
            const data = subDoc.data();
            list.push({
              id: subDoc.id,
              createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A',
              status: data.status || 'pending',
              itemsCount: data.items?.length || 0
            });
          });
          setRfqs(list);
        });

        // Query nested /tenants/{tenantId}/orders filtered by customerId
        const ordersColRef = collection(db, 'tenants', tenantId, 'orders');
        const ordersQuery = query(ordersColRef, where('customerId', '==', customerId));
        unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
          const list: OrderSummary[] = [];
          snapshot.forEach((subDoc) => {
            const data = subDoc.data();
            list.push({
              id: subDoc.id,
              orderNumber: data.orderNumber || subDoc.id,
              createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A',
              status: data.status || 'pending',
              totalAmount: data.totalAmount || 0,
              deliveryDate: data.deliveryDate || ''
            });
          });
          setOrders(list);
        });

        // Query nested /tenants/{tenantId}/whatsappMessages filtered by customerId
        const waColRef = collection(db, 'tenants', tenantId, 'whatsappMessages');
        const waQuery = query(waColRef, where('customerId', '==', customerId));
        unsubscribeWA = onSnapshot(waQuery, (snapshot) => {
          const list: WhatsappMessageSummary[] = [];
          snapshot.forEach((subDoc) => {
            const data = subDoc.data();
            list.push({
              id: subDoc.id,
              message: data.message || '',
              sentAt: data.sentAt ? new Date(data.sentAt.seconds * 1000).toLocaleDateString() : 'N/A',
              status: data.status || 'sent',
              type: data.type || 'order_status'
            });
          });
          setWhatsappMessages(list);
          setLoading(false);
        }, (err) => {
          setLoading(false);
        });

      } catch (err: any) {
        setError(err.message || 'Error initializing collection sync handlers');
        setLoading(false);
      }

      return () => {
        unsubscribeCust();
        unsubscribeRfqs();
        unsubscribeOrders();
        unsubscribeWA();
      };
    }
  }, [tenantId, customerId]);

  // Operations: Create RFQ
  const createCustomerRfq = async (items: { name: string, quantity: number }[], requirements: string = '') => {
    if (!tenantId || !customerId || !customer) return;
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    const rfqObj = {
      tenantId,
      customerId,
      customerName: customer.name,
      phone: customer.phone,
      requirements,
      items,
      status: 'pending' as const,
      createdAt: isSandbox ? new Date().toISOString() : serverTimestamp()
    };

    if (isSandbox) {
      const rfqKey = `customer_rfqs_${tenantId}_${customerId}`;
      const cached = localStorage.getItem(rfqKey);
      const list: RfqSummary[] = cached ? JSON.parse(cached) : [];
      
      const newId = `RFQ-${Date.now()}`;
      const newSummaryRecord: RfqSummary = {
        id: newId,
        createdAt: new Date().toLocaleDateString(),
        status: 'pending',
        itemsCount: items.length
      };

      const updated = [newSummaryRecord, ...list];
      localStorage.setItem(rfqKey, JSON.stringify(updated));
      setRfqs(updated);

      // Save to general central RFQ list as well for seamless consistency!
      const centralKey = `rfqs_${tenantId}`;
      const cachedCentral = localStorage.getItem(centralKey) || '[]';
      const centralList = JSON.parse(cachedCentral);
      const rfqWithItemsAndId = {
        ...rfqObj,
        id: newId,
        // Match existing App's simple RFQ structure
        createdAt: { seconds: Math.floor(Date.now() / 1000) }
      };
      localStorage.setItem(centralKey, JSON.stringify([rfqWithItemsAndId, ...centralList]));

    } else {
      const colRef = collection(db, 'tenants', tenantId, 'rfqs');
      await addDoc(colRef, rfqObj);
    }
  };

  // Operations: Send WhatsApp log stub
  const triggerWhatsAppMessage = async (message: string, type: string) => {
    if (!tenantId || !customerId || !customer) return;
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    const waMsgObj = {
      tenantId,
      customerId,
      recipientName: customer.contactPerson,
      recipientPhone: customer.phone,
      message,
      status: 'sent' as const,
      type,
      sentAt: isSandbox ? new Date().toISOString() : serverTimestamp()
    };

    if (isSandbox) {
      const waKey = `customer_whatsapp_${tenantId}_${customerId}`;
      const cached = localStorage.getItem(waKey);
      const list: WhatsappMessageSummary[] = cached ? JSON.parse(cached) : [];

      const newId = `WA-MSG-${Date.now()}`;
      const record: WhatsappMessageSummary = {
        id: newId,
        message,
        sentAt: new Date().toLocaleDateString(),
        status: 'sent',
        type
      };

      const updated = [record, ...list];
      localStorage.setItem(waKey, JSON.stringify(updated));
      setWhatsappMessages(updated);
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'whatsappMessages');
      await addDoc(colRef, waMsgObj);
    }
  };

  return {
    customer,
    rfqs,
    orders,
    whatsappMessages,
    loading,
    error,
    createCustomerRfq,
    triggerWhatsAppMessage
  };
};
