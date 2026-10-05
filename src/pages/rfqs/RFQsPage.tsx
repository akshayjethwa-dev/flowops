// src/pages/rfqs/RFQsPage.tsx

import React, { useState, useEffect } from 'react';
import { RfqsListPage } from './RfqsListPage';
import { QuotationsSection } from '../../components/QuotationsSection';
import { RFQ, Order } from '../../types';
import { FileText, FolderInput } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const RFQsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'rfqs' | 'quotes'>('rfqs');
  const [prefillRFQ, setPrefillRFQ] = useState<RFQ | null>(null);

  // Synchronise with React Router location state if navigated with activeTab / prefill triggers
  useEffect(() => {
    if (location.state) {
      const stateObj = location.state as { activeTab?: 'rfqs' | 'quotes'; prefillRFQ?: RFQ };
      if (stateObj.activeTab) {
        setActiveTab(stateObj.activeTab);
      }
      if (stateObj.prefillRFQ) {
        setPrefillRFQ(stateObj.prefillRFQ);
      }
      // Clear location state to avoid double triggering on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleInitiateOrder = (order: Order) => {
    // When a quotation gets approved, route directly to the Production page
    // and pass the newly confirmed order id as router state so the page handles auto-focus
    navigate('/orders', { state: { preselectedOrderId: order.id } });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="pb-4 border-b border-slate-200">
        <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
          Sales & CRM Desk
        </span>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block mt-1">
          CRM & Estimations Hub
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Review incoming lead inquiries, design material itemized specifications, and dispatch authorized B2B quotation PDFs.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-250 gap-4">
        <button
          onClick={() => {
            setActiveTab('rfqs');
            setPrefillRFQ(null);
          }}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all ${
            activeTab === 'rfqs' 
              ? 'border-sky-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <FolderInput className="h-4 w-4" />
          <span>Inquiries Pool</span>
        </button>

        <button
          onClick={() => setActiveTab('quotes')}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all ${
            activeTab === 'quotes' 
              ? 'border-sky-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Quotations Desk {prefillRFQ && ' (Prefill Active)'}</span>
        </button>
      </div>

      {activeTab === 'rfqs' ? (
        <RfqsListPage />
      ) : (
        <QuotationsSection
          prefillRFQ={prefillRFQ}
          clearPrefillRFQ={() => setPrefillRFQ(null)}
          onInitiateOrder={handleInitiateOrder}
        />
      )}
    </div>
  );
};
