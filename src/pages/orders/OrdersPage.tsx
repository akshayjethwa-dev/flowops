// src/pages/orders/OrdersPage.tsx

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProductionBoard } from '../../hooks/useProduction';
import { ProductionSection } from '../../components/ProductionSection';
import { OrdersBoardPage } from './OrdersBoardPage';
import { ExportButton } from '../../components/ExportButton';
import { GuardedAction } from '../../components/layout/GuardedAction';
import { Order } from '../../types';
import { Layers, Kanban, TableProperties, ShoppingBag, MessageSquare, Bot, Bell, Boxes, GitCommit } from 'lucide-react';
import { BackordersProductionQueue } from '../../components/production/BackordersProductionQueue';
import { OrderLifecycleManagementView } from '../../components/orders/OrderLifecycleManagementView';
import { KanbanOrderPipelineBoard } from '../../components/orders/KanbanOrderPipelineBoard';

export const OrdersPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  
  // Load full orders and jobs through production hook
  const { jobs, orders } = useProductionBoard(tenant?.id);

  const [activeTab, setActiveTab ] = useState<'pipeline' | 'kanban' | 'analytical' | 'backorders' | 'state_machine'>('pipeline');

  // Extract preselectedOrderId if passed state-wise
  const routerState = location.state as { preselectedOrderId?: string } | null;
  const [preselectedOrderId, setPreselectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (routerState?.preselectedOrderId) {
      setPreselectedOrderId(routerState.preselectedOrderId);
      setActiveTab('analytical'); // Switch to analytical if focusing an order
      
      // Clean up route history state to avoid sticky trigger refires
      window.history.replaceState({}, document.title);
    }
  }, [routerState]);

  const handleInitiateDispatch = (order: Order) => {
    // Navigate straight to shipping logs and pre-fill the order selection desk
    navigate('/dispatch', { state: { preselectedOrderForDispatch: order } });
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest block leading-none">
            Manufacturing execution
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block mt-1">
            Production Line Monitor
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track components yield logs, advance shopfloor CNC/assembly segments, and transition completed lots into logistic pipelines.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          {/* 🔒 RBAC Guard: Bulk Data Exports */}
          <GuardedAction action="view:reports">
            <div className="flex items-center space-x-1">
              <ExportButton
                data={orders}
                filenamePrefix="orders_master"
                headersMap={{
                  orderNumber: 'Order Number',
                  customerName: 'Customer Name',
                  phone: 'Phone',
                  totalAmount: 'Total Amount',
                  deliveryDate: 'Delivery Date',
                  status: 'Status',
                  createdAt: 'Created At'
                }}
                label="Orders CSV"
              />
              <ExportButton
                data={jobs}
                filenamePrefix="jobs_production"
                headersMap={{
                  id: 'Job ID',
                  itemName: 'Component Name',
                  quantity: 'Quantity',
                  currentStage: 'Current Production Stage',
                  updatedBy: 'Handler ID',
                  updatedAt: 'Last Updated'
                }}
                label="Jobs CSV"
              />
            </div>
          </GuardedAction>

          <button
            onClick={() => navigate('/sales-orders/erp-sync')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-lg text-xs font-mono font-bold transition shadow-3xs cursor-pointer shrink-0"
            title="Ingest incoming sales orders from Tally Prime / Oracle Cloud and auto-generate Work Orders"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-indigo-600" />
            <span>Sync from ERP</span>
          </button>

          <button
            onClick={() => navigate('/orders/whatsapp-intake')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-950 rounded-lg text-xs font-mono font-bold transition shadow-3xs cursor-pointer shrink-0"
            title="Customer WhatsApp Order Intake with NLP parsing and auto-order creation"
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
            <span>WhatsApp Intake</span>
          </button>

          <button
            onClick={() => navigate('/orders/whatsapp-intake?tab=status_bot')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-teal-50 border border-teal-300 hover:bg-teal-100 text-teal-950 rounded-lg text-xs font-mono font-bold transition shadow-3xs cursor-pointer shrink-0"
            title="Automated 24/7 WhatsApp Order Status Bot (STATUS <order-number>)"
          >
            <Bot className="h-3.5 w-3.5 text-teal-600" />
            <span>Status Bot</span>
          </button>

          <button
            onClick={() => navigate('/orders/whatsapp-intake?tab=notifications')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-50 border border-sky-300 hover:bg-sky-100 text-sky-950 rounded-lg text-xs font-mono font-bold transition shadow-3xs cursor-pointer shrink-0"
            title="Proactive WhatsApp Milestone Notifications & Live Read Receipts"
          >
            <Bell className="h-3.5 w-3.5 text-sky-600" />
            <span>Milestone Alerts</span>
          </button>

          {/* Tab Selection controller */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-lg border border-slate-200 shadow-3xs shrink-0 select-none overflow-x-auto">
            <button
              id="orders-pipeline-tab"
              onClick={() => setActiveTab('pipeline')}
              className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-mono tracking-wider font-extrabold cursor-pointer transition-colors flex items-center space-x-1.5 ${
                activeTab === 'pipeline' 
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold' 
                  : 'text-indigo-900 hover:text-indigo-950 bg-indigo-50/70 hover:bg-indigo-100/70'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Order Pipeline (Kanban)</span>
            </button>
            <button
              onClick={() => setActiveTab('kanban')}
              className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-mono tracking-wider font-extrabold cursor-pointer transition-colors flex items-center space-x-1.5 ${
                activeTab === 'kanban' 
                  ? 'bg-white text-indigo-650 shadow-2xs font-bold' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Shopfloor Jobs</span>
            </button>
            <button
              onClick={() => setActiveTab('analytical')}
              className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-mono tracking-wider font-extrabold cursor-pointer transition-colors flex items-center space-x-1.5 ${
                activeTab === 'analytical' 
                  ? 'bg-white text-indigo-650 shadow-2xs font-bold' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableProperties className="h-3.5 w-3.5" />
              <span>Analytical Grid</span>
            </button>
            <button
              id="orders-backorders-tab"
              onClick={() => setActiveTab('backorders')}
              className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-mono tracking-wider font-extrabold cursor-pointer transition-colors flex items-center space-x-1.5 ${
                activeTab === 'backorders' 
                  ? 'bg-amber-600 text-white shadow-2xs font-bold' 
                  : 'text-amber-800 hover:text-amber-900 bg-amber-50/70 hover:bg-amber-100/70'
              }`}
            >
              <Boxes className="h-3.5 w-3.5" />
              <span>Backorders Queue</span>
            </button>
            <button
              id="orders-state-machine-tab"
              onClick={() => setActiveTab('state_machine')}
              className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-mono tracking-wider font-extrabold cursor-pointer transition-colors flex items-center space-x-1.5 ${
                activeTab === 'state_machine' 
                  ? 'bg-white text-indigo-650 shadow-2xs font-bold' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <GitCommit className="h-3.5 w-3.5" />
              <span>State Machine Engine</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'pipeline' ? (
        <KanbanOrderPipelineBoard />
      ) : activeTab === 'kanban' ? (
        <OrdersBoardPage />
      ) : activeTab === 'analytical' ? (
        <ProductionSection
          preselectedOrderId={preselectedOrderId}
          clearPreselectedOrder={() => setPreselectedOrderId(null)}
          onInitiateDispatch={handleInitiateDispatch}
        />
      ) : activeTab === 'backorders' ? (
        <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200">
          <BackordersProductionQueue />
        </div>
      ) : (
        <OrderLifecycleManagementView />
      )}
    </div>
  );
};
