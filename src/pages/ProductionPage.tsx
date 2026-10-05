// src/pages/ProductionPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlants } from '../hooks/usePlants';
import { ExportButton } from '../components/ExportButton';
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
} from 'lucide-react';

// ── Step 4.4 — Scanner wiring ───────────────────────────────
import { BarcodeScanner } from '../components/BarcodeScanner';
import { useScanToIdentify } from '../hooks/useScanToIdentify';
import { ScanResult } from '../services/scannerService';

// ── Status metadata ─────────────────────────────────────────
const STATUS_META: Record<
  WorkOrderStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  pending:     { label: 'Pending',     color: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-300',  icon: <Clock size={12} /> },
  ready:       { label: 'Ready',       color: 'text-sky-700',     bg: 'bg-sky-50',      border: 'border-sky-200',    icon: <Zap size={12} /> },
  in_progress: { label: 'In Progress', color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200',icon: <PlayCircle size={12} /> },
  paused:      { label: 'Paused',      color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',  icon: <PauseCircle size={12} /> },
  completed:   { label: 'Completed',   color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200', icon: <CheckCircle2 size={12} /> },
  cancelled:   { label: 'Cancelled',   color: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-200',   icon: <X size={12} /> },
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
  const { tenant, profile } = useAuth();

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
            id="new-work-order-btn"
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono uppercase py-2.5 px-4 rounded-lg font-bold shadow-sm transition-all focus:ring-2 focus:ring-sky-500 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Work Order
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
            {(['all', 'pending', 'ready', 'in_progress', 'paused', 'completed'] as const).map((tab) => {
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
                        <div className="flex items-center gap-2">
                          {wo.orderNumber}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${priority.className}`}
                          >
                            {priority.label}
                          </span>
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
                        <div className="flex justify-center gap-1.5">
                          {nextOp && wo.status !== 'completed' && (
                            <button
                              onClick={() => handleStartOperation(wo, nextOp)}
                              disabled={actionSubmitting}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-mono uppercase font-bold px-2 py-1 rounded cursor-pointer transition-colors disabled:opacity-50"
                              title={`Start ${nextOp.name}`}
                            >
                              ▶ Start
                            </button>
                          )}
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
                </div>
              </div>
              <button
                onClick={() => setActiveWoId(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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