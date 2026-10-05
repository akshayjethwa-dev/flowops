// src/hooks/useCommunicationLog.ts

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
import { CommunicationLogEntry } from '../types';
import { useAuth } from './useAuth';

export const useCommunicationLog = (
  tenantId: string | undefined,
  customerId: string | undefined
) => {
  const [entries, setEntries] = useState<CommunicationLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

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
        const key = `communication_log_${tenantId}_${customerId}`;
        const cached = localStorage.getItem(key);
        let list: CommunicationLogEntry[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          // Sync existing WhatsApp messages or seed notes to timeline
          list = [
            {
              id: 'log-seed-1',
              tenantId,
              customerId,
              channel: 'note',
              direction: 'internal',
              message: 'Sales Rep Arjun initiated contact. Client requests price catalog of casting valves.',
              timestamp: new Date(Date.now() - 3600000 * 24 * 6).toISOString(),
              author: {
                userId: 'user_demo_arjun',
                displayName: 'Arjun Sen'
              }
            },
            {
              id: 'log-seed-2',
              tenantId,
              customerId,
              channel: 'whatsapp',
              direction: 'outbound',
              message: 'Hi Anil, we have received your purchase allocation. Order ORD-2026-1011 is officially loaded on the Shopfloor pipeline!',
              timestamp: new Date(Date.now() - 3600000 * 24 * 10).toISOString(),
              author: {
                userId: 'system',
                displayName: 'Ashrey Bot'
              },
              linkedEntityId: 'ORD-2026-1011',
              linkedEntityType: 'order'
            }
          ];
          localStorage.setItem(key, JSON.stringify(list));
        }

        // Sort: newest first
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setEntries(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandbox log');
        setLoading(false);
      }
    } else {
      try {
        const colRef = collection(db, 'tenants', tenantId, 'customers', customerId, 'communicationLog');
        const q = query(colRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: CommunicationLogEntry[] = [];
          snapshot.forEach((snap) => {
            const data = snap.data();
            list.push({
              id: snap.id,
              ...data,
              timestamp: data.timestamp ? (data.timestamp.seconds ? new Date(data.timestamp.seconds * 1000).toISOString() : data.timestamp) : new Date().toISOString()
            } as CommunicationLogEntry);
          });
          setEntries(list);
          setLoading(false);
        }, (err) => {
          setError(err.message || 'Error fetching live communication logs');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error initializing connection log stream');
        setLoading(false);
      }
    }
  }, [tenantId, customerId]);

  const addLogEntry = useCallback(async (
    entry: Omit<CommunicationLogEntry, 'id' | 'tenantId' | 'customerId' | 'timestamp' | 'author'>
  ) => {
    if (!tenantId || !customerId) throw new Error('Missing tenant or customer references');

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const author = {
      userId: profile?.uid || 'logged-in-user',
      displayName: profile?.name || 'User Agent'
    };

    const finalEntry: Omit<CommunicationLogEntry, 'id'> = {
      ...entry,
      tenantId,
      customerId,
      timestamp: isSandbox ? new Date().toISOString() : serverTimestamp(),
      author
    };

    if (isSandbox) {
      const key = `communication_log_${tenantId}_${customerId}`;
      const cached = localStorage.getItem(key);
      const list: CommunicationLogEntry[] = cached ? JSON.parse(cached) : [];

      const newRecord: CommunicationLogEntry = {
        ...finalEntry,
        id: `log-${Date.now()}`
      };

      const updated = [newRecord, ...list];
      localStorage.setItem(key, JSON.stringify(updated));
      setEntries(updated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      return newRecord;
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'customers', customerId, 'communicationLog');
      const docRef = await addDoc(colRef, finalEntry);
      return { ...finalEntry, id: docRef.id } as CommunicationLogEntry;
    }
  }, [tenantId, customerId, profile]);

  return { entries, loading, error, addLogEntry };
};
