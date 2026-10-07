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
import {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderOperation,
  WorkOrderPriority,
  ExplodedBomItem
} from '../types/workOrder';

export * from '../types/workOrder';

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
    orderNumber: 'WO-2026-0001',
    salesOrderId: 'so-tat-01',
    salesOrderNumber: 'SO-2026-0012',
    quoteNumber: 'Q-9021',
    customerPoNumber: 'PO-TAT-8921',
    partName: 'Gear Blank — 42T',
    partCode: 'GB-42T',
    customerName: 'Tata Motors',
    quantity: 250,
    quantityCompleted: 120,
    quantityScrapped: 3,
    priority: 'high',
    status: 'in_progress',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    autoExploded: true,
    bomItems: [
      {
        id: 'bom-gb-1',
        partNumber: 'RM-EN353-RD140',
        description: 'EN353 / 20MnCr5 Forged Round Billet Ø140mm',
        level: 1,
        itemType: 'raw_material',
        quantityPerUnit: 1.05,
        totalRequiredQuantity: 263,
        unit: 'pcs',
        materialGrade: 'EN353 Case Hardening Alloy Steel',
        stockAvailable: 300,
        allocatedStatus: 'allocated',
        leadTimeDays: 2
      },
      {
        id: 'bom-gb-2',
        partNumber: 'MFG-GB42T-CORE',
        description: 'Gear Blank — Machined Core Component',
        level: 1,
        itemType: 'manufactured',
        quantityPerUnit: 1,
        totalRequiredQuantity: 250,
        unit: 'pcs',
        materialGrade: 'Final Machined Part',
        stockAvailable: 0,
        allocatedStatus: 'shortage',
        leadTimeDays: 5
      },
      {
        id: 'bom-gb-3',
        partNumber: 'STD-FAST-M10X35',
        description: 'High-Tensile Hex Socket Head Screws M10 x 35mm (Gr 10.9)',
        level: 2,
        itemType: 'bought_out',
        quantityPerUnit: 4,
        totalRequiredQuantity: 1000,
        unit: 'pcs',
        materialGrade: 'High Tensile Steel Gr 10.9',
        stockAvailable: 1200,
        allocatedStatus: 'allocated',
        leadTimeDays: 1
      }
    ],
    operations: [
      { id: 'op-1', name: 'Material Cutting & Facing', sequence: 10, status: 'completed', standardTimeMinutes: 45, actualTimeMinutes: 42, workCenterName: 'Horizontal Band Saw #02' },
      { id: 'op-2', name: 'CNC Turning & OD/ID Roughing', sequence: 20, status: 'in_progress', standardTimeMinutes: 180, workCenterName: 'Doosan Puma CNC Lathe' },
      { id: 'op-3', name: 'Gear Hobbing & Spline Cutting', sequence: 30, status: 'pending', standardTimeMinutes: 120, workCenterName: 'Liebherr Gear Hobber' },
      { id: 'op-4', name: 'Heat Treatment & Case Hardening', sequence: 40, status: 'pending', standardTimeMinutes: 180, workCenterName: 'Sealed Quench & Induction Bay', isSubcontracted: true, subcontractorName: 'Pragati Heat Treaters (Pvt) Ltd' },
      { id: 'op-5', name: 'CMM & Final Inspection', sequence: 50, status: 'pending', standardTimeMinutes: 30, workCenterName: 'Zeiss CMM Quality Lab' },
    ],
  },
  {
    orderNumber: 'WO-2026-0002',
    salesOrderId: 'so-baj-02',
    salesOrderNumber: 'SO-2026-0015',
    quoteNumber: 'Q-9034',
    customerPoNumber: 'PO-BAJ-4410',
    partName: 'Shaft — Drive 30mm',
    partCode: 'DS-30',
    customerName: 'Bajaj Auto',
    quantity: 500,
    quantityCompleted: 0,
    quantityScrapped: 0,
    priority: 'urgent',
    status: 'ready',
    dueDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10),
    autoExploded: true,
    bomItems: [
      {
        id: 'bom-ds-1',
        partNumber: 'RM-EN19-RD65',
        description: 'EN19 Normalized / AISI 4140 Bright Round Bar Ø65mm',
        level: 1,
        itemType: 'raw_material',
        quantityPerUnit: 1.05,
        totalRequiredQuantity: 525,
        unit: 'pcs',
        materialGrade: 'EN19 Bright Steel',
        stockAvailable: 600,
        allocatedStatus: 'allocated',
        leadTimeDays: 2
      },
      {
        id: 'bom-ds-2',
        partNumber: 'MFG-DS30-CORE',
        description: 'Drive Shaft — Machined Component',
        level: 1,
        itemType: 'manufactured',
        quantityPerUnit: 1,
        totalRequiredQuantity: 500,
        unit: 'pcs',
        materialGrade: 'Precision Turned Shaft',
        stockAvailable: 0,
        allocatedStatus: 'shortage',
        leadTimeDays: 4
      },
      {
        id: 'bom-ds-3',
        partNumber: 'STD-SEAL-NBR70',
        description: 'Viton / Nitrile NBR 70 Shore Rotary Shaft Oil Seal',
        level: 2,
        itemType: 'bought_out',
        quantityPerUnit: 1,
        totalRequiredQuantity: 500,
        unit: 'pcs',
        materialGrade: 'NBR 70 Shore A / Spring Steel',
        stockAvailable: 450,
        allocatedStatus: 'partial',
        leadTimeDays: 2
      }
    ],
    operations: [
      { id: 'op-1', name: 'Bar Cutting & End Facing', sequence: 10, status: 'pending', standardTimeMinutes: 30, workCenterName: 'Band Saw Cell #01' },
      { id: 'op-2', name: 'CNC Turning & Threading', sequence: 20, status: 'pending', standardTimeMinutes: 240, workCenterName: 'Mazak Multi-Tasking Center' },
      { id: 'op-3', name: 'Cylindrical Finish Grinding', sequence: 30, status: 'pending', standardTimeMinutes: 90, workCenterName: 'Jones & Shipman Grinder' },
      { id: 'op-4', name: 'Final QC & Anti-Rust Coating', sequence: 40, status: 'pending', standardTimeMinutes: 25, workCenterName: 'Quality & Packing Bay' },
    ],
  },
  {
    orderNumber: 'WO-2026-0003',
    salesOrderId: 'so-kir-03',
    salesOrderNumber: 'SO-2026-0018',
    quoteNumber: 'Q-8977',
    customerPoNumber: 'PO-KIR-1102',
    partName: 'Housing — Pump Casting',
    partCode: 'PH-200',
    customerName: 'Kirloskar',
    quantity: 100,
    quantityCompleted: 100,
    quantityScrapped: 2,
    priority: 'medium',
    status: 'completed',
    dueDate: new Date().toISOString().slice(0, 10),
    autoExploded: true,
    bomItems: [
      {
        id: 'bom-ph-1',
        partNumber: 'RM-SGI-500-7',
        description: 'SG Iron 500/7 Graded Casting Blank',
        level: 1,
        itemType: 'raw_material',
        quantityPerUnit: 1,
        totalRequiredQuantity: 100,
        unit: 'pcs',
        materialGrade: 'SGI 500/7 Ductile Iron',
        stockAvailable: 100,
        allocatedStatus: 'allocated',
        leadTimeDays: 3
      },
      {
        id: 'bom-ph-2',
        partNumber: 'MFG-PH200-CORE',
        description: 'Pump Housing — Precision Machined Casting',
        level: 1,
        itemType: 'manufactured',
        quantityPerUnit: 1,
        totalRequiredQuantity: 100,
        unit: 'pcs',
        materialGrade: 'Ductile Iron Finished Part',
        stockAvailable: 100,
        allocatedStatus: 'allocated',
        leadTimeDays: 5
      }
    ],
    operations: [
      { id: 'op-1', name: 'Milling & Face Boring', sequence: 10, status: 'completed', standardTimeMinutes: 200, actualTimeMinutes: 215, workCenterName: 'Mazak 4-Axis VMC Center' },
      { id: 'op-2', name: 'Precision Line Boring', sequence: 20, status: 'completed', standardTimeMinutes: 90, actualTimeMinutes: 88, workCenterName: 'Precision Boring Cell' },
      { id: 'op-3', name: 'Hydrostatic Pressure & Final QC', sequence: 30, status: 'completed', standardTimeMinutes: 30, actualTimeMinutes: 28, workCenterName: 'Pressure Test Rig #01' },
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
      const loadLocal = () => {
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
      };

      loadLocal();

      const handleUpdateEvent = () => {
        loadLocal();
      };

      window.addEventListener('flowops:workorders_updated', handleUpdateEvent);
      return () => {
        window.removeEventListener('flowops:workorders_updated', handleUpdateEvent);
      };
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