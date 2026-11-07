// src/components/orders/OrderAtpSummaryPanel.tsx

import React, { useState } from 'react';
import { 
  OrderAtpSummary, 
  OrderAtpLineSummary,
  AtpAvailabilityStatus 
} from '../../types/materialAvailability';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Calendar, 
  RotateCcw, 
  X, 
  Sparkles, 
  ArrowRight, 
  Layers, 
  Package, 
  Info, 
  Copy, 
  Check, 
  AlertCircle,
  Scissors,
  CalendarCheck2
} from 'lucide-react';

interface OrderAtpSummaryPanelProps {
  summary: OrderAtpSummary | null;
  isRunningCheck: boolean;
  progress?: { completed: number; total: number };
  isStaleFromEdit?: boolean;
  onRerunCheck: () => void;
  onClose: () => void;
  onApplyEarliestDate?: (dateStr: string) => void;
  onAdviseSplitOrder?: () => void;
}

export const OrderAtpSummaryPanel: React.FC<OrderAtpSummaryPanelProps> = ({
  summary,
  isRunningCheck,
  progress,
  isStaleFromEdit = false,
  onRerunCheck,
  onClose,
  onApplyEarliestDate,
  onAdviseSplitOrder
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedLineIndex, setExpandedLineIndex] = useState<number | null>(null);

  if (isRunningCheck) {
    const percent = progress && progress.total > 0 
      ? Math.round((progress.completed / progress.total) * 100) 
      : 25;

    return (
      <div className="bg-white border-2 border-indigo-400 rounded-2xl p-6 shadow-lg space-y-4 animate-in fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600 animate-spin">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 block">
                Async ATP Engine In Progress
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                Running Multi-Line Availability Check...
              </h3>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
            {progress ? `${progress.completed} of ${progress.total} lines (${percent}%)` : 'Initializing...'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
            <div 
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[11px] font-mono text-slate-500">
            Exploding multi-level BOMs, calculating current stock, deducting already-committed work orders, and evaluating supplier lead times...
          </p>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  // Format date nicely e.g., "25 Nov 2026"
  const formatReadableDate = (isoString?: string) => {
    if (!isoString) return 'Immediate';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const handleCopySummary = () => {
    const linesText = summary.lineResults.map(lr => {
      let detail = lr.status === 'available' ? 'Available' : lr.summaryText;
      return `• Line ${lr.lineIndex} [${lr.productName} x ${lr.orderedQty} ${lr.unit}]: ${detail}`;
    }).join('\n');

    const bottleneck = summary.criticalBottleneckComponent 
      ? `\nCritical Bottleneck: ${summary.criticalBottleneckComponent.partName} (Lead Time: ${summary.longestLeadTimeDays} days)`
      : '';

    const textToCopy = `Order Feasibility Check Summary (Order #${summary.orderNumber}):
• Total Lines: ${summary.totalLines} (${summary.availableLinesCount} Available, ${summary.partiallyAvailableLinesCount} Partially Available, ${summary.unavailableLinesCount} Unavailable)
• Earliest Possible Fulfilment Date: ${formatReadableDate(summary.earliestPossibleFulfilmentDate)}${bottleneck}

Line Details:
${linesText}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isUnavailable = summary.unavailableLinesCount > 0;
  const isPartial = summary.partiallyAvailableLinesCount > 0;
  const isFullyFeasible = !isUnavailable && !isPartial;

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-lg ${
      isStaleFromEdit 
        ? 'border-amber-300 ring-4 ring-amber-100/60' 
        : isFullyFeasible 
          ? 'border-emerald-300 ring-2 ring-emerald-100' 
          : isUnavailable 
            ? 'border-rose-300 ring-2 ring-rose-100' 
            : 'border-amber-300 ring-2 ring-amber-100'
    }`}>
      
      {/* Stale Warning Banner (EC 3: Line quantities edited after check) */}
      {isStaleFromEdit && (
        <div className="bg-amber-500 text-amber-950 px-5 py-2.5 text-xs font-mono font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-950" />
            <span>
              Line item quantities or parts were edited after this check was run. This feasibility summary is outdated!
            </span>
          </div>
          <button
            onClick={onRerunCheck}
            className="px-2.5 py-1 bg-amber-950 text-white hover:bg-black rounded-lg text-[10px] uppercase font-bold tracking-wider transition cursor-pointer flex items-center space-x-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Re-Run Check</span>
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className={`p-5 border-b flex flex-wrap items-center justify-between gap-3 ${
        isStaleFromEdit ? 'bg-amber-50/50' : 'bg-slate-50/80'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl border ${
            isFullyFeasible 
              ? 'bg-emerald-100/80 border-emerald-300 text-emerald-800' 
              : isUnavailable 
                ? 'bg-rose-100/80 border-rose-300 text-rose-800' 
                : 'bg-amber-100/80 border-amber-300 text-amber-800'
          }`}>
            <Sparkles className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                Order Availability Feasibility
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Non-blocking Advisory Check
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5 flex items-center space-x-2">
              <span>Order #{summary.orderNumber} Feasibility Summary</span>
              <span className="text-xs font-normal text-slate-500 font-mono">
                ({new Date(summary.checkTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopySummary}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-3xs"
            title="Copy feasibility summary for customer negotiations"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
          </button>

          <button
            onClick={onRerunCheck}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-3xs"
            title="Clear session cache and re-evaluate live inventory"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Re-Check</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition cursor-pointer"
            title="Close summary panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area: Graded opacity if stale */}
      <div className={`p-5 space-y-5 ${isStaleFromEdit ? 'opacity-65 pointer-events-auto' : ''}`}>
        
        {/* KPI Summary Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          
          {/* Total Lines */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
              Total Lines
            </span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {summary.totalLines}
            </div>
            <span className="text-[10px] font-mono text-slate-400">Order line items</span>
          </div>

          {/* Available */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
            <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 block flex items-center space-x-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Available</span>
            </span>
            <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
              {summary.availableLinesCount}
            </div>
            <span className="text-[10px] font-mono text-emerald-600">Sufficient unreserved stock</span>
          </div>

          {/* Partially Available */}
          <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl">
            <span className="text-[10px] font-mono font-bold uppercase text-amber-700 block flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>Partially Avail.</span>
            </span>
            <div className="text-xl font-bold font-mono text-amber-900 mt-1">
              {summary.partiallyAvailableLinesCount}
            </div>
            <span className="text-[10px] font-mono text-amber-600">Stock shortfall on component</span>
          </div>

          {/* Unavailable */}
          <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl">
            <span className="text-[10px] font-mono font-bold uppercase text-rose-700 block flex items-center space-x-1">
              <XCircle className="h-3 w-3" />
              <span>Unavailable</span>
            </span>
            <div className="text-xl font-bold font-mono text-rose-900 mt-1">
              {summary.unavailableLinesCount}
            </div>
            <span className="text-[10px] font-mono text-rose-600">0 unreserved stock / No BOM</span>
          </div>

          {/* Earliest Possible Fulfilment Date */}
          <div className="col-span-2 sm:col-span-1 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
            <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 block flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>Earliest Fulfilment</span>
            </span>
            <div className="text-sm font-bold font-mono text-indigo-950 mt-1 truncate">
              {formatReadableDate(summary.earliestPossibleFulfilmentDate)}
            </div>
            <span className="text-[10px] font-mono text-indigo-700 block truncate" title={summary.criticalBottleneckComponent ? `${summary.criticalBottleneckComponent.partName} (${summary.longestLeadTimeDays}d lead time)` : 'Immediate'}>
              {summary.criticalBottleneckComponent 
                ? `based on ${summary.criticalBottleneckComponent.partName} lead time (${summary.longestLeadTimeDays}d)`
                : 'Stock ready immediately'}
            </span>
          </div>

        </div>

        {/* Advisory Action Bar for Sales Manager */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-700 font-mono">
            <Info className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              {isFullyFeasible 
                ? '✅ All required components & raw materials are in unreserved warehouse stock. Ready for confirmation.'
                : `⚠️ Delivery date negotiation or order lot-splitting recommended based on ${summary.criticalBottleneckComponent?.partName || 'shortfall components'}.`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {summary.earliestPossibleFulfilmentDate && onApplyEarliestDate && (
              <button
                type="button"
                onClick={() => onApplyEarliestDate(summary.earliestPossibleFulfilmentDate!)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
                title="Update target delivery date to earliest feasible replenishment date"
              >
                <CalendarCheck2 className="h-3.5 w-3.5" />
                <span>Apply Feasible Date ({formatReadableDate(summary.earliestPossibleFulfilmentDate)})</span>
              </button>
            )}

            {isPartial && onAdviseSplitOrder && (
              <button
                type="button"
                onClick={onAdviseSplitOrder}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-3xs"
                title="Split available lines into Lot 1 for immediate production and balance in Lot 2"
              >
                <Scissors className="h-3.5 w-3.5" />
                <span>Advise Order Split</span>
              </button>
            )}
          </div>
        </div>

        {/* Line-by-Line Breakdown Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-3xs">
          <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <Package className="h-3.5 w-3.5 text-indigo-600" />
              <span>Line-by-Line Availability Breakdown ({summary.lineResults.length} Lines)</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Formula: Current + Planned Receipts − Committed Orders ≥ Required
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {summary.lineResults.map((lr) => {
              const isExpanded = expandedLineIndex === lr.lineIndex;
              const isLineAvailable = lr.status === 'available';
              const isLinePartial = lr.status === 'partially_available';
              const isLineUnavailable = lr.status === 'unavailable';

              return (
                <div key={lr.lineIndex} className="p-4 hover:bg-slate-50/60 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    
                    {/* Line description */}
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                          Line {lr.lineIndex}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {lr.productName}
                        </span>
                        {lr.hasBOM ? (
                          <span className="text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded">
                            BOM Exploded
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded">
                            Direct Item
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-slate-500">
                        Ordered Qty: <span className="font-bold text-slate-800">{lr.orderedQty} {lr.unit}</span>
                      </div>
                    </div>

                    {/* Status & Shortfall Summary */}
                    <div className="flex items-center space-x-3">
                      
                      {/* Status Badge */}
                      {lr.isNoStockNoBom ? (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Unavailable – No Stock and No BOM</span>
                          </span>
                          <span className="block text-[10px] font-mono text-rose-600 mt-0.5">
                            New product: requires BOM configuration or purchase receipt
                          </span>
                        </div>
                      ) : isLineAvailable ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Available</span>
                        </span>
                      ) : isLinePartial ? (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span>Partially Available</span>
                          </span>
                          <span className="block text-[10px] font-mono text-amber-700 font-semibold mt-0.5">
                            {lr.limitingComponent ? `${lr.limitingComponent.partName} shortfall: ${lr.limitingComponent.shortfall} ${lr.limitingComponent.unit}` : lr.summaryText}
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-50 text-rose-900 border border-rose-300">
                            <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            <span>Unavailable</span>
                          </span>
                          <span className="block text-[10px] font-mono text-rose-700 font-semibold mt-0.5">
                            {lr.limitingComponent ? `${lr.limitingComponent.partName} stock: ${lr.limitingComponent.currentStock} ${lr.limitingComponent.unit}` : lr.summaryText}
                          </span>
                        </div>
                      )}

                      {/* Expand / Details Toggle */}
                      {lr.shortfallComponents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedLineIndex(isExpanded ? null : lr.lineIndex)}
                          className="px-2 py-1 text-[11px] font-mono text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition cursor-pointer"
                        >
                          {isExpanded ? 'Hide' : `Shortfalls (${lr.shortfallComponents.length})`}
                        </button>
                      )}

                    </div>

                  </div>

                  {/* Expanded Shortfall Details Panel */}
                  {(isExpanded || (lr.shortfallComponents.length > 0 && !isLineAvailable)) && (
                    <div className="mt-3 pt-2 border-t border-slate-100 bg-slate-50/70 p-3 rounded-xl text-xs space-y-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                        Shortfall Components & Supplier Replenishment
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {lr.shortfallComponents.map((sc, scIdx) => (
                          <div key={scIdx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs font-mono space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-800 truncate block mr-1" title={sc.partName}>
                                {sc.partName}
                              </span>
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded shrink-0">
                                -{sc.shortfall} {sc.unit}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>Current Stock:</span>
                              <span className="text-slate-800">{sc.currentStock} {sc.unit}</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>Lead Time:</span>
                              <span className="text-indigo-700 font-bold">{sc.leadTimeDays} days</span>
                            </div>
                            {sc.expectedReplenishmentDate && (
                              <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                <span>Expected:</span>
                                <span className="text-slate-700">{formatReadableDate(sc.expectedReplenishmentDate)}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>

      </div>

    </div>
  );
};
