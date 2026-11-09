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
  CalendarCheck2,
  FileDown,
  RefreshCw,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { downloadAtpReportPdf } from '../../utils/atpReportPdfGenerator';

interface OrderAtpSummaryPanelProps {
  summary: OrderAtpSummary | null;
  isRunningCheck: boolean;
  progress?: { completed: number; total: number };
  isStaleFromEdit?: boolean;
  onRerunCheck: () => void;
  onClose: () => void;
  onApplyEarliestDate?: (dateStr: string) => void;
  onAdviseSplitOrder?: () => void;
  onRetryFailedLines?: (lineIndices?: number[]) => void;
  customerPoNumber?: string;
  deliveryDate?: string;
  preparedBy?: string;
  isOrderConfirmed?: boolean;
}

export const OrderAtpSummaryPanel: React.FC<OrderAtpSummaryPanelProps> = ({
  summary,
  isRunningCheck,
  progress,
  isStaleFromEdit = false,
  onRerunCheck,
  onClose,
  onApplyEarliestDate,
  onAdviseSplitOrder,
  onRetryFailedLines,
  customerPoNumber,
  deliveryDate,
  preparedBy,
  isOrderConfirmed = false
}) => {
  const [copied, setCopied] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [expandedLineIndex, setExpandedLineIndex] = useState<number | null>(null);

  // Format date nicely e.g. "25 Nov 2026" or "Immediate"
  const formatReadableDate = (isoString?: string) => {
    if (!isoString || isoString.toLowerCase() === 'immediate') return 'Immediate';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const handleDownloadPdf = () => {
    if (!summary) return;
    setIsDownloadingPdf(true);
    try {
      downloadAtpReportPdf(summary, {
        customerPoNumber,
        deliveryDate,
        preparedBy: preparedBy || 'Sales Operations',
        companyName: 'FlowOps Industrial Manufacturing Ltd'
      });
    } catch (err) {
      console.error('Failed to generate ATP PDF report:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleCopySummary = () => {
    if (!summary) return;
    const linesText = summary.lineResults.map(lr => {
      let detail = '';
      if (lr.failedFromNetwork) detail = 'Network error during evaluation';
      else if (lr.isProductDeleted) detail = 'Product not found (Deleted)';
      else if (lr.status === 'available') detail = 'Available (100% in stock)';
      else detail = lr.summaryText;
      return `• Line #${lr.lineIndex} [${lr.productName} x ${lr.orderedQty} ${lr.unit}]: ${detail}`;
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

  // 1. Initial Loading State (when no prior summary exists)
  if (isRunningCheck && !summary) {
    const completed = progress?.completed || 0;
    const total = progress?.total || 1;
    const percent = Math.min(100, Math.round((completed / total) * 100));

    return (
      <div className="bg-white border-2 border-indigo-400 rounded-2xl p-6 shadow-lg space-y-4 animate-in fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600 animate-spin">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 block">
                Parallel ATP Feasibility Engine
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                Checking {completed}/{total} lines…
              </h3>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
            {completed} of {total} lines ({percent}%)
          </span>
        </div>

        {/* Progress Bar (Acceptance Criteria #6: >20 lines progress bar) */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
            <div 
              className="bg-indigo-600 h-3 rounded-full transition-all duration-200 ease-out flex items-center justify-end pr-1 text-[9px] font-mono font-bold text-white"
              style={{ width: `${Math.max(8, percent)}%` }}
            >
              {percent}%
            </div>
          </div>
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
            <span>Evaluating multi-level BOMs & planned production receipts...</span>
            <span className="font-bold text-indigo-700">Checking {completed}/{total} lines…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const isUnavailable = summary.unavailableLinesCount > 0;
  const isPartial = summary.partiallyAvailableLinesCount > 0;
  const isFullyFeasible = !isUnavailable && !isPartial && !summary.hasNetworkFailure;

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-lg relative ${
      isStaleFromEdit 
        ? 'border-amber-300 ring-4 ring-amber-100/60' 
        : isFullyFeasible 
          ? 'border-emerald-300 ring-2 ring-emerald-100' 
          : isUnavailable 
            ? 'border-rose-300 ring-2 ring-rose-100' 
            : 'border-amber-300 ring-2 ring-amber-100'
    }`}>
      
      {/* EC 3: Grey out previous results while re-running check */}
      {isRunningCheck && (
        <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white border-2 border-indigo-600 rounded-2xl p-5 shadow-2xl max-w-md w-full space-y-3">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-6 w-6 text-indigo-600 animate-spin shrink-0" />
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-indigo-600 block">
                  Re-Evaluating Availability
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  Checking {progress?.completed || 0}/{progress?.total || summary.totalLines} lines…
                </h4>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-150"
                style={{ width: `${Math.round(((progress?.completed || 0) / (progress?.total || 1)) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-slate-400 text-center">
              Previous snapshot greyed out. Overwriting results with live inventory...
            </p>
          </div>
        </div>
      )}

      {/* EC 4: Network failure mid-check banner */}
      {summary.hasNetworkFailure && (
        <div className="bg-amber-600 text-white px-5 py-3 text-xs font-mono font-bold flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-white" />
            <span>
              {summary.totalLines - (summary.failedLineIndices?.length || 0)} of {summary.totalLines} lines checked. Retry failed lines.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRetryFailedLines?.(summary.failedLineIndices)}
            className="px-3 py-1 bg-white text-amber-950 hover:bg-amber-50 rounded-lg text-xs uppercase font-extrabold tracking-wider transition cursor-pointer flex items-center space-x-1 shadow-3xs"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Retry Failed Lines</span>
          </button>
        </div>
      )}

      {/* EC 5: Order already confirmed warning banner */}
      {summary.hasConfirmedDegradation && (
        <div className="bg-rose-600 text-white px-5 py-2.5 text-xs font-mono font-bold flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-white" />
            <span>
              Warning: Order confirmed with now-unavailable material. Review. ({summary.degradedLinesCount} line{summary.degradedLinesCount === 1 ? '' : 's'} short)
            </span>
          </div>
          <span className="text-[10px] bg-rose-950 text-rose-200 px-2 py-0.5 rounded font-bold uppercase">
            Confirmed Order Alert
          </span>
        </div>
      )}

      {/* EC 3: Stale Warning Banner (Line quantities edited after check) */}
      {isStaleFromEdit && !isRunningCheck && (
        <div className="bg-amber-500 text-amber-950 px-5 py-2.5 text-xs font-mono font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-950" />
            <span>
              Line item quantities or components were edited after this check. Feasibility summary is outdated!
            </span>
          </div>
          <button
            onClick={onRerunCheck}
            className="px-2.5 py-1 bg-amber-950 text-white hover:bg-black rounded-lg text-[10px] uppercase font-bold tracking-wider transition cursor-pointer flex items-center space-x-1"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Re-Check Availability</span>
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

        {/* Action Buttons: PDF Export, Copy, Re-Check, Close */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Acceptance Criteria #7: Download ATP Report Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-3xs disabled:opacity-50"
            title="Download ATP Feasibility Report as PDF for customer sharing"
          >
            {isDownloadingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5 text-indigo-200" />
            )}
            <span>Download ATP Report</span>
          </button>

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
            <span>{isOrderConfirmed ? 'Re-check Availability' : 'Re-Check'}</span>
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

      {/* Main Content Area */}
      <div className="p-5 space-y-5">
        
        {/* KPI Summary Tiles: Total, Available (🟢), Partial (🟡), Unavailable (🔴), Earliest Date */}
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

          {/* Available (🟢) */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 block flex items-center space-x-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>Available (🟢)</span>
            </span>
            <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
              {summary.availableLinesCount}
            </div>
            <span className="text-[10px] font-mono text-emerald-600">Sufficient unreserved stock</span>
          </div>

          {/* Partially Available (🟡) */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
            <span className="text-[10px] font-mono font-bold uppercase text-amber-700 block flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              <span>Partial (🟡)</span>
            </span>
            <div className="text-xl font-bold font-mono text-amber-900 mt-1">
              {summary.partiallyAvailableLinesCount}
            </div>
            <span className="text-[10px] font-mono text-amber-600">Component shortfall</span>
          </div>

          {/* Unavailable (🔴) */}
          <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl">
            <span className="text-[10px] font-mono font-bold uppercase text-rose-700 block flex items-center space-x-1">
              <XCircle className="h-3 w-3 text-rose-600" />
              <span>Unavailable (🔴)</span>
            </span>
            <div className="text-xl font-bold font-mono text-rose-900 mt-1">
              {summary.unavailableLinesCount}
            </div>
            <span className="text-[10px] font-mono text-rose-600">Zero stock / No BOM</span>
          </div>

          {/* Earliest Possible Fulfilment Date */}
          <div className="col-span-2 sm:col-span-1 p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl">
            <span className="text-[10px] font-mono font-bold uppercase text-indigo-700 block flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>Earliest Fulfilment</span>
            </span>
            <div className="text-sm font-bold font-mono text-indigo-950 mt-1 truncate">
              {formatReadableDate(summary.earliestPossibleFulfilmentDate)}
            </div>
            <span className="text-[10px] font-mono text-indigo-700 block truncate" title={summary.criticalBottleneckComponent ? `${summary.criticalBottleneckComponent.partName} (${summary.longestLeadTimeDays}d lead time)` : 'Immediate'}>
              {summary.criticalBottleneckComponent 
                ? `based on ${summary.criticalBottleneckComponent.partName} (${summary.longestLeadTimeDays}d)`
                : 'All components ready'}
            </span>
          </div>

        </div>

        {/* Advisory Action Bar for Sales Manager */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-700 font-mono">
            <Info className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              {isFullyFeasible 
                ? '✅ All required components & materials are in stock. Promised delivery dates can be firmly confirmed.'
                : `⚠️ Delivery date negotiation or lot-splitting recommended based on ${summary.criticalBottleneckComponent?.partName || 'shortfalls'}.`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {summary.earliestPossibleFulfilmentDate && summary.earliestPossibleFulfilmentDate !== 'Immediate' && onApplyEarliestDate && (
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
                          Line #{lr.lineIndex}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {lr.productName}
                        </span>
                        {lr.isProductDeleted ? (
                          <span className="text-[9px] font-mono bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.2 rounded font-bold">
                            Deleted Product
                          </span>
                        ) : lr.hasBOM ? (
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
                      
                      {/* EC 2: Deleted Product Status */}
                      {lr.isProductDeleted ? (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Product not found</span>
                          </span>
                          <span className="block text-[10px] font-mono text-rose-600 mt-0.5">
                            Product record was deleted from catalog
                          </span>
                        </div>
                      ) : lr.failedFromNetwork ? (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Network Error</span>
                          </span>
                          <span className="block text-[10px] font-mono text-amber-700 mt-0.5">
                            Connection timeout on this line
                          </span>
                        </div>
                      ) : lr.isNoStockNoBom ? (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Unavailable – No Stock / No BOM</span>
                          </span>
                          <span className="block text-[10px] font-mono text-rose-600 mt-0.5">
                            Requires BOM configuration or procurement
                          </span>
                        </div>
                      ) : isLineAvailable ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>🟢 Available</span>
                        </span>
                      ) : isLinePartial ? (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 text-amber-900 border border-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span>🟡 Partially Available</span>
                          </span>
                          <span className="block text-[10px] font-mono text-amber-700 font-semibold mt-0.5">
                            {lr.limitingComponent ? `${lr.limitingComponent.partName} shortfall: ${lr.limitingComponent.shortfall} ${lr.limitingComponent.unit}` : lr.summaryText}
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-50 text-rose-900 border border-rose-300">
                            <XCircle className="h-3.5 w-3.5 text-rose-600" />
                            <span>🔴 Unavailable</span>
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
