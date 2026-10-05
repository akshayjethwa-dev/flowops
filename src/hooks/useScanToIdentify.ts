// src/hooks/useScanToIdentify.ts
import { useCallback, useState } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { ScanResult } from '../services/scannerService';
import { syncEngine } from '../services/syncEngine';

export type EntityType = 'material' | 'workOrder' | 'machine' | 'location' | 'batch' | 'unknown';

export interface ResolvedEntity {
  type: EntityType;
  code: string;                 // e.g., "MAT-00123"
  id: string | null;            // Firestore doc ID (null if offline & uncached)
  data: Record<string, any> | null;
  source: 'local' | 'remote' | 'none';
}

interface Options {
  /** Restrict lookup to this plant (for work centers & locations). */
  plantId?: string;
  /** Optional callback when resolution completes. */
  onResolved?: (entity: ResolvedEntity) => void;
}

export function useScanToIdentify(tenantId: string | null, opts: Options = {}) {
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedEntity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async (scan: ScanResult): Promise<ResolvedEntity | null> => {
      if (!scan.target || !scan.entityId) {
        setError('Unrecognized barcode format');
        return null;
      }

      setResolving(true);
      setError(null);

      const { target, entityId } = scan;
      const result: ResolvedEntity = {
        type: target as EntityType,
        code: entityId,
        id: null,
        data: null,
        source: 'none',
      };

      try {
        // ── 1. Try local cache first (offline path) ────────────
        const cacheKey = `scan:${target}:${entityId}`;
        const cached = await syncEngine.read<ResolvedEntity>(cacheKey, 'index');
        if (cached && cached.data) {
          result.id = cached.id;
          result.data = cached.data;
          result.source = 'local';
        }

        // ── 2. If online, hit Firestore ────────────────────────
        if (navigator.onLine && db && tenantId) {
          const remote = await lookupRemote(tenantId, target, entityId, opts.plantId);
          if (remote) {
            result.id = remote.id;
            result.data = remote.data;
            result.source = 'remote';
          }
        }

        setResolved(result);
        opts.onResolved?.(result);
        return result;
      } catch (e: any) {
        setError(e?.message || 'Lookup failed');
        return null;
      } finally {
        setResolving(false);
      }
    },
    [tenantId, opts]
  );

  const reset = useCallback(() => {
    setResolved(null);
    setError(null);
  }, []);

  return { resolve, resolved, resolving, error, reset };
}

// ─── Internals ─────────────────────────────────────────────────

async function lookupRemote(
  tenantId: string,
  target: EntityType,
  code: string,
  plantId?: string
): Promise<{ id: string; data: Record<string, any> } | null> {
  const findOne = async (
    collPath: string,
    field: string
  ): Promise<{ id: string; data: Record<string, any> } | null> => {
    const q = query(collection(db!, collPath), where(field, '==', code), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, data: snap.docs[0].data() };
  };

  switch (target) {
    case 'material':
      return (
        (await findOne(`tenants/${tenantId}/rawMaterials`, 'sku')) ||
        (await findOne(`tenants/${tenantId}/rawMaterials`, 'code'))
      );

    case 'workOrder':
      return (
        (await findOne(`tenants/${tenantId}/workOrders`, 'orderNumber')) ||
        (await findOne(`tenants/${tenantId}/orders`, 'orderNumber'))
      );

    case 'machine':
      if (!plantId) return null;
      return (
        (await findOne(
          `tenants/${tenantId}/plants/${plantId}/workCenters`,
          'code'
        ))
      );

    case 'location':
      if (!plantId) return null;
      return findOne(
        `tenants/${tenantId}/plants/${plantId}/locations`,
        'code'
      );

    case 'batch':
      return findOne(`tenants/${tenantId}/lots`, 'lotNumber');

    default:
      return null;
  }
}