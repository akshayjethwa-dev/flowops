// src/hooks/useActivityEvents.ts

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, where, limit } from 'firebase/firestore';
import { useAuth } from './useAuth';
import { ActivityEvent } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

export const useActivityEvents = (options?: {
  entityId?: string;
  entityType?: string;
  maxLimit?: number;
}) => {
  const { tenant } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSandboxMode = localStorage.getItem('isSandboxMode') === 'true' || !db;

  useEffect(() => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (isSandboxMode) {
      try {
        const fetchSandboxLogs = () => {
          const cached = localStorage.getItem(`flowops_activity_${tenant.id}`) || localStorage.getItem(`activity_logs_${tenant.id}`);
          let parsed: ActivityEvent[] = cached ? JSON.parse(cached) : [];
          
          // Seed initial logs if completely empty to give a rich startup experience
          if (parsed.length === 0) {
            parsed = [
              {
                id: 'init_act_1',
                tenantId: tenant.id,
                actionType: 'create',
                entityType: 'user',
                entityId: 'admin_user',
                actor: { userId: 'system', displayName: 'System Engine' },
                timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
                description: 'Workspace successfully initialized for industrial automation scope.',
                metadata: { role: 'admin' }
              },
              {
                id: 'init_act_2',
                tenantId: tenant.id,
                actionType: 'create',
                entityType: 'rfq',
                entityId: 'rfq_889102',
                actor: { userId: 'sales_rep', displayName: 'Karnik Sen' },
                timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
                description: 'Parsed incoming digital RFQ for customer "TATA Precision Motors".',
                metadata: { customerName: 'TATA Precision Motors', rfqNumber: 'RFQ-889102' }
              },
              {
                id: 'init_act_3',
                tenantId: tenant.id,
                actionType: 'whatsapp_sent',
                entityType: 'whatsapp',
                entityId: 'wlog_1001',
                actor: { userId: 'system_whatsapp', displayName: 'Automated BSP System' },
                timestamp: new Date(Date.now() - 3.8 * 3600 * 1000).toISOString(),
                description: 'Dispatched automated WhatsApp notification confirming rfq_received to TATA rep.',
                metadata: { templateName: 'rfq_received', customerName: 'TATA Precision Motors' }
              }
            ];
            localStorage.setItem(`flowops_activity_${tenant.id}`, JSON.stringify(parsed));
          }

          // Apply filters
          if (options?.entityType) {
            const targetType = options.entityType.toLowerCase();
            parsed = parsed.filter(e => 
              (e.entityType && e.entityType.toLowerCase() === targetType) ||
              ((e as any).module && (e as any).module.toLowerCase() === targetType)
            );
          }
          if (options?.entityId) {
            parsed = parsed.filter(e => e.entityId === options.entityId);
          }

          // Sort descending by timestamp
          parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          // Apply limit
          if (options?.maxLimit) {
            parsed = parsed.slice(0, options.maxLimit);
          }

          setEvents(parsed);
          setLoading(false);
        };

        // Listen for local changes by polling local storage or just doing simple subscription style fetch
        fetchSandboxLogs();
        const interval = setInterval(fetchSandboxLogs, 1500); // quick polling for sandbox updates
        return () => clearInterval(interval);

      } catch (err: any) {
        console.error('Error in sandboxed activity timeline stream', err);
        setError('Error reading local sandbox activity logs.');
        setLoading(false);
      }
    } else {
      // Production Firestore root 'activityLog' stream
      try {
        const colRef = collection(db, 'activityLog');
        // Simple query with tenantId only to avoid composite index failure
        const q = query(colRef, where('tenantId', '==', tenant.id));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          let list: ActivityEvent[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              ...data,
              timestamp: data.timestamp?.seconds 
                ? new Date(data.timestamp.seconds * 1000).toISOString() 
                : data.timestamp || new Date().toISOString()
            } as ActivityEvent);
          });

          // Sort descending by timestamp client side to prevent composite index errors
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          // Secondary filtering for entityType client side
          if (options?.entityType) {
            const targetType = options.entityType.toLowerCase();
            list = list.filter(e => 
              (e.entityType && e.entityType.toLowerCase() === targetType) ||
              ((e as any).module && (e as any).module.toLowerCase() === targetType)
            );
          }

          // Secondary filtering for entityId client side
          if (options?.entityId) {
            list = list.filter(e => e.entityId === options.entityId);
          }

          // Apply max limit client side
          if (options?.maxLimit) {
            list = list.slice(0, options.maxLimit);
          }

          setEvents(list);
          setLoading(false);
        }, (err) => {
          console.error('Failed to stream Firestore activity', err);
          setError('Failed to fetch realtime activities.');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Firestore connection issue.');
        setLoading(false);
      }
    }
  }, [tenant?.id, options?.entityId, options?.entityType, options?.maxLimit]);

  return { events, loading, error };
};
