// src/hooks/usePaginatedCollectionQuery.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
<<<<<<< HEAD
=======
import { useAuth } from './useAuth';
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  DocumentData, 
  QueryDocumentSnapshot,
  FirestoreError
} from 'firebase/firestore';

interface PaginationResult<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  reset: () => void;
}

export const usePaginatedCollectionQuery = <T extends { id: string }>(
  collectionPath: string,
  options: {
    filters?: Record<string, any>;
    pageSize?: number;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    isSandbox?: boolean;
    localBackupKey?: string;
  } = {}
): PaginationResult<T> => {
<<<<<<< HEAD
=======
  const { tenant, activePlantId } = useAuth();
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
  const {
    filters = {},
    pageSize = 10,
    sortField = 'createdAt',
    sortDirection = 'desc',
    isSandbox = false,
    localBackupKey
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Firestore cursor trackers
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  
  // Local Sandbox offset trackers
  const localOffsetRef = useRef<number>(0);
  const localFilteredCacheRef = useRef<T[]>([]);

  // Build local filtered cache for sandbox simulation
  const buildLocalSandboxCache = useCallback(() => {
    if (!localBackupKey) {
      localFilteredCacheRef.current = [];
      return;
    }

    try {
<<<<<<< HEAD
      const cached = localStorage.getItem(localBackupKey) || '[]';
      let parsed = JSON.parse(cached) as T[];

      // Apply dynamic filtering specs locally
      parsed = parsed.filter((item: any) => {
=======
      let cached = localStorage.getItem(localBackupKey);

      // AUTO-SEED SANDBOX KEY IF EMPTY (Resolves hook race conditions on fresh session/reload)
      if (!cached) {
        const tid = localBackupKey.split('_')[1] || 'demo';
        if (localBackupKey.startsWith('customers_')) {
          const SEED_CUSTOMERS = [
            {
              id: 'cust-1',
              tenantId: tid,
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
              tenantId: tid,
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
              tenantId: tid,
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
          localStorage.setItem(localBackupKey, JSON.stringify(SEED_CUSTOMERS));
          cached = JSON.stringify(SEED_CUSTOMERS);
        } else if (localBackupKey.startsWith('dispatches_')) {
          const SEED_DISPATCHES = [
            {
              id: 'disp_9001',
              tenantId: tid,
              orderId: 'order_test_01',
              dispatchNumber: 'DS-9001',
              invoiceNumber: 'INV-F26-9022',
              vehicleNumber: 'MH-12-PQ-9876',
              driverName: 'Sukhdev Singh',
              driverPhone: '9440612345',
              lrNumber: 'LR-890122',
              LRNumber: 'LR-890122',
              transporter: 'SafeExpress Ltd.',
              items: [
                { id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 20, unitPrice: 4200, gstPercent: 18, total: 84000 }
              ],
              status: 'Dispatched',
              dispatchDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
              dispatchedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
              destination: 'Pune Distribution Hub',
              itemsSummary: 'Forged Steel Spur Gear x20',
              notes: 'Handed over directly with full transport packaging intact.'
            }
          ];
          localStorage.setItem(localBackupKey, JSON.stringify(SEED_DISPATCHES));
          cached = JSON.stringify(SEED_DISPATCHES);
        } else if (localBackupKey.startsWith('rfqs_')) {
          const SEED_RFQS = [
            {
              id: 'rfq_1001',
              rfqNumber: 'RFQ-2026-0001',
              tenantId: tid,
              customerId: 'cust-1',
              customerName: 'Kirloskar Industrial Distributors',
              contactName: 'Anil Kulkarni',
              phone: '9880123456',
              email: 'anil@kirloskar-dist.in',
              source: 'Email',
              dateReceived: '2026-05-25',
              status: 'New',
              priority: 'High',
              description: 'Need Grade 4 standard heavy spur gears matching drawing specification housing.',
              items: [
                { id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 20, specs: 'Material: EN8 Carbon Steel' }
              ],
              createdBy: 'demo_user',
              createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
            },
            {
              id: 'rfq_1002',
              rfqNumber: 'RFQ-2026-0002',
              tenantId: tid,
              customerId: 'cust-2',
              customerName: 'Techno Welds India Pvt Ltd',
              contactName: 'Rajesh Sharma',
              phone: '9123456780',
              email: 'rsharma@technowelds.co.in',
              source: 'WhatsApp',
              dateReceived: '2026-05-28',
              status: 'Quoted',
              priority: 'Medium',
              description: 'Inquiry for prompt custom steel parts.',
              items: [
                { id: 'p2', name: 'Prompt Weld Parts', quantity: 15, specs: 'Material: Mild Steel' }
              ],
              createdBy: 'demo_user',
              createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
            }
          ];
          localStorage.setItem(localBackupKey, JSON.stringify(SEED_RFQS));
          cached = JSON.stringify(SEED_RFQS);
        }
      }

      let parsed = JSON.parse(cached || '[]') as T[];

      // Apply dynamic filtering specs locally
      parsed = parsed.filter((item: any) => {
        // Automatically scope by active plant if applicable, fallback to backwards compatibility
        if (activePlantId && activePlantId !== 'all') {
          const isPlantScopedPath = ['customers', 'rfqs', 'orders', 'dispatches', 'productionJobs', 'stockItems'].some(entity => collectionPath.includes(entity) || (localBackupKey && localBackupKey.includes(entity)));
          if (isPlantScopedPath) {
            // Include if explicitly assigned to this plant, or if it has NO plantId (legacy)
            if (item.plantId && item.plantId !== 'all' && item.plantId !== activePlantId) {
              return false;
            }
          }
        }

>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        for (const [key, val] of Object.entries(filters)) {
          if (val === undefined || val === null || val === '') continue;

          // Search criteria
          if (key === 'search' && typeof val === 'string') {
            const term = val.toLowerCase();
            const strValue = JSON.stringify(item).toLowerCase();
            if (!strValue.includes(term)) {
              return false;
            }
            continue;
          }

          // Date filters
          if (key === 'startDate' && item.createdAt) {
            const itemDate = new Date(item.dateReceived || item.createdAt);
            const rangeStart = new Date(val);
            if (itemDate < rangeStart) return false;
            continue;
          }
          if (key === 'endDate' && item.createdAt) {
            const itemDate = new Date(item.dateReceived || item.createdAt);
            const rangeEnd = new Date(val);
            if (itemDate > rangeEnd) return false;
            continue;
          }

          // Object value mappings
          if (key === 'status') {
            const filterVal = String(val).toLowerCase();
            if (filterVal === 'open') {
              const isOpen = ['new', 'in progress', 'quoted', 'pending'].includes(String(item.status || '').toLowerCase());
              if (!isOpen) return false;
              continue;
            } else if (filterVal !== 'all' && String(item.status || '').toLowerCase() !== filterVal) {
              return false;
            }
            continue;
          }

          // Assigned user mappings
          if (key === 'assignedTo' && val !== 'all') {
            if (String(item.assignedTo || '').toLowerCase() !== String(val).toLowerCase()) {
              return false;
            }
            continue;
          }

          // Tag filter support for lists
          if (key === 'tag' && val) {
            const itemTags = item.tags || [];
            const hasTag = itemTags.some((t: string) => t.toLowerCase() === String(val).toLowerCase());
            if (!hasTag) return false;
            continue;
          }

          // Assigned sales user helper
          if (key === 'assignedSalesUserId' && val) {
            if (String(item.assignedSalesUserId || '').toLowerCase() !== String(val).toLowerCase()) {
              return false;
            }
            continue;
          }

          // City location search
          if (key === 'city' && val) {
            if (!String(item.city || '').toLowerCase().includes(String(val).toLowerCase())) {
              return false;
            }
            continue;
          }

          // Generic exact properties
          if (key !== 'search' && key !== 'startDate' && key !== 'endDate' && key !== 'status' && key !== 'assignedTo' && key !== 'tag' && key !== 'assignedSalesUserId' && key !== 'city') {
            if (String(item[key] || '').toLowerCase() !== String(val).toLowerCase()) {
              return false;
            }
          }
        }
        return true;
      });

      // Apply local sorting
      parsed.sort((a: any, b: any) => {
        const valA = a[sortField];
        const valB = b[sortField];
        
        // Handle firestore server timestamps or generic string dates
        const timeA = typeof valA === 'object' && valA?.seconds ? valA.seconds * 1000 : new Date(valA || 0).getTime();
        const timeB = typeof valB === 'object' && valB?.seconds ? valB.seconds * 1000 : new Date(valB || 0).getTime();

        if (!isNaN(timeA) && !isNaN(timeB)) {
          return sortDirection === 'desc' ? timeB - timeA : timeA - timeB;
        }

        if (String(valA) < String(valB)) return sortDirection === 'desc' ? 1 : -1;
        if (String(valA) > String(valB)) return sortDirection === 'desc' ? -1 : 1;
        return 0;
      });

      localFilteredCacheRef.current = parsed;
    } catch (err) {
      console.error('Failed to prepare local sandbox pagination cache:', err);
      localFilteredCacheRef.current = [];
    }
<<<<<<< HEAD
  }, [filters, localBackupKey, sortField, sortDirection]);

  // Initial load or resetting sequence
  const resetAndFetch = useCallback(async () => {
=======
  }, [filters, localBackupKey, sortField, sortDirection, activePlantId, collectionPath]);

  // Initial load or resetting sequence
  const resetAndFetch = useCallback(async () => {
    // STRICT TENANT GUARD: Prevent unauthorized reads
    if (!isSandbox && (!tenant?.id || !db || collectionPath.includes('/undefined'))) {
      setLoading(false);
      return;
    }

>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    setLoading(true);
    setError(null);
    setData([]);
    lastDocRef.current = null;
    localOffsetRef.current = 0;

<<<<<<< HEAD
    if (isSandbox || !db) {
=======
    if (isSandbox) {
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      // Sandbox mode mock cursor paging
      buildLocalSandboxCache();
      const firstBatch = localFilteredCacheRef.current.slice(0, pageSize);
      setData(firstBatch);
      setHasMore(localFilteredCacheRef.current.length > pageSize);
      localOffsetRef.current = pageSize;
      setLoading(false);
    } else {
      // Production Firebase Storage ledger paging
      try {
        const colRef = collection(db, collectionPath);
        
        // Form progressive constraints dynamically to prevent index errors where possible
        const constraints = [];
        
        // Scoped static parameters if existing
        for (const [key, val] of Object.entries(filters)) {
          if (val === undefined || val === null || val === '') continue;
<<<<<<< HEAD
          if (['search', 'startDate', 'endDate', 'status', 'assignedTo', 'tag', 'assignedSalesUserId', 'city'].includes(key)) {
=======
          if (['search', 'startDate', 'endDate', 'status', 'assignedTo', 'tag', 'assignedSalesUserId', 'city', 'type'].includes(key)) {
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
            // These require composite indexes or complex local search maps
            continue;
          }
          constraints.push(where(key, '==', val));
        }

        // Apply primary ordering and limits
        constraints.push(orderBy(sortField, sortDirection));
        constraints.push(limit(pageSize));

        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);
        
        const list: T[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as T);
        });

<<<<<<< HEAD
        // Local filtering to support fuzzy text searches & nested ranges without requiring heavy index configs
        let finalSet = list;
=======
        // Local filtering to support fuzzy text searches, backwards compatibility & nested ranges without requiring heavy index configs
        let finalSet = list;

        // Automatically scope by active plant if applicable, maintaining legacy record visibility
        if (activePlantId && activePlantId !== 'all') {
          const isPlantScopedPath = ['customers', 'rfqs', 'orders', 'dispatches', 'productionJobs', 'stockItems'].some(entity => collectionPath.includes(entity));
          if (isPlantScopedPath) {
            finalSet = finalSet.filter((item: any) => 
              !item.plantId || item.plantId === 'all' || item.plantId === activePlantId
            );
          }
        }

>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        if (filters.search) {
          const s = String(filters.search).toLowerCase();
          finalSet = finalSet.filter(item => JSON.stringify(item).toLowerCase().includes(s));
        }
<<<<<<< HEAD
=======
        if (filters.type) {
          finalSet = finalSet.filter(item => String((item as any).type || '').toLowerCase() === String(filters.type).toLowerCase());
        }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        if (filters.status) {
          const statusVal = String(filters.status).toLowerCase();
          finalSet = finalSet.filter(item => {
            if (statusVal === 'open') {
              return ['new', 'in progress', 'quoted', 'pending'].includes(String((item as any).status || '').toLowerCase());
            }
            if (statusVal === 'all') return true;
            return String((item as any).status || '').toLowerCase() === statusVal;
          });
        }
        if (filters.assignedTo && filters.assignedTo !== 'all') {
          finalSet = finalSet.filter(item => String((item as any).assignedTo || '').toLowerCase() === String(filters.assignedTo).toLowerCase());
        }
        if (filters.tag) {
          finalSet = finalSet.filter(item => {
            const itemTags = (item as any).tags || [];
            return itemTags.some((t: string) => t.toLowerCase() === String(filters.tag).toLowerCase());
          });
        }
        if (filters.assignedSalesUserId) {
          finalSet = finalSet.filter(item => String((item as any).assignedSalesUserId || '').toLowerCase() === String(filters.assignedSalesUserId).toLowerCase());
        }
        if (filters.city) {
          finalSet = finalSet.filter(item => String((item as any).city || '').toLowerCase().includes(String(filters.city).toLowerCase()));
        }

        setData(finalSet);
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
        setHasMore(snapshot.docs.length === pageSize);
      } catch (err: any) {
        console.error('Firestore initial query failed:', err);
        setError(err.message || 'Firestore query error');
      } finally {
        setLoading(false);
      }
    }
<<<<<<< HEAD
  }, [collectionPath, isSandbox, pageSize, sortField, sortDirection, filters, buildLocalSandboxCache]);

  useEffect(() => {
    resetAndFetch();
  }, [collectionPath, isSandbox, sortField, sortDirection, JSON.stringify(filters)]);
=======
  }, [collectionPath, isSandbox, pageSize, sortField, sortDirection, filters, buildLocalSandboxCache, tenant?.id, activePlantId]); 

  useEffect(() => {
    resetAndFetch();
  }, [collectionPath, isSandbox, sortField, sortDirection, JSON.stringify(filters), tenant?.id, activePlantId]); 
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145

  // Progressive load more function
  const loadMore = async () => {
    if (loading || loadingMore || !hasMore) return;

<<<<<<< HEAD
    setLoadingMore(true);
    setError(null);

    if (isSandbox || !db) {
=======
    // STRICT TENANT GUARD for progressive loads
    if (!isSandbox && (!tenant?.id || !db || collectionPath.includes('/undefined'))) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    if (isSandbox) {
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      // Next Sandbox mock segment slice
      const start = localOffsetRef.current;
      const end = start + pageSize;
      const nextSlice = localFilteredCacheRef.current.slice(start, end);
      
      setData((prev) => [...prev, ...nextSlice]);
      localOffsetRef.current = end;
      setHasMore(localFilteredCacheRef.current.length > end);
      setLoadingMore(false);
    } else {
      // Fire next Firestore segment
      try {
        if (!lastDocRef.current) {
          setHasMore(false);
          setLoadingMore(false);
          return;
        }

        const colRef = collection(db, collectionPath);
        const constraints = [];

        // Dynamic filters matching target conditions
        for (const [key, val] of Object.entries(filters)) {
          if (val === undefined || val === null || val === '') continue;
<<<<<<< HEAD
          if (['search', 'startDate', 'endDate', 'status', 'assignedTo', 'tag', 'assignedSalesUserId', 'city'].includes(key)) continue;
=======
          if (['search', 'startDate', 'endDate', 'status', 'assignedTo', 'tag', 'assignedSalesUserId', 'city', 'type'].includes(key)) continue;
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
          constraints.push(where(key, '==', val));
        }

        constraints.push(orderBy(sortField, sortDirection));
        constraints.push(startAfter(lastDocRef.current));
        constraints.push(limit(pageSize));

        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);

        const list: T[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as T);
        });

        // local searches
        let finalSet = list;
<<<<<<< HEAD
=======
        
        // Scope backwards-compatible plants
        if (activePlantId && activePlantId !== 'all') {
          const isPlantScopedPath = ['customers', 'rfqs', 'orders', 'dispatches', 'productionJobs', 'stockItems'].some(entity => collectionPath.includes(entity));
          if (isPlantScopedPath) {
            finalSet = finalSet.filter((item: any) => 
              !item.plantId || item.plantId === 'all' || item.plantId === activePlantId
            );
          }
        }

>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        if (filters.search) {
          const s = String(filters.search).toLowerCase();
          finalSet = finalSet.filter(item => JSON.stringify(item).toLowerCase().includes(s));
        }
<<<<<<< HEAD
=======
        if (filters.type) {
          finalSet = finalSet.filter(item => String((item as any).type || '').toLowerCase() === String(filters.type).toLowerCase());
        }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
        if (filters.status) {
          const statusVal = String(filters.status).toLowerCase();
          finalSet = finalSet.filter(item => {
            if (statusVal === 'open') {
              return ['new', 'in progress', 'quoted', 'pending'].includes(String((item as any).status || '').toLowerCase());
            }
            if (statusVal === 'all') return true;
            return String((item as any).status || '').toLowerCase() === statusVal;
          });
        }
        if (filters.assignedTo && filters.assignedTo !== 'all') {
          finalSet = finalSet.filter(item => String((item as any).assignedTo || '').toLowerCase() === String(filters.assignedTo).toLowerCase());
        }
        if (filters.tag) {
          finalSet = finalSet.filter(item => {
            const itemTags = (item as any).tags || [];
            return itemTags.some((t: string) => t.toLowerCase() === String(filters.tag).toLowerCase());
          });
        }
        if (filters.assignedSalesUserId) {
          finalSet = finalSet.filter(item => String((item as any).assignedSalesUserId || '').toLowerCase() === String(filters.assignedSalesUserId).toLowerCase());
        }
        if (filters.city) {
          finalSet = finalSet.filter(item => String((item as any).city || '').toLowerCase().includes(String(filters.city).toLowerCase()));
        }

        setData((prev) => [...prev, ...finalSet]);
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
        setHasMore(snapshot.docs.length === pageSize);
      } catch (err: any) {
        console.error('Firestore loadMore query failed:', err);
        setError(err.message || 'Firestore progressive pagination failed');
      } finally {
        setLoadingMore(false);
      }
    }
  };

  return {
    data,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    reset: resetAndFetch
  };
<<<<<<< HEAD
};
=======
};
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
