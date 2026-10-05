// src/hooks/useConversationThread.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { WhatsAppMessage, CommunicationLogEntry, WhatsAppConversation } from '../types';
import { useAuth } from './useAuth';

export const useConversationThread = (
  tenantId: string | undefined,
  conversationId: string | undefined,
  conversation?: WhatsAppConversation // Optional to help identify customers & phone
) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  const getLocalStorageKey = useCallback(() => `whatsapp_messages_${tenantId}_${conversationId}`, [tenantId, conversationId]);

  // Sync / Listen to Messages
  useEffect(() => {
    if (!tenantId || !conversationId) {
      setMessages([]);
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
        let list: WhatsAppMessage[] = cached ? JSON.parse(cached) : [];

        // Sort: oldest first for a chatting feed thread inside the viewport
        list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setMessages(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading message sandbox list');
        setLoading(false);
      }
    } else {
      try {
        const colRef = collection(db, 'tenants', tenantId, 'whatsappConversations', conversationId, 'messages');
        const q = query(colRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: WhatsAppMessage[] = [];
          snapshot.forEach((snap) => {
            const data = snap.data();
            list.push({
              id: snap.id,
              ...data,
              timestamp: data.timestamp ? (data.timestamp.seconds ? new Date(data.timestamp.seconds * 1000).toISOString() : data.timestamp) : new Date().toISOString()
            } as WhatsAppMessage);
          });
          setMessages(list);
          setLoading(false);
        }, (err) => {
          console.error(`Error loading live thread: ${conversationId}`, err);
          setError(err.message || 'Error fetching WhatsApp message thread');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error initializing live message thread stream');
        setLoading(false);
      }
    }
  }, [tenantId, conversationId, getLocalStorageKey]);

  // MUTATION: Send Outbound Message
  const sendMessage = useCallback(async (
    text: string, 
    templateName?: string, 
    templateVariables?: string[]
  ) => {
    if (!tenantId || !conversationId) throw new Error('Missing tenant or active conversation identifiers');

    const cleanMsg = text.trim();
    if (!cleanMsg) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const authorName = profile?.name || 'Sales Agent';
    const recipientPhone = conversation?.phone || '+91 99999 88888';
    
    const timestampObj = isSandbox ? new Date().toISOString() : new Date().toISOString(); 
    const finalMsg: Omit<WhatsAppMessage, 'id'> = {
      tenantId,
      conversationId,
      senderPhone: 'FlowOps',
      recipientPhone,
      direction: 'outbound',
      message: cleanMsg,
      timestamp: timestampObj,
      status: 'pending', // Starts pending, then updates simulating BSP callback updates
      ...(templateName ? { templateName, templateVariables } : {})
    };

    if (isSandbox) {
      // 1. Save new message to thread
      const threadKey = getLocalStorageKey();
      const messagesCached = localStorage.getItem(threadKey);
      const list: WhatsAppMessage[] = messagesCached ? JSON.parse(messagesCached) : [];

      const newMsgId = `m-${Date.now()}`;
      const newMsg: WhatsAppMessage = {
        ...finalMsg,
        id: newMsgId,
        status: 'sent' // Instant sandbox status
      };

      const updated = [...list, newMsg];
      localStorage.setItem(threadKey, JSON.stringify(updated));
      setMessages(updated);

      // 2. Update parents lastMessage, lastTimestamp
      const convsKey = `whatsapp_convs_${tenantId}`;
      const convsCached = localStorage.getItem(convsKey);
      if (convsCached) {
        const convList: WhatsAppConversation[] = JSON.parse(convsCached);
        const updatedConvs = convList.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              lastMessage: cleanMsg,
              lastTimestamp: timestampObj,
              unreadCount: 0 // sending a message resets unread counts
            } as WhatsAppConversation;
          }
          return c;
        });
        localStorage.setItem(convsKey, JSON.stringify(updatedConvs));
      }

      // 3. Update communication log under customer if matched
      if (conversation?.customerId) {
        const commLogKey = `communication_log_${tenantId}_${conversation.customerId}`;
        const commListCached = localStorage.getItem(commLogKey);
        const commList: CommunicationLogEntry[] = commListCached ? JSON.parse(commListCached) : [];
        const newCommEntry: CommunicationLogEntry = {
          id: `log-wa-${Date.now()}`,
          tenantId,
          customerId: conversation.customerId,
          channel: 'whatsapp',
          direction: 'outbound',
          message: cleanMsg,
          timestamp: timestampObj,
          author: {
            userId: profile?.uid || 'rep',
            displayName: authorName
          }
        };
        localStorage.setItem(commLogKey, JSON.stringify([newCommEntry, ...commList]));
      }

      // Simulate webhook status changes: single tick (delivered) and double check (read) after 1.5s
      setTimeout(() => {
        const messagesLatest = localStorage.getItem(threadKey);
        if (messagesLatest) {
          const listReloaded: WhatsAppMessage[] = JSON.parse(messagesLatest);
          const finishedList = listReloaded.map((msg) => {
            if (msg.id === newMsgId) {
              return { ...msg, status: 'read' } as WhatsAppMessage;
            }
            return msg;
          });
          localStorage.setItem(threadKey, JSON.stringify(finishedList));
          // If the conversation is still active, update current screen
          setMessages(finishedList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
        }
      }, 1500);

      return newMsg;
    } else {
      // LIVE Firestore
      // 1. Add Message to thread subcollection
      const msgRef = doc(collection(db, 'tenants', tenantId, 'whatsappConversations', conversationId, 'messages'));
      const activeMsg: WhatsAppMessage = {
        ...finalMsg,
        id: msgRef.id,
        status: 'sent'
      };
      await setDoc(msgRef, activeMsg);

      // 2. Update parent conversation with details
      const parentRef = doc(db, 'tenants', tenantId, 'whatsappConversations', conversationId);
      await updateDoc(parentRef, {
        lastMessage: cleanMsg,
        lastTimestamp: timestampObj,
        unreadCount: 0
      });

      // 3. Update customer timeline communicationLog subcollection
      if (conversation?.customerId) {
        const customerCommLogRef = collection(db, 'tenants', tenantId, 'customers', conversation.customerId, 'communicationLog');
        await addDoc(customerCommLogRef, {
          tenantId,
          customerId: conversation.customerId,
          channel: 'whatsapp',
          direction: 'outbound',
          message: cleanMsg,
          timestamp: timestampObj,
          author: {
            userId: profile?.uid || 'system',
            displayName: authorName
          }
        });
      }

      return activeMsg;
    }
  }, [tenantId, conversationId, conversation, getLocalStorageKey, profile]);

  return {
    messages,
    loading,
    error,
    sendMessage
  };
};
