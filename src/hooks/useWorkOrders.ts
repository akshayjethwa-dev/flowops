// src/hooks/useWorkOrders.ts
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';

// ── Types ──────────────────────────────────────────────────────
export type WorkOrderStatus =
  | 'pending'
  | 'ready'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface WorkOrderOperation {
  id: string;
  name: string;
  workCenterId?: string;
  sequence: number;
  status: WorkOrderStatus;
  standardTimeMinutes?: number;
  actualTimeMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  startedByUserId?: string;
  startedByName?: string;
}

export interface WorkOrder {
  id: string;
  tenantId: string;
  plantId?: string;
  orderNumber: string;
  salesOrderId?: string;
  customerName?: string;
  partName: string;
  partCode?: string;
  quantity: number;
  quantityCompleted?: number;
  quantityScrapped?: number;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: WorkOrderStatus;
  currentOperationId?: string;
  operations: WorkOrderOperation[];
  assignedOperatorIds?: string[];
  notes?: string;
  createdAt: any;      // ← required, but not in seed
  updatedAt: any;      // ← required, but not in seed
  updatedBy?: string;
  updatedByName?: string;
}

interface UseWorkOrdersOptions {
  plantId?: string;
  statusFilter?: WorkOrderStatus | 'all';
  search?: string;
}

// ── Seed data for sandbox mode ─────────────────────────────────
//    FIX: widen the Omit<> so createdAt/updatedAt (injected at seed time)
//    don't need to be present in the source literals.
const SEED_WORK_ORDERS: Omit<
  WorkOrder,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
>[] = [
  {
    orderNumber: 'WO-00042',
    partName: 'Gear Blank — 42T',
    partCode: 'GB-42T',
    customerName: 'Tata Motors',
    quantity: 250,
    quantityCompleted: 120,
    quantityScrapped: 3,
    priority: 'high',
    status: 'in_progress',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    operations: [
      { id: 'op-1', name: 'Material Cutting', sequence: 1, status: 'completed', standardTimeMinutes: 45, actualTimeMinutes: 42 },
      { id: 'op-2', name: 'CNC Turning', sequence: 2, status: 'in_progress', standardTimeMinutes: 180 },
      { id: 'op-3', name: 'Hobbing', sequence: 3, status: 'pending', standardTimeMinutes: 120 },
      { id: 'op-4', name: 'Final Inspection', sequence: 4, status: 'pending', standardTimeMinutes: 30 },
    ],
  },
  {
    orderNumber: 'WO-00043',
    partName: 'Shaft — Drive 30mm',
    partCode: 'DS-30',
    customerName: 'Bajaj Auto',
    quantity: 500,
    quantityCompleted: 0,
    quantityScrapped: 0,
    priority: 'urgent',
    status: 'ready',
    dueDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
    operations: [
      { id: 'op-1', name: 'Bar Cutting', sequence: 1, status: 'pending', standardTimeMinutes: 30 },
      { id: 'op-2', name: 'CNC Turning', sequence: 2, status: 'pending', standardTimeMinutes: 240 },
      { id: 'op-3', name: 'Grinding', sequence: 3, status: 'pending', standardTimeMinutes: 90 },
    ],
  },
  {
    orderNumber: 'WO-00044',
    partName: 'Housing — Pump Casting',
    partCode: 'PH-200',
    customerName: 'Kirloskar',
    quantity: 100,
    quantityCompleted: 100,
    quantityScrapped: 2,
    priority: 'medium',
    status: 'completed',
    dueDate: new Date().toISOString().slice(0, 10),
    operations: [
      { id: 'op-1', name: 'Milling', sequence: 1, status: 'completed', standardTimeMinutes: 200, actualTimeMinutes: 215 },
      { id: 'op-2', name: 'Boring', sequence: 2, status: 'completed', standardTimeMinutes: 90, actualTimeMinutes: 88 },
      { id: 'op-3', name: 'Final QC', sequence: 3, status: 'completed', standardTimeMinutes: 30, actualTimeMinutes: 28 },
    ],
  },
];

export function useWorkOrders(
  tenantId: string | undefined,
  opts: UseWorkOrdersOptions = {}
) {
  const { plantId = 'all', statusFilter = 'all', search = '' } = opts;
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load / subscribe ────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) {
      setWorkOrders([]);
      setLoading(false);
      return;
    }

    const isSandbox =
      localStorage.getItem('isSandboxMode') === 'true' || !db;

    // ── Sandbox path — localStorage ────────────────────────────
    if (isSandbox) {
      const cacheKey = `flowops_work_orders_${tenantId}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        let list: WorkOrder[] = cached ? JSON.parse(cached) : [];

        if (list.length === 0) {
          list = SEED_WORK_ORDERS.map((w, i) => ({
            ...w,
            id: `wo_seed_${i + 1}`,
            tenantId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
          localStorage.setItem(cacheKey, JSON.stringify(list));
        }
        setWorkOrders(list);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load sandbox work orders');
        setLoading(false);
      }
      return;
    }

    // ── Production path ────────────────────────────────────────
    setLoading(true);

    const colRef = collection(db, 'tenants', tenantId, 'workOrders');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list: WorkOrder[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WorkOrder, 'id'>),
        }));
        setWorkOrders(list);
        setLoading(false);
      },
      (err) => {
        console.error('[useWorkOrders] Firestore error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [tenantId]);

  // ── Client-side filtering ───────────────────────────────────
  const filtered = workOrders.filter((wo) => {
    if (plantId !== 'all' && wo.plantId !== plantId) return false;
    if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        wo.orderNumber,
        wo.partName,
        wo.partCode ?? '',
        wo.customerName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // ── Update operation (start / pause / complete) ─────────────
  const updateOperation = useCallback(
    async (
      woId: string,
      operationId: string,
      patch: Partial<WorkOrderOperation> & { actorName?: string; actorId?: string }
    ) => {
      const nowIso = new Date().toISOString();
      const { actorName, actorId, ...opPatch } = patch;

      const isSandbox =
        localStorage.getItem('isSandboxMode') === 'true' || !db;

      if (isSandbox) {
        const cacheKey = `flowops_work_orders_${tenantId}`;
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return;
        const list: WorkOrder[] = JSON.parse(cached);

        const idx = list.findIndex((w) => w.id === woId);
        if (idx < 0) return;

        const wo = list[idx];
        const ops = wo.operations.map((op) =>
          op.id === operationId
            ? {
                ...op,
                ...opPatch,
                ...(actorName ? { startedByName: actorName } : {}),
                ...(actorId ? { startedByUserId: actorId } : {}),
              }
            : op
        );
        const targetOp = ops.find((o) => o.id === operationId);

        let nextWoStatus: WorkOrderStatus = wo.status;
        if (opPatch.status === 'in_progress') nextWoStatus = 'in_progress';
        if (opPatch.status === 'completed') {
          const allDone = ops.every((o) => o.status === 'completed');
          nextWoStatus = allDone ? 'completed' : 'in_progress';
        }

        list[idx] = {
          ...wo,
          operations: ops,
          status: nextWoStatus,
          currentOperationId:
            targetOp?.status === 'in_progress' ? operationId : wo.currentOperationId,
          updatedAt: nowIso,
          updatedByName: actorName,
          updatedBy: actorId,
        };
        localStorage.setItem(cacheKey, JSON.stringify(list));
        setWorkOrders([...list]);
        return;
      }

      // Production path
      const woRef = doc(db, 'tenants', tenantId!, 'workOrders', woId);
      const current = workOrders.find((w) => w.id === woId);
      if (!current) return;

      const ops = current.operations.map((op) =>
        op.id === operationId
          ? {
              ...op,
              ...opPatch,
              ...(actorName ? { startedByName: actorName } : {}),
              ...(actorId ? { startedByUserId: actorId } : {}),
            }
          : op
      );

      let nextWoStatus: WorkOrderStatus = current.status;
      if (opPatch.status === 'in_progress') nextWoStatus = 'in_progress';
      if (opPatch.status === 'completed') {
        const allDone = ops.every((o) => o.status === 'completed');
        nextWoStatus = allDone ? 'completed' : 'in_progress';
      }

      await updateDoc(woRef, {
        operations: ops,
        status: nextWoStatus,
        updatedAt: serverTimestamp(),
        updatedByName: actorName ?? null,
        updatedBy: actorId ?? null,
      });
    },
    [tenantId, workOrders]
  );

  // ── Update WO-level fields ──────────────────────────────────
  const updateWorkOrder = useCallback(
    async (woId: string, patch: Partial<WorkOrder>) => {
      const isSandbox =
        localStorage.getItem('isSandboxMode') === 'true' || !db;

      if (isSandbox) {
        const cacheKey = `flowops_work_orders_${tenantId}`;
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return;
        const list: WorkOrder[] = JSON.parse(cached);
        const idx = list.findIndex((w) => w.id === woId);
        if (idx < 0) return;
        list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
        localStorage.setItem(cacheKey, JSON.stringify(list));
        setWorkOrders([...list]);
        return;
      }

      await updateDoc(doc(db, 'tenants', tenantId!, 'workOrders', woId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    },
    [tenantId]
  );

  return {
    workOrders,
    filteredWorkOrders: filtered,
    loading,
    error,
    updateOperation,
    updateWorkOrder,
  };
}