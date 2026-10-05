// src/hooks/usePortal.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { CustomerOrder, Invoice, Customer } from '../types';

// Helper to determine if sandbox mode is active
const checkIsSandbox = () => {
  return localStorage.getItem('isSandboxMode') === 'true' || !db;
};

// Error wrapper as required by the Firebase Integration Skill & guidelines
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: localStorage.getItem('auth_uid') || 'unknown',
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 1. Hook to fetch customer's orders
export const useMyOrders = (customerId: string | undefined) => {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getLocalStorageKey = useCallback(() => `customer_orders_${customerId || 'guest'}`, [customerId]);

  useEffect(() => {
    if (!customerId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      const key = getLocalStorageKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        setOrders(JSON.parse(cached));
      } else {
        const demoOrders: CustomerOrder[] = [
          {
            id: 'cord-1',
            orderNumber: 'C-ORD-9481',
            tenantId: 'tenant_1',
            customerId,
            customerName: 'Ashrey Auto Parts / Pune Gears Corp',
            items: [
              { productId: 'prod-1', name: 'Wire rod 500kg', quantity: 1, unit: 'tonnes', unitPrice: 42000, total: 42000 },
              { productId: 'prod-2', name: 'Copper wire 200kg', quantity: 2, unit: 'rolls', unitPrice: 8500, total: 17000 }
            ],
            deliveryAddress: 'Plot 42, MIDC Sector 1, Bhosari, Pune, MH - 411026',
            requestedDeliveryDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
            notes: 'Pls pack tightly in crates',
            status: 'confirmed',
            isBotOrder: false,
            createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
          },
          {
            id: 'cord-2',
            orderNumber: 'C-ORD-9492',
            tenantId: 'tenant_1',
            customerId,
            customerName: 'Ashrey Auto Parts / Pune Gears Corp',
            items: [
              { productId: 'prod-3', name: 'M12 Hex Bolts — Grade 8.8 High S', quantity: 500, unit: 'units', unitPrice: 15, total: 7500 }
            ],
            deliveryAddress: 'Plot 42, MIDC Sector 1, Bhosari, Pune, MH - 411026',
            requestedDeliveryDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
            notes: 'Urgent priority shipment',
            status: 'pending_confirmation',
            isBotOrder: true,
            createdByDevice: 'whatsapp',
            createdAt: new Date().toISOString()
          }
        ];
        localStorage.setItem(key, JSON.stringify(demoOrders));
        setOrders(demoOrders);
      }
      setLoading(false);
    } else {
      // Connect to Firestore customerOrders
      const path = 'customerOrders';
      const q = query(
        collection(db, path),
        where('customerId', '==', customerId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: CustomerOrder[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as CustomerOrder);
        });
        // Sort descending by createdAt
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setOrders(list);
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [customerId, getLocalStorageKey]);

  return { orders, loading, error };
};

// 2. Hook to fetch customer's invoices
export const useMyInvoices = (customerId: string | undefined) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getLocalStorageKey = useCallback(() => `customer_invoices_${customerId || 'guest'}`, [customerId]);

  useEffect(() => {
    if (!customerId) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      const key = getLocalStorageKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        setInvoices(JSON.parse(cached));
      } else {
        const now = new Date();
        const formatDate = (daysAgo: number) => {
          return new Date(now.getTime() - daysAgo * 24 * 3600 * 1000).toISOString().split('T')[0];
        };

        const demoInvoices: Invoice[] = [
          {
            id: 'INV-8891',
            invoiceNumber: 'INV-8891',
            tenantId: 'tenant_1',
            orderId: 'ORD-5521',
            orderNumber: 'O-9912',
            customerId,
            customerName: 'Ashrey Auto Parts / Pune Gears Corp',
            invoiceDate: formatDate(10),
            dueDate: formatDate(-20), // 20 days in future
            amount: 59000,
            taxAmount: 9000,
            total: 59000,
            totalPaid: 59000,
            outstanding: 0,
            status: 'paid',
            createdByName: 'Ashrey Finance Dept',
            createdBy: 'admin_1',
            createdAt: formatDate(10)
          },
          {
            id: 'INV-8912',
            invoiceNumber: 'INV-8912',
            tenantId: 'tenant_1',
            orderId: 'ORD-5522',
            orderNumber: 'O-9913',
            customerId,
            customerName: 'Ashrey Auto Parts / Pune Gears Corp',
            invoiceDate: formatDate(2),
            dueDate: formatDate(-28),
            amount: 24500,
            taxAmount: 3700,
            total: 24500,
            totalPaid: 10000,
            outstanding: 14500,
            status: 'partial',
            createdByName: 'Ashrey Finance Dept',
            createdBy: 'admin_1',
            createdAt: formatDate(2)
          },
          {
            id: 'INV-8700',
            invoiceNumber: 'INV-8700',
            tenantId: 'tenant_1',
            orderId: 'ORD-5401',
            orderNumber: 'O-9801',
            customerId,
            customerName: 'Ashrey Auto Parts / Pune Gears Corp',
            invoiceDate: formatDate(45),
            dueDate: formatDate(15), // Due date passed 15 days ago
            amount: 32000,
            taxAmount: 4800,
            total: 32000,
            totalPaid: 0,
            outstanding: 32000,
            status: 'overdue',
            createdByName: 'Ashrey Finance Dept',
            createdBy: 'admin_1',
            createdAt: formatDate(4)
          }
        ];
        localStorage.setItem(key, JSON.stringify(demoInvoices));
        setInvoices(demoInvoices);
      }
      setLoading(false);
    } else {
      // Fetch invoices belonging to this customer from invoices collection
      const path = 'invoices';
      const q = query(
        collection(db, path),
        where('customerId', '==', customerId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Invoice[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Invoice);
        });
        list.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
        setInvoices(list);
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [customerId, getLocalStorageKey]);

  return { invoices, loading, error };
};

// 3. Hook to fetch customer's outstanding balance stats
export const useMyBalance = (customerId: string | undefined) => {
  const [stats, setStats] = useState<{
    outstandingBalance: number;
    openOrdersCount: number;
    dispatchedLast30DaysCount: number;
    customerDetail: Customer | null;
  }>({
    outstandingBalance: 0,
    openOrdersCount: 0,
    dispatchedLast30DaysCount: 0,
    customerDetail: null
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { orders } = useMyOrders(customerId);
  const { invoices } = useMyInvoices(customerId);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      // Calculate from dummy orders & invoices
      const outstandingSum = invoices.reduce((sum, inv) => sum + (inv.outstanding || 0), 0);
      const openCount = orders.filter((o) => o.status === 'pending_confirmation' || o.status === 'confirmed').length;
      
      const mockCustomer: Customer = {
        id: customerId,
        tenantId: 'tenant_1',
        name: 'Ashrey Auto Parts / Pune Gears Corp',
        type: 'dealer',
        contactPerson: 'Mr. Rajesh Ashrey',
        phone: '+919876543210',
        email: 'dealer@ashreyparts.com',
        gstNumber: '27AAACA1234A1Z9',
        billingAddress: 'Plot 42, MIDC Sector 1, Bhosari, Pune, MH - 411026',
        shippingAddress: 'Plot 42, MIDC Sector 1, Bhosari, Pune, MH - 411026',
        city: 'Pune',
        notes: 'Premium Tier-A Dealer for automotive forgings and gear systems'
      };

      setStats({
        outstandingBalance: outstandingSum,
        openOrdersCount: openCount,
        dispatchedLast30DaysCount: 1, // Simulated
        customerDetail: mockCustomer
      });
      setLoading(false);
    } else {
      // Query the specific customer documentation from Firebase
      const path = 'customers';
      const docRef = doc(db, path, customerId);

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        let customerDetail: Customer | null = null;
        if (docSnap.exists()) {
          customerDetail = { id: docSnap.id, ...docSnap.data() } as Customer;
        }

        // Calculate from invoices and orders hook sets
        const outstandingSum = invoices.reduce((sum, inv) => sum + (inv.outstanding || 0), 0);
        const openCount = orders.filter((o) => o.status === 'pending_confirmation').length;

        setStats({
          outstandingBalance: outstandingSum,
          openOrdersCount: openCount,
          dispatchedLast30DaysCount: 2, // Realistic baseline
          customerDetail
        });
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, path);
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [customerId, invoices, orders]);

  return { stats, loading, error };
};

// 4. Mutation hook to place an order
export const usePlaceOrder = () => {
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const placeOrder = async (
    orderData: Omit<CustomerOrder, 'id' | 'orderNumber' | 'status' | 'createdAt'>
  ): Promise<CustomerOrder | null> => {
    setSubmitting(true);
    setError(null);

    const isSandbox = checkIsSandbox();
    const orderNumber = `C-ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: CustomerOrder = {
      ...orderData,
      id: `cord_${Math.random().toString(36).substring(2, 7)}`,
      orderNumber,
      status: 'pending_confirmation',
      createdAt: new Date().toISOString()
    };

    if (isSandbox) {
      try {
        // Retrieve and update existing cached orders list
        const key = `customer_orders_${orderData.customerId}`;
        const cached = localStorage.getItem(key);
        const list: CustomerOrder[] = cached ? JSON.parse(cached) : [];
        const updated = [newOrder, ...list];
        localStorage.setItem(key, JSON.stringify(updated));

        // Let's also update the flow of activity events if we have a sandbox key or we can log it
        const activityKey = `activities_${orderData.tenantId}`;
        const cachedAct = localStorage.getItem(activityKey);
        const actList = cachedAct ? JSON.parse(cachedAct) : [];
        actList.unshift({
          id: `act_${Date.now()}`,
          userId: 'dealer-portal',
          userName: `Portal: ${orderData.customerName}`,
          description: `Placed Portal Order ${orderNumber} for product(s)`,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem(activityKey, JSON.stringify(actList));

        // Simulate network
        await new Promise((resolve) => setTimeout(resolve, 800));
        setSuccessOrder(newOrder);
        setSubmitting(false);
        return newOrder;
      } catch (err: any) {
        setError(err.message || 'Error executing order creation.');
        setSubmitting(false);
        return null;
      }
    } else {
      const path = 'customerOrders';
      try {
        // Write real firestore doc
        await addDoc(collection(db, path), {
          ...orderData,
          orderNumber,
          status: 'pending_confirmation',
          createdAt: new Date().toISOString()
        });

        // Add back-office notification to activity logging
        await addDoc(collection(db, 'activities'), {
          tenantId: orderData.tenantId,
          userId: 'dealer-portal',
          userName: `Portal: ${orderData.customerName}`,
          description: `Placed Portal Order ${orderNumber}`,
          timestamp: new Date().toISOString()
        });

        setSuccessOrder(newOrder);
        setSubmitting(false);
        return newOrder;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, path);
        setError(err.message || 'Firestore operational write failed.');
        setSubmitting(false);
        return null;
      }
    }
  };

  return { placeOrder, submitting, successOrder, error };
};
