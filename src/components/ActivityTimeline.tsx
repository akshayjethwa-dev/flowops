// src/components/ActivityTimeline.tsx

import React from 'react';
import { useActivityEvents } from '../hooks/useActivityEvents';
import { 
  FileText, 
  MessageSquare, 
  Layers, 
  Truck, 
  UserPlus, 
  UserCheck,
  ShieldAlert, 
  Clock, 
  Search,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { ActivityEvent, ActivityEntityType } from '../types';

interface ActivityTimelineProps {
  entityId?: string;
  entityType?: ActivityEntityType;
  maxLimit?: number;
  title?: string;
  compact?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  entityId,
  entityType,
  maxLimit,
  title,
  compact = false
}) => {
  const { events, loading, error } = useActivityEvents({
    entityId,
    entityType,
    maxLimit
  });

  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('all');

  const filteredEvents = React.useMemo(() => {
    return events.filter(evt => {
      const actorName = evt.actorName || evt.actor?.displayName || '';
      const matchesSearch = 
        evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (evt.metadata?.customerName && evt.metadata.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const evtType = evt.entityType || (evt as any).module;
      const matchesType = filterType === 'all' || evtType === filterType;
      
      return matchesSearch && matchesType;
    });
  }, [events, searchQuery, filterType]);

  const getEntityIcon = (type: any) => {
    switch (type?.toLowerCase()) {
      case 'rfq': 
        return <FileText className="h-4 w-4 text-amber-500" />;
      case 'quotation': 
        return <FileText className="h-4 w-4 text-sky-500" />;
      case 'job': 
        return <Layers className="h-4 w-4 text-indigo-500" />;
      case 'dispatch': 
        return <Truck className="h-4 w-4 text-emerald-500" />;
      case 'whatsapp': 
        return <MessageSquare className="h-4 w-4 text-teal-500" />;
      case 'user': 
        return <UserPlus className="h-4 w-4 text-purple-500" />;
      default: 
        return <Info className="h-4 w-4 text-slate-500" />;
    }
  };

  const getEventBadgeStyle = (action: string) => {
    switch (action?.toLowerCase()) {
      case 'create':
      case 'rfq_created':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'status_change':
      case 'stage_change':
      case 'order_stage_changed':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'invited':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'deactivate':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'whatsapp_sent':
        return 'bg-teal-50 text-teal-700 border-teal-100';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-2 text-xs text-slate-400">
        <div className="animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full" />
        <span>Loading factory audit events...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg flex items-center space-x-2 text-xs text-rose-700">
        <ShieldAlert className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER OR TITLE */}
      {title && (
        <div className="flex justify-between items-center-center">
          <h3 className="text-xs font-bold font-mono text-slate-700 uppercase tracking-widest flex items-center space-x-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>{title}</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-400">
            {filteredEvents.length} recorded index{filteredEvents.length !== 1 ? 'es' : ''}
          </span>
        </div>
      )}

      {/* SEARCH AND FILTERS (only shown when not compact detail view) */}
      {!compact && (
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search descriptions, operator names, or entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded text-xs select-text focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white border border-slate-200 rounded text-xs px-2.5 py-1.5 focus:outline-none focus:border-sky-500 transition-colors"
            >
              <option value="all">All Modules</option>
              <option value="rfq">RFQs</option>
              <option value="quotation">Quotations</option>
              <option value="job">Shopfloor Jobs</option>
              <option value="dispatch">Dispatches</option>
              <option value="whatsapp">BSP WhatsApp</option>
              <option value="user">Operator Credentials</option>
            </select>
          </div>
        </div>
      )}

      {/* TIMELINE LIST */}
      {filteredEvents.length > 0 ? (
        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200/80">
          {filteredEvents.map((evt) => {
            return (
              <div key={evt.id} className="relative group select-text">
                {/* ICON MARKER */}
                <div className="absolute -left-6 top-1.5 w-6 h-6 rounded-full bg-slate-50 border border-slate-250 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                  {getEntityIcon(evt.module || evt.entityType)}
                </div>

                {/* CONTENT CONTAINER */}
                <div className="bg-white p-3.5 rounded-lg border border-slate-200/70 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      {/* ACTION TYPE BADGE */}
                      <span className={`text-[9px] font-mono font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${getEventBadgeStyle(evt.action || evt.actionType)}`}>
                        {(evt.action || evt.actionType || '').replace('_', ' ')}
                      </span>
                      {/* MODULE CONTEXT */}
                      <span className="text-[10px] font-mono text-slate-400 lowercase">
                        /{evt.module || evt.entityType}s
                      </span>
                    </div>

                    {/* OPERATOR AND ACCURATE TIME */}
                    <div className="flex items-center space-x-2.5 text-[9px] font-mono text-slate-400 self-start sm:self-center">
                      <span className="flex items-center font-semibold text-slate-600 bg-slate-100/60 px-1.5 py-0.5 rounded gap-1">
                        <UserCheck className="h-3 w-3 text-slate-400" />
                        <span>{evt.actorName || evt.actor?.displayName || 'System'}</span>
                      </span>
                      <span>{new Date(evt.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* HUMAN READABLE EVENT SYNOPSIS */}
                  <p className="text-slate-800 text-xs font-sans font-medium leading-relaxed">
                    {evt.description}
                  </p>

                  {/* METADATA ACCENTS */}
                  {evt.metadata && Object.keys(evt.metadata).some(k => evt.metadata?.[k] !== undefined) && (
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[9px] font-mono text-slate-500">
                      {evt.metadata.fromStage && evt.metadata.toStage && (
                        <span>
                          Cycle: <strong className="text-slate-705 uppercase">{evt.metadata.fromStage}</strong> → <strong className="text-indigo-600 uppercase">{evt.metadata.toStage}</strong>
                        </span>
                      )}
                      {evt.metadata.fromStatus && evt.metadata.toStatus && (
                        <span>
                          Status: <strong className="text-slate-705 uppercase">{evt.metadata.fromStatus}</strong> → <strong className="text-sky-600 uppercase">{evt.metadata.toStatus}</strong>
                        </span>
                      )}
                      {evt.metadata.customerName && (
                        <span>
                          Customer: <strong className="text-slate-700">{evt.metadata.customerName}</strong>
                        </span>
                      )}
                      {evt.metadata.rfqNumber && (
                        <span>
                          RFQ Ref: <strong className="text-slate-700">{evt.metadata.rfqNumber}</strong>
                        </span>
                      )}
                      {evt.metadata.jobCode && (
                        <span>
                          Job ID: <strong className="text-slate-700">{evt.metadata.jobCode}</strong>
                        </span>
                      )}
                      {evt.metadata.orderNumber && (
                        <span>
                          Order Ref: <strong className="text-slate-700">{evt.metadata.orderNumber}</strong>
                        </span>
                      )}
                      {evt.metadata.role && (
                        <span>
                          Assigned Permission: <strong className="text-purple-600 uppercase">{evt.metadata.role}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs text-slate-400 font-sans">
          No audit occurrences matched current filters inside this index.
        </div>
      )}
    </div>
  );
};
