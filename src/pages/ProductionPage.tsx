// src/pages/ProductionPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlants } from '../hooks/usePlants';
import { useProductionBoard } from '../hooks/useProduction';
import { ExportButton } from '../components/ExportButton';
import { Order } from '../types';
import {
  WorkOrder,
  WorkOrderStatus,
  WorkOrderOperation,
  useWorkOrders,
} from '../hooks/useWorkOrders';
import {
  Layers,
  Search,
  Plus,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  PauseCircle,
  Clock,
  User,
  X,
  ScanLine,
  Boxes,
  TrendingUp,
  Zap,
  ClipboardList,
  ArrowRight,
  Printer,
  FileText,
  ExternalLink,
  CalendarClock,
  Split,
  Merge,
  GitBranch,
  Tablet,
  Gauge,
  UserCheck,
  AlertOctagon
} from 'lucide-react';
import { GenerateWorkOrdersModal } from '../components/orders/GenerateWorkOrdersModal';
import { ShopTravelerModal } from '../components/orders/ShopTravelerModal';
import { WorkOrderSplitModal } from '../components/workOrders/WorkOrderSplitModal';
import { WorkOrderMergeModal } from '../components/workOrders/WorkOrderMergeModal';
import { WorkOrderGenealogyModal } from '../components/workOrders/WorkOrderGenealogyModal';
import { qualityHoldService } from '../services/qualityHoldService';
import { QualityHoldBadge } from '../components/quality-holds/QualityHoldBadge';

// ── Step 4.4 — Scanner wiring ───────────────────────────────
import { BarcodeScanner } from '../components/BarcodeScanner';
import { useScanToIdentify } from '../hooks/useScanToIdentify';
import { ScanResult } from '../services/scannerService';

// ── Backorders Queue Integration ────────────────────────────
import { BackordersProductionQueue } from '../components/production/BackordersProductionQueue';
import { getBackordersSync } from '../services/partialDispatchService';

// ── Status metadata ─────────────────────────────────────────
const STATUS_META: Record<
  WorkOrderStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  draft:       { label: 'Draft',       color: 'text-slate-500',   bg: 'bg-slate-50',    border: 'border-slate-200',  icon: <Clock size={12} /> },
  pending:     { label: 'Pending',     color: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-300',  icon: <Clock size={12} /> },
  ready:       { label: 'Ready',       color: 'text-sky-700',     bg: 'bg-sky-50',      border: 'border-sky-200',    icon: <Zap size={12} /> },
  in_progress: { label: 'In Progress', color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200',icon: <PlayCircle size={12} /> },
  paused:      { label: 'Paused',      color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',  icon: <PauseCircle size={12} /> },
  completed:   { label: 'Completed',   color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200', icon: <CheckCircle2 size={12} /> },
  cancelled:   { label: 'Cancelled',   color: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-200',   icon: <X size={12} /> },
  split:       { label: 'Split (Parent)', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: <Split size={12} /> },
  merged:      { label: 'Merged',      color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200', icon: <Merge size={12} /> },
};

const PRIORITY_META: Record<
  WorkOrder['priority'],
  { label: string; className: string }
> = {
  low:    { label: 'Low',    className: 'text-slate-500 bg-slate-100 border-slate-200' },
  medium: { label: 'Medium', className: 'text-sky-700 bg-sky-50 border-sky-200' },
  high:   { label: 'High',   className: 'text-amber-700 bg-amber-50 border-amber-200' },
  urgent: { label: 'Urgent', className: 'text-rose-700 bg-rose-50 border-rose-200 animate-pulse' },
};

export const ProductionPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { orders: allSalesOrders } = useProductionBoard(tenant?.id);

  // ── Hooks in stable order ─────────────────────────────────
  const [selectedPlantId, setSelectedPlantId] = useState<string>(() =>
    localStorage.getItem('production_selected_plant_id') || 'all'
  );
  const { plants } = usePlants(tenant?.id);

  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    filteredWorkOrders,
    workOrders,
    loading,
    error,
    updateOperation,
    updateWorkOrder,
    splitWorkOrder,
    mergeWorkOrders,
  } = useWorkOrders(tenant?.id, {
    plantId: selectedPlantId,
    statusFilter,
    search: searchQuery,
  });

  // ── Detail drawer state ───────────────────────────────────
  const [activeWoId, setActiveWoId] = useState<string | null>(null);
  const activeWo = useMemo(
    () => workOrders.find((w) => w.id === activeWoId) ?? null,
    [workOrders, activeWoId]
  );

  // ── Splitting & Merging Modal State ───────────────────────
  const [splitModalWo, setSplitModalWo] = useState<WorkOrder | null>(null);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<WorkOrder[]>([]);
  const [genealogyWoId, setGenealogyWoId] = useState<string | null>(null);

  // ── Sales Order → Work Order Generation & Shop Traveler Modals ──
  const [isSoPickerOpen, setIsSoPickerOpen] = useState(false);
  const [selectedSoForGeneration, setSelectedSoForGeneration] = useState<Order | null>(null);
  const [travelerWo, setTravelerWo] = useState<WorkOrder | null>(null);

  // ── Backorders Queue & View Switcher ──────────────────────
  const [mainQueueTab, setMainQueueTab] = useState<'work_orders' | 'backorders'>('work_orders');
  
  const linkedBackorders = useMemo(() => {
    if (!tenant?.id) return [];
    try {
      return getBackordersSync(tenant.id);
    } catch {
      return [];
    }
  }, [tenant?.id, mainQueueTab]);

  const activeBackordersCount = useMemo(() => {
    return linkedBackorders.filter(b => b.status !== 'fulfilled' && b.status !== 'cancelled').length;
  }, [linkedBackorders]);

  // ═════════════════════════════════════════════════════════
  // STEP 4.4 — Scanner wiring
  // ═════════════════════════════════════════════════════════
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedWo, setScannedWo] = useState<{ number: string; source: string } | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'err'; text: string } | null>(null);

  const { resolve: resolveScan } = useScanToIdentify(tenant?.id ?? null, {
    plantId: selectedPlantId === 'all' ? undefined : selectedPlantId,
  });

  const handleScan = async (result: ScanResult) => {
    setScanError(null);
    setScannedWo(null);

    const entity = await resolveScan(result);

    // Reject anything that isn't a work order
    if (!entity || entity.type !== 'workOrder') {
      setScanError(
        `Barcode "${result.raw}" is not a Work Order. Expected format: WO-xxxxx.`
      );
      setScannerOpen(false);
      return;
    }

    // Try to match against the currently loaded list
    const match =
      workOrders.find(
        (w) =>
          w.orderNumber === entity.code ||
          w.orderNumber === (entity.data?.orderNumber as string) ||
          w.id === entity.id
      ) ?? null;

    if (!match) {
      setScanError(
        `Work Order "${entity.code}" not found in this plant's active queue.`
      );
      setScannerOpen(false);
      return;
    }

    // Found — highlight + open drawer
    setScannedWo({ number: match.orderNumber, source: entity.source });
    setActiveWoId(match.id);
    setScannerOpen(false);

    // Optional: clear the banner automatically after a few seconds
    setTimeout(() => setScannedWo(null), 6000);
  };

  // ── Operation actions ─────────────────────────────────────
  const handleStartOperation = async (wo: WorkOrder, op: WorkOrderOperation) => {
    const hold = qualityHoldService.getActiveHoldForTarget(wo.orderNumber);
    if (hold && hold.preventProductionProgression) {
      setActionMsg({
        type: 'err',
        text: `Operation Blocked: ${wo.orderNumber} is on Quality Hold [${hold.id}]. Reason: ${hold.holdReason}. Quality release sign-off required.`
      });
      return;
    }

    setActionSubmitting(true);
    setActionMsg(null);
    try {
      await updateOperation(wo.id, op.id, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        actorId: profile?.uid,
        actorName: profile?.name,
      });
      setActionMsg({
        type: 'success',
        text: `Started "${op.name}" on ${wo.orderNumber}`,
      });
    } catch (e: any) {
      setActionMsg({ type: 'err', text: e?.message ?? 'Failed to start operation' });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleCompleteOperation = async (
    wo: WorkOrder,
    op: WorkOrderOperation,
    actualMinutes: number
  ) => {
    setActionSubmitting(true);
    setActionMsg(null);
    try {
      await updateOperation(wo.id, op.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        actualTimeMinutes: actualMinutes,
      });
      setActionMsg({
        type: 'success',
        text: `Completed "${op.name}" on ${wo.orderNumber}`,
      });
    } catch (e: any) {
      setActionMsg({ type: 'err', text: e?.message ?? 'Failed to complete operation' });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handlePauseOperation = async (wo: WorkOrder, op: WorkOrderOperation) => {
    setActionSubmitting(true);
    setActionMsg(null);
    try {
      await updateOperation(wo.id, op.id, { status: 'paused' });
      setActionMsg({ type: 'success', text: `Paused "${op.name}"` });
    } catch (e: any) {
      setActionMsg({ type: 'err', text: e?.message ?? 'Failed to pause' });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleQuickQtyUpdate = async (wo: WorkOrder, produced: number, scrap: number) => {
    setActionSubmitting(true);
    setActionMsg(null);
    try {
      await updateWorkOrder(wo.id, {
        quantityCompleted: (wo.quantityCompleted ?? 0) + produced,
        quantityScrapped: (wo.quantityScrapped ?? 0) + scrap,
        updatedByName: profile?.name,
        updatedBy: profile?.uid,
      });
      setActionMsg({ type: 'success', text: `Logged +${produced} produced · +${scrap} scrap` });
    } catch (e: any) {
      setActionMsg({ type: 'err', text: e?.message ?? 'Failed to log output' });
    } finally {
      setActionSubmitting(false);
    }
  };

  // ── KPIs ──────────────────────────────────────────────────
  const plantScopedWorkOrders = workOrders.filter(
    (w) => selectedPlantId === 'all' || w.plantId === selectedPlantId
  );
  const kpi = {
    total: plantScopedWorkOrders.length,
    inProgress: plantScopedWorkOrders.filter((w) => w.status === 'in_progress').length,
    ready: plantScopedWorkOrders.filter((w) => w.status === 'ready').length,
    overdue: plantScopedWorkOrders.filter((w) => {
      if (!w.dueDate || w.status === 'completed') return false;
      return new Date(w.dueDate).getTime() < Date.now();
    }).length,
  };

  // ── Helpers ───────────────────────────────────────────────
  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const isOverdue = (wo: WorkOrder) =>
    !!wo.dueDate && wo.status !== 'completed' && new Date(wo.dueDate).getTime() < Date.now();

  const nextPendingOperation = (wo: WorkOrder): WorkOrderOperation | undefined => {
    if (wo.currentOperationId) {
      const cur = wo.operations.find((o) => o.id === wo.currentOperationId);
      if (cur && cur.status === 'in_progress') return cur;
    }
    return wo.operations
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .find((o) => o.status === 'pending' || o.status === 'paused');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-8 font-sans text-slate-800">

      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-xs font-mono uppercase text-sky-600 bg-sky-50 px-2 py-1 rounded font-bold tracking-wider">
            Shop Floor Module
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-2 flex items-center gap-2">
            <Layers className="h-7 w-7 text-sky-600" />
            Production Line & Work Orders
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Scan a work-order traveler to start, pause, or complete an operation on the shop floor.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-stretch">
          {/* ── STEP 4.4 — Scan Work Order ─────────────────── */}
          <button
            onClick={() => {
              setScanError(null);
              setScannedWo(null);
              setScannerOpen(true);
            }}
            id="scan-work-order-btn"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono uppercase py-2.5 px-4 rounded-lg font-bold shadow-sm transition-all focus:ring-2 focus:ring-slate-500 cursor-pointer"
          >
            <ScanLine className="h-4 w-4 text-sky-400" />
            Scan Work Order
          </button>

          <ExportButton
            data={filteredWorkOrders}
            filenamePrefix="work_orders"
            headersMap={{
              orderNumber: 'WO Number',
              partName: 'Part Name',
              partCode: 'Part Code',
              customerName: 'Customer',
              quantity: 'Quantity',
              quantityCompleted: 'Completed',
              quantityScrapped: 'Scrap',
              status: 'Status',
              dueDate: 'Due Date',
            }}
            label="Export CSV"
          />

          <button
            onClick={() => navigate('/scheduling')}
            className="flex items-center gap-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80 text-xs font-mono uppercase py-2 px-3.5 rounded-lg font-bold shadow-xs transition-all cursor-pointer"
            title="Inspect Machine Capacity & Bottlenecks"
          >
            <CalendarClock className="h-4 w-4 text-indigo-400" />
            <span>Capacity Scheduler</span>
          </button>

          <button
            onClick={() => navigate('/work-instructions')}
            className="flex items-center gap-2 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/80 text-xs font-mono uppercase py-2 px-3.5 rounded-lg font-bold shadow-xs transition-all cursor-pointer"
            title="Digital Work Instructions with CAD drawings, videos, and step sign-offs on tablet"
          >
            <Tablet className="h-4 w-4 text-cyan-400" />
            <span>Tablet Instructions</span>
          </button>

          <button
            onClick={() => navigate('/time-capture')}
            className="flex items-center gap-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 text-xs font-mono uppercase py-2 px-3.5 rounded-lg font-bold shadow-xs transition-all cursor-pointer"
            title="Operator Start/Stop Time Capture Terminal with live stopwatch timers"
          >
            <Clock className="h-4 w-4 text-emerald-400" />
            <span>Time Clock Kiosk</span>
          </button>

          <button
            onClick={() => navigate('/oee')}
            className="flex items-center gap-2 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/80 text-xs font-mono uppercase py-2 px-3.5 rounded-lg font-bold shadow-xs transition-all cursor-pointer"
            title="Machine Connectivity & Real-Time OEE telemetry from PLCs and sensors"
          >
            <Gauge className="h-4 w-4 text-cyan-400" />
            <span>Machine OEE</span>
          </button>

          <button
            onClick={() => navigate('/production-genealogy')}
            className="flex items-center gap-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80 text-xs font-mono uppercase py-2 px-3.5 rounded-lg font-bold shadow-xs transition-all cursor-pointer"
            title="Complete Unit & Batch Production Genealogy with Operator, Machine, and Timestamp Lineage"
          >
            <GitBranch className="h-4 w-4 text-indigo-400" />
            <span>Genealogy &amp; Trace</span>
          </button>

          <button
            onClick={() => navigate('/shift-handover')}
            className="flex items-center gap-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80 text-xs font-mono uppercase py-2 px-3.5 rounded-lg font-bold shadow-xs transition-all cursor-pointer"
            title="Digital Shift Handover Notes &amp; Machine Status Handshake"
          >
            <UserCheck className="h-4 w-4 text-indigo-400" />
            <span>Shift Handover</span>
          </button>

          <button
            onClick={() => {
              setSelectedForMerge([]);
              setIsMergeModalOpen(true);
            }}
            className="flex items-center gap-2 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-700/80 text-xs font-mono uppercase py-2 px-3.5 rounded-lg font-bold shadow-xs transition-all cursor-pointer"
            title="Merge multiple small work orders for identical parts into a consolidated run"
          >
            <Merge className="h-4 w-4 text-purple-400" />
            <span>Merge Orders</span>
          </button>

          <button
            id="new-work-order-btn"
            onClick={() => setIsSoPickerOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono uppercase py-2.5 px-4 rounded-lg font-bold shadow-sm transition-all focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            title="Generate Work Orders from Confirmed Sales Order with Auto-BOM explosion"
          >
            <Zap className="h-4 w-4 text-indigo-200" />
            <span>Generate Work Order</span>
          </button>
        </div>
      </div>

      {/* ── Scanned WO confirmation banner ─────────────────── */}
      {scannedWo && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-sky-50 border border-sky-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-sky-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-sky-900">
                Scanned Work Order: <span className="font-mono">{scannedWo.number}</span>
              </p>
              <p className="text-xs text-sky-700">
                Detail drawer opened below.
                <span className="ml-2 text-[10px] font-mono uppercase tracking-wider bg-white/60 px-1.5 py-0.5 rounded">
                  via {scannedWo.source}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setScannedWo(null)}
            className="p-1.5 rounded-lg hover:bg-sky-100 text-sky-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Scan error banner ─────────────────────────────── */}
      {scanError && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50 border border-rose-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <p className="text-sm font-semibold text-rose-800">{scanError}</p>
          </div>
          <button
            onClick={() => setScanError(null)}
            className="p-1.5 rounded-lg hover:bg-rose-100 transition-colors"
          >
            <X className="h-4 w-4 text-rose-600" />
          </button>
        </div>
      )}

      {/* ── View Mode Switcher: Work Orders Queue vs Backorders Queue ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMainQueueTab('work_orders')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase font-bold transition cursor-pointer ${
              mainQueueTab === 'work_orders'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="h-4 w-4 text-sky-400" />
            <span>Work Orders Queue</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              mainQueueTab === 'work_orders' ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {filteredWorkOrders.length}
            </span>
          </button>

          <button
            id="backorders-queue-tab"
            onClick={() => setMainQueueTab('backorders')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono uppercase font-bold transition cursor-pointer ${
              mainQueueTab === 'backorders'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-200'
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Backorders Queue</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              mainQueueTab === 'backorders' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900 font-extrabold'
            }`}>
              {activeBackordersCount}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span>Plant Filter: <strong>{selectedPlantId === 'all' ? 'All Plants' : plants.find(p => p.id === selectedPlantId)?.name || selectedPlantId}</strong></span>
        </div>
      </div>

      {mainQueueTab === 'backorders' ? (
        <BackordersProductionQueue plantId={selectedPlantId} />
      ) : (
        <>
          {/* 2. KPI Board */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<ClipboardList size={18} />} label="Total Work Orders" value={kpi.total} />
        <KpiCard icon={<PlayCircle size={18} />}   label="In Progress"       value={kpi.inProgress} accent="emerald" />
        <KpiCard icon={<Zap size={18} />}          label="Ready to Start"    value={kpi.ready} accent="sky" />
        <KpiCard icon={<AlertTriangle size={18} />} label="Overdue"          value={kpi.overdue} accent="rose" />
      </div>

      {/* 3. Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">

          {/* Status tabs */}
          <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-1 md:pb-0 scrollbar-none">
            {(['all', 'pending', 'ready', 'in_progress', 'paused', 'completed', 'split', 'merged'] as const).map((tab) => {
              const active = statusFilter === tab;
              const count =
                tab === 'all'
                  ? plantScopedWorkOrders.length
                  : plantScopedWorkOrders.filter((w) => w.status === tab).length;

              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wide cursor-pointer transition-all shrink-0 flex items-center gap-1.5
                    ${active
                      ? 'bg-slate-900 text-white font-bold shadow-xs'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200/60'}
                  `}
                >
                  {tab === 'all' ? 'All WOs' : STATUS_META[tab].label}
                  <span
                    className={`px-1 py-0.2 rounded text-[10px] font-mono ${
                      active ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center grow max-w-2xl">
            {/* Plant filter */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 shrink-0">
                Plant:
              </span>
              <select
                value={selectedPlantId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPlantId(val);
                  localStorage.setItem('production_selected_plant_id', val);
                }}
                className="text-xs font-bold text-slate-700 bg-transparent border-none focus:ring-0 p-0 pr-6 cursor-pointer"
              >
                <option value="all">🌐 All Plants</option>
                {plants?.map((p) => (
                  <option key={p.id} value={p.id}>
                    🏭 {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative grow">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search WO number, part, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white text-slate-800"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2 text-[10px] text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Data Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            Loading active work order queue...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 bg-red-50/50 rounded-lg m-4 text-xs font-mono">
            {error}
          </div>
        ) : filteredWorkOrders.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Boxes className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No work orders found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Adjust search parameters.'
                : 'Create a work order or scan a traveler barcode to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">WO Number</th>
                  <th className="py-3.5 px-4 font-semibold">Part</th>
                  <th className="py-3.5 px-4 font-semibold">Customer</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Progress</th>
                  <th className="py-3.5 px-4 font-semibold">Stage</th>
                  <th className="py-3.5 px-4 font-semibold">Due</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkOrders.map((wo) => {
                  const status = STATUS_META[wo.status];
                  const priority = PRIORITY_META[wo.priority];
                  const progress = wo.quantity > 0
                    ? Math.round(((wo.quantityCompleted ?? 0) / wo.quantity) * 100)
                    : 0;
                  const overdue = isOverdue(wo);
                  const nextOp = nextPendingOperation(wo);

                  return (
                    <tr
                      key={wo.id}
                      onClick={() => setActiveWoId(wo.id)}
                      className={`
                        cursor-pointer transition-all text-xs
                        ${activeWoId === wo.id ? 'bg-sky-500/10 border-l-4 border-sky-500' : 'hover:bg-slate-50/70 border-l-4 border-transparent'}
                        ${overdue && activeWoId !== wo.id ? 'bg-rose-500/5' : ''}
                      `}
                    >
                      <td className="py-4 px-4 font-mono font-bold text-slate-900 tracking-tight">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{wo.orderNumber}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${priority.className}`}
                          >
                            {priority.label}
                          </span>
                          {wo.isChild && (
                            <span 
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200"
                              title={`Child of ${wo.parentOrderNumber}`}
                            >
                              Child
                            </span>
                          )}
                          {wo.isSplitParent && (
                            <span 
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                              title={`Split into ${(wo.childOrderNumbers || []).join(', ')}`}
                            >
                              Parent ({wo.childOrderNumbers?.length || 0})
                            </span>
                          )}
                          {wo.isMerged && (
                            <span 
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200"
                              title={`Merged from ${(wo.mergedFromOrderNumbers || []).join(', ')}`}
                            >
                              Merged
                            </span>
                          )}
                          {(() => {
                            const hold = qualityHoldService.getActiveHoldForTarget(wo.orderNumber);
                            if (hold) {
                              return (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-500/80 flex items-center gap-1 animate-pulse"
                                  title={`Quality Hold Active: ${hold.holdReason}`}
                                >
                                  <AlertOctagon className="w-2.5 h-2.5 text-rose-400" />
                                  HOLD
                                </span>
                              );
                            }
                            return null;
                          })()}
                          {linkedBackorders.some(b => (b.originalOrderNumber === wo.orderNumber || b.orderNumber === wo.orderNumber || (wo.salesOrderNumber && b.originalOrderNumber === wo.salesOrderNumber)) && b.status !== 'fulfilled' && b.status !== 'cancelled') && (
                            <span 
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 cursor-pointer hover:bg-amber-200 transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMainQueueTab('backorders');
                              }}
                              title="Has active follow-on backorders in queue. Click to open Backorders Queue."
                            >
                              <Boxes className="w-2.5 h-2.5" />
                              Backorder
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-700">{wo.partName}</div>
                        {wo.partCode && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {wo.partCode}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-600">{wo.customerName ?? '—'}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-mono text-xs">
                          <span className="font-black text-slate-900">{wo.quantityCompleted ?? 0}</span>
                          <span className="text-slate-400"> / {wo.quantity}</span>
                        </div>
                        <div className="h-1.5 w-24 bg-slate-200 rounded-full mt-1.5 ml-auto overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${status.bg} ${status.color} ${status.border}`}
                          >
                            {status.icon}
                            {status.label}
                          </span>
                        </div>
                        {nextOp && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            Next: {nextOp.name}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`font-mono text-xs ${
                            overdue ? 'text-rose-600 font-bold' : 'text-slate-600'
                          }`}
                        >
                          {formatDate(wo.dueDate)}
                        </span>
                        {overdue && (
                          <div className="text-[9px] text-rose-500 font-bold uppercase mt-0.5">
                            Overdue
                          </div>
                        )}
                      </td>
                      <td
                        className="py-4 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-center items-center gap-1.5">
                          {nextOp && wo.status !== 'completed' && wo.status !== 'cancelled' && wo.status !== 'split' && wo.status !== 'merged' && (
                            <button
                              onClick={() => handleStartOperation(wo, nextOp)}
                              disabled={actionSubmitting}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-mono uppercase font-bold px-2 py-1 rounded cursor-pointer transition-colors disabled:opacity-50"
                              title={`Start ${nextOp.name}`}
                            >
                              ▶ Start
                            </button>
                          )}
                          {wo.status !== 'completed' && wo.status !== 'cancelled' && !wo.isSplitParent && wo.status !== 'merged' && (
                            <button
                              onClick={() => setSplitModalWo(wo)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-mono uppercase font-bold px-2 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
                              title="Split this work order into child batches"
                            >
                              <Split className="w-2.5 h-2.5" />
                              Split
                            </button>
                          )}
                          <button
                            onClick={() => setGenealogyWoId(wo.id)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-mono uppercase font-bold px-1.5 py-1 rounded cursor-pointer transition-colors"
                            title="View Genealogy Lineage & Family Tree"
                          >
                            <GitBranch className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setActiveWoId(wo.id)}
                            className="bg-sky-50 hover:bg-sky-100 text-sky-600 text-[10px] font-mono uppercase font-bold px-2 py-1 rounded cursor-pointer transition-colors"
                          >
                            Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* 5. Detail Side Drawer — Start / Complete Operation */}
      {activeWo && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30 transition-opacity"
            onClick={() => setActiveWoId(null)}
          />
          <div
            id="work-order-drawer"
            className="fixed inset-y-0 right-0 w-full md:w-8/12 lg:w-6/12 bg-white h-screen shadow-2xl z-40 overflow-y-auto border-l border-slate-200 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10 shadow-xs">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                  Work Order Detail
                </span>
                <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5 flex items-center gap-2 uppercase font-display">
                  <Layers className="h-5 w-5 text-sky-600 shrink-0" />
                  {activeWo.orderNumber}
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                      STATUS_META[activeWo.status].bg
                    } ${STATUS_META[activeWo.status].color} ${STATUS_META[activeWo.status].border}`}
                  >
                    {STATUS_META[activeWo.status].icon}
                    {STATUS_META[activeWo.status].label}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${
                      PRIORITY_META[activeWo.priority].className
                    }`}
                  >
                    {PRIORITY_META[activeWo.priority].label}
                  </span>
                  {(() => {
                    const hold = qualityHoldService.getActiveHoldForTarget(activeWo.orderNumber);
                    if (hold) {
                      return <QualityHoldBadge status="active_hold" holdId={hold.id} size="sm" />;
                    }
                    return null;
                  })()}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => navigate('/quality-holds')}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
                  title="Quality Hold & Containment Management"
                >
                  <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
                  <span className="hidden sm:inline">Quality Hold</span>
                </button>
                {activeWo.status !== 'completed' && activeWo.status !== 'cancelled' && !activeWo.isSplitParent && activeWo.status !== 'merged' && (
                  <button
                    type="button"
                    onClick={() => setSplitModalWo(activeWo)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-mono font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
                    title="Split into child work orders across machines or shifts"
                  >
                    <Split className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Split Order</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setGenealogyWoId(activeWo.id)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
                  title="View Genealogy Lineage & Family Tree"
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Genealogy</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTravelerWo(activeWo)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-mono font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
                  title="Print / View Shop Traveler Slip"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Traveler Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/work-instructions?wo=${activeWo.orderNumber}`)}
                  className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 text-xs font-mono font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
                  title="Open Digital Work Instructions on Tablet"
                >
                  <Tablet className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tablet SOP</span>
                </button>
                <button
                  onClick={() => setActiveWoId(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Active Quality Hold Lockdown Alert Banner */}
            {(() => {
              const hold = qualityHoldService.getActiveHoldForTarget(activeWo.orderNumber);
              if (hold) {
                return (
                  <div className="mx-4 md:mx-6 mt-4 p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl flex items-start justify-between gap-3 shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                            QUALITY CONTAINMENT HOLD ACTIVE [{hold.id}]
                          </strong>
                          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 font-bold uppercase">
                            {hold.severity}
                          </span>
                        </div>
                        <p className="text-xs text-rose-800 font-medium leading-tight mt-0.5">
                          {hold.holdReason}
                        </p>
                        <p className="text-[10px] text-rose-700 font-mono mt-1">
                          Containment: {hold.location} · Placed by {hold.placedBy} · Operations &amp; Dispatch Blocked
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/quality-holds')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-mono uppercase tracking-wider shrink-0 shadow-xs transition"
                    >
                      Open Release Desk
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">

              {/* Action feedback */}
              {actionMsg && (
                <div
                  className={`p-2.5 rounded text-[11px] font-mono ${
                    actionMsg.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {actionMsg.text}
                </div>
              )}

              {/* Genealogy / Lineage Card if Child, Split Parent, or Merged */}
              {(activeWo.isChild || activeWo.isSplitParent || activeWo.isMerged) && (
                <div className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                  activeWo.isChild
                    ? 'bg-teal-50 border-teal-200 text-teal-900'
                    : activeWo.isSplitParent
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                    : 'bg-purple-50 border-purple-200 text-purple-900'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      activeWo.isChild ? 'bg-teal-200/60 text-teal-800' : activeWo.isSplitParent ? 'bg-indigo-200/60 text-indigo-800' : 'bg-purple-200/60 text-purple-800'
                    }`}>
                      {activeWo.isChild ? <Split className="w-4 h-4" /> : activeWo.isSplitParent ? <Split className="w-4 h-4" /> : <Merge className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="font-bold block">
                        {activeWo.isChild
                          ? `Child Batch of Parent ${activeWo.parentOrderNumber || 'WO'}`
                          : activeWo.isSplitParent
                          ? `Split Parent Order (Divided into ${(activeWo.childOrderNumbers || []).length} child batches)`
                          : `Merged Consolidated Order (Combined from ${(activeWo.mergedFromOrderNumbers || []).length} source orders)`}
                      </span>
                      <span className="text-[11px] opacity-80">
                        {activeWo.isChild && activeWo.splitRatio
                          ? `Split fraction: ${(activeWo.splitRatio * 100).toFixed(0)}% (${activeWo.quantity} of ${activeWo.splitFromQuantity} pcs) • ${activeWo.splitReason || 'Operational split'}`
                          : activeWo.splitReason || activeWo.mergedReason || 'Optimized production run'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGenealogyWoId(activeWo.id)}
                    className="px-2.5 py-1 rounded bg-white border border-current text-[11px] font-bold shadow-3xs hover:bg-slate-50 transition cursor-pointer shrink-0"
                  >
                    View Family Tree
                  </button>
                </div>
              )}

              {/* Linking SO → WO → Operations Traceability Card */}
              <div className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-200/80 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-indigo-900">
                    <Zap className="h-4 w-4 text-indigo-600" />
                    <span>SO → WO Traceability Linkage</span>
                  </div>
                  {activeWo.salesOrderId && (
                    <button
                      type="button"
                      onClick={() => navigate('/orders', { state: { preselectedOrderId: activeWo.salesOrderId } })}
                      className="text-[10px] font-mono text-indigo-700 hover:text-indigo-950 font-bold inline-flex items-center space-x-1 bg-white border border-indigo-200 px-2 py-0.5 rounded cursor-pointer transition-colors shadow-3xs"
                    >
                      <span>Open Sales Order</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-[9px] uppercase text-indigo-600 font-bold block">Sales Order #</span>
                    <span className="font-bold text-slate-900">{activeWo.salesOrderNumber || 'SO-2026-0012'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-indigo-600 font-bold block">Customer PO #</span>
                    <span className="font-bold text-slate-900">{activeWo.customerPoNumber || 'Direct PO'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-indigo-600 font-bold block">Originating Quote</span>
                    <span className="font-bold text-slate-900">#{activeWo.quoteNumber || 'Q-9021'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-[10.5px] font-mono text-indigo-800">
                  <span>Routing: <strong>{activeWo.operations.length} sequence stages</strong></span>
                  <span>Auto-Exploded: <strong>{activeWo.bomItems?.length || 0} BOM lines</strong></span>
                </div>
              </div>

              {/* WO summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Part</span>
                    <span className="font-semibold text-slate-800">{activeWo.partName}</span>
                    {activeWo.partCode && (
                      <span className="ml-2 text-[10px] text-slate-400">({activeWo.partCode})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Customer</span>
                    <span className="font-semibold text-slate-800">
                      {activeWo.customerName ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Quantity</span>
                    <span className="font-black text-slate-900 text-sm">
                      {activeWo.quantityCompleted ?? 0}
                      <span className="text-[10px] text-slate-400 font-normal">
                        {' '}/ {activeWo.quantity}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Scrap</span>
                    <span className="font-semibold text-rose-600">
                      {activeWo.quantityScrapped ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Due Date</span>
                    <span className={`font-semibold ${isOverdue(activeWo) ? 'text-rose-600' : 'text-slate-800'}`}>
                      {formatDate(activeWo.dueDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Last Update</span>
                    <span className="font-semibold text-slate-800">
                      {activeWo.updatedByName ?? '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Exploded Bill of Materials (BOM) Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Boxes className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-bold">
                      Auto-Exploded Bill of Materials ({activeWo.bomItems?.length || 0} Components)
                    </h3>
                  </div>
                  <span className="text-[9.5px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold uppercase">
                    Auto-Exploded
                  </span>
                </div>

                {activeWo.bomItems && activeWo.bomItems.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="bg-slate-50 text-[9px] uppercase font-bold text-slate-500 border-b border-slate-200">
                          <th className="p-2.5">Level</th>
                          <th className="p-2.5">Part / Description</th>
                          <th className="p-2.5">Material</th>
                          <th className="p-2.5 text-right">Qty/Unit</th>
                          <th className="p-2.5 text-right">Total Req.</th>
                          <th className="p-2.5 text-right">Stock Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {activeWo.bomItems.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/50">
                            <td className="p-2.5 text-slate-400 font-bold">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                b.level === 1 ? 'bg-indigo-50 text-indigo-700 font-bold' : 'bg-slate-100 text-slate-600'
                              }`}>
                                L{b.level}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className="font-bold text-slate-900 block font-sans">{b.description}</span>
                              <span className="text-[10px] text-slate-400">{b.partNumber}</span>
                            </td>
                            <td className="p-2.5 text-slate-600 text-[10px]">
                              {b.materialGrade || '—'}
                            </td>
                            <td className="p-2.5 text-right font-medium text-slate-700">
                              {b.quantityPerUnit} {b.unit}
                            </td>
                            <td className="p-2.5 text-right font-black text-slate-900">
                              {b.totalRequiredQuantity} {b.unit}
                            </td>
                            <td className="p-2.5 text-right">
                              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                b.allocatedStatus === 'allocated'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : b.allocatedStatus === 'shortage'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {b.allocatedStatus ? b.allocatedStatus.toUpperCase() : 'ALLOCATED'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500 font-mono">
                    Direct manufactured component. Standard raw billet & cutting allowances applied.
                  </div>
                )}
              </div>

              {/* Operations timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-slate-500" />
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                      Operations Sequence
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {activeWo.operations.filter((o) => o.status === 'completed').length} / {activeWo.operations.length} done
                  </span>
                </div>

                <div className="space-y-2">
                  {activeWo.operations
                    .slice()
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((op) => {
                      const opMeta = STATUS_META[op.status];
                      const isCurrent = op.status === 'in_progress';
                      const isDone = op.status === 'completed';
                      const canStart = !isDone && !isCurrent;

                      return (
                        <div
                          key={op.id}
                          className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors ${
                            isCurrent
                              ? 'border-emerald-300 bg-emerald-50/50 shadow-sm'
                              : isDone
                              ? 'border-slate-200 bg-slate-50/60'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                                  isDone
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : isCurrent
                                    ? 'bg-emerald-500 text-white animate-pulse'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {op.sequence}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 text-sm truncate">
                                  {op.name}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${opMeta.bg} ${opMeta.color} ${opMeta.border}`}
                                  >
                                    {opMeta.icon}
                                    {opMeta.label}
                                  </span>
                                  {op.standardTimeMinutes != null && (
                                    <span className="text-[10px] font-mono text-slate-500">
                                      Std: {op.standardTimeMinutes} min
                                    </span>
                                  )}
                                  {op.actualTimeMinutes != null && (
                                    <span className="text-[10px] font-mono text-emerald-600">
                                      Actual: {op.actualTimeMinutes} min
                                    </span>
                                  )}
                                </div>
                                {op.startedByName && (
                                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                    <User size={10} />
                                    {op.startedByName}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Touch-friendly action buttons */}
                          {activeWo.status !== 'completed' && (
                            <div className="flex flex-wrap gap-2">
                              {canStart && (
                                <button
                                  onClick={() => handleStartOperation(activeWo, op)}
                                  disabled={actionSubmitting}
                                  className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white text-xs font-mono uppercase font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <PlayCircle size={14} />
                                  Start
                                </button>
                              )}
                              {isCurrent && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleCompleteOperation(
                                        activeWo,
                                        op,
                                        op.standardTimeMinutes ?? 30
                                      )
                                    }
                                    disabled={actionSubmitting}
                                    className="flex-1 min-w-[120px] bg-sky-600 hover:bg-sky-500 disabled:bg-sky-400 text-white text-xs font-mono uppercase font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <CheckCircle2 size={14} />
                                    Complete
                                  </button>
                                  <button
                                    onClick={() => handlePauseOperation(activeWo, op)}
                                    disabled={actionSubmitting}
                                    className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-mono uppercase font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <PauseCircle size={14} />
                                    Pause
                                  </button>
                                </>
                              )}
                              {isDone && (
                                <div className="flex-1 text-center text-emerald-600 text-[11px] font-mono uppercase font-bold py-2">
                                  ✓ Operation Completed
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => navigate(`/work-instructions?wo=${activeWo.orderNumber}&op=${op.id}`)}
                                className="bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-mono font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                title="Open Digital Work Instructions on Tablet"
                              >
                                <Tablet size={13} />
                                <span>Tablet SOP</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Quick output logger */}
              {activeWo.status === 'in_progress' && (
                <QuickOutputLogger
                  onSubmit={(produced, scrap) =>
                    handleQuickQtyUpdate(activeWo, produced, scrap)
                  }
                  disabled={actionSubmitting}
                />
              )}

              {/* Notes */}
              {activeWo.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-bold block mb-1">
                    Notes
                  </span>
                  <p className="text-xs text-amber-900">{activeWo.notes}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── STEP 4.4 — Barcode Scanner Modal ─────────────────── */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        hint="Scan work order traveler barcode (WO-xxxxx)"
      />

      {/* ── Sales Order Picker for Work Order Generation ──────── */}
      {isSoPickerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up font-sans">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Select Confirmed Sales Order
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Choose a sales order to auto-explode its BOM and generate linked shopfloor work orders.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSoPickerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs">
              {allSalesOrders && allSalesOrders.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  {allSalesOrders.map((ord) => {
                    const isGenerated = (ord as any).workOrdersGenerated;
                    return (
                      <div
                        key={ord.id}
                        className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                              SO: {ord.orderNumber}
                            </span>
                            {ord.customerPoNumber && (
                              <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                PO: {ord.customerPoNumber}
                              </span>
                            )}
                            {isGenerated && (
                              <span className="font-mono text-[9.5px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded uppercase">
                                ✓ WOs Released
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm">{ord.customerName}</h4>
                          <p className="text-[11px] font-mono text-slate-500">
                            {ord.items?.length || 1} Line Items • Due: {ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString() : 'N/A'} • ₹{ord.totalAmount?.toLocaleString('en-IN')}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setIsSoPickerOpen(false);
                            setSelectedSoForGeneration(ord);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-4 py-2 rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs transition-all hover:scale-101 shrink-0"
                        >
                          <Zap className="h-3.5 w-3.5 text-indigo-200" />
                          <span>{isGenerated ? 'Re-Explode BOM' : 'Explode BOM & Release WOs'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 font-mono text-xs bg-slate-50 border rounded-xl">
                  No confirmed sales orders found. Confirm an order in the Orders Monitor first.
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSoPickerOpen(false)}
                className="text-xs font-mono font-bold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Work Orders Modal ────────────────────────── */}
      {selectedSoForGeneration && (
        <GenerateWorkOrdersModal
          isOpen={!!selectedSoForGeneration}
          onClose={() => setSelectedSoForGeneration(null)}
          order={selectedSoForGeneration}
          onSuccess={() => {
            // Updated automatically via window event
          }}
        />
      )}

      {/* ── Shop Traveler Modal ───────────────────────────────── */}
      {travelerWo && (
        <ShopTravelerModal
          isOpen={!!travelerWo}
          onClose={() => setTravelerWo(null)}
          workOrder={travelerWo}
          companyName={tenant?.companyName}
        />
      )}

      {/* ── Work Order Splitting Modal ─────────────────────────── */}
      {splitModalWo && (
        <WorkOrderSplitModal
          isOpen={!!splitModalWo}
          onClose={() => setSplitModalWo(null)}
          workOrder={splitModalWo}
          onSplit={async (params) => {
            await splitWorkOrder(params);
            setSplitModalWo(null);
            if (activeWoId === params.parentWorkOrderId) {
              setActiveWoId(null);
            }
          }}
        />
      )}

      {/* ── Work Order Merging Modal ───────────────────────────── */}
      {isMergeModalOpen && (
        <WorkOrderMergeModal
          isOpen={isMergeModalOpen}
          onClose={() => {
            setIsMergeModalOpen(false);
            setSelectedForMerge([]);
          }}
          initialSelectedOrders={selectedForMerge}
          allAvailableOrders={workOrders}
          onMerge={async (params) => {
            await mergeWorkOrders(params);
            setIsMergeModalOpen(false);
            setSelectedForMerge([]);
          }}
        />
      )}

      {/* ── Work Order Genealogy & Lineage Modal ───────────────── */}
      {genealogyWoId && (
        <WorkOrderGenealogyModal
          isOpen={!!genealogyWoId}
          onClose={() => setGenealogyWoId(null)}
          workOrderId={genealogyWoId}
          allWorkOrders={workOrders}
          onSelectWorkOrder={(id) => {
            setActiveWoId(id);
            setGenealogyWoId(null);
          }}
        />
      )}
    </div>
  );
};

// ─── Subcomponents ──────────────────────────────────────────

const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: 'default' | 'emerald' | 'sky' | 'rose';
}> = ({ icon, label, value, accent = 'default' }) => {
  const accents = {
    default: 'border-slate-200 bg-white text-slate-700',
    emerald: 'border-emerald-100 bg-white text-emerald-700',
    sky: 'border-sky-100 bg-white text-sky-700',
    rose: 'border-rose-100 bg-white text-rose-700',
  };
  const iconBg = {
    default: 'bg-slate-100 text-slate-500',
    emerald: 'bg-emerald-50 text-emerald-500',
    sky: 'bg-sky-50 text-sky-500',
    rose: 'bg-rose-50 text-rose-500',
  };
  return (
    <div className={`p-4 rounded-xl border flex items-center justify-between ${accents[accent]}`}>
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{label}</p>
        <h3 className="text-2xl font-black mt-1">{value}</h3>
      </div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${iconBg[accent]}`}>
        {icon}
      </div>
    </div>
  );
};

const QuickOutputLogger: React.FC<{
  onSubmit: (produced: number, scrap: number) => void;
  disabled?: boolean;
}> = ({ onSubmit, disabled }) => {
  const [produced, setProduced] = useState<number | ''>('');
  const [scrap, setScrap] = useState<number | ''>('');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
        <TrendingUp className="h-4 w-4 text-emerald-600" />
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-bold">
          Log Output
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
            Produced Qty
          </label>
          <input
            type="number"
            min={0}
            value={produced}
            onChange={(e) => setProduced(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
            Scrap Qty
          </label>
          <input
            type="number"
            min={0}
            value={scrap}
            onChange={(e) => setScrap(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded font-mono text-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
            placeholder="0"
          />
        </div>
      </div>
      <button
        onClick={() => {
          const p = Number(produced) || 0;
          const s = Number(scrap) || 0;
          if (p === 0 && s === 0) return;
          onSubmit(p, s);
          setProduced('');
          setScrap('');
        }}
        disabled={disabled}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white font-mono uppercase text-[10px] tracking-widest py-2.5 px-4 rounded-lg font-bold transition-colors cursor-pointer"
      >
        Log Output
      </button>
    </div>
  );
};