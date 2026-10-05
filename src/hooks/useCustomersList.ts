// src/hooks/useCustomersList.ts

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
  serverTimestamp 
} from 'firebase/firestore';
import { Customer } from '../types';

export const useCustomersList = (
  tenantId: string | undefined, 
  filters?: { type?: 'customer' | 'dealer' | ''; search?: string }
) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Default mock seeds for sandbox
  const SEED_CUSTOMERS: Customer[] = [
    {
      id: 'cust-1',
      tenantId: tenantId || 'demo',
      name: 'Kirloskar Industrial Distributors',
      type: 'dealer',
      contactPerson: 'Anil Kulkarni',
      phone: '9880123456',
      email: 'anil@kirloskar-dist.in',
      city: 'Pune',
      billingAddress: '102 Industrial Area, MIDC Phase 2, Pune, MH - 411018',
      shippingAddress: 'Warehouse B, Plot 45, MIDC, Pune, MH - 411018',
      gstNumber: '27AAAAA1111A1Z1',
      notes: 'High-volume regional distributor for Western India. Prefers Lorry transport.',
      tags: ['Priority', 'Distributor'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'cust-2',
      tenantId: tenantId || 'demo',
      name: 'Techno Welds India Pvt Ltd',
      type: 'customer',
      contactPerson: 'Rajesh Sharma',
      phone: '9123456780',
      email: 'rsharma@technowelds.co.in',
      city: 'Jamshedpur',
      billingAddress: 'Building 4B, Industrial Estate, Adityapur, Jamshedpur, JH - 832109',
      shippingAddress: 'Plant 1 Receiving Dock, Jamshedpur, JH - 832109',
      gstNumber: '20BBBBB2222B2Z2',
      notes: 'Regular prompt payment customer. Procures steel wire and joints.',
      tags: ['Regular', 'Loyal'],
      createdAt: new Date().toISOString()
    },
    {
      id: 'cust-3',
      tenantId: tenantId || 'demo',
      name: 'L&T Heavy Engineering Co.',
      type: 'customer',
      contactPerson: 'Vikram Mehta',
      phone: '9820098765',
      email: 'v.mehta@heavyeng.lnte.com',
      city: 'Surat',
      billingAddress: 'L&T Campus, Gate 3, Hazira Road, Surat, GJ - 394270',
      shippingAddress: 'Hazira Manufacturing Complex, Workshop 5, Surat, GJ - 394270',
      gstNumber: '24CCCCC3333C3Z3',
      notes: 'Requires detailed technical inspection reports with all dispatch shipments.',
      tags: ['MNC', 'Strict QA'],
      createdAt: new Date().toISOString()
    }
  ];

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
        const key = `customers_${tenantId}`;
        const cached = localStorage.getItem(key);
        let list: Customer[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          list = SEED_CUSTOMERS;
          localStorage.setItem(key, JSON.stringify(list));
        }

        setCustomers(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandbox customers');
        setLoading(false);
      }
    } else {
      // Production live sync: /tenants/{tenantId}/customers
      try {
        const colRef = collection(db, 'tenants', tenantId, 'customers');
        const unsubscribe = onSnapshot(colRef, (snapshot) => {
          const list: Customer[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as Customer);
          });
          setCustomers(list);
          setLoading(false);
        }, (err) => {
          setError(err.message || 'Error subscribing to customer subcollection');
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message || 'Error establishing Firebase customer pipe');
        setLoading(false);
      }
    }
  }, [tenantId]);

  // Operations: Add Customer
  const addCustomer = useCallback(async (newCust: Omit<Customer, 'tenantId'>): Promise<Customer> => {
    if (!tenantId) throw new Error('No tenant detected');
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    const finalCust: Customer = {
      ...newCust,
      tenantId,
      createdAt: isSandbox ? new Date().toISOString() : serverTimestamp()
    };

    if (isSandbox) {
      const key = `customers_${tenantId}`;
      const cached = localStorage.getItem(key);
      const currentList: Customer[] = cached ? JSON.parse(cached) : [];
      
      const newDocId = `cust-${Date.now()}`;
      const record = { ...finalCust, id: newDocId };
      const updatedList = [record, ...currentList];
      
      localStorage.setItem(key, JSON.stringify(updatedList));
      setCustomers(updatedList);
      return record;
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'customers');
      const docRef = await addDoc(colRef, finalCust);
      const record = { ...finalCust, id: docRef.id };
      return record;
    }
  }, [tenantId]);

  // Operations: Update Customer
  const updateCustomer = useCallback(async (id: string, updatedFields: Partial<Customer>) => {
    if (!tenantId) throw new Error('No tenant detected');
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = `customers_${tenantId}`;
      const cached = localStorage.getItem(key);
      const currentList: Customer[] = cached ? JSON.parse(cached) : [];
      
      const updatedList = currentList.map(item => {
        if (item.id === id) {
          return { ...item, ...updatedFields };
        }
        return item;
      });

      localStorage.setItem(key, JSON.stringify(updatedList));
      setCustomers(updatedList);
    } else {
      const docRef = doc(db, 'tenants', tenantId, 'customers', id);
      await updateDoc(docRef, {
        ...updatedFields,
        updatedAt: serverTimestamp()
      });
    }
  }, [tenantId]);

  // Operations: Delete Customer
  const deleteCustomer = useCallback(async (id: string) => {
    if (!tenantId) throw new Error('No tenant detected');
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const key = `customers_${tenantId}`;
      const cached = localStorage.getItem(key);
      const currentList: Customer[] = cached ? JSON.parse(cached) : [];
      
      const updatedList = currentList.filter(item => item.id !== id);

      localStorage.setItem(key, JSON.stringify(updatedList));
      setCustomers(updatedList);
    } else {
      const docRef = doc(db, 'tenants', tenantId, 'customers', id);
      await deleteDoc(docRef);
    }
  }, [tenantId]);

  // Filter clients locally for super speedy instant UI updates
  const filteredCustomers = customers.filter(customer => {
    if (!customer) return false;
    
    // 1. Filter by Type (customer or dealer)
    if (filters?.type && customer.type !== filters.type) {
      return false;
    }

    // 2. Filter by search input (matching name, contact person, phone, email, or city)
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      const nameMatch = customer.name?.toLowerCase().includes(s);
      const contactMatch = customer.contactPerson?.toLowerCase().includes(s);
      const phoneMatch = customer.phone?.toLowerCase().includes(s);
      const emailMatch = customer.email?.toLowerCase().includes(s);
      const cityMatch = customer.city?.toLowerCase().includes(s);
      
      if (!nameMatch && !contactMatch && !phoneMatch && !emailMatch && !cityMatch) {
        return false;
      }
    }

    return true;
  });

  return { 
    customers: filteredCustomers, 
    rawCustomers: customers,
    loading, 
    error, 
    addCustomer, 
    updateCustomer, 
    deleteCustomer 
  };
};
