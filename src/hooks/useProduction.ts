// src/hooks/useProduction.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { ProductionJob, Order, ProductionStageChange } from '../types';

export const useProductionBoard = (tenantId: string | undefined) => {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const cachedJobs = localStorage.getItem(`jobs_${tenantId}`) || '[]';
        setJobs(JSON.parse(cachedJobs));

        const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
        setOrders(JSON.parse(cachedOrders));

        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error parsing test workspace registry');
        setLoading(false);
      }
    } else {
      try {
        const jCol = collection(db, 'productionJobs');
        const jq = query(jCol, where('tenantId', '==', tenantId));

        const oCol = collection(db, 'orders');
        const oq = query(oCol, where('tenantId', '==', tenantId));

        const unsubJobs = onSnapshot(jq, (snap) => {
          const list: ProductionJob[] = [];
          snap.forEach(d => list.push({ ...d.data() } as ProductionJob));
          setJobs(list);
          setLoading(false);
        }, (err) => {
          setError(err.message);
          setLoading(false);
        });

        const unsubOrders = onSnapshot(oq, (snap) => {
          const list: Order[] = [];
          snap.forEach(d => list.push({ ...d.data() } as Order));
          setOrders(list);
        });

        return () => {
          unsubJobs();
          unsubOrders();
        };
      } catch (err: any) {
        setError(err.message || 'Failed connected live firestore listener nodes');
        setLoading(false);
      }
    }
  }, [tenantId]);

  const updateJobStage = useCallback(async (
    jobId: string, 
    newStage: string,
    notes: string,
    operatorId: string,
    operatorName: string
  ) => {
    if (!tenantId) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const updateTime = new Date().toISOString();

    const entry: ProductionStageChange = {
      stage: newStage,
      notes: notes || 'Segment changed with dashboard drag-and-drop tool.',
      updatedBy: operatorId,
      updatedByName: operatorName,
      updatedAt: updateTime
    };

    if (isSandbox) {
      const cached = localStorage.getItem(`jobs_${tenantId}`) || '[]';
      const list: ProductionJob[] = JSON.parse(cached);
      
      const updatedList = list.map(j => {
        if (j.id === jobId) {
          return {
            ...j,
            currentStage: newStage,
            stagesHistory: [...(j.stagesHistory || []), entry],
            updatedBy: operatorId,
            updatedAt: updateTime
          };
        }
        return j;
      });

      localStorage.setItem(`jobs_${tenantId}`, JSON.stringify(updatedList));
      setJobs(updatedList);
    } else {
      const docRef = doc(db, 'productionJobs', jobId);
      const snapshot = await getDocs(query(collection(db, 'productionJobs'), where('id', '==', jobId)));
      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        const currentData = snapshot.docs[0].data() as ProductionJob;
        await updateDoc(doc(db, 'productionJobs', docId), {
          currentStage: newStage,
          stagesHistory: [...(currentData.stagesHistory || []), entry],
          updatedBy: operatorId,
          updatedAt: serverTimestamp()
        });
      }
    }
  }, [tenantId]);

  return {
    jobs,
    orders,
    loading,
    error,
    updateJobStage
  };
};

export const useJobDetail = (tenantId: string | undefined, jobId: string | undefined) => {
  const [job, setJob] = useState<ProductionJob | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !jobId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      try {
        const cachedJobs = localStorage.getItem(`jobs_${tenantId}`) || '[]';
        const list: ProductionJob[] = JSON.parse(cachedJobs);
        const foundJob = list.find(j => j.id === jobId);

        if (foundJob) {
          setJob(foundJob);
          
          const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
          const ordersList: Order[] = JSON.parse(cachedOrders);
          const foundOrder = ordersList.find(o => o.id === foundJob.orderId);
          setOrder(foundOrder || null);
        } else {
          setJob(null);
          setOrder(null);
        }
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    } else {
      try {
        const qRef = query(collection(db, 'productionJobs'), where('id', '==', jobId));
        const unsubscribe = onSnapshot(qRef, async (snap) => {
          if (!snap.empty) {
            const currentJob = { id: snap.docs[0].id, ...snap.docs[0].data() } as ProductionJob;
            setJob(currentJob);

            const oRef = query(collection(db, 'orders'), where('id', '==', currentJob.orderId));
            const oSnap = await getDocs(oRef);
            if (!oSnap.empty) {
              setOrder({ id: oSnap.docs[0].id, ...oSnap.docs[0].data() } as Order);
            }
          } else {
            setJob(null);
            setOrder(null);
          }
          setLoading(false);
        }, (err) => {
          setError(err.message);
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [tenantId, jobId]);

  const addJobComment = useCallback(async (text: string, userName: string, userId: string) => {
    if (!tenantId || !job) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const entry: ProductionStageChange = {
      stage: job.currentStage,
      notes: text,
      updatedBy: userId,
      updatedByName: userName,
      updatedAt: new Date().toISOString()
    };

    if (isSandbox) {
      const cached = localStorage.getItem(`jobs_${tenantId}`) || '[]';
      const list: ProductionJob[] = JSON.parse(cached);
      
      const updatedList = list.map(j => {
        if (j.id === job.id) {
          const freshHistory = [...(j.stagesHistory || []), entry];
          return {
            ...j,
            stagesHistory: freshHistory,
            updatedAt: new Date().toISOString()
          };
        }
        return j;
      });

      localStorage.setItem(`jobs_${tenantId}`, JSON.stringify(updatedList));
      setJob(prev => prev ? { ...prev, stagesHistory: [...(prev.stagesHistory || []), entry] } : null);
    } else {
      const snapshot = await getDocs(query(collection(db, 'productionJobs'), where('id', '==', job.id)));
      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        const currentData = snapshot.docs[0].data() as ProductionJob;
        await updateDoc(doc(db, 'productionJobs', docId), {
          stagesHistory: [...(currentData.stagesHistory || []), entry],
          updatedAt: serverTimestamp()
        });
      }
    }
  }, [tenantId, job]);

  const updateJobStage = useCallback(async (
    newStage: string,
    notes: string,
    operatorId: string,
    operatorName: string
  ) => {
    if (!tenantId || !job) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const updateTime = new Date().toISOString();

    const entry: ProductionStageChange = {
      stage: newStage,
      notes: notes || 'Segment changed from Job Detail Page.',
      updatedBy: operatorId,
      updatedByName: operatorName,
      updatedAt: updateTime
    };

    if (isSandbox) {
      const cached = localStorage.getItem(`jobs_${tenantId}`) || '[]';
      const list: ProductionJob[] = JSON.parse(cached);
      
      const updatedList = list.map(j => {
        if (j.id === job.id) {
          return {
            ...j,
            currentStage: newStage,
            stagesHistory: [...(j.stagesHistory || []), entry],
            updatedBy: operatorId,
            updatedAt: updateTime
          };
        }
        return j;
      });

      localStorage.setItem(`jobs_${tenantId}`, JSON.stringify(updatedList));
      setJob(prev => prev ? {
        ...prev,
        currentStage: newStage,
        stagesHistory: [...(prev.stagesHistory || []), entry],
        updatedBy: operatorId,
        updatedAt: updateTime
      } : null);
    } else {
      const snapshot = await getDocs(query(collection(db, 'productionJobs'), where('id', '==', job.id)));
      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        const currentData = snapshot.docs[0].data() as ProductionJob;
        await updateDoc(doc(db, 'productionJobs', docId), {
          currentStage: newStage,
          stagesHistory: [...(currentData.stagesHistory || []), entry],
          updatedBy: operatorId,
          updatedAt: serverTimestamp()
        });
        setJob(prev => prev ? {
          ...prev,
          currentStage: newStage,
          stagesHistory: [...(prev.stagesHistory || []), entry],
          updatedBy: operatorId,
          updatedAt: updateTime
        } : null);
      }
    }
  }, [tenantId, job]);

  return {
    job,
    order,
    loading,
    error,
    addJobComment,
    updateJobStage
  };
};
