// src/hooks/useNotifications.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  writeBatch, 
  query, 
  where
} from 'firebase/firestore';
import { AppNotification, NotificationType } from '../types';
import { useAuth } from './useAuth';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

export const SEED_NOTIFICATIONS = (tenantId: string, userId: string): AppNotification[] => [
  {
    id: 'notif-1',
    tenantId,
    userId: 'all',
    type: 'payment_overdue',
    title: 'Payment Overdue',
    message: 'BHEL invoice INV-001 of ₹2,45,000 is 15 days overdue',
    entityId: 'INV-001',
    entityType: 'payment',
    link: '/payments',
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    id: 'notif-2',
    tenantId,
    userId,
    type: 'low_stock',
    title: 'Low Stock Alert',
    message: 'Forged Crankshaft — CS-FC300 has fallen below the minimum stock of 200 units (Current: 120)',
    entityId: 'stock-2',
    entityType: 'inventory',
    link: '/inventory',
    read: false,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString() // 5 hours ago
  },
  {
    id: 'notif-3',
    tenantId,
    userId: 'all',
    type: 'new_rfq',
    title: 'New RFQ Received',
    message: 'New RFQ received from Tata Motors for custom forged crankshaft blocks',
    entityId: 'rfq-demo-1',
    entityType: 'rfq',
    link: '/rfqs',
    read: true,
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString() // 1 day ago
  }
];

export const useNotifications = () => {
  const { profile, tenant } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const tenantId = tenant?.id;
  const userId = profile?.uid;

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  useEffect(() => {
    if (!tenantId || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (isSandbox) {
      try {
        const key = `flowops_notifications_${tenantId}`;
        const cached = localStorage.getItem(key);
        let list: AppNotification[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          list = SEED_NOTIFICATIONS(tenantId, userId);
          localStorage.setItem(key, JSON.stringify(list));
        }

        // Filter notifications by user visibility
        const filtered = list.filter(n => n.userId === userId || n.userId === 'all');
        
        // Sort descending by creation date
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setNotifications(filtered);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandboxed notifications.');
        setLoading(false);
      }
    } else {
      // Direct Firestore Sync: subscribe to notifications collection matching tenantId
      const colRef = collection(db, 'notifications');
      const q = query(colRef, where('tenantId', '==', tenantId));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let list: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.seconds 
              ? new Date(data.createdAt.seconds * 1000).toISOString() 
              : data.createdAt || new Date().toISOString()
          } as AppNotification);
        });

        // Seed live DB once if totally empty so we always have initial sample notifications
        if (list.length === 0) {
          const seeds = SEED_NOTIFICATIONS(tenantId, userId);
          seeds.forEach(async (seed) => {
            try {
              const seedRef = doc(db, 'notifications', seed.id);
              // Store exactly with JS strings/dates for simple compatibility
              await updateDoc(seedRef, {
                ...seed,
                createdAt: new Date(seed.createdAt)
              }).catch(async () => {
                // Set block fallback if get failed or update failed due to doc missing
                const { setDoc } = await import('firebase/firestore');
                await setDoc(seedRef, {
                  ...seed,
                  createdAt: new Date(seed.createdAt)
                });
              });
            } catch (se) {
              console.warn('Failed to commit notification seed', se);
            }
          });
          setNotifications(seeds.filter(n => n.userId === userId || n.userId === 'all'));
        } else {
          // Filter by user visibility
          const filtered = list.filter(n => n.userId === userId || n.userId === 'all');
          
          // Sort descending
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          setNotifications(filtered);
        }
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [tenantId, userId, isSandbox]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    if (!tenantId || !userId) return;

    if (isSandbox) {
      const key = `flowops_notifications_${tenantId}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed: AppNotification[] = JSON.parse(cached);
        const updated = parsed.map(n => n.id === id ? { ...n, read: true } : n);
        localStorage.setItem(key, JSON.stringify(updated));
        
        const filtered = updated.filter(n => n.userId === userId || n.userId === 'all');
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(filtered);
      }
    } else {
      try {
        const docRef = doc(db, 'notifications', id);
        await updateDoc(docRef, { read: true });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
      }
    }
  }, [tenantId, userId, isSandbox]);

  // Mark all filtered notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!tenantId || !userId || notifications.length === 0) return;

    const unreadList = notifications.filter(n => !n.read);
    if (unreadList.length === 0) return;

    if (isSandbox) {
      const key = `flowops_notifications_${tenantId}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed: AppNotification[] = JSON.parse(cached);
        const updated = parsed.map(n => {
          if (unreadList.some(ul => ul.id === n.id)) {
            return { ...n, read: true };
          }
          return n;
        });
        localStorage.setItem(key, JSON.stringify(updated));

        const filtered = updated.filter(n => n.userId === userId || n.userId === 'all');
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(filtered);
      }
    } else {
      try {
        const batch = writeBatch(db);
        unreadList.forEach(n => {
          const docRef = doc(db, 'notifications', n.id);
          batch.update(docRef, { read: true });
        });
        await batch.commit();
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, 'notifications/batch-read');
      }
    }
  }, [tenantId, userId, notifications, isSandbox]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead
  };
};
