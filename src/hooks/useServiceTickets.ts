// src/hooks/useServiceTickets.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { useAuth } from './useAuth';

export interface ServiceTicket {
  id: string;
  tenantId: string;
  customerId?: string;
  customerName: string;
  phone: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved';
  assignedUserId?: string;
  assignedUserName?: string;
  conversationId?: string;
  createdAt: string;
}

export const useServiceTickets = (tenantId: string | undefined) => {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getLocalStorageKey = useCallback(() => `service_tickets_${tenantId}`, [tenantId]);

  // Read Service Tickets
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
        let list: ServiceTicket[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          // Defaults for demo
          const now = new Date();
          list = [
            {
              id: 'TKT-001',
              tenantId,
              customerId: 'CUST-002',
              customerName: 'Sunil Sharma (Sharma Pipelines)',
              phone: '+91 76543 21098',
              subject: 'Consignment damaged on package 5',
              description: 'Customer reported that box 5 of direct delivery arrived loaded with deep gashes and joint breaches.',
              priority: 'high',
              status: 'open',
              assignedUserId: 'user-arj-10',
              assignedUserName: 'Arjun Sales',
              createdAt: new Date(now.getTime() - 2 * 3600000).toISOString()
            }
          ];
          localStorage.setItem(key, JSON.stringify(list));
        }

        // Newer tickets first
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTickets(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandbox service tickets');
        setLoading(false);
      }
    } else {
      try {
        const colRef = collection(db, 'tenants', tenantId, 'serviceTickets');
        const unsubscribe = onSnapshot(colRef, (snapshot) => {
          const list: ServiceTicket[] = [];
          snapshot.forEach((snap) => {
            const data = snap.data();
            list.push({
              id: snap.id,
              ...data,
              createdAt: data.createdAt || new Date().toISOString()
            } as ServiceTicket);
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setTickets(list);
          setLoading(false);
        }, (err) => {
          console.error('Error fetching live service tickets', err);
          setError(err.message || 'Error fetching service tickets');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error initializing live service tickets stream');
        setLoading(false);
      }
    }
  }, [tenantId, getLocalStorageKey]);

  // Add Service Ticket
  const addServiceTicket = useCallback(async (payload: Omit<ServiceTicket, 'id' | 'tenantId' | 'createdAt'>) => {
    if (!tenantId) return null;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const ticketId = `TKT-${Math.floor(100 + Math.random() * 900)}`;
    const createdAt = new Date().toISOString();

    const newTicket: ServiceTicket = {
      id: ticketId,
      tenantId,
      createdAt,
      ...payload
    };

    if (isSandbox) {
      const key = getLocalStorageKey();
      const cached = localStorage.getItem(key);
      const list: ServiceTicket[] = cached ? JSON.parse(cached) : [];
      list.push(newTicket);
      localStorage.setItem(key, JSON.stringify(list));

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTickets(list);
    } else {
      const docRef = doc(db, 'tenants', tenantId, 'serviceTickets', ticketId);
      await setDoc(docRef, newTicket);
    }

    return newTicket;
  }, [tenantId, getLocalStorageKey]);

  // Update Status
  const updateTicketStatus = useCallback(async (ticketId: string, status: 'open' | 'in_progress' | 'resolved') => {
    if (!tenantId) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = getLocalStorageKey();
      const cached = localStorage.getItem(key);
      if (cached) {
        const list: ServiceTicket[] = JSON.parse(cached);
        const updated = list.map((t) => {
          if (t.id === ticketId) {
            return { ...t, status } as ServiceTicket;
          }
          return t;
        });
        localStorage.setItem(key, JSON.stringify(updated));
        setTickets(updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } else {
      const docRef = doc(db, 'tenants', tenantId, 'serviceTickets', ticketId);
      await updateDoc(docRef, { status });
    }
  }, [tenantId, getLocalStorageKey]);

  return {
    tickets,
    loading,
    error,
    addServiceTicket,
    updateTicketStatus
  };
};
