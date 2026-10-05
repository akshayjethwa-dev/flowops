// src/hooks/useQuotations.ts

import { useState, useEffect, useCallback } from 'react';
import { db, storage } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Quote, Quotation, QuoteItem, QuotationVersion } from '../types';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { logActivityEvent } from '../utils/activityLogger';
import { useAuth } from './useAuth';

const checkIsSandbox = () => {
  return localStorage.getItem('isSandboxMode') === 'true' || !db;
};

// 1. Hook to fetch a single quotation
export const useQuotation = (quotationId: string | undefined) => {
  const [quotation, setQuotation] = useState<Quote | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
<<<<<<< HEAD
  const { tenant } = useAuth();

  useEffect(() => {
    if (!quotationId || !tenant?.id) {
=======
  const { tenant, profile } = useAuth(); // 🔒 IMPORT PROFILE

  useEffect(() => {
    // 🔒 SECURITY CHECK: Ensure user's verified profile matches the active tenant state
    if (!quotationId || !tenant?.id || !profile?.tenantId || tenant.id !== profile.tenantId) {
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      try {
<<<<<<< HEAD
        const cached = localStorage.getItem(`quotes_${tenant.id}`);
=======
        const cached = localStorage.getItem(`quotes_${profile.tenantId}`);
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        if (cached) {
          const list = JSON.parse(cached) as Quote[];
          const found = list.find(q => q.id === quotationId);
          setQuotation(found || null);
        } else {
          setQuotation(null);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      const qPath = 'quotes';
      const q = query(
        collection(db, qPath),
<<<<<<< HEAD
        where('tenantId', '==', tenant.id),
=======
        where('tenantId', '==', profile.tenantId), // 🔒 Enforce strictly via Profile
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        where('id', '==', quotationId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setQuotation(snapshot.docs[0].data() as Quote);
        } else {
          setQuotation(null);
        }
        setLoading(false);
      }, (err) => {
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    }
<<<<<<< HEAD
  }, [quotationId, tenant?.id]);
=======
  }, [quotationId, tenant?.id, profile?.tenantId]);
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145

  return { quotation, loading, error };
};

// 2. Hook to fetch quotations list (optionally filtered by RFQ ID)
export const useQuotationList = (rfqId?: string) => {
  const [quotations, setQuotations] = useState<Quote[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
<<<<<<< HEAD
  const { tenant } = useAuth();

  useEffect(() => {
    if (!tenant?.id) {
=======
  const { tenant, profile } = useAuth(); // 🔒 IMPORT PROFILE

  useEffect(() => {
    // 🔒 SECURITY CHECK: Mitigate client side local storage tampering
    if (!tenant?.id || !profile?.tenantId || tenant.id !== profile.tenantId) {
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    if (isSandbox) {
      try {
<<<<<<< HEAD
        const cached = localStorage.getItem(`quotes_${tenant.id}`);
=======
        const cached = localStorage.getItem(`quotes_${profile.tenantId}`);
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        if (cached) {
          let list = JSON.parse(cached) as Quote[];
          if (rfqId) {
            list = list.filter(q => q.rfqId === rfqId);
          }
          setQuotations(list);
        } else {
          setQuotations([]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      const qPath = 'quotes';
      let q = query(
        collection(db, qPath),
<<<<<<< HEAD
        where('tenantId', '==', tenant.id)
=======
        where('tenantId', '==', profile.tenantId) // 🔒 Enforce strictly via Profile
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      );

      if (rfqId) {
        q = query(
          collection(db, qPath),
<<<<<<< HEAD
          where('tenantId', '==', tenant.id),
=======
          where('tenantId', '==', profile.tenantId),
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
          where('rfqId', '==', rfqId)
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Quote[] = [];
        snapshot.forEach(docSnap => {
          list.push(docSnap.data() as Quote);
        });
        // Sort by dates locally
        list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
        setQuotations(list);
        setLoading(false);
      }, (err) => {
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    }
<<<<<<< HEAD
  }, [tenant?.id, rfqId]);
=======
  }, [tenant?.id, profile?.tenantId, rfqId]);
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145

  return { quotations, loading, error };
};

// 3. Hook to create a quotation
export const useCreateQuotation = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { tenant, profile } = useAuth();

  const createQuotation = async (quotationData: Omit<Quote, 'id' | 'tenantId' | 'createdBy' | 'createdAt'>) => {
<<<<<<< HEAD
    if (!tenant?.id || !profile?.uid) {
      throw new Error('User or tenant context missing.');
=======
    // 🔒 SECURITY CHECK
    if (!tenant?.id || !profile?.uid || !profile?.tenantId || tenant.id !== profile.tenantId) {
      throw new Error('User or tenant context missing or unauthorized cross-tenant action attempted.');
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    }

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();
    const newQuoteId = `quote_${Date.now().toString().slice(-6)}`;
    const newQuotation: Quote = {
      ...quotationData,
      id: newQuoteId,
<<<<<<< HEAD
      tenantId: tenant.id,
=======
      tenantId: profile.tenantId, // 🔒 Force to authenticated profile id
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      createdBy: profile.uid,
      createdAt: isSandbox ? new Date().toISOString() : serverTimestamp()
    };

    try {
      if (isSandbox) {
<<<<<<< HEAD
        const cached = localStorage.getItem(`quotes_${tenant.id}`);
        const list: Quote[] = cached ? JSON.parse(cached) : [];
        const updated = [newQuotation, ...list];
        localStorage.setItem(`quotes_${tenant.id}`, JSON.stringify(updated));

        // Update associated RFQ
        if (quotationData.rfqId && quotationData.rfqId !== 'direct_quote') {
          const rfqsCached = localStorage.getItem(`rfqs_${tenant.id}`);
=======
        const cached = localStorage.getItem(`quotes_${profile.tenantId}`);
        const list: Quote[] = cached ? JSON.parse(cached) : [];
        const updated = [newQuotation, ...list];
        localStorage.setItem(`quotes_${profile.tenantId}`, JSON.stringify(updated));

        // Update associated RFQ
        if (quotationData.rfqId && quotationData.rfqId !== 'direct_quote') {
          const rfqsCached = localStorage.getItem(`rfqs_${profile.tenantId}`);
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
          if (rfqsCached) {
            const rfqsList = JSON.parse(rfqsCached);
            const rfqUpdated = rfqsList.map((r: any) => 
              r.id === quotationData.rfqId ? { ...r, status: 'quoted' } : r
            );
<<<<<<< HEAD
            localStorage.setItem(`rfqs_${tenant.id}`, JSON.stringify(rfqUpdated));
=======
            localStorage.setItem(`rfqs_${profile.tenantId}`, JSON.stringify(rfqUpdated));
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
          }
        }
      } else {
        await addDoc(collection(db, 'quotes'), newQuotation);

        if (quotationData.rfqId && quotationData.rfqId !== 'direct_quote') {
<<<<<<< HEAD
          const rfqSnap = await getDocs(query(collection(db, 'rfqs'), where('id', '==', quotationData.rfqId), where('tenantId', '==', tenant.id)));
=======
          const rfqSnap = await getDocs(query(collection(db, 'rfqs'), where('id', '==', quotationData.rfqId), where('tenantId', '==', profile.tenantId)));
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
          if (!rfqSnap.empty) {
            await updateDoc(doc(db, 'rfqs', rfqSnap.docs[0].id), { status: 'quoted' });
          }
        }
      }

      logActivityEvent({
<<<<<<< HEAD
        tenantId: tenant.id,
=======
        tenantId: profile.tenantId,
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        actionType: 'create',
        entityType: 'quotation',
        entityId: newQuoteId,
        actor: {
          userId: profile.uid,
          displayName: profile.name || profile.email || 'Plant Sales Head',
          email: profile.email
        },
        description: `Drafted Quotation ${newQuotation.quoteNumber} for customer "${newQuotation.customerName}" with grand total ₹${newQuotation.total.toLocaleString('en-IN')}`,
        metadata: {
          customerName: newQuotation.customerName,
          total: newQuotation.total,
          quoteNumber: newQuotation.quoteNumber
        },
        isSandboxMode: isSandbox
      });

      return newQuotation;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createQuotation, loading, error };
};

// 4. Hook to update a quotation status or metadata
export const useUpdateQuotation = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
<<<<<<< HEAD
  const { tenant } = useAuth();

  const updateQuotation = async (quotationId: string, updates: Partial<Quote>) => {
    if (!tenant?.id) throw new Error('Tenant context missing.');
=======
  const { tenant, profile } = useAuth(); // 🔒 IMPORT PROFILE

  const updateQuotation = async (quotationId: string, updates: Partial<Quote>) => {
    // 🔒 SECURITY CHECK
    if (!tenant?.id || !profile?.tenantId || tenant.id !== profile.tenantId) {
      throw new Error('Tenant context missing or unauthorized cross-tenant action attempted.');
    }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();

    try {
      if (isSandbox) {
<<<<<<< HEAD
        const cached = localStorage.getItem(`quotes_${tenant.id}`);
        if (cached) {
          const list = JSON.parse(cached) as Quote[];
          const updated = list.map(q => q.id === quotationId ? { ...q, ...updates } : q);
          localStorage.setItem(`quotes_${tenant.id}`, JSON.stringify(updated));
        }
      } else {
        const qSnap = await getDocs(query(collection(db, 'quotes'), where('id', '==', quotationId), where('tenantId', '==', tenant.id)));
=======
        const cached = localStorage.getItem(`quotes_${profile.tenantId}`);
        if (cached) {
          const list = JSON.parse(cached) as Quote[];
          const updated = list.map(q => q.id === quotationId ? { ...q, ...updates } : q);
          localStorage.setItem(`quotes_${profile.tenantId}`, JSON.stringify(updated));
        }
      } else {
        const qSnap = await getDocs(query(collection(db, 'quotes'), where('id', '==', quotationId), where('tenantId', '==', profile.tenantId)));
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        if (!qSnap.empty) {
          await updateDoc(doc(db, 'quotes', qSnap.docs[0].id), updates);
        } else {
          throw new Error('Quotation not found.');
        }
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { updateQuotation, loading, error };
};

// 5. Hook to Generate Quotation PDF, Upload to Storage & Update Firestore Version
export const useGeneratePDF = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
<<<<<<< HEAD
  const { tenant } = useAuth();
  const { updateQuotation } = useUpdateQuotation();

  const generatePDF = async (quote: Quote, pdfBlob: Blob): Promise<string> => {
    if (!tenant?.id) throw new Error('Tenant context missing.');
=======
  const { tenant, profile } = useAuth();
  const { updateQuotation } = useUpdateQuotation();

  const generatePDF = async (quote: Quote, pdfBlob: Blob): Promise<string> => {
    // 🔒 SECURITY CHECK
    if (!tenant?.id || !profile?.tenantId || tenant.id !== profile.tenantId) {
      throw new Error('Tenant context missing or unauthorized cross-tenant action attempted.');
    }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145

    setLoading(true);
    setError(null);

    const isSandbox = checkIsSandbox();
    const nextVersion = (quote.pdfVersion || 0) + 1;
    const timestampStr = new Date().toISOString();

    try {
      let downloadUrl = '';

      if (isSandbox) {
        // Create simulated local downloadable data url or Blob url
        const blobUrl = URL.createObjectURL(pdfBlob);
        downloadUrl = blobUrl;

        // Keep local trace
        const newVersionRecord: QuotationVersion = {
          version: nextVersion,
          downloadUrl,
          createdAt: timestampStr
        };

        const existingVersions = quote.pdfVersions || [];
        const updatedVersions = [...existingVersions, newVersionRecord];

        await updateQuotation(quote.id, {
          pdfVersion: nextVersion,
          pdfVersions: updatedVersions,
          downloadUrl
        });
      } else {
        // Upload real PDF to Firebase Storage
<<<<<<< HEAD
        const storagePath = `tenant/${tenant.id}/quotations/${quote.id}/v${nextVersion}.pdf`;
=======
        const storagePath = `tenant/${profile.tenantId}/quotations/${quote.id}/v${nextVersion}.pdf`;
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        const fileRef = ref(storage, storagePath);
        
        await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' });
        downloadUrl = await getDownloadURL(fileRef);

        const newVersionRecord: QuotationVersion = {
          version: nextVersion,
          downloadUrl,
          createdAt: timestampStr
        };

        const existingVersions = quote.pdfVersions || [];
        const updatedVersions = [...existingVersions, newVersionRecord];

        await updateQuotation(quote.id, {
          pdfVersion: nextVersion,
          pdfVersions: updatedVersions,
          downloadUrl
        });
      }

      return downloadUrl;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { generatePDF, loading, error };
};

// 6. Hook to Send Quotation via WhatsApp or Email and Log Send Event
export const useSendQuotation = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { tenant, profile } = useAuth();
  const { updateQuotation } = useUpdateQuotation();

  const sendWhatsApp = async (quote: Quote, downloadUrl: string) => {
<<<<<<< HEAD
    if (!tenant?.id || !profile?.uid) throw new Error('Auth scope missing.');
=======
    // 🔒 SECURITY CHECK
    if (!tenant?.id || !profile?.uid || !profile?.tenantId || tenant.id !== profile.tenantId) {
      throw new Error('Auth scope missing or unauthorized cross-tenant action attempted.');
    }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    if (!quote.phone) throw new Error('Customer phone not configured.');

    setLoading(true);
    setError(null);

    try {
      const isSandbox = checkIsSandbox();
      const validUntilStr = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-IN') : 'N/A';

      await sendWhatsAppNotification({
        recipientName: quote.customerName,
        recipientPhone: quote.phone,
        templateName: 'quotation_pdf_shared',
<<<<<<< HEAD
        tenantId: tenant.id,
=======
        tenantId: profile.tenantId,
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        parameters: {
          quotationNumber: quote.quoteNumber,
          validUntil: validUntilStr,
          tenantName: tenant.companyName || 'Ashrey FlowOps',
          pdfLink: downloadUrl
        }
      });

      // Update Quotation Status to 'sent' if draft
      await updateQuotation(quote.id, { status: 'sent' });

      // Log dispatch communication securely in Firestore or local log
      if (!isSandbox) {
        await addDoc(collection(db, 'communicationLogs'), {
<<<<<<< HEAD
          tenantId: tenant.id,
=======
          tenantId: profile.tenantId,
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
          quoteId: quote.id,
          recipientName: quote.customerName,
          recipientPhone: quote.phone,
          channel: 'whatsapp',
          type: 'quotation_shared',
          sentBy: profile.uid,
          sentByName: profile.name || 'Sales Desk',
          sentAt: serverTimestamp(),
          pdfVersion: quote.pdfVersion || 1,
          downloadUrl
        });
      }

      logActivityEvent({
<<<<<<< HEAD
        tenantId: tenant.id,
=======
        tenantId: profile.tenantId,
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        actionType: 'sent',
        entityType: 'quotation',
        entityId: quote.id,
        actor: {
          userId: profile.uid,
          displayName: profile.name || profile.email || 'Plant Sales Head',
          email: profile.email
        },
        description: `Dispatched Quotation #${quote.quoteNumber} PDF (v${quote.pdfVersion || 1}) to customer "${quote.customerName}" via WhatsApp.`,
        metadata: {
          customerName: quote.customerName,
          quoteNumber: quote.quoteNumber,
          channel: 'whatsapp',
          pdfVersion: quote.pdfVersion || 1
        },
        isSandboxMode: isSandbox
      });

    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async (quote: Quote, downloadUrl: string, destinationEmail: string) => {
<<<<<<< HEAD
    if (!tenant?.id || !profile?.uid) throw new Error('Auth scope missing.');
=======
    // 🔒 SECURITY CHECK
    if (!tenant?.id || !profile?.uid || !profile?.tenantId || tenant.id !== profile.tenantId) {
      throw new Error('Auth scope missing or unauthorized cross-tenant action attempted.');
    }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    if (!destinationEmail) throw new Error('Target destination email missing.');

    setLoading(true);
    setError(null);

    try {
      const isSandbox = checkIsSandbox();

      // Email dispatch logging for traceable B2B workflow
      console.log(`[Email Sync] SMTP Dispatch Queue:
        - Target Entity: "${quote.customerName}"
        - Email: ${destinationEmail}
        - Subject: Quotation #${quote.quoteNumber} from ${tenant.companyName || 'Ashrey FlowOps'}
        - Attachment URL: ${downloadUrl}`);

      // Update quote status to 'sent' if draft
      await updateQuotation(quote.id, { status: 'sent' });

      if (!isSandbox) {
        await addDoc(collection(db, 'communicationLogs'), {
<<<<<<< HEAD
          tenantId: tenant.id,
=======
          tenantId: profile.tenantId,
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
          quoteId: quote.id,
          recipientName: quote.customerName,
          recipientEmail: destinationEmail,
          channel: 'email',
          type: 'quotation_shared',
          sentBy: profile.uid,
          sentByName: profile.name || 'Sales Desk',
          sentAt: serverTimestamp(),
          pdfVersion: quote.pdfVersion || 1,
          downloadUrl
        });
      }

      logActivityEvent({
<<<<<<< HEAD
        tenantId: tenant.id,
=======
        tenantId: profile.tenantId,
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        actionType: 'sent',
        entityType: 'quotation',
        entityId: quote.id,
        actor: {
          userId: profile.uid,
          displayName: profile.name || profile.email || 'Plant Sales Head',
          email: profile.email
        },
        description: `Dispatched Quotation #${quote.quoteNumber} PDF (v${quote.pdfVersion || 1}) to customer "${quote.customerName}" via Email detailing PDF attachment download path.`,
        metadata: {
          customerName: quote.customerName,
          quoteNumber: quote.quoteNumber,
          channel: 'email',
          pdfVersion: quote.pdfVersion || 1
        },
        isSandboxMode: isSandbox
      });

    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sendWhatsApp, sendEmail, loading, error };
<<<<<<< HEAD
};
=======
};
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
