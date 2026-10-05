// src/pages/customers/CustomerDetailPage.tsx

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCustomerDetail } from '../../hooks/useCustomerDetail';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { useCommunicationLog } from '../../hooks/useCommunicationLog';
import { useCustomerPayments } from '../../hooks/useCustomerPayments';
import { useDispatchList } from '../../hooks/useDispatch';
import { useTenantUsers } from '../../hooks/useTenantUsers';
import { useWhatsAppConversations } from '../../hooks/useWhatsAppConversations';
import { useConversationThread } from '../../hooks/useConversationThread';
import { 
  Building2, 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Tag, 
  FileText, 
  ShoppingBag, 
  MessageSquare, 
  Clock, 
  Layers, 
  User, 
  CheckCircle, 
  X, 
  Plus, 
  Send,
  Calendar,
  IndianRupee,
  AlertTriangle,
  Info,
  Truck,
  LineChart,
  Copy,
  ChevronRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { TextField } from '../../components/ui/TextField';

export const CustomerDetailPage: React.FC = () => {
  const { tenant } = useAuth();
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();

  // Load basic details
  const { 
    customer, 
    rfqs, 
    orders, 
    whatsappMessages, 
    loading: detailLoading, 
    error,
    createCustomerRfq,
    triggerWhatsAppMessage
  } = useCustomerDetail(tenant?.id, customerId);

  // Load real-time sub-ledgers and communication feed
  const { entries: timelineEntries, loading: logLoading, addLogEntry } = useCommunicationLog(tenant?.id, customerId);
  const { payments, loading: payLoading, recordPayment } = useCustomerPayments(tenant?.id, customerId);
  const { dispatches: allDispatches, loading: dispatchLoading } = useDispatchList(tenant?.id);
  const { users } = useTenantUsers(tenant?.id);

  // Derive client dispatches
  const customerDispatches = (allDispatches || []).filter(
    d => d.customerId === customerId || d.customerName === customer?.name
  );

  const assignedRep = (users || []).find(u => u.id === customer?.assignedSalesUserId);

  // Financial KPI calculations
  const totalBookings = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalPayments = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const outstandingBalance = Math.max(0, totalBookings - totalPayments);

  const isSyncing = detailLoading || logLoading || payLoading || dispatchLoading;

  // Active Tab: overview | rfqs | orders | dispatches | payments | timeline | whatsapp | activity
  const [activeTab, setActiveTab] = useState<'overview' | 'rfqs' | 'orders' | 'dispatches' | 'payments' | 'timeline' | 'whatsapp' | 'activity'>('overview');

  // WhatsApp Embed Hooks
  const { conversations, simulateInboundMessage: triggerLocalInbound, matchCustomer } = useWhatsAppConversations(tenant?.id);
  const matchedConv = conversations.find(c => 
    c.customerId === customerId || 
    c.phone.replace(/[\s+-]/g, '') === customer?.phone?.replace(/[\s+-]/g, '')
  );
  const { 
    messages: waEmbedMessages, 
    sendMessage: sendWaEmbedMessage,
    loading: embedChatLoading 
  } = useConversationThread(tenant?.id, matchedConv?.id, matchedConv);
  const [embedWaText, setEmbedWaText] = useState('');

  // Inline Communication Log Entry states
  const [noteMsg, setNoteMsg] = useState('');
  const [noteChannel, setNoteChannel] = useState<'note' | 'whatsapp' | 'call' | 'email' | 'meeting'>('note');
  const [noteDirection, setNoteDirection] = useState<'internal' | 'inbound' | 'outbound'>('internal');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Payment recording form states
  const [isPayDrawerOpen, setIsPayDrawerOpen] = useState(false);
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payMethod, setPayMethod] = useState<'RTGS' | 'NEFT' | 'UPI' | 'Cash' | 'Cheque'>('RTGS');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotesInput, setPayNotesInput] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // WhatsApp simulation input
  const [waText, setWaText] = useState('');
  const [waType, setWaType] = useState('order_status');

  // RFQ builder state
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [rfqReq, setRfqReq] = useState('');
  const [rfqItems, setRfqItems] = useState<{ name: string; quantity: number }[]>([
    { name: '', quantity: 1 }
  ]);

  // Helpers for RFQ items builder
  const handleAddRfqItemField = () => {
    setRfqItems([...rfqItems, { name: '', quantity: 1 }]);
  };

  const handleRemoveRfqItemField = (idx: number) => {
    if (rfqItems.length === 1) return;
    setRfqItems(rfqItems.filter((_, i) => i !== idx));
  };

  const handleRfqItemChange = (idx: number, field: 'name' | 'quantity', val: any) => {
    const updated = [...rfqItems];
    updated[idx] = {
      ...updated[idx],
      [field]: field === 'quantity' ? parseInt(val) || 1 : val
    };
    setRfqItems(updated);
  };

  const handleRfqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = rfqItems.filter(item => item.name.trim().length > 0);
    if (validItems.length === 0) {
      alert('Please enter at least one item name.');
      return;
    }

    try {
      await createCustomerRfq(validItems, rfqReq);
      alert('Inquiry/RFQ registered and queued in the pipeline.');
      setIsRfqModalOpen(false);
      setRfqReq('');
      setRfqItems([{ name: '', quantity: 1 }]);
    } catch (err: any) {
      alert(`Failed to add RFQ: ${err.message}`);
    }
  };

  const handleSendWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waText.trim()) return;

    try {
      await triggerWhatsAppMessage(waText, waType);
      setWaText('');
      alert('WhatsApp template message logged & simulated in real time.');
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    }
  };

  if (isSyncing) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="animate-spin h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">Syncing Account Portfolio...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="h-10 w-10 text-red-600 mx-auto mb-3" />
        <h4 className="font-bold text-slate-900 text-sm">Portfolio Retrieval Failure</h4>
        <p className="text-[11px] text-slate-500 mt-1">{error || 'Failed to resolve current customer records.'}</p>
        <button
          onClick={() => navigate('/customers')}
          className="mt-4 bg-slate-900 text-white rounded-lg px-4 py-2 font-mono text-xs uppercase font-bold"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans select-none">
      
      {/* Dynamic Navigation row */}
      <button
        onClick={() => navigate('/customers')}
        className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 font-mono uppercase font-black cursor-pointer transition-colors"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        <span>Directory Index</span>
      </button>

      {/* Main Account Title / Header Block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className={`p-4 rounded-xl shrink-0 ${
              customer.type === 'dealer' ? 'bg-indigo-50 text-indigo-750' : 'bg-emerald-50 text-emerald-755'
            }`}>
              <Building2 className="h-7 w-7" />
            </div>
            
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                  {customer.name}
                </h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-[9px] uppercase tracking-wider border ${
                  customer.type === 'dealer' 
                    ? 'bg-indigo-50 text-indigo-750 border-indigo-100' 
                    : 'bg-emerald-50 text-emerald-750 border-emerald-100'
                }`}>
                  {customer.type}
                </span>
              </div>

              <div className="flex flex-wrap items-center text-xs text-slate-500 gap-x-3 gap-y-1">
                <span className="font-mono flex items-center space-x-1">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <strong>{customer.contactPerson}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center space-x-1 select-all font-mono">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{customer.phone}</span>
                </span>
                {customer.email && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center space-x-1 select-all font-mono">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span className="lowercase">{customer.email}</span>
                    </span>
                  </>
                )}
              </div>

              {/* Tags & liaison pane */}
              <div className="flex flex-wrap gap-2 pt-2 items-center">
                {assignedRep && (
                  <span className="inline-flex items-center space-x-1 font-sans text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 shrink-0 font-medium select-none">
                    <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Liaison Rep: {assignedRep.name}</span>
                  </span>
                )}
                {customer.tags && customer.tags.length > 0 && customer.tags.map((tag, idx) => (
                  <span key={idx} className="bg-slate-50 text-slate-500 font-mono text-[8px] px-1.5 py-0.5 rounded border border-slate-150">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 KPI summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-3xs space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Inquiry Inbox</span>
          <div className="flex items-baseline justify-between pt-0.5">
            <span className="text-2xl font-black text-slate-800">{rfqs.length}</span>
            <span className="text-[9px] font-mono text-slate-450 font-bold bg-slate-50 px-1.5 py-0.2 rounded border border-slate-155">
              Active RFQs
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-3xs space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Bookings</span>
          <div className="flex items-baseline justify-between pt-0.5">
            <span className="text-2xl font-black text-slate-800">₹{totalBookings.toLocaleString('en-IN')}</span>
            <span className="text-[9px] font-mono text-slate-450 font-semibold">{orders.length} Active</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-3xs space-y-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Total Payments Received</span>
          <div className="flex items-baseline justify-between pt-0.5 font-sans">
            <span className="text-2xl font-black text-emerald-750">₹{totalPayments.toLocaleString('en-IN')}</span>
            <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 font-bold">
              Ledger Cleared
            </span>
          </div>
        </div>

        <div className="bg-white border border-rose-220 bg-rose-50/5 rounded-2xl p-4.5 shadow-3xs space-y-1">
          <span className="text-[10px] font-mono text-rose-500 uppercase tracking-wider block">Outstanding Balance Due</span>
          <div className="flex items-baseline justify-between pt-0.5">
            <span className={`text-2xl font-black ${outstandingBalance > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              ₹{outstandingBalance.toLocaleString('en-IN')}
            </span>
            <span className="text-[9px] font-mono text-rose-500 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100 font-bold">
              Pending Receipts
            </span>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION BAR */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 font-mono text-xs uppercase" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 px-1 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'overview'
                ? 'border-sky-650 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Account Overview
          </button>
          <button
            onClick={() => setActiveTab('rfqs')}
            className={`pb-4 px-1 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'rfqs'
                ? 'border-sky-650 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Inquiries ({rfqs.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-4 px-1 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'orders'
                ? 'border-sky-650 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('dispatches')}
            className={`pb-4 px-1 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'dispatches'
                ? 'border-sky-650 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Dispatches ({customerDispatches.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-4 px-1 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'payments'
                ? 'border-sky-650 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Payments ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-4 px-1 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'timeline'
                ? 'border-sky-650 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Timeline ({timelineEntries.length})
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`pb-4 px-1 border-b-2 font-bold cursor-pointer transition-all flex items-center space-x-1.5 ${
              activeTab === 'whatsapp'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>WhatsApp Chat</span>
            {matchedConv && matchedConv.unreadCount > 0 && (
              <span className="bg-emerald-500 text-slate-950 font-bold text-[9px] h-3.5 min-w-3.5 px-1 rounded-full flex items-center justify-center font-mono">
                {matchedConv.unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-4 px-1 border-b-2 font-bold cursor-pointer transition-all ${
              activeTab === 'activity'
                ? 'border-sky-650 text-sky-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            Audit Log
          </button>
        </nav>
      </div>

      {/* TAB CONTENTS PANELS */}
      <div className="space-y-4">
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Extended Metadata */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
                <h3 className="text-xs font-bold font-mono tracking-wider text-slate-500 uppercase flex items-center space-x-1.5">
                  <Info className="h-4 w-4" />
                  <span>General Registration Details</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                  {customer.gstNumber && (
                    <div className="space-y-1">
                      <span className="text-slate-400 block font-mono">Tax Identification (GSTIN)</span>
                      <strong className="text-slate-800 font-mono tracking-wider uppercase">{customer.gstNumber}</strong>
                    </div>
                  )}
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-mono">Operations Zone</span>
                    <strong className="text-slate-800">{customer.city}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans border-t border-slate-100 pt-4">
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-mono">Billing Registration Seat</span>
                    <p className="text-slate-800 leading-relaxed max-w-sm whitespace-pre-line">
                      {customer.billingAddress || 'No billing address defined.'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 block font-mono">Factory Delivery / Unloading Hub</span>
                    <p className="text-slate-800 leading-relaxed max-w-sm whitespace-pre-line">
                      {customer.shippingAddress || 'No shipping address defined.'}
                    </p>
                  </div>
                </div>

                {customer.notes && (
                  <div className="border-t border-slate-100 pt-4 space-y-1 text-xs">
                    <span className="text-slate-400 block font-mono">Special Trade Instructions & Directives</span>
                    <p className="text-slate-700 leading-relaxed italic bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                      "{customer.notes}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Guides & Recent Snippets */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider block">CRM Direct Controls</h4>
                <div className="space-y-2.5">
                  <button
                    onClick={() => setIsRfqModalOpen(true)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Onboard Raw Inquiry (RFQ)</span>
                  </button>

                  <a
                    href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 text-emerald-800 font-mono font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>Launch Direct WhatsApp Chat</span>
                  </a>
                </div>
              </div>

              {/* Snapshot of last activities */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider block">Activity Snapshot</h4>
                <div className="space-y-3 font-sans text-xs">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-405 font-mono">Total Inquiries</span>
                    <strong className="text-slate-850">{rfqs.length}</strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-450 font-mono">Active Orders</span>
                    <strong className="text-slate-850">{orders.length}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-450 font-mono">WhatsApp Alerts</span>
                    <strong className="text-slate-850">{whatsappMessages.length}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RFQS LIST */}
        {activeTab === 'rfqs' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Customer Demands / RFQ Inbox</h3>
                  <p className="text-[11px] text-slate-450 leading-none mt-1">Pending inquiry records waiting for custom pricing or review.</p>
                </div>
                <button
                  onClick={() => setIsRfqModalOpen(true)}
                  className="bg-sky-650 hover:bg-sky-700 text-white font-bold text-[10px] font-mono uppercase tracking-wider px-3.5 py-1.5 rounded-lg flex items-center space-x-1 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Onboard RFQ</span>
                </button>
              </div>

              {rfqs.length > 0 ? (
                <div className="divide-y divide-slate-100 text-xs font-sans">
                  {rfqs.map((r) => (
                    <div key={r.id} className="py-4 flex items-center justify-between hover:bg-slate-50/50 p-2.5 rounded-xl transition-all">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 flex items-center space-x-2">
                          <FileText className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-xs">{r.id}</span>
                        </div>
                        <div className="text-[10px] text-slate-450 flex items-center space-x-2 font-mono">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>Received: {r.createdAt}</span>
                          </span>
                          <span>•</span>
                          <span>{r.itemsCount} specific line items</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[8px] uppercase tracking-wider ${
                          r.status === 'quoted'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50/30 rounded-xl">
                  <p className="text-slate-400 text-xs">No RFQ history is logged under this customer profile.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ORDERS LIST */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Active Purchase Contracts</h3>
                <p className="text-[11px] text-slate-450 leading-none mt-1">Confirmed orders from this client currently running on the shopfloor.</p>
              </div>

              {orders.length > 0 ? (
                <div className="divide-y divide-slate-100 text-xs font-sans">
                  {orders.map((o) => (
                    <div key={o.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50/30 p-2.5 rounded-xl gap-2 transition-all">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 flex items-center space-x-2">
                          <ShoppingBag className="h-4.5 w-4.5 text-sky-505 shrink-0" />
                          <span className="font-mono text-xs">{o.orderNumber}</span>
                        </div>
                        <div className="text-[10px] text-slate-450 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            <span>Logged: {o.createdAt}</span>
                          </span>
                          {o.deliveryDate && (
                            <>
                              <span>•</span>
                              <span className="flex items-center space-x-1 text-amber-600 font-bold">
                                <Clock className="h-3 w-3" />
                                <span>Planned Delivery: {o.deliveryDate}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-5">
                        <strong className="font-mono text-slate-800 flex items-center">
                          <IndianRupee className="h-3 w-3 text-slate-400" />
                          <span>{o.totalAmount.toLocaleString('en-IN')}</span>
                        </strong>
                        <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[8px] uppercase tracking-wider ${
                          o.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : o.status === 'dispatched'
                            ? 'bg-cyan-50 text-cyan-700'
                            : 'bg-indigo-50 text-indigo-750'
                        }`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50/30 rounded-xl">
                  <p className="text-slate-400 text-xs">No active or historic orders recorded for this profile.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DISPATCHES LIST */}
        {activeTab === 'dispatches' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Transport Dispatches & Shipping Logs</h3>
                <p className="text-[11px] text-slate-450 mt-1">Outbound transit, billing invoices, and certified delivery proofs for this company.</p>
              </div>

              {customerDispatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customerDispatches.map((disp) => (
                    <div key={disp.id} className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                          <Truck className="h-4 w-4 text-sky-600" />
                          <span>{disp.dispatchNumber || `DSP-${disp.id.substring(0, 6).toUpperCase()}`}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[8px] font-bold uppercase tracking-wider ${
                          disp.status === 'Delivered' || disp.status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {disp.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs font-sans text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Carrier Transporter:</span>
                          <strong className="text-slate-800">{disp.transporter || 'Self Logistics'}</strong>
                        </div>
                        {disp.vehicleNumber && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Vehicle Frame No:</span>
                            <strong className="text-slate-800 font-mono text-[11px]">{disp.vehicleNumber}</strong>
                          </div>
                        )}
                        {disp.invoiceNumber && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Tax Invoice ID:</span>
                            <strong className="text-slate-800 font-mono text-[11px]">{disp.invoiceNumber}</strong>
                          </div>
                        )}
                        {disp.lrNumber && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Lorry Receipt (LR) tracking:</span>
                            <span className="font-mono text-indigo-650 font-bold bg-indigo-50 px-1 py-0.2 rounded select-all text-[11px]">{disp.lrNumber}</span>
                          </div>
                        )}
                        {disp.dispatchDate && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Date Logged:</span>
                            <strong className="text-slate-805 font-mono">{disp.dispatchDate}</strong>
                          </div>
                        )}
                      </div>

                      {disp.itemsSummary && (
                        <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-500 italic">
                          Summary: {disp.itemsSummary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50/20 rounded-xl">
                  <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">No dispatches or shipping routes registered for this account.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: PAYMENTS COLLECTION */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Finance Ledger & Receipts</h3>
                  <p className="text-[11px] text-slate-455 mt-1">Direct wire transfer receipts, ledger clearances, and payment audits.</p>
                </div>
                <button
                  onClick={() => setIsPayDrawerOpen(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Record Payment</span>
                </button>
              </div>

              {payments && payments.length > 0 ? (
                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-mono text-[9px] uppercase tracking-wider border-b border-slate-150">
                        <th className="p-3">Reference No / Txn Hash</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3">Private Memo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-indigo-600 flex items-center space-x-1 text-[11px]">
                            <span>{p.referenceNumber}</span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(p.referenceNumber);
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-650 transition cursor-pointer"
                              title="Copy Txn ID"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-bold bg-indigo-50 text-indigo-750 px-2 py-0.5 rounded border border-indigo-100 text-[9px] uppercase">
                              {p.method}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-600">{p.paymentDate}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-slate-500 italic max-w-xs truncate">{p.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50/20 rounded-xl">
                  <IndianRupee className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">No ledger collections submitted.</p>
                </div>
              )}
            </div>

            {/* Slide drawer for Record Payment */}
            {isPayDrawerOpen && (
              <div className="fixed inset-0 overflow-hidden z-50 flex items-center justify-end select-none">
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" onClick={() => setIsPayDrawerOpen(false)} />
                <div className="bg-white max-w-sm w-full h-full relative z-10 flex flex-col p-6 shadow-2xl border-l border-slate-200">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Record Client Payment</h4>
                      <p className="text-[10px] text-slate-450">Log transfers or cheques to balance ledger accounts.</p>
                    </div>
                    <button onClick={() => setIsPayDrawerOpen(false)} className="p-1.5 hover:bg-slate-50 border border-slate-150 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const amt = parseFloat(payAmountInput);
                    if (isNaN(amt) || amt <= 0) {
                      alert('Please enter a positive numeric payment amount.');
                      return;
                    }
                    if (!payRef.trim()) {
                      alert('Please register a valid transaction reference id.');
                      return;
                    }
                    setPaySubmitting(true);
                    try {
                      await recordPayment({
                        amount: amt,
                        method: payMethod,
                        referenceNumber: payRef,
                        paymentDate: payDate,
                        notes: payNotesInput
                      });
                      alert('Payment ledger updated successfully!');
                      setIsPayDrawerOpen(false);
                      setPayAmountInput('');
                      setPayRef('');
                      setPayNotesInput('');
                    } catch (err: any) {
                      alert(`Error: ${err.message}`);
                    } finally {
                      setPaySubmitting(false);
                    }
                  }} className="flex-grow overflow-y-auto space-y-4 py-4 text-xs select-text">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase text-slate-455 tracking-wider block">Payment Date</label>
                      <input
                        type="date"
                        required
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden p-2 rounded-lg font-mono text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase text-slate-455 tracking-wider block">Method</label>
                      <select
                        value={payMethod}
                        onChange={(e: any) => setPayMethod(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden p-2 rounded-lg font-mono text-slate-800"
                      >
                        <option value="RTGS">RTGS Wire Transfer</option>
                        <option value="NEFT">NEFT Settlement</option>
                        <option value="UPI">UPI Digital Payment / GPay</option>
                        <option value="Cheque">Physical Demand Cheque</option>
                        <option value="Cash">Direct Cash Receipt</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase text-slate-455 tracking-wider block">Reference / Transaction Ref ID</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. UTIB0001092818 or TXN-492"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden p-2 rounded-lg font-mono text-slate-850"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase text-slate-455 tracking-wider block">Amount (₹)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 75000"
                        value={payAmountInput}
                        onChange={(e) => setPayAmountInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden p-2 rounded-lg font-mono text-slate-850 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold uppercase text-slate-455 tracking-wider block">Account Ledger Private Memo</label>
                      <textarea
                        placeholder="Notes on balance adjustments..."
                        value={payNotesInput}
                        onChange={(e) => setPayNotesInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden p-2 rounded-lg min-h-[80px]"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsPayDrawerOpen(false)}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-605 font-mono font-bold text-[10px] uppercase cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={paySubmitting}
                        className="px-5 py-2 bg-emerald-750 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-mono font-bold text-[10px] uppercase cursor-pointer text-center"
                      >
                        {paySubmitting ? 'Recording...' : 'Commit Ledger'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: CRM TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 space-y-4">
              
              {/* Form to log memo */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5 shadow-3xs">
                <div>
                  <h4 className="font-bold text-slate-805 text-slate-800 text-xs">Log Client Action / CRM Notes</h4>
                  <p className="text-[10px] text-slate-450 mt-1">Add a quick call log, client email response, physical meeting recap, or text reminder.</p>
                </div>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!noteMsg.trim()) return;
                  setNoteSubmitting(true);
                  try {
                    await addLogEntry({
                      channel: noteChannel,
                      direction: noteDirection,
                      message: noteMsg,
                    });
                    setNoteMsg('');
                    alert('CRM action successfully committed to the customer timeline!');
                  } catch (err: any) {
                    alert(`Failed to log note: ${err.message}`);
                  } finally {
                    setNoteSubmitting(false);
                  }
                }} className="space-y-3 font-sans text-xs select-text">
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Communication Channel</label>
                      <select
                        value={noteChannel}
                        onChange={(e: any) => setNoteChannel(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-205 focus:bg-white focus:outline-hidden p-2 rounded-lg font-mono text-[11px]"
                      >
                        <option value="note">📝 Private Memo / Note</option>
                        <option value="call">📞 Phone Voice Call</option>
                        <option value="email">✉️ Official Email Outbox</option>
                        <option value="meeting">🤝 Physical Office Meeting</option>
                        <option value="whatsapp">💬 WhatsApp Message</option>
                      </select>
                    </div>

                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Message Direction</label>
                      <select
                        value={noteDirection}
                        onChange={(e: any) => setNoteDirection(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-205 focus:bg-white focus:outline-hidden p-2 rounded-lg font-mono text-[11px]"
                      >
                        <option value="internal">⚠️ Internal Only Memo</option>
                        <option value="inbound">📥 Inbound (From Client)</option>
                        <option value="outbound">📤 Outbound (Sent to Client)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-wider block">Memo Notes</label>
                    <textarea
                      required
                      value={noteMsg}
                      onChange={(e) => setNoteMsg(e.target.value)}
                      placeholder="Log precise terms discussed, callbacks scheduled, or visit outlines..."
                      className="w-full text-xs font-sans border border-slate-205 bg-slate-50 focus:bg-white rounded-lg p-2.5 min-h-[70px] focus:outline-hidden text-slate-805 text-slate-800 leading-relaxed"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={noteSubmitting}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-[10px] uppercase tracking-widest py-2.5 rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{noteSubmitting ? 'Recording...' : 'Commit CRM Log'}</span>
                  </button>
                </form>
              </div>

              {/* Vertical feed timeline */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-3xs">
                <h3 className="font-mono text-xs uppercase font-bold text-slate-555 block tracking-wide">
                  Chronological CRM Stream
                </h3>

                {timelineEntries.length > 0 ? (
                  <div className="relative pl-6 border-l border-slate-150 space-y-6 text-xs">
                    {timelineEntries.map((entry) => {
                      const isInternal = entry.direction === 'internal';
                      const isInbound = entry.direction === 'inbound';
                      const isOutbound = entry.direction === 'outbound';

                      return (
                        <div key={entry.id} className="relative group select-text">
                          <span className={`absolute -left-[31px] top-0.5 p-1.5 rounded-full border bg-white ${
                            isInternal 
                              ? 'border-amber-200 text-amber-600'
                              : isInbound
                              ? 'border-sky-200 text-sky-600'
                              : 'border-emerald-200 text-emerald-600'
                          }`}>
                            {entry.channel === 'call' && <Phone className="h-3.5 w-3.5" />}
                            {entry.channel === 'email' && <Mail className="h-3.5 w-3.5" />}
                            {entry.channel === 'meeting' && <Building2 className="h-3.5 w-3.5" />}
                            {entry.channel === 'note' && <FileText className="h-3.5 w-3.5" />}
                            {entry.channel === 'whatsapp' && <MessageSquare className="h-3.5 w-3.5" />}
                          </span>

                          <div className="space-y-1.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-150/60 p-3.5 rounded-xl transition-all">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="font-bold text-slate-850 flex items-center space-x-1.5">
                                <span className="capitalize">{entry.channel} Entry</span>
                                <span className={`px-1.5 py-0.2 rounded font-mono text-[8px] uppercase font-bold tracking-wider ${
                                  isInternal
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                    : isInbound
                                    ? 'bg-sky-50 text-sky-700 border border-sky-100'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}>
                                  {entry.direction}
                                </span>
                              </div>
                              <span className="font-mono text-[9px] text-slate-400 font-bold">
                                {new Date(entry.timestamp).toLocaleString('en-IN', {
                                  dateStyle: 'short',
                                  timeStyle: 'short'
                                })}
                              </span>
                            </div>

                            <p className="text-slate-700 font-sans leading-relaxed text-[11.5px]">
                              {entry.message}
                            </p>

                            {entry.author && (
                              <div className="flex items-center space-x-1 text-[9px] font-mono text-slate-400 pt-1.5 border-t border-slate-100 uppercase font-bold">
                                <span>Agent:</span>
                                <span className="text-slate-600">{entry.author.displayName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50/20 rounded-xl font-mono text-xs uppercase tracking-wider text-slate-405">
                    <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs">Timeline log is pristine.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Campaign Column */}
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-3xs">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">WhatsApp Campaign Push</h4>
                  <p className="text-[10px] text-slate-455 leading-relaxed mt-1">
                    Deliver outbound template campaigns over WhatsApp. Live timeline tracking updates automatically.
                  </p>
                </div>

                <form onSubmit={handleSendWhatsApp} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold uppercase tracking-wide text-slate-455 block">Marketing Template</label>
                    <select
                      value={waType}
                      onChange={(e) => setWaType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:outline-hidden p-2 rounded-lg font-mono"
                    >
                      <option value="order_status">🚧 Active Order Update</option>
                      <option value="billing_summary">🏦 Billing Balance Reminder</option>
                      <option value="general_trade">📦 Trade Campaign Circular</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold uppercase tracking-wide text-slate-455 block">Push Message Body</label>
                    <textarea
                      value={waText}
                      onChange={(e) => setWaText(e.target.value)}
                      required
                      placeholder="Customize your live client message campaigns..."
                      className="w-full text-xs font-sans border border-slate-200 focus:bg-white focus:outline-hidden p-2.5 rounded-lg min-h-[105px] leading-relaxed select-text text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Run Campaign</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: EMBEDDED REAL-TIME WHATSAPP CHAT CHANNEL */}
        {activeTab === 'whatsapp' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 select-none">
              <div>
                <h4 className="font-bold text-slate-800 text-xs">Direct WhatsApp Live Support Channel</h4>
                <p className="text-[10px] text-slate-400 mt-1">Chat securely with {customer?.name || 'Client'} in real time. Sent messages also log in this customer's CRM profile history automatically.</p>
              </div>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-150">
                Secure Meta BSP Tunnel Enabled
              </span>
            </div>

            {matchedConv ? (
              <div className="space-y-4 flex flex-col h-[400px]">
                {/* Chat window viewport */}
                <div className="flex-grow overflow-y-auto p-4 rounded-xl bg-slate-50 border border-slate-150 space-y-3 flex flex-col justify-end">
                  {embedChatLoading ? (
                    <div className="text-center text-xs font-mono text-slate-400 py-10 uppercase animate-pulse">
                      Retrieving WhatsApp thread...
                    </div>
                  ) : waEmbedMessages.length === 0 ? (
                    <div className="text-center text-xs font-mono text-slate-450 py-10 uppercase">
                      No message exchanges yet. Send a message to start!
                    </div>
                  ) : (
                    <div className="space-y-3 overflow-y-auto pr-1">
                      {waEmbedMessages.map((msg) => {
                        const isInbound = msg.direction === 'inbound';
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col max-w-[80%] ${isInbound ? 'mr-auto items-start' : 'ml-auto items-end'}`}
                          >
                            <div className={`p-2.5 rounded-xl text-xs leading-normal font-medium shadow-3xs ${
                              isInbound 
                                ? 'bg-slate-200 text-slate-800 rounded-tl-none' 
                                : 'bg-emerald-600 text-white rounded-tr-none'
                            }`}>
                              <p className="whitespace-pre-line">{msg.message}</p>
                            </div>
                            <span className="text-[8px] font-mono text-slate-400 mt-1 px-1">
                              {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              {!isInbound && (
                                <span className="ml-1 text-emerald-600 font-bold">
                                  {msg.status === 'read' ? '✓✓ read' : '✓ sent'}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Send action bar */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const text = embedWaText.trim();
                    if (!text) return;
                    
                    try {
                      await sendWaEmbedMessage(text);
                      
                      // Also add this as a local communicationLog entry
                      await addLogEntry({
                        channel: 'whatsapp',
                        direction: 'outbound',
                        message: text
                      });

                      setEmbedWaText('');
                    } catch (err: any) {
                      alert(`Error: ${err.message}`);
                    }
                  }}
                  className="flex space-x-2 shrink-0 select-none"
                >
                  <input
                    type="text"
                    value={embedWaText}
                    onChange={(e) => setEmbedWaText(e.target.value)}
                    placeholder={`Reply directly to ${customer?.name}...`}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-emerald-500 text-slate-800 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={!embedWaText.trim()}
                    className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-lg cursor-pointer ${
                      embedWaText.trim() 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Send Outbound
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center space-y-4 max-w-md mx-auto select-none">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mx-auto">
                  <MessageSquare className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-700 text-xs uppercase font-mono">No Established WhatsApp Thread</h5>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                    This B2B contact ({customer?.phone || 'No Phone Register'}) is currently not actively linked inside the WhatsApp inbox dashboard. Initiate safe channel dialogue:
                  </p>
                </div>
                {customer?.phone ? (
                  <button
                    onClick={async () => {
                      try {
                        const defaultIntro = `Hello, this is our response from the active Sales Engineering desk at ${tenant?.companyName || 'Ashrey Forge'}. How may we assist with your casting scheduler?`;
                        
                        // Create conversation + Seed first local incoming chat
                        await triggerLocalInbound(customer.phone, defaultIntro);
                        
                        // Associate customer profile immediately
                        const key = `whatsapp_convs_${tenant?.id}`;
                        const cCached = localStorage.getItem(key);
                        if (cCached) {
                          const list: any[] = JSON.parse(cCached);
                          const freshlyCreated = list.find(c => c.phone === customer.phone);
                          if (freshlyCreated) {
                            await matchCustomer(freshlyCreated.id, customerId || '', customer.name);
                          }
                        }

                        alert(`WhatsApp channel initialized with ${customer.phone}! Matches are synced.`);
                      } catch (err: any) {
                        alert(err.message || 'Error executing initialization');
                      }
                    }}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold uppercase cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Initiate support desk chat channel</span>
                  </button>
                ) : (
                  <p className="text-[9px] font-mono text-red-500 uppercase font-bold">
                    ⚠️ No valid phone number assigned to this Customer profile. Update basic detail record.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 8: HISTORIC AUDIT LOG */}
        {activeTab === 'activity' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs">
            <ActivityTimeline entityId={customerId} compact={false} title="System Profile Registry Audits" />
          </div>
        )}
      </div>

      {/* DYNAMIC REGISTER RFQ INQUIRY POPUP */}
      {isRfqModalOpen && (
        <div className="fixed inset-0 overflow-hidden z-50 flex items-center justify-center select-none">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" onClick={() => setIsRfqModalOpen(false)} />

          <div className="bg-white rounded-2xl shadow-2xl border border-slate-150 max-w-lg w-full p-6 relative z-10 m-4 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 select-none">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono font-bold text-sky-655 uppercase tracking-widest block leading-none">
                  Custom Costing Sheet
                </span>
                <h3 className="font-bold text-slate-850 text-sm leading-none mt-1">Register New Customer Inquiry</h3>
              </div>
              <button
                onClick={() => setIsRfqModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 border border-slate-205 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Scrollable inputs field */}
            <form onSubmit={handleRfqSubmit} className="overflow-y-auto space-y-4 my-4 flex-grow pr-1 text-xs">
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-mono font-bold uppercase text-slate-450 tracking-wide">
                    Line Component Requirements
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRfqItemField}
                    className="text-sky-655 hover:text-sky-800 text-[10px] font-bold font-mono tracking-wider uppercase flex items-center space-x-0.5 transition"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>Add Item Block</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {rfqItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <div className="flex-grow">
                        <input
                          type="text"
                          required
                          className="w-full text-xs font-sans border border-slate-200 bg-slate-50 focus:bg-white rounded-lg p-2 focus:outline-hidden text-slate-800 shrink-0"
                          placeholder="e.g. High-Density Cast Iron Valve"
                          value={item.name}
                          onChange={(e) => handleRfqItemChange(idx, 'name', e.target.value)}
                        />
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          required
                          className="w-full text-xs font-mono border border-slate-200 bg-slate-50 focus:bg-white rounded-lg p-2 font-bold text-center focus:outline-hidden text-slate-800 shrink-0"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleRfqItemChange(idx, 'quantity', e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={rfqItems.length === 1}
                        onClick={() => handleRemoveRfqItemField(idx)}
                        className="p-2 border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-400 hover:text-red-650 rounded-lg transition shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special instructions */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-bold uppercase tracking-wide text-slate-450 block">Inquiry Notes / Special terms</label>
                <textarea
                  value={rfqReq}
                  onChange={(e) => setRfqReq(e.target.value)}
                  placeholder="Requires ultra precision machining, custom surface hardening coatings..."
                  className="w-full text-xs font-sans border border-slate-200 bg-slate-50 focus:bg-white rounded-lg p-2.5 min-h-[70px] focus:outline-hidden text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRfqModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 font-mono font-bold uppercase text-[10px] tracking-wide"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-mono font-bold uppercase text-[10px] tracking-widest transition shadow-sm"
                >
                  Onboard Inquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
