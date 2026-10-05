// src/hooks/useTenantConfig.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { TenantConfig, Tenant } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { useAuth } from './useAuth';

export const useTenantConfig = (tenantId: string | undefined) => {
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  const isAdmin = profile?.role === 'admin';

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
        const cached = localStorage.getItem('flowops_sandbox_tenant');
        if (cached) {
          const parsed = JSON.parse(cached);
          setTenantConfig({
            tenantName: parsed.companyName || parsed.tenantName || 'Ashrey Castings & Forging',
            address: parsed.address || 'Industrial Area Phase 2, Chikhli, Pune, MH',
            gstNumber: parsed.gstin || parsed.gstNumber || '27AADCA1112B1Z1',
            contactEmail: parsed.contactEmail || 'admin@ashreyforge.co.in',
            contactPhone: parsed.phone || parsed.contactPhone || '+91 20 612345',
            timeZone: parsed.timeZone || 'Asia/Kolkata',
            defaultCurrency: parsed.currency || parsed.defaultCurrency || 'INR (₹)',
            onboardingCompleted: parsed.onboardingCompleted || false,
            onboardingState: parsed.onboardingState || null
          });
        } else {
          // Default fallbacks
          setTenantConfig({
            tenantName: 'Ashrey Castings & Forging',
            address: 'Industrial Area Phase 2, Chikhli, Pune, MH',
            gstNumber: '27AADCA1112B1Z1',
            contactEmail: 'admin@ashreyforge.co.in',
            contactPhone: '+91 20 612345',
            timeZone: 'Asia/Kolkata',
            defaultCurrency: 'INR (₹)',
            onboardingCompleted: false,
            onboardingState: null
          });
        }
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error parsing sandbox tenant settings');
        setLoading(false);
      }
    } else {
      const fetchLive = async () => {
        try {
          const tDoc = await getDoc(doc(db, 'tenants', tenantId));
          if (tDoc.exists()) {
            const data = tDoc.data();
            setTenantConfig({
              tenantName: data.companyName || data.tenantName || 'Ashrey Castings & Forging',
              address: data.address || 'Industrial Area Phase 2, Chikhli, Pune, MH',
              gstNumber: data.gstin || data.gstNumber || '',
              contactEmail: data.contactEmail || '',
              contactPhone: data.phone || data.contactPhone || '',
              timeZone: data.timeZone || 'Asia/Kolkata',
              defaultCurrency: data.currency || data.defaultCurrency || 'INR (₹)',
              onboardingCompleted: data.onboardingCompleted || false,
              onboardingState: data.onboardingState || null
            });
          } else {
            // Default configuration if doesn't exist
            setTenantConfig({
              tenantName: 'Ashrey Castings & Forging',
              address: 'Industrial Area Phase 2, Chikhli, Pune, MH',
              gstNumber: '27AADCA1112B1Z1',
              contactEmail: 'admin@ashreyforge.co.in',
              contactPhone: '+91 20 612345',
              timeZone: 'Asia/Kolkata',
              defaultCurrency: 'INR (₹)'
            });
          }
        } catch (err: any) {
          handleFirestoreError(err, OperationType.GET, `tenants/${tenantId}`);
        } finally {
          setLoading(false);
        }
      };
      fetchLive();
    }
  }, [tenantId]);

  const saveTenantConfig = useCallback(async (updates: TenantConfig) => {
    if (!tenantId) return;
    if (!isAdmin) {
      throw new Error('Only Admin users hold clearance to alter corporate profiles.');
    }

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      // Keep sandbox synced in multiple components
      const cached = localStorage.getItem('flowops_sandbox_tenant') || '{}';
      const parsed = JSON.parse(cached);
      
      const updatedTenant: Tenant = {
        ...parsed,
        companyName: updates.tenantName,
        gstin: updates.gstNumber,
        address: updates.address,
        phone: updates.contactPhone,
        currency: updates.defaultCurrency.includes('₹') ? '₹' : updates.defaultCurrency.split(' ')[0],
        onboardingCompleted: updates.onboardingCompleted,
        onboardingState: updates.onboardingState
      };

      localStorage.setItem('flowops_sandbox_tenant', JSON.stringify(updatedTenant));
      // Trigger a storage event to alert other context listeners
      window.dispatchEvent(new Event('storage'));
      
      setTenantConfig(updates);
    } else {
      try {
        const docRef = doc(db, 'tenants', tenantId);
        await setDoc(docRef, {
          companyName: updates.tenantName,
          gstin: updates.gstNumber,
          address: updates.address,
          phone: updates.contactPhone,
          contactEmail: updates.contactEmail,
          timeZone: updates.timeZone,
          currency: updates.defaultCurrency.includes('₹') ? '₹' : updates.defaultCurrency.split(' ')[0],
          defaultCurrency: updates.defaultCurrency,
          onboardingCompleted: updates.onboardingCompleted ?? false,
          onboardingState: updates.onboardingState ?? null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        
        setTenantConfig(updates);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `tenants/${tenantId}`);
      }
    }
  }, [tenantId, isAdmin]);

  return { tenantConfig, loading, error, saveTenantConfig, isAdmin };
};
