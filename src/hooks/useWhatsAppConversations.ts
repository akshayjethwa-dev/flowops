// src/hooks/useWhatsAppConversations.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  serverTimestamp,
  getDocs,
  where,
  addDoc
} from 'firebase/firestore';
import { WhatsAppConversation, WhatsAppMessage, Customer, CustomerOrder, Invoice, BotSession } from '../types';
import { useAuth } from './useAuth';
import { BotStateMachine } from '../utils/BotStateMachine';

export const useWhatsAppConversations = (tenantId: string | undefined) => {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  const getLocalStorageKey = useCallback(() => `whatsapp_convs_${tenantId}`, [tenantId]);

  // Load / Sync
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
        const key = getLocalStorageKey();
        const cached = localStorage.getItem(key);
        let list: WhatsAppConversation[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          // Add default premium sandbox seeds matching PM requirements
          const now = new Date();
          list = [
            {
              id: 'conv-1',
              tenantId,
              phone: '+91 98765 43210',
              customerId: 'CUST-001', // Anil Kumar (match if exists)
              customerName: 'Anil Kumar (Sri Ganesh Castings)',
              lastMessage: 'Please send me 500 units price list for high-pressure gate valves.',
              lastTimestamp: new Date(now.getTime() - 10 * 60000).toISOString(), // 10m ago
              unreadCount: 1,
              status: 'unread',
              createdAt: new Date(now.getTime() - 120 * 60000).toISOString()
            },
            {
              id: 'conv-2',
              tenantId,
              phone: '+91 76543 21098',
              customerId: 'CUST-002', 
              customerName: 'Sunil Sharma (Sharma Pipelines)',
              lastMessage: 'Dispatch alert says delivered, but we only received 450 units. Package damaged on box 5.',
              lastTimestamp: new Date(now.getTime() - 45 * 60000).toISOString(), // 45m ago
              unreadCount: 1,
              status: 'unread',
              createdAt: new Date(now.getTime() - 500 * 60000).toISOString()
            },
            {
              id: 'conv-3',
              tenantId,
              phone: '+91 91234 56789',
              customerId: 'CUST-003',
              customerName: 'Ramesh Shah (Bombay Valves)',
              lastMessage: 'Thank you, order received!',
              lastTimestamp: new Date(now.getTime() - 120 * 60000).toISOString(), // 2h ago
              unreadCount: 0,
              status: 'active',
              assignedSalesUserId: profile?.uid || 'user-arj-10',
              createdAt: new Date(now.getTime() - 2000 * 60000).toISOString()
            },
            {
              id: 'conv-4',
              tenantId,
              phone: '+91 88888 77777',
              lastMessage: 'I am interested in buying 200 gate valves. Where can I find quotes?',
              lastTimestamp: new Date(now.getTime() - 360 * 60000).toISOString(), // 6h ago
              unreadCount: 2,
              status: 'unassigned',
              createdAt: new Date(now.getTime() - 400 * 60000).toISOString()
            }
          ];
          localStorage.setItem(key, JSON.stringify(list));

          // Seed primary messages per conversation too so timeline hooks load correctly
          const seedMessages: Record<string, WhatsAppMessage[]> = {
            'conv-1': [
              {
                id: 'm1-1',
                tenantId,
                conversationId: 'conv-1',
                senderPhone: '+91 98765 43210',
                recipientPhone: 'FlowOps',
                direction: 'inbound',
                message: 'Hello FlowOps, is the valve order dispatched?',
                timestamp: new Date(now.getTime() - 60 * 60000).toISOString(),
                status: 'read'
              },
              {
                id: 'm1-2',
                tenantId,
                conversationId: 'conv-1',
                senderPhone: 'FlowOps',
                recipientPhone: '+91 98765 43210',
                direction: 'outbound',
                message: 'Hi Anil, yes, your order has loaded on our logistics line. Dispatched today!',
                timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
                status: 'read'
              },
              {
                id: 'm1-3',
                tenantId,
                conversationId: 'conv-1',
                senderPhone: '+91 98765 43210',
                recipientPhone: 'FlowOps',
                direction: 'inbound',
                message: 'Please send me 500 units price list for high-pressure gate valves.',
                timestamp: new Date(now.getTime() - 10 * 60000).toISOString(),
                status: 'delivered'
              }
            ],
            'conv-2': [
              {
                id: 'm2-1',
                tenantId,
                conversationId: 'conv-2',
                senderPhone: 'FlowOps',
                recipientPhone: '+91 76543 21098',
                direction: 'outbound',
                message: 'Your consignment has been delivered by carrier Air Express. LR-89100. Contact supervisor for checklist.',
                timestamp: new Date(now.getTime() - 180 * 60000).toISOString(),
                status: 'read'
              },
              {
                id: 'm2-2',
                tenantId,
                conversationId: 'conv-2',
                senderPhone: '+91 76543 21098',
                recipientPhone: 'FlowOps',
                direction: 'inbound',
                message: 'Dispatch alert says delivered, but we only received 450 units. Package damaged on box 5.',
                timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
                status: 'delivered'
              }
            ],
            'conv-3': [
              {
                id: 'm3-1',
                tenantId,
                conversationId: 'conv-3',
                senderPhone: '+91 91234 56789',
                recipientPhone: 'FlowOps',
                direction: 'inbound',
                message: 'Are my alloy orders undergoing welding operations currently?',
                timestamp: new Date(now.getTime() - 240 * 60000).toISOString(),
                status: 'read'
              },
              {
                id: 'm3-2',
                tenantId,
                conversationId: 'conv-3',
                senderPhone: 'FlowOps',
                recipientPhone: '+91 91234 56789',
                direction: 'outbound',
                message: 'Hi Ramesh, let me check our Shopfloor scheduler. Yes, they are in the welding process stage currently.',
                timestamp: new Date(now.getTime() - 180 * 60000).toISOString(),
                status: 'read'
              },
              {
                id: 'm3-3',
                tenantId,
                conversationId: 'conv-3',
                senderPhone: '+91 91234 56789',
                recipientPhone: 'FlowOps',
                direction: 'inbound',
                message: 'Thank you, order received!',
                timestamp: new Date(now.getTime() - 120 * 60000).toISOString(),
                status: 'read'
              }
            ],
            'conv-4': [
              {
                id: 'm4-1',
                tenantId,
                conversationId: 'conv-4',
                senderPhone: '+91 88888 77777',
                recipientPhone: 'FlowOps',
                direction: 'inbound',
                message: 'Hi team. Are you open today?',
                timestamp: new Date(now.getTime() - 450 * 60000).toISOString(),
                status: 'read'
              },
              {
                id: 'm4-2',
                tenantId,
                conversationId: 'conv-4',
                senderPhone: '+91 88888 77777',
                recipientPhone: 'FlowOps',
                direction: 'inbound',
                message: 'I am interested in buying 200 gate valves. Where can I find quotes?',
                timestamp: new Date(now.getTime() - 360 * 60000).toISOString(),
                status: 'delivered'
              }
            ]
          };

          Object.keys(seedMessages).forEach((cid) => {
            localStorage.setItem(`whatsapp_messages_${tenantId}_${cid}`, JSON.stringify(seedMessages[cid]));
          });
        }

        // Sort by lastTimestamp newest first
        list.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
        setConversations(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandbox WhatsApp conversations');
        setLoading(false);
      }
    } else {
      try {
        const colRef = collection(db, 'tenants', tenantId, 'whatsappConversations');
        // Let's query ordered by lastTimestamp. Falls back to client-side sorting if index is missing.
        const q = query(colRef, orderBy('lastTimestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: WhatsAppConversation[] = [];
          snapshot.forEach((snap) => {
            const data = snap.data();
            list.push({
              id: snap.id,
              ...data,
              lastTimestamp: data.lastTimestamp ? (data.lastTimestamp.seconds ? new Date(data.lastTimestamp.seconds * 1000).toISOString() : data.lastTimestamp) : new Date().toISOString()
            } as WhatsAppConversation);
          });
          setConversations(list);
          setLoading(false);
        }, (err) => {
          console.error('Error fetching live WhatsApp conversations', err);
          setError(err.message || 'Error fetching WhatsApp conversations');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error initializing live WhatsApp conversation stream');
        setLoading(false);
      }
    }
  }, [tenantId, getLocalStorageKey, profile?.uid]);

  // MUTATION: Assign Team Member
  const assignSalesUser = useCallback(async (conversationId: string, userId: string | undefined, userDisplayName?: string) => {
    if (!tenantId) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = getLocalStorageKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const list: WhatsAppConversation[] = JSON.parse(cached);
        const updated = list.map((c) => {
          if (c.id === conversationId) {
            return { 
              ...c, 
              assignedSalesUserId: userId || undefined, 
              status: c.status === 'unassigned' ? 'active' : c.status
            } as WhatsAppConversation;
          }
          return c;
        });
        localStorage.setItem(key, JSON.stringify(updated));
        setConversations(updated.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()));
      }
    } else {
      const docRef = doc(db, 'tenants', tenantId, 'whatsappConversations', conversationId);
      await updateDoc(docRef, {
        assignedSalesUserId: userId || null,
        status: 'active'
      });
    }
  }, [tenantId, getLocalStorageKey]);

  // MUTATION: Update Status (resolved / archive / etc)
  const updateStatus = useCallback(async (conversationId: string, status: 'unread' | 'unassigned' | 'resolved' | 'active') => {
    if (!tenantId) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = getLocalStorageKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const list: WhatsAppConversation[] = JSON.parse(cached);
        const updated = list.map((c) => {
          if (c.id === conversationId) {
            return { ...c, status } as WhatsAppConversation;
          }
          return c;
        });
        localStorage.setItem(key, JSON.stringify(updated));
        setConversations(updated.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()));
      }
    } else {
      const docRef = doc(db, 'tenants', tenantId, 'whatsappConversations', conversationId);
      await updateDoc(docRef, { status });
    }
  }, [tenantId, getLocalStorageKey]);

  // MUTATION: Mark local/live unread Count to 0
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!tenantId) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = getLocalStorageKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const list: WhatsAppConversation[] = JSON.parse(cached);
        const updated = list.map((c) => {
          if (c.id === conversationId) {
            return { ...c, unreadCount: 0 } as WhatsAppConversation;
          }
          return c;
        });
        localStorage.setItem(key, JSON.stringify(updated));
        setConversations(updated.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()));
      }
    } else {
      const docRef = doc(db, 'tenants', tenantId, 'whatsappConversations', conversationId);
      await updateDoc(docRef, { unreadCount: 0 });
    }
  }, [tenantId, getLocalStorageKey]);

  // MUTATION: Associate / Match contact to Customer
  const matchCustomer = useCallback(async (conversationId: string, customerId: string, customerName: string) => {
    if (!tenantId) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = getLocalStorageKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const list: WhatsAppConversation[] = JSON.parse(cached);
        const updated = list.map((c) => {
          if (c.id === conversationId) {
            return { ...c, customerId, customerName } as WhatsAppConversation;
          }
          return c;
        });
        localStorage.setItem(key, JSON.stringify(updated));
        setConversations(updated);
      }
    } else {
      const docRef = doc(db, 'tenants', tenantId, 'whatsappConversations', conversationId);
      await updateDoc(docRef, { customerId, customerName });
    }
  }, [tenantId, getLocalStorageKey]);

  // HELPER: Automated WhatsApp Order Bot implementation
  const triggerBotResponse = useCallback(async (phone: string, text: string, convId: string, isSandbox: boolean) => {
    try {
      const cleanPhoneValue = phone.trim();
      let customer: Customer | null = null;
      let latestOrders: CustomerOrder[] = [];
      let latestInvoices: Invoice[] = [];

      if (isSandbox) {
        // Query local customer list or default matching Rajesh demo
        const customersKey = `customers_${tenantId}`;
        const cachedC = localStorage.getItem(customersKey);
        const customerList = cachedC ? JSON.parse(cachedC) : [];
        customer = customerList.find((c: any) => c.phone && c.phone.replace(/[^0-9]/g, '') === cleanPhoneValue.replace(/[^0-9]/g, ''));
        
        if (!customer && (cleanPhoneValue.includes('9876543210') || cleanPhoneValue.includes('9500012345'))) {
          // Rajesh Patel default fallback matches
          customer = {
            id: 'CUST-DEMO-RAJESH',
            tenantId: tenantId || 'tenant_1',
            name: 'Ashrey Auto Parts / Pune Gears Corp',
            type: 'dealer',
            contactPerson: 'Mr. Rajesh Ashrey',
            phone: cleanPhoneValue,
            email: 'dealer@ashreyparts.com',
            gstNumber: '27AAACA1234A1Z9',
            billingAddress: 'Plot 42, MIDC Sector 1, Bhosari, Pune, MH - 411026',
            shippingAddress: 'Plot 42, MIDC Sector 1, Bhosari, Pune, MH - 411026',
            city: 'Pune'
          };
        }

        if (customer) {
          const ordersKey = `customer_orders_${customer.id}`;
          const cachedOrd = localStorage.getItem(ordersKey);
          latestOrders = cachedOrd ? JSON.parse(cachedOrd) : [];

          const invoicesKey = `customer_invoices_${customer.id}`;
          const cachedInv = localStorage.getItem(invoicesKey);
          latestInvoices = cachedInv ? JSON.parse(cachedInv) : [];
        }
      } else {
        // Live Firebase lookup
        const cSnap = await getDocs(query(collection(db, 'customers'), where('phone', '==', cleanPhoneValue)));
        if (!cSnap.empty) {
          customer = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as Customer;
          
          const ordSnap = await getDocs(query(collection(db, 'customerOrders'), where('customerId', '==', customer.id)));
          ordSnap.forEach(docSnapVal => {
            latestOrders.push({ id: docSnapVal.id, ...docSnapVal.data() } as CustomerOrder);
          });

          const invSnap = await getDocs(query(collection(db, 'invoices'), where('customerId', '==', customer.id)));
          invSnap.forEach(docSnapVal => {
            latestInvoices.push({ id: docSnapVal.id, ...docSnapVal.data() } as Invoice);
          });
        }
      }

      // Load session
      const sessionKey = `bot_session_${cleanPhoneValue}`;
      const sessionCached = localStorage.getItem(sessionKey);
      let session: BotSession;
      if (sessionCached) {
        session = JSON.parse(sessionCached);
      } else {
        session = {
          phone: cleanPhoneValue,
          tenantId: tenantId || 'tenant_1',
          customerId: customer?.id || 'demo_customer_id',
          customerName: customer?.name || 'Walkin Customer',
          currentStep: 'IDLE',
          lastActiveAt: new Date().toISOString()
        };
      }

      // Execute Bot state machine
      const botResult = BotStateMachine.getNextStep(text, session, {
        customer,
        latestOrders,
        latestInvoices
      });

      // Save updated session state
      localStorage.setItem(sessionKey, JSON.stringify(botResult.updatedSession));

      // Check if order generated
      if (botResult.orderToCreate) {
        const orderNumber = `C-ORD-${Math.floor(100000 + Math.random() * 900000)}`;
        const newOrder: CustomerOrder = {
          ...botResult.orderToCreate,
          id: `bot_ord_${Date.now()}`,
          orderNumber,
          status: 'pending_confirmation',
          createdAt: new Date().toISOString()
        };

        if (isSandbox) {
          if (customer) {
            const ordersKey = `customer_orders_${customer.id}`;
            const cachedList = localStorage.getItem(ordersKey);
            const list = cachedList ? JSON.parse(cachedList) : [];
            list.unshift(newOrder);
            localStorage.setItem(ordersKey, JSON.stringify(list));
          }
          const actKey = `activities_${tenantId}`;
          const cachedAct = localStorage.getItem(actKey);
          const actList = cachedAct ? JSON.parse(cachedAct) : [];
          actList.unshift({
            id: `act_${Date.now()}`,
            userId: 'whatsapp-bot',
            userName: `Bot: ${customer?.name || phone}`,
            description: `Auto-ordered ${orderNumber} via WhatsApp state machine`,
            timestamp: new Date().toISOString()
          });
          localStorage.setItem(actKey, JSON.stringify(actList));
        } else {
          await addDoc(collection(db, 'customerOrders'), newOrder);
          await addDoc(collection(db, 'activities'), {
            tenantId,
            userId: 'whatsapp-bot',
            userName: `Bot: ${customer?.name || phone}`,
            description: `Auto-ordered ${orderNumber} via WhatsApp state machine`,
            timestamp: new Date().toISOString()
          });
        }
      }

      // If user typed 'STOP' -> notify team & unassign to direct to human
      const cleanUpper = text.trim().toUpperCase();
      let overrideMsg = botResult.message;
      let targetStatus: 'unread' | 'active' | 'unassigned' = 'unread';

      if (cleanUpper === 'STOP') {
        overrideMsg = `🚨 *FlowOps State Machine Terminated:* \n\n` +
                      `Connecting you to an Ashrey coordination desks immediately. Please wait for human assistance.`;
        targetStatus = 'unassigned';
      }

      // Add Outbound automated response message to the timeline
      const botMsgId = `bot-m-${Date.now()}`;
      const timestamp = new Date().toISOString();

      if (isSandbox) {
        const key = getLocalStorageKey();
        const cachedConvs = localStorage.getItem(key);
        const conversationsList: WhatsAppConversation[] = cachedConvs ? JSON.parse(cachedConvs) : [];
        const existingConv = conversationsList.find((c) => c.phone === cleanPhoneValue);

        if (existingConv) {
          existingConv.lastMessage = overrideMsg;
          existingConv.lastTimestamp = timestamp;
          if (cleanUpper === 'STOP') {
            existingConv.status = targetStatus;
          }
        }

        const threadKey = `whatsapp_messages_${tenantId}_${existingConv?.id || convId}`;
        const threadCached = localStorage.getItem(threadKey);
        const threadList: WhatsAppMessage[] = threadCached ? JSON.parse(threadCached) : [];

        threadList.push({
          id: botMsgId,
          tenantId,
          conversationId: existingConv?.id || convId,
          senderPhone: 'FlowOps',
          recipientPhone: cleanPhoneValue,
          direction: 'outbound',
          message: overrideMsg,
          timestamp,
          status: 'read'
        });

        localStorage.setItem(threadKey, JSON.stringify(threadList));
        localStorage.setItem(key, JSON.stringify(conversationsList));
        setConversations(conversationsList.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()));
      } else {
        // Write outbound Firebase reply
        const docRef = doc(db, 'tenants', tenantId, 'whatsappConversations', convId);
        await updateDoc(docRef, {
          lastMessage: overrideMsg,
          lastTimestamp: timestamp,
          ...(cleanUpper === 'STOP' ? { status: targetStatus } : {})
        });

        const newMsgRef = doc(collection(db, 'tenants', tenantId, 'whatsappConversations', convId, 'messages'));
        await setDoc(newMsgRef, {
          id: newMsgRef.id,
          tenantId,
          conversationId: convId,
          senderPhone: 'FlowOps',
          recipientPhone: cleanPhoneValue,
          direction: 'outbound',
          message: overrideMsg,
          timestamp,
          status: 'read'
        });
      }
    } catch (err) {
      console.error('Error handling WhatsApp Order Bot State Machine', err);
    }
  }, [tenantId, getLocalStorageKey]);

  // HELPER: trigger an inbound message simulation
  const simulateInboundMessage = useCallback(async (phone: string, text: string, optionalMedia?: { url: string, type: 'image' | 'document', name: string }) => {
    if (!tenantId) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const cleanPhone = phone.trim();

    if (isSandbox) {
      const key = getLocalStorageKey();
      const cached = localStorage.getItem(key);
      const list: WhatsAppConversation[] = cached ? JSON.parse(cached) : [];

      let existingConv = list.find((c) => c.phone === cleanPhone);
      const mId = `sim-m-${Date.now()}`;
      const timestamp = new Date().toISOString();

      if (!existingConv) {
        // Create conversation
        existingConv = {
          id: `sim-conv-${Date.now()}`,
          tenantId,
          phone: cleanPhone,
          lastMessage: text,
          lastTimestamp: timestamp,
          unreadCount: 1,
          status: 'unread',
          createdAt: timestamp
        };
        list.push(existingConv);
      } else {
        existingConv.lastMessage = text;
        existingConv.lastTimestamp = timestamp;
        existingConv.unreadCount += 1;
        existingConv.status = 'unread'; // bring back to unread status
      }

      // Add to conversation thread
      const threadKey = `whatsapp_messages_${tenantId}_${existingConv.id}`;
      const messagesCached = localStorage.getItem(threadKey);
      const messages: WhatsAppMessage[] = messagesCached ? JSON.parse(messagesCached) : [];
      
      const newMsg: WhatsAppMessage = {
        id: mId,
        tenantId,
        conversationId: existingConv.id,
        senderPhone: cleanPhone,
        recipientPhone: 'FlowOps',
        direction: 'inbound',
        message: text,
        timestamp,
        status: 'delivered',
        ...(optionalMedia ? {
          mediaUrl: optionalMedia.url,
          mediaType: optionalMedia.type,
          mediaName: optionalMedia.name
        } : {})
      };

      messages.push(newMsg);
      localStorage.setItem(threadKey, JSON.stringify(messages));
      localStorage.setItem(key, JSON.stringify(list));

      // Trigger standard local state sync
      setConversations(list.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()));

      // Trigger Bot Auto-response asynchronous
      setTimeout(() => {
        triggerBotResponse(cleanPhone, text, existingConv!.id, true);
      }, 1000);
    } else {
      // Live Firestore Simulation
      // 1. Check if conversation with this phone exists
      const colRef = collection(db, 'tenants', tenantId, 'whatsappConversations');
      const q = query(colRef, where('phone', '==', cleanPhone));
      const sRef = await getDocs(q);
      
      let convId = '';
      let existingData: any = null;

      sRef.forEach((snap) => {
        convId = snap.id;
        existingData = snap.data();
      });

      const timestamp = new Date().toISOString();

      if (!convId) {
        // Create new
        const newDocRef = doc(collection(db, 'tenants', tenantId, 'whatsappConversations'));
        convId = newDocRef.id;
        existingData = {
          id: convId,
          tenantId,
          phone: cleanPhone,
          lastMessage: text,
          lastTimestamp: timestamp,
          unreadCount: 1,
          status: 'unread',
          createdAt: timestamp
        };
        await setDoc(newDocRef, existingData);
      } else {
        // Update
        const docRef = doc(db, 'tenants', tenantId, 'whatsappConversations', convId);
        await updateDoc(docRef, {
          lastMessage: text,
          lastTimestamp: timestamp,
          unreadCount: (existingData.unreadCount || 0) + 1,
          status: 'unread'
        });
      }

      // Add message
      const msgRef = doc(collection(db, 'tenants', tenantId, 'whatsappConversations', convId, 'messages'));
      await setDoc(msgRef, {
        id: msgRef.id,
        tenantId,
        conversationId: convId,
        senderPhone: cleanPhone,
        recipientPhone: 'FlowOps',
        direction: 'inbound',
        message: text,
        timestamp,
        status: 'delivered',
        ...(optionalMedia ? {
          mediaUrl: optionalMedia.url,
          mediaType: optionalMedia.type,
          mediaName: optionalMedia.name
        } : {})
      });

      // Trigger Bot Auto-response asynchronous
      setTimeout(() => {
        triggerBotResponse(cleanPhone, text, convId, false);
      }, 1000);
    }
  }, [tenantId, getLocalStorageKey, triggerBotResponse]);

  return {
    conversations,
    loading,
    error,
    assignSalesUser,
    updateStatus,
    markAsRead,
    matchCustomer,
    simulateInboundMessage
  };
};
