// src/hooks/useRfqsList.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { Rfq, RfqStatus } from '../types';
import { triggerRfqAutoAcknowledgement } from '../utils/whatsapp';

export interface RfqsFilters {
  status?: string; // e.g. "all", "open" (New, In Progress, Quoted), or specific like "New"
  startDate?: string;
  endDate?: string;
  assignedTo?: string;
  search?: string;
}

export const useRfqsList = (
  tenantId: string | undefined, 
  filters?: RfqsFilters
) => {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Default seed dataset
  const SEED_RFQS = useCallback((tid: string): Rfq[] => [
    {
      id: 'rfq_1001',
      rfqNumber: 'RFQ-2026-0001',
      tenantId: tid,
      customerId: 'cust-1',
      customerName: 'Kirloskar Industrial Distributors',
      contactName: 'Anil Kulkarni',
      phone: '9880123456',
      email: 'anil@kirloskar-dist.in',
      source: 'Email',
      dateReceived: '2026-05-25',
      status: 'New',
      priority: 'High',
      description: 'Need Grade 4 standard heavy spur gears matching drawing specification housing.',
      items: [
        { id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 20, specs: 'Material: EN8 Carbon Steel' }
      ],
      createdBy: 'demo_user',
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
    },
    {
      id: 'rfq_1002',
      rfqNumber: 'RFQ-2026-0002',
      tenantId: tid,
      customerId: 'cust-2',
      customerName: 'Techno Welds India Pvt Ltd',
      contactName: 'Rajesh Sharma',
      phone: '9123456780',
      email: 'rsharma@technowelds.co.in',
      source: 'WhatsApp',
      dateReceived: '2026-05-28',
      status: 'Quoted',
      priority: 'Medium',
      description: 'Urgent price estimation for SS welding electrode consumables AWS A5.4.',
      items: [
        { id: 'p2', name: 'Stainless Steel Arc Welding Consumables (Grade E308L-16)', quantity: 150, specs: 'Grade: AWS A5.4' }
      ],
      createdBy: 'demo_user',
      createdAt: new Date(Date.now() - 24 * 3605 * 1000).toISOString()
    }
  ], []);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      try {
        const key = `rfqs_${tenantId}`;
        const cached = localStorage.getItem(key);
        let list: Rfq[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          list = SEED_RFQS(tenantId);
          localStorage.setItem(key, JSON.stringify(list));
        }

        setRfqs(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandbox RFQs');
        setLoading(false);
      }
    } else {
      // Sync on root rfqs collection securely scoped by tenantId
      try {
        const colRef = collection(db, 'rfqs');
        const q = query(colRef, where('tenantId', '==', tenantId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: Rfq[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as Rfq);
          });
          
          // Sort descending by createdAt
          list.sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          });

          setRfqs(list);
          setLoading(false);
        }, (err) => {
          setError(err.message || 'Error subscribing to Firestore RFQs');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error establishing live RFQs pipeline');
        setLoading(false);
      }
    }
  }, [tenantId, SEED_RFQS]);

  // Add RFQ
  const addRfq = useCallback(async (newRfqPayload: Omit<Rfq, 'id' | 'tenantId' | 'createdAt'>) => {
    if (!tenantId) throw new Error('No active tenant context');
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    const key = `rfqs_${tenantId}`;
    const rfqId = `rfq_${Date.now().toString().slice(-6)}`;
    const serialCount = rfqs.length + 1001;
    const rfqNumber = newRfqPayload.rfqNumber || `RFQ-2026-${serialCount}`;

    const finalRfq: Rfq = {
      ...newRfqPayload,
      id: rfqId,
      rfqNumber,
      tenantId,
      createdAt: isSandbox ? new Date().toISOString() : serverTimestamp()
    };

    if (isSandbox) {
      const cached = localStorage.getItem(key);
      const currentList: Rfq[] = cached ? JSON.parse(cached) : [];
      const updatedList = [finalRfq, ...currentList];
      localStorage.setItem(key, JSON.stringify(updatedList));
      setRfqs(updatedList);

      // Trigger Connected Workflow 6: RFQ Created -> Customer Auto-Acknowledgement on WhatsApp
      try {
        let companyName = 'Ashrey FlowWorks';
        const cachedTenant = localStorage.getItem('tenant_context') || localStorage.getItem('tenant');
        if (cachedTenant) {
          const parsed = JSON.parse(cachedTenant);
          if (parsed?.companyName) companyName = parsed.companyName;
        }
        triggerRfqAutoAcknowledgement(tenantId, finalRfq, companyName);
      } catch (waErr) {
        console.warn('Sandbox auto-ack rfq fail:', waErr);
      }

      return finalRfq;
    } else {
      const colRef = collection(db, 'rfqs');
      const docRef = await addDoc(colRef, finalRfq);
      const savedRfq = { ...finalRfq, id: docRef.id };

      // Trigger Connected Workflow 6: RFQ Created -> Customer Auto-Acknowledgement on WhatsApp
      try {
        let companyName = 'Ashrey FlowWorks';
        const cachedTenant = localStorage.getItem('tenant_context') || localStorage.getItem('tenant');
        if (cachedTenant) {
          const parsed = JSON.parse(cachedTenant);
          if (parsed?.companyName) companyName = parsed.companyName;
        }
        triggerRfqAutoAcknowledgement(tenantId, savedRfq, companyName);
      } catch (waErr) {
        console.warn('Live auto-ack rfq fail:', waErr);
      }

      return savedRfq;
    }
  }, [tenantId, rfqs]);

  // Update RFQ
  const updateRfq = useCallback(async (id: string, updatedFields: Partial<Rfq>) => {
    if (!tenantId) throw new Error('No active tenant context');
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = `rfqs_${tenantId}`;
      const cached = localStorage.getItem(key);
      const currentList: Rfq[] = cached ? JSON.parse(cached) : [];
      
      const updatedList = currentList.map(item => {
        if (item.id === id) {
          return { ...item, ...updatedFields };
        }
        return item;
      });

      localStorage.setItem(key, JSON.stringify(updatedList));
      setRfqs(updatedList);
    } else {
      // Find the document reference in root collection
      const colRef = collection(db, 'rfqs');
      // If of generic ID
      const dRef = doc(db, 'rfqs', id);
      await updateDoc(dRef, {
        ...updatedFields,
        updatedAt: serverTimestamp()
      });
    }
  }, [tenantId]);

  // Apply filters locally for seamless visual instantaneous switching
  const filteredRfqs = rfqs.filter(item => {
    if (!item) return false;

    // Filter by status 
    if (filters?.status) {
      const statusParam = filters.status.toLowerCase();
      if (statusParam === 'open') {
        const isOpen = ['new', 'in progress', 'quoted', 'pending'].includes(item.status.toLowerCase());
        if (!isOpen) return false;
      } else if (statusParam !== 'all' && item.status.toLowerCase() !== statusParam) {
        return false;
      }
    }

    // Filter by assignedTo
    if (filters?.assignedTo && filters.assignedTo !== 'all') {
      if (item.assignedTo?.toLowerCase() !== filters.assignedTo.toLowerCase()) {
        return false;
      }
    }

    // Filter by Date Range
    if (filters?.startDate) {
      const receiveDate = new Date(item.dateReceived || item.createdAt);
      const startRange = new Date(filters.startDate);
      if (receiveDate < startRange) return false;
    }
    if (filters?.endDate) {
      const receiveDate = new Date(item.dateReceived || item.createdAt);
      const endRange = new Date(filters.endDate);
      if (receiveDate > endRange) return false;
    }

    // Search by rfqNumber or customerName or phone or email
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      const rfqNumMatch = item.rfqNumber?.toLowerCase().includes(s);
      const nameMatch = item.customerName?.toLowerCase().includes(s);
      const contactMatch = item.contactName?.toLowerCase().includes(s);
      const idMatch = item.id?.toLowerCase().includes(s);
      
      if (!rfqNumMatch && !nameMatch && !contactMatch && !idMatch) {
         return false;
      }
    }

    return true;
  });

  return {
    rfqs: filteredRfqs,
    rawRfqs: rfqs,
    loading,
    error,
    addRfq,
    updateRfq
  };
};
