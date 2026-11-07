// src/components/orders/MaterialAvailabilityBadge.tsx

import React, { useState } from 'react';
import { QuoteItem, StockItem, Order } from '../../types';
import { 
  AtpCheckResult, 
  AtpComponentBreakdown 
} from '../../types/materialAvailability';
import { MaterialAvailabilityService } from '../../services/materialAvailabilityService';
import { MultiLevelBom } from '../../types/multiLevelBom';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Layers, 
  Calendar, 
  Package, 
  Info,
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface MaterialAvailabilityBadgeProps {
  item: QuoteItem;
  stockItems?: StockItem[];
  existingOrders?: Order[];
  multiLevelBoms?: MultiLevelBom[];
  lastSyncedTimestamp?: string | number;
  onOpenAcknowledgement?: (atpResult: AtpCheckResult) => void;
  interactive?: boolean;
}

export const MaterialAvailabilityBadge: React.FC<MaterialAvailabilityBadgeProps> = ({
  item,
  stockItems = [],
  existingOrders = [],
  multiLevelBoms = [],
  lastSyncedTimestamp,
  onOpenAcknowledgement,
  interactive = true
}) => {
  const [showPopover, setShowPopover] = useState(false);

  // Compute ATP Result
  const atp: AtpCheckResult = MaterialAvailabilityService.evaluateOrderLineAtp(
    item,
    stockItems,
    existingOrders,
    multiLevelBoms,
    lastSyncedTimestamp
  );

  const isAvailable = atp.overallStatus === 'available';
  const isPartial = atp.overallStatus === 'partially_available';
  const isUnavailable = atp.overallStatus === 'unavailable';

  // Badge Styling
  const badgeConfig = isAvailable
    ? {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100',
        dot: 'bg-emerald-500',
        icon: CheckCircle2,
        label: 'Available'
      }
    : isPartial
      ? {
          bg: 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100',
          dot: 'bg-amber-500',
          icon: AlertTriangle,
          label: atp.limitingComponent 
            ? `Partially Available (${atp.limitingComponent.partName} shortfall: ${atp.limitingComponent.shortfall})` 
            : 'Partially Available'
        }
      : {
          bg: 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100',
          dot: 'bg-rose-500',
          icon: XCircle,
          label: atp.limitingComponent
            ? `Unavailable (${atp.limitingComponent.partName} shortfall: ${atp.limitingComponent.shortfall})`
            : 'Unavailable'
        };

  const Icon = badgeConfig.icon;

  return (
    <div className="relative inline-block font-sans select-none">
      
      {/* Pill Badge Trigger */}
      <button
        type="button"
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={() => setShowPopover(false)}
        onClick={() => {
          if (interactive && (isPartial || isUnavailable) && onOpenAcknowledgement) {
            onOpenAcknowledgement(atp);
          } else {
            setShowPopover(!showPopover);
          }
        }}
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border transition shadow-3xs cursor-pointer ${badgeConfig.bg}`}
        title="Real-Time ATP Material Availability (Click or hover to inspect BOM breakdown)"
      >
        <span className={`h-2 w-2 rounded-full ${badgeConfig.dot} animate-pulse`} />
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-[260px]">{badgeConfig.label}</span>

        {/* Staleness Pill Indicator (EC 4) */}
        {atp.isStale && (
          <span 
            className="text-[9px] font-mono bg-amber-200 text-amber-900 border border-amber-400 px-1 rounded uppercase font-bold ml-1"
            title={`ATP data is stale (last synced ${atp.stalenessMinutes}m ago).`}
          >
            Stale ({atp.stalenessMinutes}m)
          </span>
        )}

        {/* Acknowledgement Status if already acknowledged */}
        {item.atpAcknowledgement && (
          <span 
            className="text-[9px] font-mono bg-purple-100 text-purple-800 border border-purple-300 px-1 rounded uppercase font-bold"
            title={`Acknowledged by ${item.atpAcknowledgement.acknowledgedBy}: "${item.atpAcknowledgement.reason}"`}
          >
            Acknowledged
          </span>
        )}
      </button>

      {/* Hover / Tap Popover Breakdown */}
      {showPopover && (
        <div 
          onMouseEnter={() => setShowPopover(true)}
          onMouseLeave={() => setShowPopover(false)}
          className="absolute z-50 bottom-full left-0 mb-2 w-84 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">
                ATP Availability Breakdown
              </span>
              <h4 className="text-xs font-bold text-white truncate max-w-[220px]">
                {item.name}
              </h4>
            </div>
            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
              isAvailable 
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700' 
                : isPartial 
                  ? 'bg-amber-950 text-amber-300 border-amber-700' 
                  : 'bg-rose-950 text-rose-300 border-rose-700'
            }`}>
              {atp.overallStatus.replace('_', ' ')}
            </span>
          </div>

          {/* BOM Explosion Info */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2">
            <span>
              {atp.hasBOM ? `BOM Explosion: ${atp.components.length} parts` : 'Direct Stock Check (No BOM)'}
            </span>
            <span>Required: <strong className="text-white">{item.quantity} units</strong></span>
          </div>

          {/* Components List */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin text-xs font-mono">
            {atp.components.map((comp) => {
              const compOk = comp.status === 'available';
              const compPart = comp.status === 'partially_available';

              return (
                <div 
                  key={comp.id} 
                  className={`p-2 rounded-xl border text-[11px] ${
                    compOk 
                      ? 'bg-slate-800/60 border-slate-700 text-slate-300' 
                      : compPart 
                        ? 'bg-amber-950/40 border-amber-800/80 text-amber-200' 
                        : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate max-w-[170px]" title={comp.partName}>
                      {comp.partName}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      compOk ? 'text-emerald-400' : compPart ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {comp.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-700/60">
                    <div>Req: <span className="text-white font-bold">{comp.requiredQty} {comp.unit}</span></div>
                    <div>Avail: <span className="text-white font-bold">{comp.unreservedAvailableStock} {comp.unit}</span></div>
                    {comp.shortfall > 0 && (
                      <div className="col-span-2 text-rose-300 font-bold">
                        Shortfall: {comp.shortfall} {comp.unit}
                      </div>
                    )}
                    {comp.expectedReplenishmentDate && (
                      <div className="col-span-2 text-indigo-300">
                        Expected Delivery: {comp.expectedReplenishmentDate}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sync Timestamp Footer (EC 4) */}
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>ATP Formula: Stock + Receipts − Reserved</span>
            <span>Sync: {atp.lastSyncedTimestamp ? new Date(atp.lastSyncedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}</span>
          </div>

          {/* Advisory Notice Button if Unavailable */}
          {(isPartial || isUnavailable) && onOpenAcknowledgement && (
            <div className="mt-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowPopover(false);
                  onOpenAcknowledgement(atp);
                }}
                className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-mono font-bold flex items-center justify-center space-x-1 cursor-pointer transition shadow-3xs"
              >
                <span>Acknowledge Shortfall & Proceed</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Arrow pointing down */}
          <div className="absolute top-full left-6 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
        </div>
      )}

    </div>
  );
};
