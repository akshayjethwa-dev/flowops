// src/components/orders/TrafficLightAvailabilityBadge.tsx

import React, { useState, useEffect, useRef } from 'react';
import { calculateATP, AtpResult } from '../../services/atpService';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  RotateCw, 
  Calendar, 
  Layers, 
  ShieldAlert, 
  AlertCircle,
  HelpCircle,
  Info
} from 'lucide-react';

export type TrafficLightStatus = 'checking' | 'available' | 'partial' | 'unavailable' | 'timeout';

export interface TrafficLightAvailabilityBadgeProps {
  productName: string;
  quantity: number;
  asOfDate?: string;
  orderStatus?: string; // e.g. 'order_confirmed', 'in_production', etc.
  wasConfirmedAvailable?: boolean; // True if order was confirmed while this line was available
  initialStatus?: 'available' | 'partially_available' | 'partial' | 'unavailable';
  onStatusChange?: (
    status: TrafficLightStatus,
    atpResult: AtpResult | null,
    errorMessage?: string
  ) => void;
  interactive?: boolean;
  debounceMs?: number; // default: 350ms
  simulateTimeout?: boolean; // For EC 1 simulation
  compact?: boolean;
}

export const TrafficLightAvailabilityBadge: React.FC<TrafficLightAvailabilityBadgeProps> = ({
  productName,
  quantity,
  asOfDate,
  orderStatus,
  wasConfirmedAvailable = false,
  initialStatus,
  onStatusChange,
  interactive = true,
  debounceMs = 350,
  simulateTimeout = false,
  compact = false
}) => {
  const [status, setStatus] = useState<TrafficLightStatus>(() => {
    if (initialStatus === 'available') return 'available';
    if (initialStatus === 'partially_available' || initialStatus === 'partial') return 'partial';
    if (initialStatus === 'unavailable') return 'unavailable';
    return productName.trim() ? 'checking' : 'checking';
  });

  const [atpResult, setAtpResult] = useState<AtpResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [localSimulateTimeout, setLocalSimulateTimeout] = useState(simulateTimeout);

  // Track previous confirmed availability for EC 4
  const [previouslyAvailable, setPreviouslyAvailable] = useState<boolean>(wasConfirmedAvailable);

  // Concurrency & debounce tracking refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Determine if order is in a confirmed/post-confirmed state
  const isOrderPostConfirmed = orderStatus && [
    'order_confirmed',
    'in_production',
    'partially_dispatched',
    'fully_dispatched'
  ].includes(orderStatus.toLowerCase());

  // Check if status is degraded post-confirmation (EC 4)
  const isDegradedAfterConfirmation = Boolean(
    isOrderPostConfirmed &&
    previouslyAvailable &&
    (status === 'unavailable' || status === 'partial')
  );

  const runCheck = async (currentReqId: number, targetName: string, targetQty: number) => {
    // 5-second timeout guard per Acceptance Criteria EC 1
    const timeoutPromise = new Promise<never>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error('ATP_TIMEOUT'));
      }, 5000);
    });

    try {
      const atpPromise = calculateATP(targetName, targetQty, asOfDate || new Date().toISOString().split('T')[0], {
        simulateTimeout: localSimulateTimeout,
        simulateDelayMs: localSimulateTimeout ? 5500 : undefined,
        forceRefresh: true
      });

      const result = await Promise.race([atpPromise, timeoutPromise]);

      // Guard against stale responses from rapid quantity changes (EC 3)
      if (requestIdRef.current !== currentReqId) {
        return;
      }

      setAtpResult(result);
      setErrorMessage(null);

      let resolvedStatus: TrafficLightStatus;
      if (result.overallStatus === 'available') {
        resolvedStatus = 'available';
        // Remember that this line became available
        if (isOrderPostConfirmed) {
          setPreviouslyAvailable(true);
        }
      } else if (result.overallStatus === 'partial') {
        resolvedStatus = 'partial';
      } else {
        resolvedStatus = 'unavailable';
      }

      setStatus(resolvedStatus);
      onStatusChange?.(resolvedStatus, result);
    } catch (err: any) {
      if (requestIdRef.current !== currentReqId) return;

      if (err?.message === 'ATP_TIMEOUT' || err?.name === 'TimeoutError') {
        // EC 1: ATP service times out (>5s) -> Badge shows ⚠️ Unknown with tooltip
        setStatus('timeout');
        setErrorMessage('Availability check timed out. Retry.');
        onStatusChange?.('timeout', null, 'Availability check timed out. Retry.');
      } else {
        setStatus('unavailable');
        setErrorMessage(err?.message || 'Error computing ATP');
        onStatusChange?.('unavailable', null, err?.message);
      }
    }
  };

  useEffect(() => {
    if (!productName || !productName.trim() || quantity <= 0) {
      setStatus('checking');
      return;
    }

    // EC 3: User rapidly changes quantity (debounce) -> intermediate changes show ⚪ Checking…
    setStatus('checking');
    const currentReqId = ++requestIdRef.current;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      runCheck(currentReqId, productName, quantity);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [productName, quantity, asOfDate, localSimulateTimeout]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatus('checking');
    setLocalSimulateTimeout(false);
    const currentReqId = ++requestIdRef.current;
    runCheck(currentReqId, productName, quantity);
  };

  // Badge Visual Styles
  let badgeClasses = '';
  let dotClass = '';
  let labelText = '';
  let IconComponent = CheckCircle2;

  switch (status) {
    case 'checking':
      badgeClasses = 'bg-slate-100 text-slate-700 border-slate-300';
      dotClass = 'bg-slate-400 animate-pulse';
      labelText = '⚪ Checking…';
      IconComponent = Loader2;
      break;
    case 'available':
      badgeClasses = 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100';
      dotClass = 'bg-emerald-500';
      labelText = '🟢 Available';
      IconComponent = CheckCircle2;
      break;
    case 'partial':
      badgeClasses = 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100';
      dotClass = 'bg-amber-500';
      labelText = '🟡 Partially Available';
      IconComponent = AlertTriangle;
      break;
    case 'unavailable':
      badgeClasses = 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100';
      dotClass = 'bg-rose-500';
      labelText = '🔴 Unavailable';
      IconComponent = XCircle;
      break;
    case 'timeout':
      badgeClasses = 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200';
      dotClass = 'bg-amber-600';
      labelText = '⚠️ Unknown';
      IconComponent = HelpCircle;
      break;
  }

  // EC 2 Check: Product has no BOM and no stock record
  const isNoStockRecord = Boolean(
    status === 'unavailable' &&
    (atpResult?.isNoStockNoBom ||
      atpResult?.shortfalls?.some(s => s.notes?.includes('No stock record found')) ||
      (!atpResult?.hasBOM && atpResult?.components.length === 1 && atpResult.components[0].currentStock === 0 && !atpResult.components[0].leadTimeDays))
  );

  return (
    <div className="relative inline-block font-sans select-none">
      {/* Trigger Pill Badge */}
      <div className="flex items-center space-x-1">
        <button
          type="button"
          onMouseEnter={() => setShowPopover(true)}
          onMouseLeave={() => setShowPopover(false)}
          onClick={() => setShowPopover(!showPopover)}
          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border transition-colors shadow-3xs cursor-pointer ${badgeClasses}`}
          title={
            status === 'timeout'
              ? 'Availability check timed out. Retry.'
              : 'Click or hover to inspect real-time material ATP breakdown'
          }
        >
          {status === 'checking' ? (
            <Loader2 className="h-3 w-3 animate-spin shrink-0 text-slate-500" />
          ) : (
            <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
          )}

          <span className="truncate max-w-[200px]">{labelText}</span>

          {/* Retry trigger when timed out */}
          {status === 'timeout' && (
            <span
              onClick={handleRetry}
              className="ml-1 p-0.5 rounded hover:bg-amber-300/80 transition cursor-pointer"
              title="Click to retry ATP check"
            >
              <RotateCw className="h-2.5 w-2.5 text-amber-900" />
            </span>
          )}
        </button>

        {/* EC 4 Warning Badge: Order confirmed with now-unavailable material */}
        {isDegradedAfterConfirmation && (
          <span 
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-600 text-white animate-pulse"
            title="Warning: Order confirmed with now-unavailable material. Review."
          >
            <ShieldAlert className="h-3 w-3 mr-0.5" />
            Degraded
          </span>
        )}
      </div>

      {/* EC 4 Post-Confirmation Warning Banner if degraded */}
      {isDegradedAfterConfirmation && (
        <div className="mt-1 text-[10px] font-mono font-bold text-rose-600 flex items-center space-x-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>Order confirmed with now-unavailable material. Review.</span>
        </div>
      )}

      {/* Hover / Tap Popover Breakdown Panel */}
      {showPopover && (
        <div
          onMouseEnter={() => setShowPopover(true)}
          onMouseLeave={() => setShowPopover(false)}
          className="absolute z-50 bottom-full left-0 mb-2 w-88 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">
                ATP Availability Breakdown
              </span>
              <h4 className="text-xs font-bold text-white truncate max-w-[220px]" title={productName}>
                {productName}
              </h4>
            </div>
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
                status === 'available'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : status === 'partial'
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : status === 'timeout'
                  ? 'bg-amber-900 text-amber-200 border-amber-600'
                  : 'bg-rose-950 text-rose-300 border-rose-700'
              }`}
            >
              {labelText}
            </span>
          </div>

          {/* EC 4 Banner inside popover */}
          {isDegradedAfterConfirmation && (
            <div className="mb-2.5 p-2 bg-rose-950/80 border border-rose-600 rounded-xl text-rose-200 text-[10px] font-mono flex items-start space-x-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-white">Critical Lifecycle Alert</strong>
                Order confirmed with now-unavailable material. Review shopfloor allocation or raise rush procurement.
              </div>
            </div>
          )}

          {/* Status-Specific Details */}
          {status === 'checking' ? (
            <div className="py-4 text-center text-xs font-mono text-slate-400 space-y-1">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-sky-400" />
              <p>Calculating ATP & exploding BOM...</p>
            </div>
          ) : status === 'timeout' ? (
            <div className="py-2 text-xs font-mono space-y-2">
              <div className="p-2.5 bg-amber-950/50 border border-amber-800/80 rounded-xl text-amber-200 text-[11px]">
                <p className="font-bold flex items-center space-x-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Availability check timed out. Retry.</span>
                </p>
                <p className="text-[10px] text-amber-300/80 mt-1">
                  The ATP service did not respond within 5 seconds. You may proceed; your acknowledgement will be logged as "ATP timeout".
                </p>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-mono font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition shadow-3xs"
              >
                <RotateCw className="h-3 w-3" />
                <span>Retry Availability Check</span>
              </button>
            </div>
          ) : isNoStockRecord ? (
            // EC 2: Product has no BOM and no stock record
            <div className="py-2 text-xs font-mono space-y-2">
              <div className="p-2.5 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-200 text-[11px]">
                <p className="font-bold flex items-center space-x-1 text-rose-300">
                  <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>No stock record found for this product.</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  This item has no BOM definition and does not exist in inventory stock. Shortfall is 100% of required quantity ({quantity} units).
                </p>
              </div>
            </div>
          ) : (
            // Standard Available / Partial / Shortfall breakdown
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>
                  {atpResult?.hasBOM
                    ? `BOM: ${atpResult.components.length} components (${atpResult.bomRevision || 'Active'})`
                    : 'Direct Material Check'}
                </span>
                <span>
                  Target Qty: <strong className="text-white">{quantity} units</strong>
                </span>
              </div>

              {/* Shortfall Components List */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin text-xs font-mono">
                {atpResult?.components && atpResult.components.length > 0 ? (
                  atpResult.components.map((comp, idx) => {
                    const hasShortfall = comp.shortfall > 0;
                    return (
                      <div
                        key={comp.componentId || idx}
                        className={`p-2 rounded-xl border text-[11px] ${
                          !hasShortfall
                            ? 'bg-slate-800/60 border-slate-700/80 text-slate-300'
                            : comp.atp > 0
                            ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                            : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="font-bold text-white truncate max-w-[180px]"
                            title={comp.componentName}
                          >
                            {comp.componentName}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              !hasShortfall
                                ? 'text-emerald-400'
                                : comp.atp > 0
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {!hasShortfall ? 'Available' : comp.atp > 0 ? 'Partial' : 'Unavailable'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-700/60">
                          <div>
                            Required: <strong className="text-white">{comp.totalRequired} {comp.unit}</strong>
                          </div>
                          <div>
                            Available: <strong className="text-white">{comp.atp} {comp.unit}</strong>
                          </div>

                          {hasShortfall && (
                            <div className="col-span-2 text-rose-300 font-bold">
                              Shortfall: {comp.shortfall} {comp.unit}
                            </div>
                          )}

                          <div className="col-span-2 text-slate-400 text-[9px] flex items-center space-x-1">
                            <Calendar className="h-3 w-3 text-indigo-400 shrink-0" />
                            <span>
                              Replenishment:{' '}
                              {comp.expectedReplenishmentDate ? (
                                <strong className="text-indigo-300 font-bold">
                                  {comp.expectedReplenishmentDate}
                                </strong>
                              ) : (
                                <span className="text-slate-500">None scheduled</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-2 text-slate-400 text-[10px]">No component details available.</div>
                )}
              </div>
            </div>
          )}

          {/* Footer note & Testing Tools */}
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>ATP: Stock + Receipts − Reserved</span>
            <button
              type="button"
              onClick={() => setLocalSimulateTimeout(!localSimulateTimeout)}
              className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer border ${
                localSimulateTimeout
                  ? 'bg-amber-950 text-amber-300 border-amber-600'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Toggle to simulate 5-second ATP timeout for Edge Case 1"
            >
              Simulate &gt;5s Timeout: {localSimulateTimeout ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Downward triangle pointer */}
          <div className="absolute top-full left-6 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
