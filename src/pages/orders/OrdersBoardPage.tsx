// src/pages/orders/OrdersBoardPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProductionBoard } from '../../hooks/useProduction';
import { useProductionStagesConfig } from '../../hooks/useProductionStagesConfig';
import { sendWhatsAppNotification } from '../../utils/whatsapp';
import { PRODUCTION_STAGES_ENUM } from '../../data/mockData';
import { ProductionJob, Order } from '../../types';
import { 
  Layers, 
  User, 
  Calendar, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  MoveRight,
  Sparkles,
  RefreshCw,
  Clock,
  Filter,
  Sliders,
  ChevronDown
} from 'lucide-react';

export const OrdersBoardPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { jobs, orders, loading, error, updateJobStage } = useProductionBoard(tenant?.id);
  const { stages } = useProductionStagesConfig(tenant?.id);

  // Dynamic stages mapping from process config settings
  const activeStages = stages && stages.length > 0 
    ? stages.map(s => ({
        value: s.id,
        label: s.name,
        color: s.color === 'indigo' ? 'border-t-indigo-500 text-indigo-700 bg-indigo-50/15' :
               s.color === 'blue' ? 'border-t-blue-500 text-blue-700 bg-blue-50/15' :
               s.color === 'amber' ? 'border-t-amber-500 text-amber-700 bg-amber-50/15' :
               s.color === 'purple' ? 'border-t-purple-500 text-purple-700 bg-purple-50/15' :
               s.color === 'pink' ? 'border-t-pink-500 text-pink-700 bg-pink-50/15' :
               s.color === 'green' ? 'border-t-emerald-500 text-emerald-700 bg-emerald-50/15' :
               s.color === 'orange' ? 'border-t-orange-500 text-orange-700 bg-orange-50/15' :
               s.color === 'teal' ? 'border-t-teal-500 text-teal-700 bg-teal-50/15' :
               'border-t-slate-500 text-slate-700 bg-slate-50/15'
      }))
    : [
        { value: 'cutting', label: 'Material Cutting', color: 'border-t-indigo-500 text-indigo-700 bg-indigo-50/20' },
        { value: 'welding', label: 'Pre-Heating & Welding', color: 'border-t-blue-500 text-blue-700 bg-blue-50/20' },
        { value: 'machining', label: 'Precision Machining', color: 'border-t-amber-500 text-amber-700 bg-amber-50/20' },
        { value: 'assembly', label: 'Shopfloor Assembly', color: 'border-t-purple-500 text-purple-700 bg-purple-50/20' },
        { value: 'quality_check', label: 'NDT & Quality Check', color: 'border-t-pink-500 text-pink-700 bg-pink-50/20' },
        { value: 'ready', label: 'Ready for Dispatch', color: 'border-t-emerald-500 text-emerald-700 bg-emerald-50/20' }
      ];

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMobileStage, setSelectedMobileStage] = useState<string>('cutting');
  const [stageNotes, setStageNotes] = useState('');
  const [activeStageUpdateJob, setActiveStageUpdateJob] = useState<ProductionJob | null>(null);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sync mobile default view with available stations
  useEffect(() => {
    if (activeStages && activeStages.length > 0 && !activeStages.some(s => s.value === selectedMobileStage)) {
      setSelectedMobileStage(activeStages[0].value);
    }
  }, [stages, activeStages, selectedMobileStage]);

  // Filters output
  const filteredJobs = jobs.filter(j => {
    const isSearchMatch = j.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          j.id.toLowerCase().includes(searchTerm.toLowerCase());
    return isSearchMatch;
  });

  // Overdue Check (placeholder checking if job was updated > 5 days ago and is not 'ready')
  const isJobOverdue = (job: ProductionJob) => {
    if (job.currentStage === 'ready') return false;
    const lastUpdate = new Date(job.updatedAt).getTime();
    const ageDays = (Date.now() - lastUpdate) / (1000 * 365 * 24); // simplistic local age check
    return ageDays > 3; // overdue tracker limit
  };

  // Stage shift execution handler
  const handleStageMove = async (job: ProductionJob, nextStage: string) => {
    if (!profile || !tenant) return;
    setUpdatingStage(true);
    
    try {
      const displayNotes = stageNotes.trim() || `Advanced segment to ${nextStage.toUpperCase()} in the control board.`;
      
      await updateJobStage(
        job.id, 
        nextStage, 
        displayNotes, 
        profile.uid, 
        profile.name || 'Operations Lead'
      );

      // Trigger automatic WhatsApp update alert if contact details exit on parent Order card
      const parentOrder = orders.find(o => o.id === job.orderId);
      if (parentOrder?.phone) {
        const displayLabel = activeStages.find(s => s.value === nextStage)?.label || nextStage;
        await sendWhatsAppNotification({
          recipientName: parentOrder.customerName,
          recipientPhone: parentOrder.phone,
          templateName: 'production_update',
          tenantId: tenant.id,
          orderId: parentOrder.id,
          customerId: (parentOrder as any).customerId || '',
          parameters: {
            itemName: job.itemName,
            quantity: job.quantity.toString(),
            orderNumber: parentOrder.orderNumber,
            stage: displayLabel
          }
        });
      }

      setStageNotes('');
      setActiveStageUpdateJob(null);
    } catch (err) {
      console.error('Error shifting job node:', err);
    } finally {
      setUpdatingStage(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 bg-white border border-slate-205 rounded-xl space-y-4">
        <div className="animate-spin h-8 w-8 border-3 border-indigo-650 border-t-transparent rounded-full mx-auto" />
        <p className="text-[11px] text-slate-450 font-mono uppercase tracking-widest">Constructing Kanban shopfloor array...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header operations controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest block leading-none">
            Manufacturing resource execution
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-905 leading-tight block mt-1.5">
            Production Line Kanban Board
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visualise shopfloor yield pipelines, drag-advance items across CNC, fabrication, and QA stages, and synchronize client WhatsApp notifications.
          </p>
        </div>

        {/* Global Stats KPIs */}
        <div className="flex items-center space-x-3 text-right text-xs">
          <div className="p-2.5 bg-slate-50 border rounded-lg">
            <span className="text-[9px] text-slate-400 font-mono block uppercase">Yield Items WIP</span>
            <span className="font-extrabold text-slate-800">{jobs.filter(j => j.currentStage !== 'ready').length} active lines</span>
          </div>
          <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-lg text-emerald-800">
            <span className="text-[9px] text-emerald-600/70 font-mono block uppercase">Completed ready</span>
            <span className="font-black text-emerald-900">{jobs.filter(j => j.currentStage === 'ready').length} jobs</span>
          </div>
        </div>
      </div>

      {/* Global Toolbar filters search input desk */}
      <div className="bg-white border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 select-none">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs pl-9 pr-4 py-2 border rounded-lg focus:outline-hidden"
            placeholder="Search items, order refs, customer links..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <span className="text-[10px] font-mono text-slate-400 uppercase">Filtered yield: {filteredJobs.length} matches</span>
        </div>
      </div>

      {/* STAGE TRANSITION ACTION OVERLAY FORM */}
      {activeStageUpdateJob && (
        <div className="bg-white border-2 border-indigo-505 rounded-xl p-5 shadow-lg space-y-4 animate-fadeIn">
          <div className="flex justify-between items-start border-b pb-2.5">
            <div>
              <span className="text-[9px] font-mono text-indigo-600 font-bold uppercase tracking-widest leading-none block">
                Line dispatch control center
              </span>
              <h3 className="font-bold text-slate-905 text-sm font-sans mt-1">
                Advance Stage: {activeStageUpdateJob.itemName}
              </h3>
            </div>
            <button 
              onClick={() => {
                setActiveStageUpdateJob(null);
                setStageNotes('');
              }}
              className="text-xs font-mono px-2.5 py-1 text-slate-550 border rounded cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="text-xs space-y-3">
            <p className="text-slate-500 font-mono">
              Current stage is: <span className="font-bold text-slate-800 uppercase">{activeStageUpdateJob.currentStage}</span>
            </p>

            <span className="text-[10px] font-mono uppercase font-black text-slate-400 block mb-1">Select landing stage:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {activeStages.map(s => {
                const isCurrent = activeStageUpdateJob.currentStage === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => handleStageMove(activeStageUpdateJob, s.value)}
                    className={`p-2.5 border rounded-lg text-left transition text-[10px] uppercase font-mono tracking-wider font-bold cursor-pointer hover:border-slate-350 ${
                      isCurrent 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' 
                        : 'bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {s.value}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-mono uppercase font-black text-slate-400 block mb-1">Add Operational Notes:</label>
              <textarea
                value={stageNotes}
                onChange={(e) => setStageNotes(e.target.value)}
                placeholder="e.g. Dimensions confirmed with electronic micrometers. Moving output lot to fusion/welding rack."
                rows={2}
                className="w-full text-xs font-mono bg-slate-50 border p-2 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* MOBILE COLLAPSED LAYOUT PANEL */}
      <div className="block lg:hidden space-y-4 select-none">
        <label className="text-[10px] text-slate-450 uppercase tracking-widest font-bold block mb-1">Active Shopfloor Column (Mobile Toggle)</label>
        <select
          className="w-full bg-white border border-slate-205 rounded-lg p-2.5 text-xs text-slate-705 font-mono shadow-2xs focus:outline-hidden"
          value={selectedMobileStage}
          onChange={(e) => setSelectedMobileStage(e.target.value)}
        >
          {activeStages.map(s => {
            const count = filteredJobs.filter(j => j.currentStage === s.value).length;
            return (
              <option key={s.value} value={s.value}>
                {s.label.toUpperCase()} ({count} jobs)
              </option>
            );
          })}
        </select>

        {/* Selected Mobile stage cards */}
        <div className="space-y-4">
          {filteredJobs.filter(j => j.currentStage === selectedMobileStage).length > 0 ? (
            filteredJobs.filter(j => j.currentStage === selectedMobileStage).map(job => (
              <JobCard 
                key={job.id} 
                job={job}
                orders={orders}
                onSelectStage={() => setActiveStageUpdateJob(job)}
                isJobOverdue={isJobOverdue(job)}
                onNavigateDetail={() => navigate(`/orders/${job.id}`)}
              />
            ))
          ) : (
            <div className="p-8 text-center text-xs text-slate-450 font-mono bg-slate-50 border rounded-xl">
              No jobs allocated to {selectedMobileStage.toUpperCase()} in local search query.
            </div>
          )}
        </div>
      </div>

      {/* FULL DESKTOP HORIZONTALLY SCROLLING KANBAN SLABS */}
      <div className="hidden lg:flex flex-row gap-4 min-h-[500px] overflow-x-auto pb-4 items-start select-none">
        {activeStages.map(col => {
          const colJobs = filteredJobs.filter(j => j.currentStage === col.value);
          return (
            <div 
              key={col.value}
              className={`w-[260px] shrink-0 border border-slate-205/85 rounded-xl p-3 flex flex-col gap-3 min-h-[480px] group transition-all duration-200 border-t-4 ${col.color}`}
            >
              {/* Header block details */}
              <div className="flex items-center justify-between font-mono pb-1.5 border-b border-dashed border-slate-200">
                <span className="text-[9px] uppercase font-black text-slate-905 truncate leading-none mr-2">
                  {col.label}
                </span>
                <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[9px] font-black text-slate-700 shrink-0 select-none">
                  {colJobs.length}
                </span>
              </div>

              {/* Stacked Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1 scrollbar-thin">
                {colJobs.length > 0 ? (
                  colJobs.map(job => (
                    <JobCard 
                      key={job.id} 
                      job={job}
                      orders={orders}
                      onSelectStage={() => setActiveStageUpdateJob(job)}
                      isJobOverdue={isJobOverdue(job)}
                      onNavigateDetail={() => navigate(`/orders/${job.id}`)}
                    />
                  ))
                ) : (
                  <div className="text-[10px] text-slate-400 font-mono text-center py-12 leading-relaxed border border-dashed rounded-lg bg-slate-50/50">
                    Empty column
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

/* INTERNAL JOB CARD */
interface JobCardProps {
  job: ProductionJob;
  orders: Order[];
  onSelectStage: () => void;
  isJobOverdue: boolean;
  onNavigateDetail: () => void;
}

const JobCard: React.FC<JobCardProps> = ({ 
  job, 
  orders, 
  onSelectStage, 
  isJobOverdue,
  onNavigateDetail
}) => {
  const associatedOrder = orders.find(o => o.id === job.orderId);

  return (
    <div className={`bg-white border p-3.5 rounded-lg shadow-2xs hover:shadow-xs transition-shadow space-y-3 ${
      isJobOverdue ? 'border-amber-250 bg-amber-50/10' : 'border-slate-200'
    }`}>
      {/* Header index status tags */}
      <div className="flex items-start justify-between gap-2.5">
        <span className="text-[9px] font-mono bg-slate-105 text-slate-650 px-1.5 py-0.5 rounded font-extrabold truncate">
          {associatedOrder?.orderNumber || 'DEMO-911'}
        </span>

        {isJobOverdue && (
          <span className="bg-amber-50 text-amber-850 font-bold border border-amber-200/60 rounded px-1.5 py-0.5 font-mono text-[8px] uppercase flex items-center shrink-0">
            <AlertTriangle className="h-2 w-2 mr-0.5" />
            STAGNANT
          </span>
        )}
      </div>

      {/* Description particulars block */}
      <div onClick={onNavigateDetail} className="cursor-pointer space-y-1 group">
        <h4 className="text-xs font-bold text-slate-805 leading-snug group-hover:text-indigo-650 transition">
          {job.itemName}
        </h4>
        <p className="text-[10px] text-slate-450 truncate font-mono">
          Customer: {associatedOrder?.customerName || 'B2B Procurement'}
        </p>
      </div>

      {/* Yield volume value */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pt-2 border-t border-slate-100">
        <div className="space-y-0.5 text-[10px]">
          <span className="text-[9px] text-slate-400 block uppercase font-sans">Vol Requested</span>
          <span className="font-extrabold text-slate-700 bg-slate-100/70 px-1.5 rounded">{job.quantity} items</span>
        </div>

        {/* Adjust actions triggers */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectStage();
            }}
            className="p-1 border rounded hover:bg-indigo-50/50 cursor-pointer hover:border-indigo-300 text-slate-600 flex items-center"
            title="Advance Stage Segment"
          >
            <MoveRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
