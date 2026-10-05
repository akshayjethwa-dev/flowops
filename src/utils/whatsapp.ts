// src/utils/whatsapp.ts

import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { logActivityEvent } from './activityLogger';

/**
 * Interface representing WhatsApp notification options
 */
export interface WhatsAppNotificationPayload {
  recipientName: string;
  recipientPhone: string;
  templateName: string;
  parameters: Record<string, string>;
  tenantId: string;
  orderId?: string;
  customerId?: string;
}

/**
 * Clean abstraction layer for BSP-based WhatsApp integration (e.g., AiSensy, Wati, Gupshup).
 * 
 * In production:
 * This triggers a physical API call to the BSP with registered template structures.
 * 
 * In MVP:
 * This logs the notification into the Firestore `whatsappLogs` collection and prints 
 * the exact template payload in the developer logs, with TODO hooks for secret integration.
 */
export async function sendWhatsAppNotification(payload: WhatsAppNotificationPayload): Promise<string> {
  const { recipientPhone, recipientName, templateName, parameters, tenantId, orderId, customerId: inputCustomerId } = payload;
  
  // Format the country prefix for Indian phone numbers as they are local targets
  let formattedPhone = recipientPhone.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = `91${formattedPhone}`; // India country code prefix
  } else if (!formattedPhone.startsWith('91') && formattedPhone.length > 10) {
    // If it is another length and doesn't have 91, keep it but warn
  }

  // Generate some conversational message bodies based on standard registered manufacturing templates
  let messageContent = '';
  switch (templateName) {
    case 'rfq_received':
      messageContent = `Dear {customerName}, we have received your inquiry for {productName}. Our team will get back to you shortly with a quotation. Ref: {rfqNumber}. — {companyName}`
        .replace('{customerName}', recipientName || parameters.customerName || 'Customer')
        .replace('{productName}', parameters.productName || parameters.itemName || 'products')
        .replace('{rfqNumber}', parameters.rfqNumber || parameters.rfqId || '')
        .replace('{companyName}', parameters.companyName || parameters.tenantName || 'Ashrey FlowWorks');
      break;
    case 'quote_shared':
      messageContent = `Dear ${recipientName}, your formal Quotation ${parameters.quoteNumber} of total ₹${parameters.total} has been generated. Direct Link: ${parameters.quoteLink || 'Shared via App'}. Please review and approve. Regards, ${parameters.companyName}.`;
      break;
    case 'order_confirmed':
      messageContent = `Hello ${recipientName}! Thrilled to confirm your purchase Order ${parameters.orderNumber} is scheduled for production. Est delivery: ${parameters.deliveryDate}. Track live inside FlowOps!`;
      break;
    case 'production_update':
      messageContent = `Dear ${recipientName}, your order ${parameters.orderNumber} for ${parameters.productName || parameters.itemName || 'products'} has moved to stage: ${parameters.stage}. — Ashrey FlowOps`;
      break;
    case 'order_dispatched':
      messageContent = `Dear ${recipientName}, your order ${parameters.orderNumber} has been dispatched. Transporter: ${parameters.transporterName || parameters.transporter || 'Direct'}, LR No: ${parameters.lrNumber || 'N/A'}. Expected delivery: ${parameters.expectedDeliveryDate || parameters.deliveryDate || 'N/A'}. — ${parameters.companyName || 'Ashrey FlowWorks'}`;
      break;
    case 'payment_reminder':
      messageContent = `Dear {customerName}, a payment of ₹{amount} for invoice {invoiceNumber} was due on {dueDate}. Kindly arrange payment at your earliest. — {companyName}`
        .replace('{customerName}', recipientName)
        .replace('{amount}', parameters.amount || parameters.outstandingAmount || '')
        .replace('{invoiceNumber}', parameters.invoiceNumber || '')
        .replace('{dueDate}', parameters.dueDate || '')
        .replace('{companyName}', parameters.companyName || parameters.tenantName || 'Ashrey FlowWorks');
      break;
    case 'quotation_pdf_shared':
      messageContent = `Dear ${recipientName}, please find attached our Quotation #${parameters.quotationNumber} for your reference. Valid until ${parameters.validUntil}. — ${parameters.tenantName || 'Ashrey FlowOps'}`;
      break;
    case 'low_stock_alert':
      messageContent = `Low stock alert: {itemName} is below minimum level ({currentQty} remaining).`
        .replace('{itemName}', parameters.itemName || '')
        .replace('{currentQty}', parameters.currentQty || '');
      break;
    default:
      messageContent = `Alert for ${recipientName}: Update associated with reference ${parameters.referenceId || 'N/A'}. Dynamic params: ${JSON.stringify(parameters)}.`;
  }

  // Log to console for local developers (Enterprise traceability)
  console.log(`[WhatsApp Sync] BSP Outbox Queue Triggered:
    - Target: ${recipientName} (${formattedPhone})
    - BSP Template: ${templateName}
    - Formulated Message: "${messageContent}"`);

  const isSandboxMode = localStorage.getItem('isSandboxMode') === 'true' || !db;
  const simulatedId = `wlog_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  // Find customer ID if not provided
  let customerId = inputCustomerId || '';
  if (!customerId && tenantId) {
    if (isSandboxMode) {
      try {
        const cachedCusts = localStorage.getItem(`customers_${tenantId}`) || '[]';
        const parsedCusts = JSON.parse(cachedCusts);
        const cleanRecipPhone = formattedPhone.replace(/\D/g, '');
        const matched = parsedCusts.find((c: any) => {
          const cPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
          return (cPhone && (cPhone.includes(cleanRecipPhone) || cleanRecipPhone.includes(cPhone))) ||
                 (c.name && c.name.toLowerCase() === recipientName.toLowerCase());
        });
        if (matched) {
          customerId = matched.id;
        } else {
          customerId = 'cust-1'; // Default backup matching SEED_CUSTOMERS
        }
      } catch (err) {
        console.error('Error matching customer in sandbox storage:', err);
        customerId = 'cust-1';
      }
    } else {
      try {
        const custsSnap = await getDocs(query(collection(db, 'tenants', tenantId, 'customers'), where('phone', '==', recipientPhone)));
        if (!custsSnap.empty) {
          customerId = custsSnap.docs[0].id;
        } else {
          const custsSnapName = await getDocs(query(collection(db, 'tenants', tenantId, 'customers'), where('name', '==', recipientName)));
          if (!custsSnapName.empty) {
            customerId = custsSnapName.docs[0].id;
          } else {
            customerId = 'cust-generic';
          }
        }
      } catch (e) {
        console.error('Error looking up customer in Firestore:', e);
        customerId = 'cust-generic';
      }
    }
  }

  // 1. Log the outbound message to the whatsappMessages collection as requested in Workflow 2
  const whatsappMessagesPayload = {
    tenantId,
    orderId: orderId || parameters.orderId || '',
    customerId,
    messageType: templateName === 'production_update' ? 'order_stage_update' : templateName,
    stage: parameters.stage || '',
    sentAt: isSandboxMode ? new Date().toISOString() : new Date().toISOString(),
    status: 'sent',
    message: messageContent
  };

  if (isSandboxMode && tenantId) {
    // Write sandbox message log to customer detail subcollection
    try {
      const waKey = `customer_whatsapp_${tenantId}_${customerId}`;
      const cachedM = localStorage.getItem(waKey);
      const mList = cachedM ? JSON.parse(cachedM) : [];
      mList.unshift({
        id: `wlog-${Date.now()}`,
        message: messageContent,
        sentAt: new Date().toLocaleDateString(),
        status: 'sent',
        type: templateName === 'production_update' ? 'order_stage_update' : templateName
      });
      localStorage.setItem(waKey, JSON.stringify(mList));

      // Also general sandbox list
      const centralWaMessagesKey = `whatsappMessages_${tenantId}`;
      const cachedCentralM = localStorage.getItem(centralWaMessagesKey) || '[]';
      const parsedCentralM = JSON.parse(cachedCentralM);
      parsedCentralM.unshift({
        id: `wmsg-${Date.now()}`,
        ...whatsappMessagesPayload
      });
      localStorage.setItem(centralWaMessagesKey, JSON.stringify(parsedCentralM));
    } catch (e) {
      console.error('Failed to log customer subcollection WhatsApp messages in sandbox localStorage:', e);
    }
  } else if (tenantId) {
    try {
      const waColRef = collection(db, 'tenants', tenantId, 'whatsappMessages');
      await addDoc(waColRef, whatsappMessagesPayload);
    } catch (e) {
      console.error('Error writing to tenants-level whatsappMessages collection:', e);
    }
  }

  // 2. The WhatsAppInboxPage should show this logged message in the conversation thread for that customer
  let convId = '';
  if (isSandboxMode && tenantId) {
    try {
      const convsKey = `whatsapp_convs_${tenantId}`;
      const convsCached = localStorage.getItem(convsKey);
      const convList = convsCached ? JSON.parse(convsCached) : [];
      
      const cleanTargetPhone = formattedPhone.replace(/\D/g, '');
      let matchedConv = convList.find((c: any) => c.phone.replace(/\D/g, '') === cleanTargetPhone);
      
      if (!matchedConv) {
        convId = `sim-conv-${Date.now()}`;
        matchedConv = {
          id: convId,
          tenantId,
          phone: recipientPhone,
          customerId,
          customerName: recipientName,
          lastMessage: messageContent,
          lastTimestamp: new Date().toISOString(),
          unreadCount: 0,
          status: 'active',
          createdAt: new Date().toISOString()
        };
        convList.push(matchedConv);
      } else {
        convId = matchedConv.id;
        matchedConv.lastMessage = messageContent;
        matchedConv.lastTimestamp = new Date().toISOString();
        if (!matchedConv.customerId && customerId) {
          matchedConv.customerId = customerId;
        }
      }
      localStorage.setItem(convsKey, JSON.stringify(convList));

      // Write code block message to this thread
      const threadKey = `whatsapp_messages_${tenantId}_${convId}`;
      const messagesCached = localStorage.getItem(threadKey);
      const messagesList = messagesCached ? JSON.parse(messagesCached) : [];
      messagesList.push({
        id: `m-${Date.now()}`,
        tenantId,
        conversationId: convId,
        senderPhone: 'FlowOps',
        recipientPhone,
        direction: 'outbound',
        message: messageContent,
        timestamp: new Date().toISOString(),
        status: 'read'
      });
      localStorage.setItem(threadKey, JSON.stringify(messagesList));
    } catch (e) {
      console.error('Failed to update sandbox conversation message thread:', e);
    }
  } else if (tenantId) {
    try {
      const convsCol = collection(db, 'tenants', tenantId, 'whatsappConversations');
      const q = query(convsCol, where('phone', '==', recipientPhone));
      const sRef = await getDocs(q);
      
      let matchedConvDocId = '';
      let existingConvData: any = null;
      sRef.forEach((snap) => {
        matchedConvDocId = snap.id;
        existingConvData = snap.data();
      });

      const timestampISO = new Date().toISOString();

      if (!matchedConvDocId) {
        const newDocRef = doc(collection(db, 'tenants', tenantId, 'whatsappConversations'));
        convId = newDocRef.id;
        existingConvData = {
          id: convId,
          tenantId,
          phone: recipientPhone,
          customerId,
          customerName: recipientName,
          lastMessage: messageContent,
          lastTimestamp: timestampISO,
          unreadCount: 0,
          status: 'active',
          createdAt: timestampISO
        };
        await setDoc(newDocRef, existingConvData);
      } else {
        convId = matchedConvDocId;
        await updateDoc(doc(db, 'tenants', tenantId, 'whatsappConversations', convId), {
          lastMessage: messageContent,
          lastTimestamp: timestampISO,
          customerId: customerId || existingConvData.customerId || null
        });
      }

      // Add message document to thread messages subcollection
      const msgRef = doc(collection(db, 'tenants', tenantId, 'whatsappConversations', convId, 'messages'));
      await setDoc(msgRef, {
        id: msgRef.id,
        tenantId,
        conversationId: convId,
        senderPhone: 'FlowOps',
        recipientPhone,
        direction: 'outbound',
        message: messageContent,
        timestamp: timestampISO,
        status: 'read'
      });
    } catch (e) {
      console.error('Error synchronizing chat inbox for outbound alert in live Firestore:', e);
    }
  }

  // Record standard log record
  if (isSandboxMode) {
    try {
      const cachedLogs = localStorage.getItem(`whatsapp_logs_${tenantId}`) || '[]';
      const parsed = JSON.parse(cachedLogs);
      const newLog = {
        id: simulatedId,
        tenantId,
        recipientName,
        recipientPhone: formattedPhone,
        message: messageContent,
        status: 'sent',
        type: templateName,
        sentAt: new Date().toISOString()
      };
      localStorage.setItem(`whatsapp_logs_${tenantId}`, JSON.stringify([newLog, ...parsed]));
    } catch (err) {
      console.error('Failed to log WhatsApp in sandbox localStorage:', err);
    }
  } else {
    const logPath = 'whatsappLogs';
    try {
      await addDoc(collection(db, logPath), {
        id: simulatedId,
        tenantId,
        recipientName,
        recipientPhone: formattedPhone,
        message: messageContent,
        status: 'sent', // Initially marked as successfully processed by BSP stub
        type: templateName,
        sentAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, logPath);
    }
  }

  // Record to unified activity audit timeline
  logActivityEvent({
    tenantId,
    actionType: 'whatsapp_sent',
    entityType: 'whatsapp',
    entityId: simulatedId,
    actor: {
      userId: auth.currentUser?.uid || 'system_whatsapp',
      displayName: auth.currentUser?.email || 'Automated System Alert'
    },
    description: `Dispatched WhatsApp "${templateName}" alerting customer "${recipientName}" (${formattedPhone}).`,
    metadata: {
      toStatus: 'sent',
      customerName: recipientName,
      templateName,
      recipientPhone: formattedPhone
    },
    isSandboxMode
  });

  return simulatedId;
}

/**
 * Workflow 6 trigger: When a new RFQ is saved, auto-acknowledge on WhatsApp
 */
export async function triggerRfqAutoAcknowledgement(
  tenantId: string,
  rfq: any,
  companyName?: string
) {
  try {
    const isSandboxMode = localStorage.getItem('isSandboxMode') === 'true' || !db;
    
    // Look up customer phone/WhatsApp number
    let recipientPhone = rfq.phone || rfq.customerPhone || '';
    let customerId = rfq.customerId || '';
    
    // If phone is missing, try looking up via customerId
    if (!recipientPhone && customerId && tenantId) {
      if (isSandboxMode) {
        try {
          const cachedCusts = localStorage.getItem(`customers_${tenantId}`) || '[]';
          const parsedCusts = JSON.parse(cachedCusts);
          const matched = parsedCusts.find((c: any) => c.id === customerId);
          if (matched && matched.phone) {
            recipientPhone = matched.phone;
          }
        } catch (e) {
          console.error('[Workflow 6] Sandbox customer lookup failed:', e);
        }
      } else {
        try {
          const custsSnap = await getDocs(query(collection(db, 'tenants', tenantId, 'customers'), where('id', '==', customerId)));
          if (!custsSnap.empty) {
            recipientPhone = custsSnap.docs[0].data().phone || '';
          }
        } catch (e) {
          console.error('[Workflow 6] Live customer lookup failed:', e);
        }
      }
    }

    // Default phone if none found
    if (!recipientPhone) {
      recipientPhone = '+91 98801 23456'; 
    }

    // Prepare products string
    let productName = 'engineering products';
    if (rfq.items && Array.isArray(rfq.items) && rfq.items.length > 0) {
      productName = rfq.items.map((i: any) => i.name).join(', ');
      if (productName.length > 60) {
        productName = productName.substring(0, 57) + '...';
      }
    }

    const rfqNumber = rfq.rfqNumber || rfq.id || '';

    await sendWhatsAppNotification({
      recipientName: rfq.customerName || 'Esteemed Customer',
      recipientPhone,
      templateName: 'rfq_received',
      tenantId,
      customerId,
      parameters: {
        customerName: rfq.customerName || 'Customer',
        productName,
        rfqNumber,
        companyName: companyName || 'Ashrey FlowWorks',
        rfqId: rfqNumber,
        tenantName: companyName || 'Ashrey FlowWorks'
      }
    });
  } catch (error) {
    console.error('Error triggering RFQ auto-acknowledgement:', error);
  }
}
