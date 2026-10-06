// src/pages/rfqs/MultiChannelIntakeHub.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlants } from '../../hooks/usePlants';
import { useIntakeInquiries } from '../../hooks/useIntakeInquiries';
import { IntakeQueueList } from '../../components/rfq-intake/IntakeQueueList';
import { IntakeEmailChannel } from '../../components/rfq-intake/IntakeEmailChannel';
import { IntakeWhatsAppChannel } from '../../components/rfq-intake/IntakeWhatsAppChannel';
import { IntakeWebFormChannel } from '../../components/rfq-intake/IntakeWebFormChannel';
import { 
  Inbox, 
  Mail, 
  MessageSquare, 
  Globe, 
  ArrowLeft, 
  Sparkles, 
  Layers, 
  Share2,
  FileSpreadsheet
} from 'lucide-react';

export const MultiChannelIntakeHub: React.FC = () => {
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { plants } = usePlants(tenant?.id);

  const {
    inquiries,
    loading,
    emailConfig,
    saveEmailConfig,
    addInquiry,
    deleteInquiry,
    convertInquiryToRfq
  } = useIntakeInquiries(tenant?.id);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'queue' | 'email' | 'whatsapp' | 'webform'>('queue');

  // Handle direct conversion from a channel parser
  const handleDirectConvertFromChannel = async (inquiryData: any) => {
    // First queue it
    const createdInquiry = await addInquiry(inquiryData);
    // Then convert it
    const createdRfq = await convertInquiryToRfq(
      createdInquiry, 
      {
        customerName: inquiryData.customerName,
        items: inquiryData.items,
        priority: inquiryData.priority
      },
      profile
    );
    navigate(`/rfqs/${createdRfq.id}`);
  };

  const pendingCount = inquiries.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/rfqs')}
            className="text-xs font-mono font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1.5 mb-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Inquiries & Quotations</span>
          </button>
          
          <div className="flex items-center space-x-2.5">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
              Multi-Channel RFQ Intake Hub
            </h2>
            <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
              Automated Parsing Active
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Automatically receive and parse RFQs from Email (IMAP/Graph API), WhatsApp messages, or Web Forms with Excel/PDF BOM attachments.
          </p>
        </div>

        {/* Quick Tabs Counter & Scrubber Button */}
        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
          <button
            onClick={() => navigate('/bom-scrubber')}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer shadow-3xs transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Scrub Customer BOM</span>
          </button>

          <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-3xs flex items-center space-x-2">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Queue State:</span>
            <span className="text-xs font-mono font-bold text-amber-600">{pendingCount} Pending</span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-250 gap-2 sm:gap-4 overflow-x-auto select-none">
        <button
          onClick={() => setActiveTab('queue')}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'queue' 
              ? 'border-slate-900 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <Inbox className="h-4 w-4" />
          <span>Inbound Queue ({inquiries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'email' 
              ? 'border-sky-600 text-sky-700' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Email Parsing (IMAP/Graph)</span>
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'whatsapp' 
              ? 'border-emerald-600 text-emerald-700' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>WhatsApp Message Parser</span>
        </button>

        <button
          onClick={() => setActiveTab('webform')}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'webform' 
              ? 'border-purple-600 text-purple-700' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <Globe className="h-4 w-4" />
          <span>Web Form & BOM Uploader</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'queue' && (
        <IntakeQueueList
          inquiries={inquiries}
          loading={loading}
          plants={plants}
          onConvert={(inq, overrides) => convertInquiryToRfq(inq, overrides, profile)}
          onDelete={deleteInquiry}
        />
      )}

      {activeTab === 'email' && (
        <IntakeEmailChannel
          emailConfig={emailConfig}
          onSaveConfig={saveEmailConfig}
          onQueueInquiry={async (data) => {
            await addInquiry(data);
          }}
          onDirectConvert={handleDirectConvertFromChannel}
        />
      )}

      {activeTab === 'whatsapp' && (
        <IntakeWhatsAppChannel
          onQueueInquiry={async (data) => {
            await addInquiry(data);
          }}
          onDirectConvert={handleDirectConvertFromChannel}
        />
      )}

      {activeTab === 'webform' && (
        <IntakeWebFormChannel
          tenantId={tenant?.id}
          onQueueInquiry={async (data) => {
            await addInquiry(data);
          }}
          onDirectConvert={handleDirectConvertFromChannel}
        />
      )}

    </div>
  );
};
