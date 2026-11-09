// src/pages/orders/CommercialPipelinePage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { KanbanOrderPipelineBoard } from '../../components/orders/KanbanOrderPipelineBoard';
import { BomExplosionAtpModal } from '../../components/orders/BomExplosionAtpModal';
import { 
  Kanban, 
  ShoppingBag, 
  MessageSquare, 
  Bot, 
  TrendingUp, 
  IndianRupee, 
  AlertTriangle, 
  Layers, 
  ArrowRight,
  Boxes
} from 'lucide-react';
import { Order } from '../../types';

export const CommercialPipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  
  const [isAtpModalOpen, setIsAtpModalOpen] = useState<boolean>(false);
  
  // Pipeline metrics state computed from localStorage or live orders
  const [pipelineMetrics, setPipelineMetrics] = useState({
    totalCount: 0,
    totalValueINR: 0,
    inProductionCount: 0,
    shortfallCount: 0
  });

  // Calculate high-level pipeline metrics
  useEffect(() => {
    const computeMetrics = () => {
      try {
        const localKey = `orders_${tenant?.id || 'demo_tenant'}`;
        const raw = localStorage.getItem(localKey);
        if (raw) {
          const orders: Order[] = JSON.parse(raw);
          const activeOrders = orders.filter(o => o.status !== 'cancelled' && o.status !== 'closed');
          const totalVal = activeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
          const prodCount = orders.filter(o => o.status === 'in_production' || o.status === 'in-production').length;
          const shortCount = orders.filter(o => 
            o.items?.some(i => i.materialAvailability === 'unavailable' || i.materialAvailability === 'partially_available')
          ).length;

          setPipelineMetrics({
            totalCount: activeOrders.length,
            totalValueINR: totalVal,
            inProductionCount: prodCount,
            shortfallCount: shortCount
          });
        }
      } catch (e) {
        console.warn('Error reading pipeline metrics', e);
      }
    };

    computeMetrics();
    const interval = setInterval(computeMetrics, 5000);
    return () => clearInterval(interval);
  }, [tenant?.id]);

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header with Commercial Stage Overview */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest block leading-none">
              Commercial Order Management
            </span>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-indigo-200">
              State Machine Enforced
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight block mt-1.5 flex items-center space-x-2.5">
            <Kanban className="h-6 w-6 text-indigo-600" />
            <span>Commercial Order Pipeline</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">
            Visualise active orders across every commercial lifecycle stage: Enquiry &rarr; Quoted &rarr; Order Confirmed &rarr; In Production &rarr; Partially Dispatched &rarr; Fully Dispatched &rarr; Invoiced &rarr; Payment Received. Real-time WIP limits, ATP material availability, and role-enforced transitions.
          </p>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-mono font-bold transition shadow-3xs cursor-pointer"
            title="View Shopfloor Jobs & Execution List"
          >
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span>Orders & Jobs View</span>
          </button>

          <button
            onClick={() => navigate('/sales-orders/erp-sync')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-xl text-xs font-mono font-bold transition shadow-3xs cursor-pointer"
            title="Ingest incoming sales orders from Tally Prime / ERP"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-indigo-600" />
            <span>Sync ERP</span>
          </button>

          <button
            onClick={() => setIsAtpModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-mono font-bold transition shadow-3xs cursor-pointer"
            title="Launch BOM Explosion & ATP Availability Calculator"
          >
            <Boxes className="h-3.5 w-3.5" />
            <span>BOM & ATP Engine</span>
          </button>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>Active Pipeline Orders</span>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {pipelineMetrics.totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Excludes cancelled & archived
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>Total Commercial Value</span>
            <IndianRupee className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
            ₹{pipelineMetrics.totalValueINR.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Active order book commitments
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>Shopfloor WIP Orders</span>
            <Layers className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2 font-mono">
            {pipelineMetrics.inProductionCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Active in fabrication & machining
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono">
            <span>ATP Material Shortfalls</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2 font-mono flex items-center space-x-1.5">
            <span>{pipelineMetrics.shortfallCount}</span>
            {pipelineMetrics.shortfallCount > 0 && (
              <span className="text-xs bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Action Req.
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Lines with component deficit
          </div>
        </div>
      </div>

      {/* Main Kanban Board Component */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs">
        <KanbanOrderPipelineBoard />
      </div>

      {/* BOM Explosion & ATP Calculator Modal */}
      {isAtpModalOpen && (
        <BomExplosionAtpModal
          isOpen={isAtpModalOpen}
          onClose={() => setIsAtpModalOpen(false)}
        />
      )}
    </div>
  );
};
