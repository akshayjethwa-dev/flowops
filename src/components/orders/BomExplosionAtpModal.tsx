// src/components/orders/BomExplosionAtpModal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { 
  calculateATP, 
  AtpResult, 
  CircularBOMError, 
  BOMDepthExceededError, 
  ValidationError 
} from '../../services/atpService';
import { 
  Boxes, 
  Search, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Layers, 
  Zap, 
  ExternalLink, 
  Info, 
  X,
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react';

interface BomExplosionAtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
  initialQuantity?: number;
  initialAsOfDate?: string;
  onApplyResult?: (result: AtpResult) => void;
}

export const BomExplosionAtpModal: React.FC<BomExplosionAtpModalProps> = ({
  isOpen,
  onClose,
  initialProductId = 'gear_box',
  initialQuantity = 50,
  initialAsOfDate = '2026-11-20',
  onApplyResult
}) => {
  const [productId, setProductId] = useState<string>(initialProductId);
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [asOfDate, setAsOfDate] = useState<string>(initialAsOfDate);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AtpResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'circular' | 'depth' | 'validation' | 'generic' | null>(null);

  // Cache freshness tracking
  const [timeSinceCalculated, setTimeSinceCalculated] = useState<number>(0);

  // Sync initial props
  useEffect(() => {
    if (initialProductId) setProductId(initialProductId);
    if (initialQuantity) setQuantity(initialQuantity);
    if (initialAsOfDate) setAsOfDate(initialAsOfDate);
  }, [initialProductId, initialQuantity, initialAsOfDate]);

  // Compute ATP
  const handleCalculate = useCallback(async (force = false, customProduct?: string, customQty?: number, customDate?: string) => {
    const targetProduct = customProduct ?? productId;
    const targetQty = customQty ?? quantity;
    const targetDate = customDate ?? asOfDate;

    setLoading(true);
    setErrorMessage(null);
    setErrorType(null);

    try {
      const res = await calculateATP(targetProduct, targetQty, targetDate, {
        forceRefresh: force
      });
      setResult(res);
      setTimeSinceCalculated(0);
      if (onApplyResult) onApplyResult(res);
    } catch (err: any) {
      if (err instanceof CircularBOMError || err?.name === 'CircularBOMError') {
        setErrorType('circular');
        // Acceptance Criteria: "UI shows: BOM configuration error on product X. Contact engineering."
        setErrorMessage(`BOM configuration error on product ${targetProduct}. Contact engineering.`);
      } else if (err instanceof BOMDepthExceededError || err?.name === 'BOMDepthExceededError') {
        setErrorType('depth');
        setErrorMessage(err.message || 'BOM recursion depth exceeded maximum limit of 10 levels.');
      } else if (err instanceof ValidationError || err?.name === 'ValidationError') {
        setErrorType('validation');
        // Acceptance Criteria: "Rejected with ValidationError: Availability date cannot be in the past."
        setErrorMessage(err.message);
      } else {
        setErrorType('generic');
        setErrorMessage(err.message || 'Failed to calculate ATP availability.');
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [productId, quantity, asOfDate, onApplyResult]);

  // Run on mount or when opening
  useEffect(() => {
    if (isOpen) {
      handleCalculate();
    }
  }, [isOpen]);

  // Timer tracking seconds since calculation
  useEffect(() => {
    if (!result) return;
    const interval = setInterval(() => {
      const diffMs = Date.now() - new Date(result.calculatedAt).getTime();
      setTimeSinceCalculated(Math.floor(diffMs / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [result]);

  if (!isOpen) return null;

  const isCacheExpired = timeSinceCalculated > 300; // > 5 minutes

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-3xs">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  BOM Explosion & ATP Calculation Engine
                </h3>
                <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                  Recursive ATP
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Recursively explodes multi-tier product BOMs and computes Available-to-Promise (ATP) per component with lead-time gating.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto grow">
          
          {/* Quick Presets / Test Scenarios Bar */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
              <Zap className="h-3 w-3 text-amber-500" />
              <span>Quick Test Scenarios & Edge Cases:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setProductId('gear_box');
                  setQuantity(50);
                  setAsOfDate('2026-11-20');
                  handleCalculate(true, 'gear_box', 50, '2026-11-20');
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono font-semibold transition cursor-pointer"
              >
                ⚡ Gear Box (Prompt Flow: Qty 50)
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductId('forged steel spur gear (mod 4, 32t)');
                  setQuantity(100);
                  setAsOfDate('2026-11-25');
                  handleCalculate(true, 'forged steel spur gear (mod 4, 32t)', 100, '2026-11-25');
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono font-semibold transition cursor-pointer"
              >
                ⚙️ Multi-Tier Spur Gear (BOM 3 Levels)
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductId('prt-shf-100');
                  setQuantity(30);
                  setAsOfDate('2026-11-20');
                  handleCalculate(true, 'prt-shf-100', 30, '2026-11-20');
                }}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono font-semibold transition cursor-pointer"
              >
                📦 Purchased Item (No BOM)
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductId('demo_circular_bom');
                  setQuantity(10);
                  setAsOfDate('2026-11-20');
                  handleCalculate(true, 'demo_circular_bom', 10, '2026-11-20');
                }}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                title="Test Circular BOM reference detection"
              >
                ⚠️ Test Circular Error (A &rarr; B &rarr; A)
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductId('demo_deep_bom');
                  setQuantity(5);
                  setAsOfDate('2026-11-20');
                  handleCalculate(true, 'demo_deep_bom', 5, '2026-11-20');
                }}
                className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-300 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                title="Test BOM depth exceeding limit of 10 levels"
              >
                🏔️ Test Max Depth (12 Levels)
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductId('gear_box');
                  setQuantity(50);
                  setAsOfDate('2026-10-01'); // Past date!
                  handleCalculate(true, 'gear_box', 50, '2026-10-01');
                }}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                title="Test past date rejection"
              >
                🛑 Test Past Date Rejection
              </button>
            </div>
          </div>

          {/* Input Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
            <div className="sm:col-span-5 space-y-1">
              <label className="text-[11px] font-mono font-bold text-slate-700 uppercase block">
                Product ID / Name / Part Number:
              </label>
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  placeholder="e.g. gear_box, ASM-GBX-100..."
                  className="w-full text-xs font-mono pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>
            </div>

            <div className="sm:col-span-3 space-y-1">
              <label className="text-[11px] font-mono font-bold text-slate-700 uppercase block">
                Required Quantity:
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="text-[11px] font-mono font-bold text-slate-700 uppercase block">
                Availability As-Of Date:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => handleCalculate(true)}
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded-xl shadow-3xs transition flex items-center space-x-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Compute</span>
                </button>
              </div>
            </div>
          </div>

          {/* Error Message Display */}
          {errorMessage && (
            <div className={`p-4 rounded-xl border text-xs flex items-start space-x-3 animate-in fade-in ${
              errorType === 'circular'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : errorType === 'validation'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <span className="font-bold font-mono uppercase tracking-wider block">
                  {errorType === 'circular' ? 'Circular Reference Error' : errorType === 'validation' ? 'Validation Error' : 'Calculation Error'}
                </span>
                <p className="font-mono text-xs">{errorMessage}</p>
                {errorType === 'circular' && (
                  <p className="text-[11px] opacity-80 mt-1">
                    Acceptance Criteria met: Cyclic graph structure detected and caught without stack overflow. Contact engineering to resolve parent/child dependencies.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Results Section */}
          {result && (
            <div className="space-y-4 animate-in fade-in">
              
              {/* Overall Status Banner & Cache Indicator */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${
                result.overallStatus === 'available'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : result.overallStatus === 'partial'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    result.overallStatus === 'available'
                      ? 'bg-emerald-600 text-white'
                      : result.overallStatus === 'partial'
                        ? 'bg-amber-500 text-white'
                        : 'bg-rose-600 text-white'
                  }`}>
                    {result.overallStatus === 'available' ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : result.overallStatus === 'partial' ? (
                      <AlertTriangle className="h-6 w-6" />
                    ) : (
                      <XCircle className="h-6 w-6" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">
                        Overall ATP Availability:
                      </span>
                      <span className={`text-xs font-mono font-black uppercase px-2.5 py-0.5 rounded-full ${
                        result.overallStatus === 'available'
                          ? 'bg-emerald-200 text-emerald-900 border border-emerald-400'
                          : result.overallStatus === 'partial'
                            ? 'bg-amber-200 text-amber-900 border border-amber-400'
                            : 'bg-rose-200 text-rose-900 border border-rose-400'
                      }`}>
                        {result.overallStatus}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {result.productName} ({result.requiredQty} units as of {result.asOfDate})
                    </h4>
                  </div>
                </div>

                {/* Cache Freshness Indicator (EC 5) */}
                <div className="flex items-center space-x-2 text-right justify-end shrink-0">
                  <div className="text-[11px] font-mono text-slate-500">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{result.cached ? '⚡ Cached result' : 'Fresh computation'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Last checked: {timeSinceCalculated}s ago
                    </span>
                  </div>

                  <button
                    onClick={() => handleCalculate(true)}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 cursor-pointer"
                    title="Force refresh calculation"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Shortfall Breakdown Alert (if any) */}
              {result.shortfalls.length > 0 && (
                <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between text-rose-900">
                    <div className="flex items-center space-x-2 font-mono font-bold text-xs">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <span>Material Shortfalls Gating Fulfilment ({result.shortfalls.length} component(s)):</span>
                    </div>
                    {result.earliestPossibleReplenishmentDate && (
                      <span className="text-[11px] font-mono bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
                        Earliest Feasible: <strong>{result.earliestPossibleReplenishmentDate}</strong>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.shortfalls.map((sf, idx) => (
                      <div key={idx} className="p-3 bg-white border border-rose-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 truncate" title={sf.componentName}>
                            {sf.componentName}
                          </span>
                          <span className="text-[10px] font-mono font-extrabold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                            Shortfall: {sf.shortfall} {sf.unit || 'pcs'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 flex justify-between pt-1 border-t border-slate-100">
                          <span>Required: <strong>{sf.required}</strong></span>
                          <span>ATP Stock: <strong className={sf.available > 0 ? 'text-amber-600' : 'text-rose-600'}>{sf.available}</strong></span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-600 pt-0.5">
                          Replenishment: {sf.expectedReplenishmentDate ? (
                            <span className="text-emerald-700 font-bold">{sf.expectedReplenishmentDate}</span>
                          ) : (
                            <span className="text-rose-600 italic">No replenishment scheduled.</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exploded BOM Components ATP Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
                      Exploded Component ATP Breakdown
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ({result.components.length} Leaf Items)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Formula: ATP = Current − Reserved + Planned − Committed
                  </span>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">Component / Part</th>
                        <th className="py-2.5 px-2 text-right">Req. Qty</th>
                        <th className="py-2.5 px-2 text-right">Current</th>
                        <th className="py-2.5 px-2 text-right">Reserved</th>
                        <th className="py-2.5 px-2 text-right">Planned</th>
                        <th className="py-2.5 px-2 text-right">Committed</th>
                        <th className="py-2.5 px-2 text-right font-black">Net ATP</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {result.components.map((c, i) => (
                        <tr key={i} className={`hover:bg-slate-50/80 transition ${
                          !c.isAvailable ? 'bg-rose-50/20' : ''
                        }`}>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-900 block truncate max-w-xs" title={c.componentName}>
                              {c.componentName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {c.partNumber} • Level {c.level} • {c.itemType}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-slate-900">
                            {c.totalRequired} {c.unit}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-600">
                            {c.currentStock}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-500">
                            {c.reservedStock > 0 ? `-${c.reservedStock}` : '0'}
                          </td>
                          <td className="py-2 px-2 text-right text-emerald-600 font-semibold">
                            {c.plannedReceipts > 0 ? `+${c.plannedReceipts}` : '0'}
                          </td>
                          <td className="py-2 px-2 text-right text-rose-600 font-semibold">
                            {c.committedOrders > 0 ? `-${c.committedOrders}` : '0'}
                          </td>
                          <td className={`py-2 px-2 text-right font-black ${
                            c.isAvailable ? 'text-emerald-700 font-bold' : 'text-rose-700 font-extrabold'
                          }`}>
                            {c.atp}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {c.isAvailable ? (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                                Ready ✓
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-300">
                                Short ({c.shortfall})
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-slate-400">
            {result?.cached && (
              <span>Cache key: <code className="text-slate-600">{result.cacheKey}</code></span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-mono font-bold text-xs rounded-xl shadow-3xs cursor-pointer"
            >
              Close
            </button>
            {result && onApplyResult && (
              <button
                onClick={() => {
                  onApplyResult(result);
                  onClose();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-bold text-xs rounded-xl shadow-3xs cursor-pointer flex items-center space-x-1.5"
              >
                <span>Apply to Order Line</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
