// src/pages/orders/OrdersPage.tsx

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProductionBoard } from '../../hooks/useProduction';
import { ProductionSection } from '../../components/ProductionSection';
import { OrdersBoardPage } from './OrdersBoardPage';
import { ExportButton } from '../../components/ExportButton';
import { Order } from '../../types';
import { Layers, Kanban, TableProperties } from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  
  // Load full orders and jobs through production hook
  const { jobs, orders } = useProductionBoard(tenant?.id);

  const [activeTab, setActiveTab ] = useState<'kanban' | 'analytical'>('kanban');

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
          {/* Export Buttons */}
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

          {/* Tab Selection controller */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-lg border border-slate-200 shadow-3xs shrink-0 select-none">
          <button
            onClick={() => setActiveTab('kanban')}
            className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-mono tracking-wider font-extrabold cursor-pointer transition-colors flex items-center space-x-1.5 ${
              activeTab === 'kanban' 
                ? 'bg-white text-indigo-650 shadow-2xs font-bold' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Kanban className="h-3.5 w-3.5" />
            <span>Kanban Board</span>
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
        </div>
      </div>
    </div>

      {activeTab === 'kanban' ? (
        <OrdersBoardPage />
      ) : (
        <ProductionSection
          preselectedOrderId={preselectedOrderId}
          clearPreselectedOrder={() => setPreselectedOrderId(null)}
          onInitiateDispatch={handleInitiateDispatch}
        />
      )}
    </div>
  );
};

