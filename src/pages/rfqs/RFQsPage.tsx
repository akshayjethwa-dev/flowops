// src/pages/rfqs/RFQsPage.tsx

import React, { useState, useEffect } from 'react';
import { RfqsListPage } from './RfqsListPage';
import { QuotationsSection } from '../../components/QuotationsSection';
import { MultiChannelIntakeHub } from './MultiChannelIntakeHub';
import { RFQ, Order } from '../../types';
import { FileText, FolderInput, Inbox, Sparkles, FileSpreadsheet, Sliders } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useIntakeInquiries } from '../../hooks/useIntakeInquiries';
import { BomScrubberView } from '../../components/bom-scrubber/BomScrubberView';
import { CostEnginePage } from './CostEnginePage';

export const RFQsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant } = useAuth();
  const { inquiries } = useIntakeInquiries(tenant?.id);

  const [activeTab, setActiveTab] = useState<'rfqs' | 'intake' | 'bom' | 'quotes' | 'cost-engine'>('rfqs');
  const [prefillRFQ, setPrefillRFQ] = useState<RFQ | null>(null);

  // Synchronise with React Router location state if navigated with activeTab / prefill triggers
  useEffect(() => {
    if (location.state) {
      const stateObj = location.state as { activeTab?: 'rfqs' | 'intake' | 'bom' | 'quotes' | 'cost-engine'; prefillRFQ?: RFQ };
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
    navigate('/orders', { state: { preselectedOrderId: order.id } });
  };

  const pendingInquiriesCount = inquiries.filter(i => i.status === 'pending').length;

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
          Receive multi-channel inquiries (Email, WhatsApp, Web Form), review technical specifications, and dispatch authorized B2B quotation PDFs.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-250 gap-4 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('rfqs');
            setPrefillRFQ(null);
          }}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'rfqs' 
              ? 'border-sky-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <FolderInput className="h-4 w-4" />
          <span>Inquiries Pool</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('intake');
            setPrefillRFQ(null);
          }}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'intake' 
              ? 'border-sky-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <Inbox className="h-4 w-4 text-sky-600" />
          <span>Multi-Channel Intake</span>
          {pendingInquiriesCount > 0 && (
            <span className="bg-amber-500 text-white font-mono text-[9px] px-1.5 py-0.2 rounded-full font-black">
              {pendingInquiriesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('bom');
            setPrefillRFQ(null);
          }}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'bom' 
              ? 'border-sky-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span>BOM Scrubber & Validation</span>
          <span className="bg-sky-100 text-sky-800 font-mono text-[9px] px-1.5 py-0.2 rounded-full font-bold">
            NEW
          </span>
        </button>

        <button
          onClick={() => setActiveTab('quotes')}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'quotes' 
              ? 'border-sky-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Quotations Desk {prefillRFQ && ' (Prefill Active)'}</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('cost-engine');
            setPrefillRFQ(null);
          }}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'cost-engine' 
              ? 'border-sky-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <Sliders className="h-4 w-4 text-sky-600" />
          <span>Cost Engine Rules</span>
          <span className="bg-emerald-100 text-emerald-800 font-mono text-[9px] px-1.5 py-0.2 rounded-full font-bold">
            CONFIG
          </span>
        </button>
      </div>

      {activeTab === 'rfqs' && <RfqsListPage onOpenIntake={() => setActiveTab('intake')} />}
      {activeTab === 'intake' && <MultiChannelIntakeHub />}
      {activeTab === 'bom' && (
        <BomScrubberView
          onPushToQuotation={(items) => {
            setActiveTab('quotes');
          }}
        />
      )}
      {activeTab === 'quotes' && (
        <QuotationsSection
          prefillRFQ={prefillRFQ}
          clearPrefillRFQ={() => setPrefillRFQ(null)}
          onInitiateOrder={handleInitiateOrder}
        />
      )}
      {activeTab === 'cost-engine' && <CostEnginePage />}
    </div>
  );
};
