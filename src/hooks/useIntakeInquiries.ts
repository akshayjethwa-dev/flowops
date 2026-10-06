// src/hooks/useIntakeInquiries.ts

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
  getDocs,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  IntakeInquiry, 
  IntakeChannel, 
  IntakeStatus, 
  EmailInboxConfig, 
  Rfq, 
  Customer 
} from '../types';
import { useRfqsList } from './useRfqsList';
import { useCustomersList } from './useCustomersList';
import { logActivityEvent } from '../utils/activityLogger';
import { triggerRfqAutoAcknowledgement } from '../utils/whatsapp';

export const useIntakeInquiries = (tenantId: string | undefined) => {
  const [inquiries, setInquiries] = useState<IntakeInquiry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [emailConfig, setEmailConfig] = useState<EmailInboxConfig>({
    protocol: 'IMAP',
    host: 'imap.mailserver.com',
    port: 993,
    ssl: true,
    username: 'rfq-intake@flowops.com',
    folder: 'INBOX',
    lastSyncAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    autoSyncEnabled: true
  });

  const { addRfq } = useRfqsList(tenantId);
  const { customers, addCustomer } = useCustomersList(tenantId);

  // Initial seed dataset for demo/sandbox mode
  const SEED_INQUIRIES = useCallback((tid: string): IntakeInquiry[] => [
    {
      id: 'inq-email-01',
      tenantId: tid,
      channel: 'Email',
      sourceIdentifier: 's.deshmukh@mahindra-vendor.com',
      subject: 'URGENT RFQ: Machined Transmission Flanges & EN8 Splined Shafts',
      rawContent: `From: Sanjay Deshmukh <s.deshmukh@mahindra-vendor.com>\nSubject: URGENT RFQ: Machined Transmission Flanges & EN8 Splined Shafts\n\nDear Sales Team,\nPlease quote for 250 nos EN8 Precision Splined Shafts and 150 nos Forged Alloy Companion Flanges Class 300. Urgent requirement for Chakan Plant assembly line. Delivery required by 25th October 2026. - Sanjay Deshmukh, Mahindra Tier-1 (9822054321)`,
      receivedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      status: 'pending',
      customerName: 'Mahindra & Mahindra Tier-1 Systems',
      contactName: 'Sanjay Deshmukh',
      email: 's.deshmukh@mahindra-vendor.com',
      phone: '9822054321',
      city: 'Pune',
      priority: 'High',
      expectedDeliveryDate: '2026-10-25',
      description: 'Urgent CNC machined transmission splined shafts and forged companion flanges.',
      items: [
        { id: 'item-1', name: 'EN8 Precision Splined Drive Shaft (Dia 45mm x 320mm)', quantity: 250, specs: 'Material: EN8 Normalized' },
        { id: 'item-2', name: 'Forged Alloy Companion Flange Class 300 (PCD 120mm)', quantity: 150, specs: 'Finish: Black Phosphated' },
        { id: 'item-3', name: 'M14 High-Tensile Wheel Hub Studs (Grade 10.9)', quantity: 1200, specs: 'Zinc Yellow Passivated' }
      ],
      attachments: [
        {
          id: 'att-sample-1',
          name: 'Transmission_Shaft_Rev_C_Drawing.pdf',
          size: 428000,
          type: 'application/pdf',
          url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80'
        }
      ]
    },
    {
      id: 'inq-wa-02',
      tenantId: tid,
      channel: 'WhatsApp',
      sourceIdentifier: '+91 9880123456',
      subject: 'WhatsApp RFQ: SS 316 Flanges & Elbows',
      rawContent: `Hi Anand sir, urgent quotation required for 100 pcs 4 inch SS 316 Slip-on Flanges 150# and 50 pcs 4 inch Long Radius 90 Deg Welded Elbows Schedule 40. Need dispatch to Turbhe Navi Mumbai by next Friday without delay. - Nilesh Patil, Apex Piping Solutions (Phone: 9880123456)`,
      receivedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      status: 'pending',
      customerName: 'Apex Piping Solutions',
      contactName: 'Nilesh Patil',
      email: 'nilesh@apexpiping.in',
      phone: '9880123456',
      city: 'Mumbai',
      priority: 'High',
      description: 'Stainless steel piping flanges and welded elbows inquiry.',
      items: [
        { id: 'item-wa-1', name: '4 inch SS 316 Slip-on Flanges 150#', quantity: 100, specs: 'Material: SS 316' },
        { id: 'item-wa-2', name: '4 inch Long Radius 90 Deg Welded Elbows Schedule 40', quantity: 50, specs: 'Schedule 40' }
      ],
      attachments: []
    },
    {
      id: 'inq-web-03',
      tenantId: tid,
      channel: 'Web Form',
      sourceIdentifier: 'web-portal-sub-889',
      subject: 'Web Inquiry: Heavy Foundation Baseplate Fabrication',
      rawContent: `Web Form Submission with attached BOM spreadsheet (5 fabrication parts). Customer: Larsen & Toubro Heavy Engineering. Contact: P. V. Rao.`,
      receivedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      status: 'pending',
      customerName: 'Larsen & Toubro Heavy Engineering',
      contactName: 'P. V. Rao',
      email: 'p.rao@lt-heavy.com',
      phone: '9845012345',
      city: 'Vadodara',
      gstNumber: '24AAACL1234F1Z5',
      priority: 'Medium',
      description: 'Heavy structural baseplate fabrication for thermal equipment units.',
      items: [
        { id: 'item-web-1', name: 'Baseplate 50mm IS 2062 E250', quantity: 8, specs: 'Dimensions: 1500mm x 800mm x 50mm' },
        { id: 'item-web-2', name: 'Gusset Plate 16mm Rib Stiffener', quantity: 32, specs: 'Beveled edges for full penetration weld' },
        { id: 'item-web-3', name: 'Anchor Bolt Assemblies M36 Grade 8.8', quantity: 64, specs: 'Hot Dip Galvanized with double nuts' }
      ],
      attachments: [
        {
          id: 'att-bom-1',
          name: 'Foundation_Baseplate_BOM_v2.csv',
          size: 18200,
          type: 'text/csv'
        }
      ]
    }
  ], []);

  // Sync inquiries stream
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
        const key = `intake_inquiries_${tenantId}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          setInquiries(JSON.parse(cached));
        } else {
          const seeded = SEED_INQUIRIES(tenantId);
          localStorage.setItem(key, JSON.stringify(seeded));
          setInquiries(seeded);
        }

        const configKey = `email_config_${tenantId}`;
        const cachedCfg = localStorage.getItem(configKey);
        if (cachedCfg) {
          setEmailConfig(JSON.parse(cachedCfg));
        }
      } catch (err: any) {
        console.error('Sandbox inquiries loading failed:', err);
        setError(err.message || 'Sandbox storage error');
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const colPath = `tenants/${tenantId}/inquiries`;
        const q = query(collection(db, colPath));

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const list: IntakeInquiry[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as IntakeInquiry);
            });
            list.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
            setInquiries(list);
            setLoading(false);
          },
          (err) => {
            console.warn('Firestore inquiries subscription warning, falling back to sandbox storage:', err);
            // Fallback gracefully
            const key = `intake_inquiries_${tenantId}`;
            const cached = localStorage.getItem(key);
            setInquiries(cached ? JSON.parse(cached) : SEED_INQUIRIES(tenantId));
            setLoading(false);
          }
        );

        return unsubscribe;
      } catch (err: any) {
        console.error('Error in inquiries pipeline:', err);
        setError(err.message || 'Pipeline initialization error');
        setLoading(false);
      }
    }
  }, [tenantId, SEED_INQUIRIES]);

  // Save email IMAP / Graph API configuration
  const saveEmailConfig = async (newConfig: EmailInboxConfig) => {
    setEmailConfig(newConfig);
    if (!tenantId) return;
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      localStorage.setItem(`email_config_${tenantId}`, JSON.stringify(newConfig));
    } else {
      try {
        const configDocRef = doc(db, 'tenants', tenantId, 'config', 'emailInbox');
        await setDoc(configDocRef, { ...newConfig, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        console.warn('Failed to persist email config to Firestore, preserved in local storage:', err);
        localStorage.setItem(`email_config_${tenantId}`, JSON.stringify(newConfig));
      }
    }
  };

  // Add inquiry to inbox queue
  const addInquiry = async (inquiryData: Omit<IntakeInquiry, 'id' | 'tenantId' | 'receivedAt' | 'status'> & { receivedAt?: string; status?: IntakeStatus }) => {
    if (!tenantId) throw new Error('Tenant context missing.');
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    const newInquiry: IntakeInquiry = {
      ...inquiryData,
      id: `inq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId,
      status: inquiryData.status || 'pending',
      receivedAt: inquiryData.receivedAt || new Date().toISOString()
    };

    if (isSandbox) {
      const key = `intake_inquiries_${tenantId}`;
      const cached = localStorage.getItem(key);
      const list: IntakeInquiry[] = cached ? JSON.parse(cached) : [];
      const updated = [newInquiry, ...list];
      localStorage.setItem(key, JSON.stringify(updated));
      setInquiries(updated);
      return newInquiry;
    } else {
      try {
        const colPath = `tenants/${tenantId}/inquiries`;
        const docRef = await addDoc(collection(db, colPath), newInquiry);
        const created = { ...newInquiry, id: docRef.id };
        setInquiries(prev => [created, ...prev]);
        return created;
      } catch (err) {
        console.warn('Failed to add inquiry in Firestore, falling back to sandbox storage:', err);
        const key = `intake_inquiries_${tenantId}`;
        const cached = localStorage.getItem(key);
        const list: IntakeInquiry[] = cached ? JSON.parse(cached) : [];
        const updated = [newInquiry, ...list];
        localStorage.setItem(key, JSON.stringify(updated));
        setInquiries(updated);
        return newInquiry;
      }
    }
  };

  // Update inquiry
  const updateInquiry = async (id: string, updates: Partial<IntakeInquiry>) => {
    if (!tenantId) return;
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = `intake_inquiries_${tenantId}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        let list: IntakeInquiry[] = JSON.parse(cached);
        list = list.map(item => item.id === id ? { ...item, ...updates } : item);
        localStorage.setItem(key, JSON.stringify(list));
        setInquiries(list);
      }
    } else {
      try {
        const docRef = doc(db, 'tenants', tenantId, 'inquiries', id);
        await updateDoc(docRef, updates);
        setInquiries(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
      } catch (err) {
        console.warn('Firestore update failed, fallback to local:', err);
        const key = `intake_inquiries_${tenantId}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          let list: IntakeInquiry[] = JSON.parse(cached);
          list = list.map(item => item.id === id ? { ...item, ...updates } : item);
          localStorage.setItem(key, JSON.stringify(list));
          setInquiries(list);
        }
      }
    }
  };

  // Delete inquiry
  const deleteInquiry = async (id: string) => {
    if (!tenantId) return;
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = `intake_inquiries_${tenantId}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        let list: IntakeInquiry[] = JSON.parse(cached);
        list = list.filter(item => item.id !== id);
        localStorage.setItem(key, JSON.stringify(list));
        setInquiries(list);
      }
    } else {
      try {
        const docRef = doc(db, 'tenants', tenantId, 'inquiries', id);
        await deleteDoc(docRef);
        setInquiries(prev => prev.filter(item => item.id !== id));
      } catch (err) {
        console.warn('Firestore delete failed, fallback to local:', err);
        const key = `intake_inquiries_${tenantId}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          let list: IntakeInquiry[] = JSON.parse(cached);
          list = list.filter(item => item.id !== id);
          localStorage.setItem(key, JSON.stringify(list));
          setInquiries(list);
        }
      }
    }
  };

  /**
   * Convert an incoming inquiry into a formal structured RFQ record
   * Links or creates the customer, links attachments, logs activity event,
   * triggers WhatsApp auto-acknowledgement, and flags the inquiry as converted.
   */
  const convertInquiryToRfq = async (
    inquiry: IntakeInquiry,
    overrides?: {
      plantId?: string;
      assignedTo?: string;
      customerName?: string;
      customerId?: string;
      items?: any[];
      priority?: 'Low' | 'Medium' | 'High';
    },
    userProfile?: { uid: string; name?: string; email?: string } | null
  ): Promise<Rfq> => {
    if (!tenantId) throw new Error('No tenant detected');

    const customerName = overrides?.customerName || inquiry.customerName || 'Inquiry Customer';
    let customerId = overrides?.customerId;

    // 1. Find or create matching customer
    if (!customerId) {
      const existingCustomer = customers.find(c => 
        (c.name && c.name.toLowerCase() === customerName.toLowerCase()) ||
        (inquiry.phone && c.phone && c.phone.replace(/\D/g, '').includes(inquiry.phone.replace(/\D/g, '').slice(-10)))
      );

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        try {
          const newCust = await addCustomer({
            name: customerName,
            contactPerson: inquiry.contactName || '',
            phone: inquiry.phone || '',
            email: inquiry.email || '',
            city: inquiry.city || 'Pune',
            billingAddress: inquiry.city ? `${inquiry.city} Industrial Hub` : '',
            shippingAddress: inquiry.city ? `${inquiry.city} Industrial Hub` : '',
            gstNumber: inquiry.gstNumber || '',
            type: 'customer',
            notes: `Auto-created from ${inquiry.channel} inquiry.`
          });
          customerId = newCust.id;
        } catch (cErr) {
          console.warn('Auto customer creation warning:', cErr);
          customerId = 'cust-generic';
        }
      }
    }

    // 2. Prepare structured RFQ payload
    const finalItems = (overrides?.items || inquiry.items || []).map((it, idx) => ({
      id: it.id || `item-${Date.now()}-${idx + 1}`,
      name: it.name || `Line Item ${idx + 1}`,
      quantity: Number(it.quantity) || 1,
      specs: it.specs || ''
    }));

    const rfqNumber = `RFQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const rfqPayload: Omit<Rfq, 'id' | 'tenantId' | 'createdAt'> = {
      rfqNumber,
      plantId: overrides?.plantId || inquiry.plantId || 'all',
      customerId,
      customerName,
      contactName: inquiry.contactName,
      phone: inquiry.phone,
      email: inquiry.email,
      source: inquiry.channel === 'Email' ? 'Email' : inquiry.channel === 'WhatsApp' ? 'WhatsApp' : 'Web Form',
      dateReceived: inquiry.receivedAt ? inquiry.receivedAt.split('T')[0] : new Date().toISOString().split('T')[0],
      status: 'New',
      priority: overrides?.priority || inquiry.priority || 'Medium',
      description: inquiry.description || inquiry.subject || `Inquiry ingested via ${inquiry.channel}.`,
      attachments: inquiry.attachments?.map(a => a.name) || [],
      assignedTo: overrides?.assignedTo || 'Sales Engineer',
      items: finalItems,
      createdBy: userProfile?.uid || 'sales_engineer',
      intakeInquiryId: inquiry.id,
      expectedDeliveryDate: inquiry.expectedDeliveryDate
    };

    // 3. Create the formal RFQ record
    const createdRfq = await addRfq(rfqPayload);

    // 4. Save metadata attachments into flowops attachments repository
    if (inquiry.attachments && inquiry.attachments.length > 0) {
      try {
        const attachList = inquiry.attachments.map(att => ({
          id: att.id || `att_${Date.now()}`,
          fileName: att.name,
          fileType: att.type || 'application/pdf',
          size: att.size || 1024,
          uploadedBy: {
            userId: userProfile?.uid || 'system',
            displayName: userProfile?.name || 'Inquiry Importer',
            email: userProfile?.email || ''
          },
          uploadedAt: new Date().toISOString(),
          tenantId,
          entityType: 'rfq' as const,
          entityId: createdRfq.id,
          storagePath: att.storagePath || `tenants/${tenantId}/rfq/${createdRfq.id}/${att.name}`,
          downloadUrl: att.url || '',
          isLocalSimulated: true
        }));

        const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
        if (isSandbox) {
          const cached = localStorage.getItem(`flowops_attachments_${tenantId}`) || '[]';
          const parsed = JSON.parse(cached);
          localStorage.setItem(`flowops_attachments_${tenantId}`, JSON.stringify([...attachList, ...parsed]));
        } else {
          for (const att of attachList) {
            await addDoc(collection(db, 'tenants', tenantId, 'attachments'), att);
          }
        }
      } catch (attErr) {
        console.warn('Failed to mirror intake attachments to central attachments collection:', attErr);
      }
    }

    // 5. Update inquiry status to converted
    await updateInquiry(inquiry.id, {
      status: 'converted',
      convertedRfqId: createdRfq.id,
      convertedRfqNumber: createdRfq.rfqNumber || rfqNumber,
      convertedAt: new Date().toISOString(),
      convertedBy: userProfile?.name || 'Sales Engineer'
    });

    // 6. Record Activity Timeline audit event
    await logActivityEvent({
      tenantId,
      actionType: 'create',
      entityType: 'rfq',
      entityId: createdRfq.id,
      actor: {
        userId: userProfile?.uid || 'sales_engineer',
        displayName: userProfile?.name || 'Sales Engineer',
        email: userProfile?.email || ''
      },
      description: `Converted ${inquiry.channel} inquiry into formal RFQ #${createdRfq.rfqNumber || rfqNumber} with ${finalItems.length} items and ${inquiry.attachments?.length || 0} attachments.`,
      metadata: {
        rfqNumber: createdRfq.rfqNumber || rfqNumber,
        channel: inquiry.channel,
        customerName,
        itemCount: finalItems.length
      },
      isSandboxMode: localStorage.getItem('isSandboxMode') === 'true' || !db
    });

    return createdRfq;
  };

  return {
    inquiries,
    loading,
    error,
    emailConfig,
    saveEmailConfig,
    addInquiry,
    updateInquiry,
    deleteInquiry,
    convertInquiryToRfq
  };
};
