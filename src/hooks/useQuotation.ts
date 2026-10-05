// src/hooks/useQuotation.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Quotation, QuotationItem, QuotationStatus } from '../types';

export const useQuotation = (
  tenantId: string | undefined, 
  rfqId: string | undefined
) => {
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load quotation linked to this RFQ
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
        const key = `quotations_${tenantId}`;
        const cached = localStorage.getItem(key);
        const list: Quotation[] = cached ? JSON.parse(cached) : [];
        const found = list.find(q => q.rfqId === rfqId);

        if (found) {
          setQuotation(found);
        } else {
          setQuotation(null);
        }
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error parsing sandbox quotations');
        setLoading(false);
      }
    } else {
      try {
        const colRef = collection(db, 'tenants', tenantId, 'quotations');
        const q = query(colRef, where('rfqId', '==', rfqId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const firstDoc = snapshot.docs[0];
            setQuotation({ id: firstDoc.id, ...firstDoc.data() } as Quotation);
          } else {
            setQuotation(null);
          }
          setLoading(false);
        }, (err) => {
          setError(err.message || 'Error subscribing to firestore quotations');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Failed to establish quotation listener');
        setLoading(false);
      }
    }
  }, [tenantId, rfqId]);

  // Save Quotation (Saves / Overwrites)
  const saveQuotation = useCallback(async (
    payload: Omit<Quotation, 'id' | 'tenantId' | 'createdAt'>
  ) => {
    if (!tenantId || !rfqId) throw new Error('Parameters missing');

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const finalId = quotation?.id || `quot_${Date.now().toString().slice(-6)}`;
    
    const finalQuotation: Quotation = {
      ...payload,
      id: finalId,
      tenantId,
      rfqId,
      createdAt: quotation?.createdAt || (isSandbox ? new Date().toISOString() : serverTimestamp())
    };

    if (isSandbox) {
      const key = `quotations_${tenantId}`;
      const cached = localStorage.getItem(key);
      const currentList: Quotation[] = cached ? JSON.parse(cached) : [];
      
      const existsId = currentList.findIndex(q => q.id === finalId);
      let updatedList: Quotation[] = [];
      if (existsId !== -1) {
        updatedList = currentList.map(item => item.id === finalId ? finalQuotation : item);
      } else {
        // Also ensure we remove any older quotes on the same RFQ to prevent duplicate screens
        const cleanList = currentList.filter(q => q.rfqId !== rfqId);
        updatedList = [finalQuotation, ...cleanList];
      }

      localStorage.setItem(key, JSON.stringify(updatedList));

      // Synchronize back RFQ status to 'quoted' or matching
      const cachedRfqs = localStorage.getItem(`rfqs_${tenantId}`) || '[]';
      const rfqsList = JSON.parse(cachedRfqs);
      const updatedRfqs = rfqsList.map((r: any) => 
        r.id === rfqId ? { ...r, status: 'Quoted' } : r
      );
      localStorage.setItem(`rfqs_${tenantId}`, JSON.stringify(updatedRfqs));

      setQuotation(finalQuotation);
      return finalQuotation;
    } else {
      // In Production, save directly inside tenant's quote subcollection
      const colRef = collection(db, 'tenants', tenantId, 'quotations');
      const docRef = doc(colRef, finalId);
      await setDoc(docRef, finalQuotation);

      // Backwards sync status on general rfqs collection
      try {
        const rfqDocRef = doc(db, 'rfqs', rfqId);
        await updateDoc(rfqDocRef, { status: 'Quoted' });
      } catch {
        // Ignore if rfqs doc is main schema
      }

      setQuotation(finalQuotation);
      return finalQuotation;
    }
  }, [tenantId, rfqId, quotation]);

  // Update Quotation Status
  const updateQuotationStatus = useCallback(async (status: QuotationStatus) => {
    if (!tenantId || !rfqId || !quotation) throw new Error('RFQ or Quotation context missing');

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = `quotations_${tenantId}`;
      const cached = localStorage.getItem(key);
      const currentList: Quotation[] = cached ? JSON.parse(cached) : [];
      
      const updatedList = currentList.map(item => {
        if (item.id === quotation.id) {
          return { ...item, status };
        }
        return item;
      });

      localStorage.setItem(key, JSON.stringify(updatedList));

      // Sync corresponding RFQ status based on Quotation result
      let rfqStatusSync: string = 'Quoted';
      if (status === 'Accepted') rfqStatusSync = 'Won';
      if (status === 'Rejected') rfqStatusSync = 'Lost';

      const cachedRfqs = localStorage.getItem(`rfqs_${tenantId}`) || '[]';
      const rfqsList = JSON.parse(cachedRfqs);
      const updatedRfqs = rfqsList.map((r: any) => 
        r.id === rfqId ? { ...r, status: rfqStatusSync } : r
      );
      localStorage.setItem(`rfqs_${tenantId}`, JSON.stringify(updatedRfqs));

      // Spawn Order and Production Jobs if marked as Accepted
      if (status === 'Accepted') {
        const orderId = `order_${Date.now()}`;
        const orderNumber = `OD-${quotation.quotationNumber.split('-').pop() || Date.now().toString().slice(-4)}`;
        
        const mappedItems = (quotation.items || []).map((itm, index) => ({
          id: itm.id || `item_${index}_${Date.now()}`,
          name: itm.description,
          quantity: itm.quantity,
          unitPrice: itm.unitPrice,
          gstPercent: itm.taxRate,
          total: itm.lineTotal
        }));

        const newOrder = {
          id: orderId,
          tenantId,
          quoteId: quotation.id,
          orderNumber,
          customerName: quotation.customerName || 'B2B Client',
          phone: '', 
          items: mappedItems,
          totalAmount: quotation.totalAmount,
          deliveryDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0],
          status: 'pending' as const,
          createdBy: quotation.createdBy || 'estimator',
          createdAt: new Date().toISOString()
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
            notes: 'System auto-initialized production on positive quote confirmation.',
            updatedBy: quotation.createdBy || 'system',
            updatedByName: 'System Estimator',
            updatedAt: new Date().toISOString()
          }],
          notes: 'Auto-spawned',
          updatedBy: quotation.createdBy || 'system',
          updatedAt: new Date().toISOString()
        }));

        const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
        const parsedOrders = JSON.parse(cachedOrders);
        localStorage.setItem(`orders_${tenantId}`, JSON.stringify([newOrder, ...parsedOrders]));

        const cachedJobs = localStorage.getItem(`jobs_${tenantId}`) || '[]';
        const parsedJobs = JSON.parse(cachedJobs);
        localStorage.setItem(`jobs_${tenantId}`, JSON.stringify([...newJobs, ...parsedJobs]));
      }

      setQuotation(prev => prev ? { ...prev, status } : null);
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'quotations');
      const docRef = doc(colRef, quotation.id);
      await updateDoc(docRef, { status });

      // Sync corresponding RFQ status based on Quotation result
      let rfqStatusSync = 'Quoted';
      if (status === 'Accepted') rfqStatusSync = 'Won';
      if (status === 'Rejected') rfqStatusSync = 'Lost';

      try {
        const rfqDocRef = doc(db, 'rfqs', rfqId);
        await updateDoc(rfqDocRef, { status: rfqStatusSync });
      } catch {
        // Safe check
      }

      if (status === 'Accepted') {
        const orderId = `order_${Date.now()}`;
        const orderNumber = `OD-${quotation.quotationNumber.split('-').pop() || Date.now().toString().slice(-4)}`;
        
        const mappedItems = (quotation.items || []).map((itm, index) => ({
          id: itm.id || `item_${index}_${Date.now()}`,
          name: itm.description,
          quantity: itm.quantity,
          unitPrice: itm.unitPrice,
          gstPercent: itm.taxRate,
          total: itm.lineTotal
        }));

        const newOrder = {
          id: orderId,
          tenantId,
          quoteId: quotation.id,
          orderNumber,
          customerName: quotation.customerName || 'B2B Client',
          phone: '',
          items: mappedItems,
          totalAmount: quotation.totalAmount,
          deliveryDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0],
          status: 'pending',
          createdBy: quotation.createdBy || 'estimator',
          createdAt: serverTimestamp()
        };

        // Write Order to 'orders'
        const ordersCol = collection(db, 'orders');
        await setDoc(doc(ordersCol, orderId), newOrder);

        // Write Jobs to 'productionJobs'
        const jobsCol = collection(db, 'productionJobs');
        for (let index = 0; index < mappedItems.length; index++) {
          const itm = mappedItems[index];
          const jobId = `job_${orderId}_${index}`;
          await setDoc(doc(jobsCol, jobId), {
            id: jobId,
            tenantId,
            orderId,
            itemName: itm.name,
            quantity: itm.quantity,
            currentStage: 'cutting',
            stagesHistory: [{
              stage: 'cutting',
              notes: 'System auto-initialized production on positive quote confirmation.',
              updatedBy: quotation.createdBy || 'system',
              updatedByName: 'System Estimator',
              updatedAt: new Date().toISOString()
            }],
            notes: 'Auto-spawned',
            updatedBy: quotation.createdBy || 'system',
            updatedAt: serverTimestamp()
          });
        }
      }

      setQuotation(prev => prev ? { ...prev, status } : null);
    }
  }, [tenantId, rfqId, quotation]);

  return {
    quotation,
    loading,
    error,
    saveQuotation,
    updateQuotationStatus
  };
};

/**
 * Client-side call stub to the Cloud Function
 * Generates a mock shareable URL and dispatches a BSP template message
 */
export const sendQuotationViaWhatsapp = async (
  tenantId: string,
  rfqId: string,
  quotationId: string,
  customerId: string,
  customerName: string,
  phone: string,
  amount: number,
  quotationNumber: string
): Promise<{ success: boolean; url: string; msg: string }> => {
  // Simulate network latency of the Google Cloud HTTPS function
  await new Promise(resolve => setTimeout(resolve, 1400));

  const mockPdfUrl = `https://pdf-engine.ashrey.flowops/view/${tenantId}/${quotationId}.pdf`;
  const textBody = `Namaste ${customerName}, your formal manufacturing commercial quotation ${quotationNumber} is ready. Total Estimate: ₹${amount.toLocaleString('en-IN')}. Please click here to review the specifications PDF: ${mockPdfUrl}. Regards, Sales Estimator Team.`;

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  if (isSandbox) {
    // Write WhatsApp log context in sandbox local storage
    const waKey = `customer_whatsapp_${tenantId}_${customerId}`;
    const currentWA = JSON.parse(localStorage.getItem(waKey) || '[]');
    
    const newLog = {
      id: `mwa_${Date.now()}`,
      message: textBody,
      sentAt: new Date().toLocaleDateString(),
      status: 'sent' as const,
      type: 'rfq_receipt'
    };

    localStorage.setItem(waKey, JSON.stringify([newLog, ...currentWA]));
  } else {
    // Write into production GCP Firestore collections
    try {
      const colRef = collection(db, 'tenants', tenantId, 'whatsappMessages');
      await addDoc(colRef, {
        customerId,
        message: textBody,
        sentAt: serverTimestamp(),
        status: 'sent',
        type: 'rfq_receipt'
      });
    } catch {
      // Safe guard
    }
  }

  return {
    success: true,
    url: mockPdfUrl,
    msg: textBody
  };
};
