// src/components/orders/ReservedMaterialsPanel.tsx

import React, { useState, useEffect } from 'react';
import { Order, UserRole } from '../../types';
import { 
  StockReservation, 
  StockReservationStatus 
} from '../../types/stockReservation';
import { 
  StockReservationService, 
  onStockReservationsChanged 
} from '../../services/stockReservationService';
import { 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Trash2, 
  Clock, 
  Info, 
  Boxes, 
  ArrowUpRight, 
  Sparkles,
  RefreshCw,
  Plus,
  AlertOctagon,
  Flame
} from 'lucide-react';

interface ReservedMaterialsPanelProps {
  order: Order;
  tenantId?: string;
  userRole?: UserRole;
  userName?: string;
  isSandboxMode?: boolean;
  onReservationUpdated?: () => void;
}

export const ReservedMaterialsPanel: React.FC<ReservedMaterialsPanelProps> = ({
  order,
  tenantId = 'default_tenant',
  userRole = 'sales',
  userName = 'User',
  isSandboxMode = true,
  onReservationUpdated
}) => {
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Manual Release Modal / State
  const [releaseTarget, setReleaseTarget] = useState<StockReservation | null>(null);
  const [releaseReason, setReleaseReason] = useState<string>('');
  const [isReleasing, setIsReleasing] = useState<boolean>(false);

  // Write-Off Modal / State (Damaged / Lost Stock)
  const [writeOffTarget, setWriteOffTarget] = useState<StockReservation | null>(null);
  const [writeOffQty, setWriteOffQty] = useState<number>(1);
  const [writeOffReason, setWriteOffReason] = useState<string>('');
  const [isWritingOff, setIsWritingOff] = useState<boolean>(false);

  // Re-evaluation / Resync State
  const [isResyncing, setIsResyncing] = useState<boolean>(false);

  const isAdminOrManager = ['admin', 'manager', 'management', 'production'].includes(userRole);
  const isAdmin = userRole === 'admin';

  const loadReservations = () => {
    setLoading(true);
    try {
      const list = StockReservationService.getReservationsForOrder(tenantId, order.id);
      setReservations(list);
    } catch (e) {
      console.warn('Error loading reservations', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
    const unsub = onStockReservationsChanged((tId, oId) => {
      if (tId === tenantId && (!oId || oId === order.id)) {
        loadReservations();
      }
    });
    return () => unsub();
  }, [order.id, tenantId]);

  // Handle Manual Release (EC 3)
  const handleConfirmManualRelease = async () => {
    if (!releaseTarget) return;
    if (!releaseReason.trim() || releaseReason.trim().length < 5) {
      setActionError('A valid release justification of at least 5 characters is required.');
      return;
    }

    setIsReleasing(true);
    setActionError(null);
    try {
      await StockReservationService.manualReleaseReservation(
        {
          reservationId: releaseTarget.id,
          reason: releaseReason.trim(),
          releasedBy: userName,
          userRole
        },
        { tenantId, isSandboxMode }
      );

      setActionNotice(`Successfully released stock reservation for "${releaseTarget.componentName}".`);
      setReleaseTarget(null);
      setReleaseReason('');
      loadReservations();
      onReservationUpdated?.();
    } catch (err: any) {
      setActionError(err.message || 'Failed to release reservation');
    } finally {
      setIsReleasing(false);
    }
  };

  // Handle Write-off (EC 5: Damaged / Lost Stock)
  const handleConfirmWriteOff = async () => {
    if (!writeOffTarget) return;
    if (!writeOffReason.trim() || writeOffReason.trim().length < 5) {
      setActionError('A valid write-off reason of at least 5 characters is required (e.g., "Foundry casting crack during heat treatment").');
      return;
    }
    if (writeOffQty <= 0 || writeOffQty > writeOffTarget.reservedQty) {
      setActionError(`Write-off quantity must be between 1 and ${writeOffTarget.reservedQty} ${writeOffTarget.unit}.`);
      return;
    }

    setIsWritingOff(true);
    setActionError(null);
    try {
      await StockReservationService.writeOffReservation(
        {
          reservationId: writeOffTarget.id,
          writeOffQty: Number(writeOffQty),
          reason: writeOffReason.trim(),
          writtenOffBy: userName,
          userRole
        },
        { tenantId, isSandboxMode }
      );

      setActionNotice(`Logged write-off of ${writeOffQty} ${writeOffTarget.unit} for "${writeOffTarget.componentName}". Shortfall updated and notification sent.`);
      setWriteOffTarget(null);
      setWriteOffQty(1);
      setWriteOffReason('');
      loadReservations();
      onReservationUpdated?.();
    } catch (err: any) {
      setActionError(err.message || 'Failed to write off damaged stock');
    } finally {
      setIsWritingOff(false);
    }
  };

  // Handle Re-reserve / Manual trigger (e.g. if order was confirmed without prior reservations)
  const handleTriggerReservation = async () => {
    setIsResyncing(true);
    setActionError(null);
    try {
      const summary = await StockReservationService.reserveStockForOrder(order, {
        tenantId,
        actor: { uid: 'usr_manual', name: userName, role: userRole },
        isSandboxMode
      });
      setActionNotice(`Stock reservation evaluated: ${summary.fullyReservedCount}/${summary.totalComponents} components fully reserved.`);
      loadReservations();
      onReservationUpdated?.();
    } catch (err: any) {
      setActionError(err.message || 'Failed to execute stock reservation');
    } finally {
      setIsResyncing(false);
    }
  };

  // Simulation EC 1: Order Edited (Qty increased)
  const handleSimulateOrderEditQtyIncrease = async () => {
    setIsResyncing(true);
    setActionError(null);
    try {
      // Create clone with 20% higher qty on first item
      const modifiedItems = (order.items || []).map((it, idx) => {
        if (idx === 0) {
          const newQty = Math.round(Number(it.quantity || 1) * 1.5);
          return { ...it, quantity: newQty };
        }
        return it;
      });

      const updatedOrder = { ...order, items: modifiedItems };
      const summary = await StockReservationService.syncOrderReservationsOnEdit(updatedOrder, {
        tenantId,
        actor: { uid: 'usr_edit_sim', name: userName, role: userRole },
        isSandboxMode
      });

      setActionNotice(`[EC 1 Simulation]: Order quantity increased by 50%. Additional allocation checked: ${summary.partiallyReservedCount} partial reservation(s) logged.`);
      loadReservations();
      onReservationUpdated?.();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setIsResyncing(false);
    }
  };

  // Compute Metrics
  const activeReservations = reservations.filter(r => r.status === 'active' || r.status === 'partially_reserved');
  const totalReservedComps = activeReservations.length;
  const fullyReservedComps = activeReservations.filter(r => r.shortfallQty === 0).length;
  const partialShortfallComps = activeReservations.filter(r => r.shortfallQty > 0).length;
  const releasedComps = reservations.filter(r => r.status === 'released').length;
  const writtenOffComps = reservations.filter(r => r.status === 'written_off').length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4 font-sans">
      
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded flex items-center space-x-1">
              <Lock className="h-3 w-3 text-indigo-600" />
              <span>Inventory Allocation</span>
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">
              Order #{order.orderNumber}
            </span>
            {partialShortfallComps > 0 && (
              <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 rounded flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                <span>{partialShortfallComps} Partial Shortfall</span>
              </span>
            )}
            {partialShortfallComps === 0 && totalReservedComps > 0 && (
              <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded flex items-center space-x-1">
                <CheckCircle className="h-3 w-3 text-emerald-600" />
                <span>100% Stock Reserved</span>
              </span>
            )}
          </div>
          <h4 className="text-base font-bold text-slate-900 mt-1 flex items-center space-x-2">
            <span>Reserved Materials & Raw Component Allocation</span>
          </h4>
          <p className="text-xs text-slate-500">
            Raw materials locked exclusively for this order. Excluded from ATP calculations for all other customer orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {reservations.length === 0 ? (
            <button
              onClick={handleTriggerReservation}
              disabled={isResyncing}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              title="Automatically explode BOM and reserve required raw materials from warehouse stock"
            >
              <Lock className="h-3.5 w-3.5 text-indigo-200" />
              <span>{isResyncing ? 'Reserving...' : 'Reserve Materials'}</span>
            </button>
          ) : (
            <button
              onClick={handleTriggerReservation}
              disabled={isResyncing}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
              title="Re-evaluate BOM allocations against latest inventory balances"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isResyncing ? 'animate-spin' : ''}`} />
              <span>Re-sync</span>
            </button>
          )}

          {/* Quick Simulation Menu for Test Scenarios */}
          <button
            onClick={handleSimulateOrderEditQtyIncrease}
            disabled={isResyncing || reservations.length === 0}
            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-mono font-bold transition flex items-center space-x-1 cursor-pointer"
            title="Simulate EC 1: Order quantity increases after confirmation, triggering incremental stock reservation and partial shortage notification"
          >
            <Plus className="h-3 w-3 text-amber-600" />
            <span>Simulate Qty Increase (EC 1)</span>
          </button>
        </div>
      </div>

      {/* Action Banners */}
      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionNotice}</span>
          </div>
          <button 
            onClick={() => setActionNotice(null)} 
            className="text-emerald-700 hover:text-emerald-900 font-mono text-[10px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{actionError}</span>
          </div>
          <button 
            onClick={() => setActionError(null)} 
            className="text-rose-700 hover:text-rose-900 font-mono text-[10px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold">Active Allocations</span>
          <span className="text-base font-mono font-bold text-slate-800">{activeReservations.length} Components</span>
        </div>
        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
          <span className="text-[10px] font-mono text-emerald-700 uppercase block font-semibold">Fully Reserved</span>
          <span className="text-base font-mono font-bold text-emerald-700">{fullyReservedComps} Components</span>
        </div>
        <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200">
          <span className="text-[10px] font-mono text-amber-700 uppercase block font-semibold">Partial Shortfalls</span>
          <span className="text-base font-mono font-bold text-amber-700">{partialShortfallComps} Components</span>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold">Released / Consumed</span>
          <span className="text-base font-mono font-bold text-slate-600">{releasedComps + writtenOffComps} Items</span>
        </div>
      </div>

      {/* Reservation List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 font-mono">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-500" />
          Loading material reservations...
        </div>
      ) : reservations.length === 0 ? (
        <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
          <Boxes className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="text-xs font-semibold text-slate-700">No raw material reservations recorded yet.</p>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto">
            Reservations are created automatically when the order advances to <span className="font-mono font-bold text-indigo-600">Order Confirmed</span>, or click "Reserve Materials" above to evaluate on demand.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => {
            const isFullyReserved = res.reservedQty >= res.requiredQty && res.shortfallQty === 0;
            const isReleased = res.status === 'released' || res.status === 'consumed';
            const isWrittenOff = res.status === 'written_off';
            const percentage = Math.min(100, Math.round((res.reservedQty / (res.requiredQty || 1)) * 100));

            return (
              <div 
                key={res.id}
                className={`p-4 rounded-xl border transition-all ${
                  isReleased 
                    ? 'bg-slate-50/60 border-slate-200 opacity-70' 
                    : isWrittenOff
                    ? 'bg-rose-50/40 border-rose-200'
                    : isFullyReserved
                    ? 'bg-emerald-50/20 border-emerald-200 shadow-3xs'
                    : 'bg-amber-50/30 border-amber-300 shadow-3xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {res.componentName}
                      </span>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                        {res.partNumber}
                      </span>
                      {res.orderItemName && (
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]" title={res.orderItemName}>
                          (for {res.orderItemName})
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 flex items-center space-x-3 pt-0.5">
                      <span className="font-mono">
                        Allocation: <strong className="text-slate-900">{res.reservedQty}</strong> / {res.requiredQty} {res.unit}
                      </span>
                      {isFullyReserved && !isReleased && (
                        <span className="text-emerald-700 font-bold flex items-center space-x-1 text-[11px]">
                          <CheckCircle className="h-3 w-3" />
                          <span>100% Reserved ✓</span>
                        </span>
                      )}
                      {!isFullyReserved && !isReleased && !isWrittenOff && (
                        <span className="text-amber-800 font-bold flex items-center space-x-1 text-[11px]">
                          <AlertTriangle className="h-3 w-3" />
                          <span>⚠️ Shortfall {res.shortfallQty} {res.unit}</span>
                        </span>
                      )}
                      {isReleased && (
                        <span className="text-slate-500 font-mono font-bold text-[10px] uppercase bg-slate-200 px-1.5 py-0.2 rounded">
                          {res.status === 'consumed' ? 'Consumed' : 'Released'}
                        </span>
                      )}
                      {isWrittenOff && (
                        <span className="text-rose-700 font-mono font-bold text-[10px] uppercase bg-rose-100 px-1.5 py-0.2 rounded">
                          Written-Off
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: status badge and action buttons */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {!isReleased && !isWrittenOff && isAdminOrManager && (
                      <>
                        {/* Manual Release Action (EC 3) */}
                        <button
                          onClick={() => {
                            setReleaseTarget(res);
                            setReleaseReason('');
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-mono font-bold transition flex items-center space-x-1 cursor-pointer shadow-3xs"
                          title="Manually release reserved stock back to available pool (Requires audit reason)"
                        >
                          <Unlock className="h-3 w-3 text-slate-500" />
                          <span>Release</span>
                        </button>

                        {/* Damaged Stock Write-off Action (EC 5) */}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setWriteOffTarget(res);
                              setWriteOffQty(Math.min(res.reservedQty, 1));
                              setWriteOffReason('');
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-[11px] font-mono font-bold transition flex items-center space-x-1 cursor-pointer shadow-3xs"
                            title="Write off physically damaged or lost reserved stock (EC 5)"
                          >
                            <Flame className="h-3 w-3 text-rose-600" />
                            <span>Write-off</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center space-x-3">
                  <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        isReleased 
                          ? 'bg-slate-400' 
                          : isWrittenOff 
                          ? 'bg-rose-500' 
                          : isFullyReserved 
                          ? 'bg-emerald-600' 
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {percentage}%
                  </span>
                </div>

                {/* Audit Context Footer */}
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400 font-mono">
                  <span>Reserved at: {new Date(res.reservedAt).toLocaleTimeString()} ({new Date(res.reservedAt).toLocaleDateString()})</span>
                  {res.releaseReason && (
                    <span className="text-slate-600 italic">
                      Released by {res.releasedBy}: "{res.releaseReason}"
                    </span>
                  )}
                  {res.writeOffReason && (
                    <span className="text-rose-700 font-bold">
                      Written off ({res.writeOffQty} {res.unit}) by {res.writtenOffBy}: "{res.writeOffReason}"
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Manual Release Modal (EC 3) */}
      {releaseTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-5 space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 border-b border-slate-150 pb-3">
              <Unlock className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-bold">Manual Stock Reservation Release</h3>
            </div>

            <p className="text-xs text-slate-600">
              You are about to release the reservation of <strong>{releaseTarget.reservedQty} {releaseTarget.unit}</strong> of <strong>{releaseTarget.componentName}</strong> back into the general unreserved inventory pool. Other orders' ATP will immediately reflect this available stock.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-mono font-bold uppercase text-slate-700 block">
                Mandatory Release Justification (Audit Log) *
              </label>
              <textarea
                rows={3}
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="e.g. Client requested deferral of delivery; raw material diverted to urgent Order #ORD-009 per VP Operations."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-sans text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 font-mono">Minimum 5 characters required.</span>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-150">
              <button
                type="button"
                onClick={() => setReleaseTarget(null)}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-mono font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmManualRelease}
                disabled={isReleasing || releaseReason.trim().length < 5}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-mono font-bold cursor-pointer shadow-3xs flex items-center space-x-1.5"
              >
                <Unlock className="h-3.5 w-3.5" />
                <span>{isReleasing ? 'Releasing...' : 'Confirm Release'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Damaged/Lost Stock Write-Off Modal (EC 5) */}
      {writeOffTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-5 space-y-4">
            <div className="flex items-center space-x-2 text-rose-900 border-b border-rose-150 pb-3">
              <Flame className="h-5 w-5 text-rose-600" />
              <h3 className="text-base font-bold">Write-Off Damaged / Lost Stock (EC 5)</h3>
            </div>

            <p className="text-xs text-slate-600">
              Record physically damaged, scrapped, or missing inventory for <strong>{writeOffTarget.componentName}</strong>. The order's shortfall will be increased accordingly and production planning alerted.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-700 block">
                  Write-off Quantity ({writeOffTarget.unit}) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={writeOffTarget.reservedQty}
                  value={writeOffQty}
                  onChange={(e) => setWriteOffQty(Math.max(1, Math.min(writeOffTarget.reservedQty, Number(e.target.value))))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400 font-mono">Maximum available: {writeOffTarget.reservedQty} {writeOffTarget.unit}</span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-700 block">
                  Reason / Scrap Justification *
                </label>
                <textarea
                  rows={3}
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                  placeholder="e.g. Casting dropped during forklift transit causing irreparable fracture at base flange. Scrapped to bin #SCR-04."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-sans text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                />
                <span className="text-[10px] text-slate-400 font-mono">Minimum 5 characters required.</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-150">
              <button
                type="button"
                onClick={() => setWriteOffTarget(null)}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-mono font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWriteOff}
                disabled={isWritingOff || writeOffReason.trim().length < 5 || writeOffQty <= 0}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-mono font-bold cursor-pointer shadow-3xs flex items-center space-x-1.5"
              >
                <Flame className="h-3.5 w-3.5" />
                <span>{isWritingOff ? 'Logging Write-off...' : 'Confirm Write-Off'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
