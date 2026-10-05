// src/hooks/useProductionStagesConfig.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  writeBatch,
  getDocs,
  where
} from 'firebase/firestore';
import { ProductionStageConfig } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { useAuth } from './useAuth';

const DEFAULT_STAGES: Omit<ProductionStageConfig, 'id'>[] = [
  { name: 'Material Cutting', color: 'indigo', isFinalStage: false, order: 0 },
  { name: 'Pre-Heating & Welding', color: 'blue', isFinalStage: false, order: 1 },
  { name: 'Precision Machining', color: 'amber', isFinalStage: false, order: 2 },
  { name: 'Shopfloor Assembly', color: 'purple', isFinalStage: false, order: 3 },
  { name: 'NDT & Quality Check', color: 'pink', isFinalStage: false, order: 4 },
  { name: 'Ready for Dispatch', color: 'green', isFinalStage: true, order: 5 }
];

export const useProductionStagesConfig = (tenantId: string | undefined) => {
  const [stages, setStages] = useState<ProductionStageConfig[]>([]);
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
        const cached = localStorage.getItem(`flowops_stages_${tenantId}`);
        if (cached) {
          setStages(JSON.parse(cached));
        } else {
          // Initialize defaults
          const initial: ProductionStageConfig[] = DEFAULT_STAGES.map((s, idx) => ({
            id: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            ...s
          }));
          localStorage.setItem(`flowops_stages_${tenantId}`, JSON.stringify(initial));
          setStages(initial);
        }
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error processing sandbox stages');
        setLoading(false);
      }
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'productionStages');
      const q = query(colRef, orderBy('order', 'asc'));

      const unsubscribe = onSnapshot(q, async (snap) => {
        let list: ProductionStageConfig[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as ProductionStageConfig);
        });

        if (list.length === 0) {
          // Auto-seed in firestore
          try {
            const batch = writeBatch(db);
            const initial: ProductionStageConfig[] = DEFAULT_STAGES.map((s, idx) => {
              const docId = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
              const dRef = doc(db, 'tenants', tenantId, 'productionStages', docId);
              batch.set(dRef, s);
              return { id: docId, ...s };
            });
            await batch.commit();
            list = initial;
          } catch (err) {
            console.error('Error seeding default stages in Firestore', err);
          }
        }

        setStages(list);
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `tenants/${tenantId}/productionStages`);
        setLoading(false);
      });

      return unsubscribe;
    }
  }, [tenantId]);

  const addStage = useCallback(async (name: string, color: string = 'slate', isFinalStage: boolean = false) => {
    if (!tenantId) return false;
    if (!isAdmin) {
      throw new Error('Cleared administrative accounts are solely authorized to append assembly checkpoints.');
    }

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const stageId = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    const order = stages.length > 0 ? Math.max(...stages.map(s => s.order)) + 1 : 0;

    const newStage: ProductionStageConfig = {
      id: stageId,
      name: name.trim(),
      color,
      isFinalStage,
      order
    };

    // Prevent duplicate values
    if (stages.some(s => s.id === stageId)) {
      throw new Error('An identical workflow checkpoint code already operates in this routing line.');
    }

    if (isSandbox) {
      const updated = [...stages, newStage];
      localStorage.setItem(`flowops_stages_${tenantId}`, JSON.stringify(updated));
      setStages(updated);
      return true;
    } else {
      try {
        const docRef = doc(db, 'tenants', tenantId, 'productionStages', stageId);
        await setDoc(docRef, {
          name: name.trim(),
          color,
          isFinalStage,
          order
        });
        return true;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `tenants/${tenantId}/productionStages/${stageId}`);
        return false;
      }
    }
  }, [tenantId, stages, isAdmin]);

  const reorderStages = useCallback(async (newOrderedStages: ProductionStageConfig[]) => {
    if (!tenantId) return false;
    if (!isAdmin) {
      throw new Error('Authorized admins alone hold dispatch clearances to restructure assembly operations.');
    }

    // Re-apply correct order counters
    const updated = newOrderedStages.map((s, idx) => ({
      ...s,
      order: idx
    }));

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      localStorage.setItem(`flowops_stages_${tenantId}`, JSON.stringify(updated));
      setStages(updated);
      return true;
    } else {
      try {
        const batch = writeBatch(db);
        updated.forEach(s => {
          const dRef = doc(db, 'tenants', tenantId, 'productionStages', s.id);
          batch.update(dRef, { order: s.order });
        });
        await batch.commit();
        return true;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `tenants/${tenantId}/productionStages`);
        return false;
      }
    }
  }, [tenantId, isAdmin]);

  const checkStageHasJobs = useCallback(async (stageId: string) => {
    if (!tenantId) return false;
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      try {
        const cachedJobs = localStorage.getItem(`jobs_${tenantId}`) || '[]';
        const list = JSON.parse(cachedJobs);
        return list.some((j: any) => j.currentStage === stageId);
      } catch (err) {
        return false;
      }
    } else {
      try {
        const jCol = collection(db, 'productionJobs');
        const q = query(jCol, where('tenantId', '==', tenantId), where('currentStage', '==', stageId));
        const snap = await getDocs(q);
        return !snap.empty;
      } catch (e) {
        return false;
      }
    }
  }, [tenantId]);

  const deleteStage = useCallback(async (stageId: string) => {
    if (!tenantId) return false;
    if (!isAdmin) {
      throw new Error('Only administrator profile owners can dismiss manufacturing assembly milestones.');
    }

    const hasJobs = await checkStageHasJobs(stageId);
    if (hasJobs) {
      throw new Error('This stage still routes pending shopfloor batches. Re-route those jobs before eliminating this stage index.');
    }

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const updated = stages.filter(s => s.id !== stageId).map((s, idx) => ({
        ...s,
        order: idx
      }));
      localStorage.setItem(`flowops_stages_${tenantId}`, JSON.stringify(updated));
      setStages(updated);
      return true;
    } else {
      try {
        const dRef = doc(db, 'tenants', tenantId, 'productionStages', stageId);
        await deleteDoc(dRef);
        return true;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `tenants/${tenantId}/productionStages/${stageId}`);
        return false;
      }
    }
  }, [tenantId, stages, isAdmin, checkStageHasJobs]);

  const overrideStages = useCallback(async (newStages: { name: string; color: string; isFinalStage: boolean }[]) => {
    if (!tenantId) return false;
    if (!isAdmin) {
      throw new Error('Only administrator profile owners can configure production stages.');
    }

    const updated: ProductionStageConfig[] = newStages.map((s, idx) => ({
      id: s.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_'),
      name: s.name.trim(),
      color: s.color,
      isFinalStage: s.isFinalStage,
      order: idx
    }));

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      localStorage.setItem(`flowops_stages_${tenantId}`, JSON.stringify(updated));
      setStages(updated);
      return true;
    } else {
      try {
        const colRef = collection(db, 'tenants', tenantId, 'productionStages');
        const snap = await getDocs(colRef);
        const batch = writeBatch(db);
        snap.forEach(d => {
          batch.delete(doc(db, 'tenants', tenantId, 'productionStages', d.id));
        });
        
        updated.forEach(s => {
          const dRef = doc(db, 'tenants', tenantId, 'productionStages', s.id);
          batch.set(dRef, {
            name: s.name,
            color: s.color,
            isFinalStage: s.isFinalStage,
            order: s.order
          });
        });
        await batch.commit();
        setStages(updated);
        return true;
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `tenants/${tenantId}/productionStages`);
        return false;
      }
    }
  }, [tenantId, isAdmin]);

  return {
    stages,
    loading,
    error,
    addStage,
    reorderStages,
    overrideStages,
    deleteStage,
    checkStageHasJobs,
    isAdmin
  };
};
