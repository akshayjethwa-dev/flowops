// src/pages/dashboard/DashboardPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useTenantConfig } from '../../hooks/useTenantConfig';
import { useStockItems } from '../../hooks/useStockInventory';
import { DashboardKpiCard } from '../../components/DashboardKpiCard';
import { 
  Archive, 
  FileText, 
  Clock, 
  Truck, 
  AlertTriangle, 
  ChevronRight, 
  RotateCw,
  Sliders,
  Sparkles,
  ClipboardList,
  Package,
  Activity,
  CreditCard,
  Hammer
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { profile, tenant, isSandboxMode } = useAuth();
  const navigate = useNavigate();

  const { tenantConfig } = useTenantConfig(tenant?.id);
  const { summary, loading, error, refetch } = useDashboardData(tenant?.id, isSandboxMode);

  // Fallback for stock items
  const { items: allStockItems } = useStockItems(tenant?.id);
  const [localLowStockAlerts, setLocalLowStockAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant?.id || allStockItems.length === 0) return;
    const low = allStockItems.filter(item => {
      const qty = Number(item.currentQty || 0);
      const minStock = Number(item.reorderLevel || 0);
      return qty < minStock;
    });
    setLocalLowStockAlerts(low);
  }, [tenant?.id, allStockItems]);

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getStageLabel = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case 'cutting': return 'Cutting';
      case 'welding': return 'Welding';
      case 'machining': return 'CNC Machining';
      case 'assembly': return 'Assembly';
      case 'quality_check': return 'Quality NDT';
      case 'ready': return 'Ready';
      default: return stage || 'Cutting';
    }
  };

  const getRelativeTimeString = (dateInput: any) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return `just now`;
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getActivityIcon = (entityType: string) => {
    switch (entityType?.toLowerCase()) {
      case 'rfq':
        return <Archive className="h-4 w-4 text-sky-505" />;
      case 'quote':
      case 'quotation':
        return <FileText className="h-4 w-4 text-indigo-505" />;
      case 'order':
        return <Hammer className="h-4 w-4 text-emerald-505" />;
      case 'job':
        return <ClipboardList className="h-4 w-4 text-amber-550" />;
      case 'dispatch':
        return <Truck className="h-4 w-4 text-amber-505" />;
      case 'invoice':
      case 'payment':
        return <CreditCard className="h-4 w-4 text-rose-505" />;
      default:
        return <Activity className="h-4 w-4 text-slate-505" />;
    }
  };

  const handleKpiNavigate = (route: string, state?: any) => {
    navigate(route, { state });
  };

  // Skeleton UI loading state
  if (loading) {
    return (
      <div className="space-y-6 font-sans">
        <div className="animate-pulse space-y-2 pb-6 border-b border-slate-100">
          <div className="h-4 w-32 bg-slate-200 rounded-sm" />
          <div className="h-8 w-64 bg-slate-200 rounded-md" />
          <div className="h-4 w-96 bg-slate-200 rounded-sm" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-white border border-slate-100 rounded-xl p-5 h-28 animate-pulse flex justify-between items-center">
              <div className="space-y-2.5 w-2/3">
                <div className="h-3 bg-slate-200 rounded-sm w-1/2" />
                <div className="h-6 bg-slate-200 rounded-md w-3/4" />
                <div className="h-3 bg-slate-200 rounded-sm w-1/3" />
              </div>
              <div className="h-10 w-10 bg-slate-200 rounded-lg" />
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-150 rounded-xl p-5 h-32 animate-pulse space-y-4">
          <div className="h-4 w-48 bg-slate-200 rounded-sm" />
          <div className="h-12 bg-slate-100 rounded-lg w-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((col) => (
            <div key={col} className="bg-white border border-slate-150 rounded-xl p-4.5 space-y-4 h-[350px] animate-pulse">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="h-4 w-40 bg-slate-200 rounded-sm" />
                <div className="h-4 w-12 bg-slate-200 rounded-sm" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-14 bg-slate-50 border border-slate-100 rounded-lg w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50/50 border border-red-200 rounded-xl p-10 text-center space-y-4 font-sans max-w-xl mx-auto my-12" id="dashboard-error-pane">
        <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h4 className="font-bold text-slate-900">Analytics Load Failed</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            The system encountered an error establishing real-time synchronization pipelines with the database shard. Details:
          </p>
          <p className="text-[10px] font-mono bg-red-50 text-red-700 p-2.5 rounded border border-red-100/50 block text-left">
            {error}
          </p>
        </div>
        <button
          onClick={refetch}
          className="bg-slate-905 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded hover:bg-slate-805 transition-all inline-flex items-center space-x-1.5 cursor-pointer shadow-sm"
        >
          <RotateCw className="h-3.5 w-3.5" />
          <span>Retry Database Sync</span>
        </button>
      </div>
    );
  }

  // Bind the 6 live KPIs satisfying requirements
  const liveKpis = [
    {
      id: 'open-rfqs',
      title: 'Open RFQs',
      value: summary?.openRfqsCount ?? 0,
      description: 'Under Commercial Cost Matching',
      icon: Archive,
      colorScheme: 'sky' as const,
      onClick: () => handleKpiNavigate('/rfqs')
    },
    {
      id: 'quotes-pending',
      title: 'Quotations Pending',
      value: summary?.quotesPendingCount ?? 0,
      description: 'Awaiting Dealer Reply',
      icon: FileText,
      colorScheme: 'indigo' as const,
      onClick: () => handleKpiNavigate('/rfqs')
    },
    {
      id: 'active-production',
      title: 'Orders in Production',
      value: summary?.ordersInProductionCount ?? 0,
      description: 'Active Workshop Loading',
      icon: Sliders,
      colorScheme: 'emerald' as const,
      onClick: () => handleKpiNavigate('/orders')
    },
    {
      id: 'dispatches-today',
      title: 'Dispatches Today',
      value: summary?.dispatchesTodayCount ?? 0,
      description: 'Lorry Gates Exited Today',
      icon: Truck,
      colorScheme: 'amber' as const,
      onClick: () => handleKpiNavigate('/dispatch')
    },
    {
      id: 'overdue-payments',
      title: 'Overdue Payments',
      value: summary?.overduePaymentsCount ?? 0,
      description: 'Outstanding Cash collection',
      icon: CreditCard,
      colorScheme: 'rose' as const,
      onClick: () => handleKpiNavigate('/billing')
    },
    {
      id: 'low-stock-items',
      title: 'Low Stock Items',
      value: summary?.lowStockItemsCount ?? 0,
      description: 'SKUs Below Minimum Safety Level',
      icon: Package,
      colorScheme: 'rose' as const,
      onClick: () => handleKpiNavigate('/inventory')
    }
  ];

  // Pipeline stage items
  const pipelineStages = [
    { key: 'cutting', label: 'Material Cutting', colorClass: 'bg-indigo-500' },
    { key: 'welding', label: 'Welding Joint', colorClass: 'bg-blue-500' },
    { key: 'machining', label: 'CNC Tooling', colorClass: 'bg-amber-500' },
    { key: 'assembly', label: 'Assembly Rig', colorClass: 'bg-purple-500' },
    { key: 'quality_check', label: 'Quality NDT', colorClass: 'bg-pink-500' },
    { key: 'ready', label: 'Ready Yard', colorClass: 'bg-emerald-500' }
  ];

  return (
    <div className="space-y-6 font-sans pb-10" id="main-dashboard-viewport">
      
      {/* Dynamic Header Welcoming Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-3">
        <div>
          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
            Welcome Back
          </span>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mt-1 leading-none" id="welcome-greeting-lbl">
            {getGreeting()}, {profile?.name || 'Operator'}
          </h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Snapshot control deck for <strong className="text-slate-705 font-bold uppercase">{tenant?.companyName || 'Ashrey Castings'}</strong>. Operations status is strictly compiled.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-205 rounded-lg px-2.5 py-1.5 self-start sm:self-center font-mono">
          <Clock className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-650">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
      </div>

      {/* Onboarding Resume Checklist Banner */}
      {profile?.role === 'admin' && tenantConfig && !tenantConfig.onboardingCompleted && (
        <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-4.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in" id="dashboard-onboarding-checker-bar">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 bg-sky-500 rounded-lg flex items-center justify-center text-slate-950 font-bold shrink-0">
              <Sparkles className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-sky-950 uppercase tracking-wide leading-none">First-Time Setup Checklist Incomplete</h4>
              <p className="text-xs text-sky-900/85 mt-2 leading-normal">
                Guide your plant setup, customize manufacturing stages, invite your dispatch and sales teams to Ashrey FlowOps.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/onboarding')}
            className="w-full md:w-auto bg-sky-950 text-white hover:bg-sky-900 border border-transparent px-4.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
          >
            Resume Setup Wizard
          </button>
        </div>
      )}

      {/* Primary KPI Grid - 6 Cards showing LIVE counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="kpi-cards-grid">
        {liveKpis.map((kpi) => (
          <DashboardKpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      {/* Production Pipeline: horizontal bar showing stages count */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs" id="production-pipeline-ribbon">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <Sliders className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            <h3 className="text-xs font-bold font-mono text-slate-705 uppercase tracking-wider block">
              Production Pipeline Status Matrix
            </h3>
          </div>
          <button
            onClick={() => navigate('/orders')}
            className="text-[10px] font-bold font-mono tracking-wider text-emerald-650 hover:text-emerald-750 uppercase cursor-pointer flex items-center space-x-0.5"
          >
            <span>Full Shopfloor monitor</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Horizontal bar visualization */}
        {summary?.ordersInProductionByStage && (
          <div className="space-y-4">
            {/* The Horizontal bar showing counts segments proportion */}
            <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {pipelineStages.map((stage) => {
                const count = summary.ordersInProductionByStage[stage.key as keyof typeof summary.ordersInProductionByStage] || 0;
                const totalActive = Object.values(summary.ordersInProductionByStage).reduce((a, b) => a + b, 0) || 1;
                const widthPercent = (count / totalActive) * 100;
                if (count === 0) return null;
                return (
                  <div 
                    key={stage.key}
                    style={{ width: `${widthPercent}%` }}
                    className={`${stage.colorClass} transition-all border-r border-white/20 last:border-0`}
                    title={`${stage.label}: ${count} lots`}
                  />
                );
              })}
            </div>

            {/* Horizontal Text Readout & Individual Cards */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 font-mono text-xs text-slate-600 justify-between select-none">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {pipelineStages.map((stage) => {
                  const count = summary.ordersInProductionByStage[stage.key as keyof typeof summary.ordersInProductionByStage] || 0;
                  return (
                    <div key={stage.key} className="flex items-center space-x-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${stage.colorClass}`} />
                      <span className="font-semibold text-slate-800">{getStageLabel(stage.key)}:</span>
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-l border-slate-200 pl-4 py-0.5 flex items-center space-x-2 shrink-0">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-bold text-slate-800">Dispatched Today:</span>
                <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">{summary?.dispatchesTodayCount ?? 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two Column details: Recent Activity Feeds & Delayed Alerts / Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: Recent Activity Feed */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col h-[400px]" id="activity-feed-panel">
          <div className="flex justify-between items-center pb-3 border-b border-slate-150 mb-3 shrink-0">
            <div className="flex items-center space-x-1.5">
              <Activity className="h-4 w-4 text-sky-505" />
              <h3 className="text-xs font-bold font-mono text-slate-700 uppercase tracking-widest leading-none">
                Recent Operations Log Feed
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-sky-50 text-sky-905 px-2.5 py-0.5 rounded uppercase font-bold">
              Real-time
            </span>
          </div>

          <div className="flex-grow overflow-y-auto min-h-0 divide-y divide-slate-100 pr-1">
            {summary?.recentActivities && summary.recentActivities.length > 0 ? (
              summary.recentActivities.map((act) => (
                <div key={act.id} className="py-2.5 flex items-start space-x-3 hover:bg-slate-50/40 rounded px-1 transition-all">
                  <div className="p-2 bg-slate-50 border border-slate-155 rounded-lg shrink-0 mt-0.5">
                    {getActivityIcon(act.module || act.entityType)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-tight">
                      {act.description}
                    </p>
                    <div className="flex items-center space-x-2 mt-1.5 text-[9px] font-mono text-slate-400">
                      <span className="text-slate-500 font-bold">{act.actorName || act.actor?.displayName || 'System'}</span>
                      <span>•</span>
                      <span>{getRelativeTimeString(act.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-5">
                <div className="h-10 w-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-2">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">Database Streams Quiet</p>
                <p className="text-[10px] text-slate-450 mt-1 max-w-xs mx-auto">
                  Awaiting operational interactions in the workshop to log actions live on the control deck.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Delayed / At-Risk Commitments */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col h-[400px]" id="delayed-commitments-panel">
          <div className="flex justify-between items-center pb-3 border-b border-slate-150 mb-3 shrink-0">
            <div className="flex items-center space-x-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <h3 className="text-xs font-bold font-mono text-slate-700 uppercase tracking-widest leading-none">
                Delayed Commitments & At-Risk Lots
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-rose-50 border border-rose-100 text-rose-800 px-2.5 py-0.5 rounded uppercase font-bold">
              Critical
            </span>
          </div>

          <div className="flex-grow overflow-y-auto min-h-0 divide-y divide-slate-100 pr-1">
            {summary && summary.overdueJobs.length > 0 ? (
              summary.overdueJobs.map((job) => (
                <div key={job.orderId} className="py-2.5 flex items-center justify-between hover:bg-slate-50/40 rounded px-1 transition-all">
                  <div className="space-y-1 pr-3 min-w-0 flex-grow">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-slate-800 text-xs truncate leading-none">
                        {job.customerName}
                      </span>
                      <span className="bg-rose-50 border border-rose-100 text-[8px] px-1 font-mono leading-none rounded text-rose-600 font-bold">
                        {job.orderNumber}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-505 truncate block">
                      Part: {job.itemName} ({job.quantity} pcs)
                    </div>
                    <div className="flex items-center space-x-3.5 text-[9px] font-mono text-slate-400 mt-1">
                      <span>Commitment: <strong>{new Date(job.deliveryDate).toLocaleDateString()}</strong></span>
                      <span className="text-rose-500 font-bold bg-rose-50 px-1 py-0.1 rounded">
                        +{job.overdueDays} days overdue
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1.5 shrink-0">
                    {job.currentStage && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-100 rounded tracking-wide leading-none select-none">
                        {getStageLabel(job.currentStage)}
                      </span>
                    )}
                    <button
                      onClick={() => handleKpiNavigate('/orders', { preselectedOrderId: job.orderId })}
                      className="bg-slate-900 text-white hover:bg-slate-800 text-[8px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded inline-flex items-center space-x-0.5 cursor-pointer leading-none select-none"
                    >
                      <span>Expedite</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-5">
                <div className="h-10 w-10 bg-emerald-50 text-emerald-650 rounded-full flex items-center justify-center mb-2">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">Shopfloor Pacing Safely</p>
                <p className="text-[10px] text-slate-450 mt-1 max-w-sm mx-auto">
                  Every active lot in the manufacturing pipeline is pacing safely inside its committed delivery contract boundaries!
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Emergency Stock Warnings watchlist level */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs" id="emergency-stock-panel">
        <div className="flex justify-between items-center pb-3 border-b border-slate-150 mb-3">
          <div className="flex items-center space-x-1.5">
            <Package className="h-4.5 w-4.5 text-rose-500" />
            <h3 className="text-xs font-bold font-mono text-slate-705 uppercase tracking-wider block">
              Emergency Low Stock Alert Watchlist
            </h3>
          </div>
          <span className="text-[10px] uppercase font-mono font-bold bg-rose-50 border border-rose-100 text-rose-700 px-2.5 py-0.5 rounded">
            {localLowStockAlerts.length} SKU Warnings
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {localLowStockAlerts.length > 0 ? (
            localLowStockAlerts.slice(0, 6).map(item => (
              <div key={item.id} className="bg-slate-50 border border-slate-155 rounded-lg p-3 flex items-center justify-between text-xs hover:border-rose-200 transition-all">
                <div className="space-y-1 pr-3 min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono font-black text-slate-900 tracking-tight leading-none block">
                      {item.code}
                    </span>
                    <span className="bg-rose-50 border border-rose-100 text-rose-700 text-[8px] font-mono px-1 py-0.2 rounded font-bold leading-none block">
                      LOW
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 truncate font-medium">
                    {item.name}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono leading-none">
                    Stock: <strong className="text-rose-600">{item.currentQty} {item.unit}</strong> (Min: {item.reorderLevel} {item.unit})
                  </div>
                </div>
                <button
                  onClick={() => navigate('/inventory')}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded shrink-0"
                >
                  Induct
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-lg">
              <p className="text-xs font-bold text-slate-600 block">All SKU Safety Levels Respected</p>
              <p className="text-[10px] text-slate-450 mt-1 max-w-md mx-auto">
                No registered plant floor raw materials or system spares are currently resting below their safety levels. Well stocked!
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
