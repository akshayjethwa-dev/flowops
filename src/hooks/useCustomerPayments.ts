// src/hooks/useCustomerPayments.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';

export interface PaymentLedgerEntry {
  id: string;
  tenantId: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  method: 'RTGS' | 'NEFT' | 'UPI' | 'Cash' | 'Cheque';
  referenceNumber: string;
  notes?: string;
  createdAt: any;
}

export const useCustomerPayments = (
  tenantId: string | undefined,
  customerId: string | undefined
) => {
  const [payments, setPayments] = useState<PaymentLedgerEntry[]>([]);
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
        const key = `customer_payments_${tenantId}_${customerId}`;
        const cached = localStorage.getItem(key);
        let list: PaymentLedgerEntry[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          // Initialize sandbox payments seed
          list = [
            {
              id: 'pay-seed-1',
              tenantId,
              customerId,
              amount: 50000,
              paymentDate: new Date(Date.now() - 3600000 * 24 * 5).toISOString().split('T')[0],
              method: 'RTGS',
              referenceNumber: 'TXN889104473',
              notes: 'Advance deposit for casting valves order.',
              createdAt: new Date().toISOString()
            }
          ];
          localStorage.setItem(key, JSON.stringify(list));
        }

        list.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
        setPayments(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandbox payments ledger');
        setLoading(false);
      }
    } else {
      try {
        const colRef = collection(db, 'tenants', tenantId, 'customers', customerId, 'payments');
        const q = query(colRef, orderBy('paymentDate', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: PaymentLedgerEntry[] = [];
          snapshot.forEach((snap) => {
            const data = snap.data();
            list.push({
              id: snap.id,
              ...data,
              paymentDate: data.paymentDate || new Date().toISOString().split('T')[0]
            } as PaymentLedgerEntry);
          });
          setPayments(list);
          setLoading(false);
        }, (err) => {
          setError(err.message || 'Error subscribing to payments');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error initializing payments stream');
        setLoading(false);
      }
    }
  }, [tenantId, customerId]);

  const recordPayment = useCallback(async (
    payment: Omit<PaymentLedgerEntry, 'id' | 'tenantId' | 'customerId' | 'createdAt'>
  ) => {
    if (!tenantId || !customerId) throw new Error('Missing tenant or customer references');

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    const finalPayment = {
      ...payment,
      tenantId,
      customerId,
      createdAt: isSandbox ? new Date().toISOString() : serverTimestamp()
    };

    if (isSandbox) {
      const key = `customer_payments_${tenantId}_${customerId}`;
      const cached = localStorage.getItem(key);
      const list: PaymentLedgerEntry[] = cached ? JSON.parse(cached) : [];

      const newRecord: PaymentLedgerEntry = {
        ...finalPayment,
        id: `pay-${Date.now()}`
      } as PaymentLedgerEntry;

      const updated = [newRecord, ...list];
      localStorage.setItem(key, JSON.stringify(updated));
      setPayments(updated.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()));

      // Log to direct CRM timeline as well!
      try {
        const cKey = `communication_log_${tenantId}_${customerId}`;
        const cCached = localStorage.getItem(cKey);
        const cList = cCached ? JSON.parse(cCached) : [];
        cList.unshift({
          id: `log-pay-${Date.now()}`,
          tenantId,
          customerId,
          channel: 'note',
          direction: 'internal',
          message: `Logged payment transaction of \u20B9${payment.amount.toLocaleString('en-IN')} via ${payment.method}. Ref: ${payment.referenceNumber}`,
          timestamp: new Date().toISOString(),
          author: { userId: 'system', displayName: 'Billing Engine' },
          linkedEntityId: newRecord.id,
          linkedEntityType: 'payment'
        });
        localStorage.setItem(cKey, JSON.stringify(cList));
      } catch (cErr) {
        console.error('Failed to log payment transaction to timeline:', cErr);
      }

      return newRecord;
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'customers', customerId, 'payments');
      const docRef = await addDoc(colRef, finalPayment);

      // Log/Create communication log entry for payments also
      try {
        const logsRef = collection(db, 'tenants', tenantId, 'customers', customerId, 'communicationLog');
        await addDoc(logsRef, {
          tenantId,
          customerId,
          channel: 'note',
          direction: 'internal',
          message: `Logged payment transaction of \u20B9${payment.amount.toLocaleString('en-IN')} via ${payment.method}. Ref: ${payment.referenceNumber}`,
          timestamp: serverTimestamp(),
          author: { userId: 'system', displayName: 'Billing Engine' },
          linkedEntityId: docRef.id,
          linkedEntityType: 'payment'
        });
      } catch (logErr) {
        console.error('Error logging payment transaction log to cloud timeline:', logErr);
      }

      return { ...finalPayment, id: docRef.id } as PaymentLedgerEntry;
    }
  }, [tenantId, customerId]);

  return { payments, loading, error, recordPayment };
};
