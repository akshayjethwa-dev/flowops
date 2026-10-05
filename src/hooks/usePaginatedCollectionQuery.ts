// src/hooks/usePaginatedCollectionQuery.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
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
      const cached = localStorage.getItem(localBackupKey) || '[]';
      let parsed = JSON.parse(cached) as T[];

      // Apply dynamic filtering specs locally
      parsed = parsed.filter((item: any) => {
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
  }, [filters, localBackupKey, sortField, sortDirection]);

  // Initial load or resetting sequence
  const resetAndFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData([]);
    lastDocRef.current = null;
    localOffsetRef.current = 0;

    if (isSandbox || !db) {
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
          if (['search', 'startDate', 'endDate', 'status', 'assignedTo', 'tag', 'assignedSalesUserId', 'city'].includes(key)) {
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

        // Local filtering to support fuzzy text searches & nested ranges without requiring heavy index configs
        let finalSet = list;
        if (filters.search) {
          const s = String(filters.search).toLowerCase();
          finalSet = finalSet.filter(item => JSON.stringify(item).toLowerCase().includes(s));
        }
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
  }, [collectionPath, isSandbox, pageSize, sortField, sortDirection, filters, buildLocalSandboxCache]);

  useEffect(() => {
    resetAndFetch();
  }, [collectionPath, isSandbox, sortField, sortDirection, JSON.stringify(filters)]);

  // Progressive load more function
  const loadMore = async () => {
    if (loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    setError(null);

    if (isSandbox || !db) {
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
          if (['search', 'startDate', 'endDate', 'status', 'assignedTo', 'tag', 'assignedSalesUserId', 'city'].includes(key)) continue;
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
        if (filters.search) {
          const s = String(filters.search).toLowerCase();
          finalSet = finalSet.filter(item => JSON.stringify(item).toLowerCase().includes(s));
        }
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
};
