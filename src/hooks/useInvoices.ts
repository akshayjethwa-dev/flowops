// src/hooks/useInvoices.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { useAuth } from './useAuth';
import { Invoice, PaymentRecord, InvoiceStatus, OutstandingStats } from '../types';

// Helper to determine if sandbox mode is active
const checkIsSandbox = () => {
  return localStorage.getItem('isSandboxMode') === 'true' || !db;
};

// Error wrapper as required by the Firebase Integration Skill
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

// 1. hook to fetch invoices for a tenant with optional status filtering, search & sorting
export const useInvoices = (tenantId: string | undefined, filters?: { status?: string; search?: string }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getLocalStorageKey = useCallback(() => `invoices_${tenantId}`, [tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      try {
        const key = getLocalStorageKey();
        const cached = localStorage.getItem(key);
        let list: Invoice[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          // Defaults for demo
          const now = new Date();
          const formatDate = (daysAgo: number) => {
            const d = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
            return d.toISOString().split('T')[0];
          };
          list = [
            {
              id: 'INV-1001',
              invoiceNumber: 'INV-1001',
              tenantId,
              orderId: 'ORD-901',
              orderNumber: 'ORD-901',
              customerId: 'CUST-001',
              customerName: 'Karan Metals Ltd.',
              customerPhone: '+91 98765 43210',
              invoiceDate: formatDate(15),
              dueDate: formatDate(5), // overdue
              amount: 150000,
              taxAmount: 27000,
              total: 177000,
              totalPaid: 50000,
              outstanding: 127000,
              status: 'overdue',
              createdByName: 'Arjun Sales',
              createdBy: 'user-arj-10',
              createdAt: formatDate(15)
            },
            {
              id: 'INV-1002',
              invoiceNumber: 'INV-1002',
              tenantId,
              orderId: 'ORD-902',
              orderNumber: 'ORD-902',
              customerId: 'CUST-002',
              customerName: 'Sunil Sharma (Sharma Pipelines)',
              customerPhone: '+91 76543 21098',
              invoiceDate: formatDate(10),
              dueDate: formatDate(-20), // not overdue
              amount: 250000,
              taxAmount: 45000,
              total: 295000,
              totalPaid: 295000,
              outstanding: 0,
              status: 'paid',
              createdByName: 'Arjun Sales',
              createdBy: 'user-arj-10',
              createdAt: formatDate(10)
            },
            {
              id: 'INV-1003',
              invoiceNumber: 'INV-1003',
              tenantId,
              orderId: 'ORD-903',
              orderNumber: 'ORD-903',
              customerId: 'CUST-003',
              customerName: 'Pradeep Forge India',
              customerPhone: '+91 88888 77777',
              invoiceDate: formatDate(2),
              dueDate: formatDate(-10),
              amount: 80000,
              taxAmount: 14400,
              total: 94400,
              totalPaid: 0,
              outstanding: 94400,
              status: 'sent',
              createdByName: 'Arjun Sales',
              createdBy: 'user-arj-10',
              createdAt: formatDate(2)
            }
          ];
          localStorage.setItem(key, JSON.stringify(list));
        }

        // Dynamically recalculate "overdue" status if invoice is past due date and not paid
        const nowStr = new Date().toISOString().split('T')[0];
        const updatedList = list.map(inv => {
          if (inv.status !== 'paid' && inv.dueDate < nowStr && inv.status !== 'draft') {
            return { ...inv, status: 'overdue' as InvoiceStatus };
          }
          return inv;
        });

        setInvoices(updatedList);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandbox invoices');
        setLoading(false);
      }
    } else {
      try {
        const colRef = collection(db, 'invoices');
        const q = query(colRef, where('tenantId', '==', tenantId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: Invoice[] = [];
          const nowStr = new Date().toISOString().split('T')[0];
          snapshot.forEach((snap) => {
            const data = snap.data();
            let calculatedStatus = data.status as InvoiceStatus;
            
            // On-the-fly overdue check
            if (calculatedStatus !== 'paid' && data.dueDate < nowStr && calculatedStatus !== 'draft') {
              calculatedStatus = 'overdue';
            }

            list.push({
              id: snap.id,
              ...data,
              status: calculatedStatus,
              createdAt: data.createdAt ? (data.createdAt.toMillis ? new Date(data.createdAt.toMillis()).toISOString() : data.createdAt) : new Date().toISOString()
            } as Invoice);
          });
          setInvoices(list);
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'invoices');
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error listing live invoices');
        setLoading(false);
      }
    }
  }, [tenantId, getLocalStorageKey]);

  // Apply filters and searches locally
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Status Filter
      if (filters?.status && filters.status !== 'all') {
        if (inv.status !== filters.status) return false;
      }

      // Search Search
      if (filters?.search) {
        const queryStr = filters.search.toLowerCase();
        const numMatch = inv.invoiceNumber.toLowerCase().includes(queryStr);
        const custMatch = inv.customerName.toLowerCase().includes(queryStr);
        const orderMatch = inv.orderNumber.toLowerCase().includes(queryStr);
        if (!numMatch && !custMatch && !orderMatch) return false;
      }

      return true;
    });
  }, [invoices, filters?.status, filters?.search]);

  return {
    invoices: filteredInvoices,
    loading,
    error
  };
};

// 2. hook to get details of a single invoice
export const useInvoice = (invoiceId: string | undefined) => {
  const { tenant } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId || !tenant?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      try {
        const key = `invoices_${tenant.id}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          const list: Invoice[] = JSON.parse(cached);
          const found = list.find(v => v.id === invoiceId) || null;
          if (found) {
            const nowStr = new Date().toISOString().split('T')[0];
            if (found.status !== 'paid' && found.dueDate < nowStr && found.status !== 'draft') {
              found.status = 'overdue';
            }
          }
          setInvoice(found);
        }
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error resolving sandbox invoice detail');
        setLoading(false);
      }
    } else {
      try {
        const docRef = doc(db, 'invoices', invoiceId);
        const unsubscribe = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const nowStr = new Date().toISOString().split('T')[0];
            let calculatedStatus = data.status as InvoiceStatus;
            if (calculatedStatus !== 'paid' && data.dueDate < nowStr && calculatedStatus !== 'draft') {
              calculatedStatus = 'overdue';
            }

            setInvoice({
              id: snap.id,
              ...data,
              status: calculatedStatus,
              createdAt: data.createdAt ? (data.createdAt.toMillis ? new Date(data.createdAt.toMillis()).toISOString() : data.createdAt) : new Date().toISOString()
            } as Invoice);
          } else {
            setInvoice(null);
          }
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `invoices/${invoiceId}`);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error subscribing to live invoice doc');
        setLoading(false);
      }
    }
  }, [invoiceId, tenant?.id]);

  return {
    invoice,
    loading,
    error
  };
};

// 3. hook to get list of payment records for a single invoice
export const usePayments = (invoiceId: string | undefined) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getLocalStorageKey = useCallback(() => `payments_${invoiceId}`, [invoiceId]);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      try {
        const key = getLocalStorageKey();
        const cached = localStorage.getItem(key);
        let list: PaymentRecord[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          // Check if invoice had partial payment in defaults
          if (invoiceId === 'INV-1001') {
            list = [{
              id: 'PAY-001',
              invoiceId,
              amount: 50000,
              date: new Date(new Date().getTime() - 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
              paymentMode: 'bank_transfer',
              referenceNo: 'TXN8391039',
              notes: 'First installment on direct loading.',
              recordedBy: 'user-arj-10',
              recordedByName: 'Arjun Sales'
            }];
          } else if (invoiceId === 'INV-1002') {
            list = [{
              id: 'PAY-002',
              invoiceId,
              amount: 295000,
              date: new Date(new Date().getTime() - 8 * 24 * 3600 * 1000).toISOString().split('T')[0],
              paymentMode: 'upi',
              referenceNo: 'UPI9029103829',
              notes: 'Paid fully in single transfer.',
              recordedBy: 'user-arj-10',
              recordedByName: 'Arjun Sales'
            }];
          }
          localStorage.setItem(key, JSON.stringify(list));
        }

        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPayments(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error parsing test payments register');
        setLoading(false);
      }
    } else {
      try {
        const colRef = collection(db, 'invoices', invoiceId, 'payments');
        const unsubscribe = onSnapshot(colRef, (snapshot) => {
          const list: PaymentRecord[] = [];
          snapshot.forEach((snap) => {
            const data = snap.data();
            list.push({
              id: snap.id,
              ...data
            } as PaymentRecord);
          });
          list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setPayments(list);
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, `invoices/${invoiceId}/payments`);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error subscribing to live payments');
        setLoading(false);
      }
    }
  }, [invoiceId, getLocalStorageKey]);

  return {
    payments,
    loading,
    error
  };
};

// 4. useCreateInvoice hook
export const useCreateInvoice = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInvoice = useCallback(async (
    tenantId: string,
    payload: Omit<Invoice, 'id' | 'tenantId' | 'totalPaid' | 'outstanding' | 'status' | 'createdByName' | 'createdBy' | 'createdAt'>
  ) => {
    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();
    const invoiceId = payload.invoiceNumber;
    const createdAt = new Date().toISOString();

    const finalInvoice: Invoice = {
      ...payload,
      id: invoiceId,
      tenantId,
      totalPaid: 0,
      outstanding: payload.total,
      status: 'draft',
      createdBy: profile?.uid || 'unknown',
      createdByName: profile?.name || 'Operator',
      createdAt: isSandbox ? createdAt : serverTimestamp()
    };

    if (isSandbox) {
      try {
        const key = `invoices_${tenantId}`;
        const cached = localStorage.getItem(key);
        const list: Invoice[] = cached ? JSON.parse(cached) : [];
        
        // Prevent duplicate invoice number
        if (list.some(v => v.id === invoiceId)) {
          throw new Error(`Invoice number "${invoiceId}" already exists.`);
        }

        list.push(finalInvoice);
        localStorage.setItem(key, JSON.stringify(list));
        setLoading(false);
        return finalInvoice;
      } catch (err: any) {
        setError(err.message || 'Error saving invoice locally.');
        setLoading(false);
        throw err;
      }
    } else {
      try {
        const docRef = doc(db, 'invoices', invoiceId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          throw new Error(`Invoice number "${invoiceId}" already exists.`);
        }
        await setDoc(docRef, finalInvoice);
        setLoading(false);
        return {
          ...finalInvoice,
          createdAt
        };
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, `invoices/${invoiceId}`);
        setError(err.message);
        setLoading(false);
        throw err;
      }
    }
  }, [profile]);

  return { createInvoice, loading, error };
};

// 5. useRecordPayment hook
export const useRecordPayment = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordPayment = useCallback(async (
    tenantId: string,
    invoiceId: string,
    payload: { amount: number; date: string; paymentMode: any; referenceNo?: string; notes?: string }
  ) => {
    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();
    const paymentId = `PAY-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPayment: PaymentRecord = {
      id: paymentId,
      invoiceId,
      amount: payload.amount,
      date: payload.date,
      paymentMode: payload.paymentMode,
      referenceNo: payload.referenceNo || '',
      notes: payload.notes || '',
      recordedBy: profile?.uid || 'unknown',
      recordedByName: profile?.name || 'Operator'
    };

    if (isSandbox) {
      try {
        // Load invoice and update totals
        const invKey = `invoices_${tenantId}`;
        const cachedInvoices = localStorage.getItem(invKey);
        if (!cachedInvoices) throw new Error('No invoices database setup.');

        const invoicesList: Invoice[] = JSON.parse(cachedInvoices);
        const invoiceIndex = invoicesList.findIndex(v => v.id === invoiceId);
        if (invoiceIndex === -1) throw new Error('Invoice not found.');

        const invoiceObj = invoicesList[invoiceIndex];
        const newTotalPaid = Number(invoiceObj.totalPaid) + Number(payload.amount);
        const newOutstanding = Math.max(0, Number(invoiceObj.total) - newTotalPaid);
        let newStatus: InvoiceStatus = 'partial';

        if (newOutstanding === 0) {
          newStatus = 'paid';
        } else if (newTotalPaid === 0) {
          const nowStr = new Date().toISOString().split('T')[0];
          newStatus = invoiceObj.dueDate < nowStr ? 'overdue' : 'sent';
        }

        invoiceObj.totalPaid = newTotalPaid;
        invoiceObj.outstanding = newOutstanding;
        invoiceObj.status = newStatus;

        localStorage.setItem(invKey, JSON.stringify(invoicesList));

        // Save payment record
        const payKey = `payments_${invoiceId}`;
        const cachedPayments = localStorage.getItem(payKey);
        const paymentsList: PaymentRecord[] = cachedPayments ? JSON.parse(cachedPayments) : [];
        paymentsList.push(newPayment);
        localStorage.setItem(payKey, JSON.stringify(paymentsList));

        setLoading(false);
        return { invoice: invoiceObj, payment: newPayment };
      } catch (err: any) {
        setError(err.message || 'Error recording payment locally.');
        setLoading(false);
        throw err;
      }
    } else {
      try {
        const batch = writeBatch(db);

        // Fetch invoice first to update
        const invoiceRef = doc(db, 'invoices', invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        if (!invoiceSnap.exists()) {
          throw new Error('Invoice not found in system.');
        }

        const invoiceData = invoiceSnap.data() as Invoice;
        const newTotalPaid = Number(invoiceData.totalPaid || 0) + Number(payload.amount);
        const newOutstanding = Math.max(0, Number(invoiceData.total) - newTotalPaid);
        let newStatus: InvoiceStatus = 'partial';

        if (newOutstanding === 0) {
          newStatus = 'paid';
        } else if (newTotalPaid === 0) {
          const nowStr = new Date().toISOString().split('T')[0];
          newStatus = invoiceData.dueDate < nowStr ? 'overdue' : (invoiceData.status || 'sent');
        }

        // Add payment to subcollection
        const paymentRef = doc(db, 'invoices', invoiceId, 'payments', paymentId);
        batch.set(paymentRef, newPayment);

        // Update invoice
        batch.update(invoiceRef, {
          totalPaid: newTotalPaid,
          outstanding: newOutstanding,
          status: newStatus
        });

        await batch.commit();

        setLoading(false);
        return {
          invoice: { ...invoiceData, totalPaid: newTotalPaid, outstanding: newOutstanding, status: newStatus },
          payment: newPayment
        };
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `invoices/${invoiceId}/payments/${paymentId}`);
        setError(err.message);
        setLoading(false);
        throw err;
      }
    }
  }, [profile]);

  return { recordPayment, loading, error };
};

// 6. useUpdateInvoiceStatus hook
export const useUpdateInvoiceStatus = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateInvoiceStatus = useCallback(async (tenantId: string, invoiceId: string, status: InvoiceStatus) => {
    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      try {
        const key = `invoices_${tenantId}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          const list: Invoice[] = JSON.parse(cached);
          const idx = list.findIndex(v => v.id === invoiceId);
          if (idx !== -1) {
            list[idx].status = status;
            if (status === 'sent') {
              list[idx].sentAt = new Date().toISOString();
            }
            localStorage.setItem(key, JSON.stringify(list));
          }
        }
        setLoading(false);
        return true;
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
        return false;
      }
    } else {
      try {
        const docRef = doc(db, 'invoices', invoiceId);
        const updates: any = { status };
        if (status === 'sent') {
          updates.sentAt = new Date().toISOString();
        }
        await updateDoc(docRef, updates);
        setLoading(false);
        return true;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `invoices/${invoiceId}`);
        setError(err.message);
        setLoading(false);
        return false;
      }
    }
  }, []);

  const sendReminder = useCallback(async (tenantId: string, invoiceId: string) => {
    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      try {
        const key = `invoices_${tenantId}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          const list: Invoice[] = JSON.parse(cached);
          const idx = list.findIndex(v => v.id === invoiceId);
          if (idx !== -1) {
            const nowStr = new Date().toISOString();
            list[idx].reminderSentAt = nowStr;
            list[idx].lastReminderSentAt = nowStr;
            list[idx].reminderCount = (list[idx].reminderCount || 0) + 1;
            localStorage.setItem(key, JSON.stringify(list));
          }
        }
        setLoading(false);
        return true;
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
        return false;
      }
    } else {
      try {
        const docRef = doc(db, 'invoices', invoiceId);
        await updateDoc(docRef, {
          reminderSentAt: new Date().toISOString(),
          lastReminderSentAt: new Date().toISOString(),
          reminderCount: increment(1)
        });
        setLoading(false);
        return true;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `invoices/${invoiceId}`);
        setError(err.message);
        setLoading(false);
        return false;
      }
    }
  }, []);

  return { updateInvoiceStatus, sendReminder, loading, error };
};
