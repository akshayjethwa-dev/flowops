// src/pages/subcontractors/SubcontractorsPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Building2, 
  Send, 
  BarChart3, 
  Award, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Phone, 
  Mail, 
  Star, 
  Layers, 
  Tag, 
  Sparkles, 
  Download, 
  Calendar,
  AlertCircle,
  ExternalLink,
  Truck,
  RotateCcw
} from 'lucide-react';
import { 
  Subcontractor, 
  SubcontractRfq, 
  SubcontractOperationCategory, 
  SUBCONTRACT_CATEGORIES 
} from '../../types/subcontractor';
import { 
  fetchSubcontractors, 
  fetchSubcontractRfqs, 
  calculateBidLandedTotal,
  deleteSubcontractor 
} from '../../services/subcontractorService';
import { SubcontractorFormModal } from '../../components/subcontractors/SubcontractorFormModal';
import { CreateSubcontractRfqModal } from '../../components/subcontractors/CreateSubcontractRfqModal';
import { QuoteComparisonMatrixModal } from '../../components/subcontractors/QuoteComparisonMatrixModal';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { GuardedAction } from '../../components/layout/GuardedAction';

export const SubcontractorsPage: React.FC = () => {
  const { tenant, isSandboxMode } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();

  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'rfqs' | 'directory' | 'pos'>('rfqs');
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [rfqs, setRfqs] = useState<SubcontractRfq[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals state
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null);
  const [showCreateRfqModal, setShowCreateRfqModal] = useState(false);
  const [activeMatrixRfq, setActiveMatrixRfq] = useState<SubcontractRfq | null>(null);

  // Prefill state from navigation
  const [prefillData, setPrefillData] = useState<{
    category?: SubcontractOperationCategory;
    jobName?: string;
    partName?: string;
    quantity?: number;
    orderNumber?: string;
  }>({});

  // Detect incoming navigation with prefill params
  useEffect(() => {
    if (location.state) {
      const state = location.state as {
        openCreateModal?: boolean;
        initialCategory?: SubcontractOperationCategory;
        initialJobName?: string;
        initialPartName?: string;
        initialQuantity?: number;
        initialOrderNumber?: string;
      };
      if (state.openCreateModal) {
        setPrefillData({
          category: state.initialCategory,
          jobName: state.initialJobName,
          partName: state.initialPartName,
          quantity: state.initialQuantity,
          orderNumber: state.initialOrderNumber
        });
        setShowCreateRfqModal(true);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Load initial data
  const loadData = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [subsData, rfqsData] = await Promise.all([
        fetchSubcontractors(tenant.id, isSandboxMode),
        fetchSubcontractRfqs(tenant.id, isSandboxMode)
      ]);
      setSubcontractors(subsData);
      setRfqs(rfqsData);
    } catch (err: any) {
      console.error('Failed to load subcontractor data:', err);
      toastError('Could not sync subcontractor records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id, isSandboxMode]);

  // Filtered RFQs
  const filteredRfqs = useMemo(() => {
    return rfqs.filter(r => {
      const matchesCategory = selectedCategory === 'all' || r.operationCategory === selectedCategory;
      const matchesSearch = 
        r.rfqNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.items[0]?.partName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.linkedOrderNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [rfqs, selectedCategory, searchQuery]);

  // Filtered Subcontractors
  const filteredSubcontractors = useMemo(() => {
    return subcontractors.filter(s => {
      const matchesCategory = selectedCategory === 'all' || s.categories.includes(selectedCategory as any);
      const matchesSearch = 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.capabilitiesSummary || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [subcontractors, selectedCategory, searchQuery]);

  // Awarded RFQs (Issued Subcontract POs)
  const awardedRfqs = useMemo(() => {
    return rfqs.filter(r => r.status === 'awarded' && r.awardDecision);
  }, [rfqs]);

  // Aggregate Metrics
  const activeRfqsCount = rfqs.filter(r => r.status !== 'awarded' && r.status !== 'cancelled').length;
  const quotesReceivedCount = rfqs.reduce((acc, r) => acc + (r.bids?.length || 0), 0);
  const totalAwardedValue = awardedRfqs.reduce((acc, r) => acc + (r.awardDecision?.awardedTotalAmount || 0), 0);

  const handleDeleteVendor = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the subcontractor directory?`)) return;
    if (!tenant?.id) return;

    try {
      await deleteSubcontractor(tenant.id, id, isSandboxMode);
      setSubcontractors(prev => prev.filter(s => s.id !== id));
      toastSuccess('Vendor Removed', `${name} deleted from records.`);
    } catch (e: any) {
      toastError('Failed to remove vendor: ' + e.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="bg-slate-100 text-slate-700 border border-slate-300 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">Draft</span>;
      case 'broadcasted':
        return <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">Broadcasted</span>;
      case 'quotes_received':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase animate-pulse">Bids Received</span>;
      case 'awarded':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase">Awarded (PO Issued)</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 text-[9px] font-mono px-2 py-0.5 rounded">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest block leading-none">
            Procurement & Outside Processing
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block mt-1">
            Subcontractor RFQ & Vendor Hub
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Send RFQs for outsourced manufacturing operations, compare competing bids side-by-side, and track award purchase orders.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingSubcontractor(null);
              setShowAddVendorModal(true);
            }}
            className="border border-slate-300 hover:bg-slate-50 text-slate-700 font-mono text-[10px] uppercase font-bold tracking-wider px-3.5 py-2.5 rounded-xl flex items-center space-x-1.5 cursor-pointer transition-colors shadow-3xs"
          >
            <Building2 className="h-4 w-4 text-slate-500" />
            <span>Add Subcontractor</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateRfqModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] uppercase font-bold tracking-wider px-4 py-2.5 rounded-xl flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs hover:scale-101"
          >
            <Send className="h-4 w-4 text-indigo-200" />
            <span>Broadcast Subcontract RFQ</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Active Outward RFQs</span>
          <div className="text-xl font-extrabold text-slate-900 font-mono">{activeRfqsCount}</div>
          <span className="text-[10px] text-sky-600 font-medium">Broadcasted to vendors</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Vendor Bids In Matrix</span>
          <div className="text-xl font-extrabold text-amber-600 font-mono">{quotesReceivedCount}</div>
          <span className="text-[10px] text-amber-700 font-medium">Ready for side-by-side comparison</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Certified Subcontractors</span>
          <div className="text-xl font-extrabold text-slate-900 font-mono">{subcontractors.length}</div>
          <span className="text-[10px] text-slate-500 font-medium">In master database</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Awarded Subcontract POs</span>
          <div className="text-xl font-extrabold text-emerald-700 font-mono">₹{totalAwardedValue.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-emerald-700 font-medium">{awardedRfqs.length} SPO contracts issued</span>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('rfqs')}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'rfqs' 
              ? 'border-indigo-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <BarChart3 className="h-4 w-4 text-indigo-600" />
          <span>Outsourced RFQs & Bid Matrix</span>
          <span className="bg-slate-200 text-slate-700 font-mono text-[9px] px-1.5 py-0.2 rounded-full font-bold">
            {rfqs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'directory' 
              ? 'border-indigo-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <Building2 className="h-4 w-4 text-slate-500" />
          <span>Subcontractor Database</span>
          <span className="bg-slate-200 text-slate-700 font-mono text-[9px] px-1.5 py-0.2 rounded-full font-bold">
            {subcontractors.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pos')}
          className={`pb-3 text-xs uppercase font-mono font-bold tracking-wider hover:text-slate-900 cursor-pointer flex items-center space-x-1.5 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'pos' 
              ? 'border-indigo-600 text-slate-900' 
              : 'border-transparent text-slate-400'
          }`}
        >
          <Award className="h-4 w-4 text-emerald-600" />
          <span>Awarded Orders & PO Tracking</span>
          {awardedRfqs.length > 0 && (
            <span className="bg-emerald-100 text-emerald-800 font-mono text-[9px] px-1.5 py-0.2 rounded-full font-bold">
              {awardedRfqs.length}
            </span>
          )}
        </button>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs shadow-3xs">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'directory'
                ? "Search subcontractor by name, city, contact person, or capabilities..."
                : "Search RFQ by #, part name, linked SO, or process..."
            }
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden text-xs text-slate-800"
          />
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <option value="all">🌐 All Process Categories</option>
            {SUBCONTRACT_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─────────────────── TAB 1: OUTSOURCED RFQS & BID MATRIX ─────────────────── */}
      {activeTab === 'rfqs' && (
        <div className="space-y-4">
          {filteredRfqs.length > 0 ? (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredRfqs.map(rfq => {
                const totalQty = rfq.items.reduce((sum, it) => sum + (it.quantity || 0), 0) || 1;
                const bidsCount = rfq.bids?.length || 0;
                const bestBid = rfq.bids && rfq.bids.length > 0 ? rfq.bids[0] : null;

                return (
                  <div
                    key={rfq.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-2.5 flex-wrap">
                        <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {rfq.rfqNumber}
                        </span>
                        {getStatusBadge(rfq.status)}
                        <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded font-semibold uppercase">
                          {SUBCONTRACT_CATEGORIES.find(c => c.id === rfq.operationCategory)?.label || rfq.operationCategory}
                        </span>
                        {rfq.linkedOrderNumber && (
                          <span className="text-[10px] font-mono text-slate-500">
                            Linked: <strong>{rfq.linkedOrderNumber}</strong>
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {rfq.title}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          Part: <span className="font-semibold text-slate-800">{rfq.items[0]?.partName}</span> ({totalQty} {rfq.items[0]?.unit || 'pcs'}) • Grade: {rfq.items[0]?.materialGrade}
                        </p>
                      </div>

                      <div className="flex items-center space-x-4 text-[10px] font-mono text-slate-400">
                        <span>Invited: {rfq.invitedSubcontractorIds.length} Vendors</span>
                        <span>•</span>
                        <span>Deadline: {new Date(rfq.quoteDeadlineDate).toLocaleDateString('en-IN')}</span>
                        <span>•</span>
                        <span>Delivery Target: {new Date(rfq.requiredDeliveryDate).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Right Action Block */}
                    <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      
                      {/* Comparison Matrix CTA */}
                      <button
                        type="button"
                        onClick={() => setActiveMatrixRfq(rfq)}
                        className={`font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer transition-all ${
                          bidsCount > 0
                            ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs hover:scale-101'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                        }`}
                      >
                        <BarChart3 className="h-4 w-4" />
                        <span>Compare Quotes ({bidsCount})</span>
                      </button>

                      {/* If already awarded, show award badge button */}
                      {rfq.status === 'awarded' && rfq.awardDecision && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-center">
                          <span className="text-[9px] uppercase font-mono font-bold text-emerald-800 block">Awarded Vendor</span>
                          <span className="text-xs font-bold text-emerald-950 truncate max-w-[150px] block">
                            {rfq.awardDecision.subcontractorName}
                          </span>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 space-y-3">
              <BarChart3 className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">No Outsourced RFQs Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No active subcontract RFQs match the query. Click "Broadcast Subcontract RFQ" to solicit quotes from certified vendors.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateRfqModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-4 py-2 rounded-xl inline-flex items-center space-x-1.5 cursor-pointer shadow-xs mt-1"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Subcontract RFQ</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────── TAB 2: SUBCONTRACTOR DATABASE ─────────────────── */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSubcontractors.map(sub => (
              <div 
                key={sub.id} 
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-slate-100 text-slate-700">
                          {sub.qualityTier} Tier
                        </span>
                        {sub.status === 'preferred' && (
                          <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                            ⭐ Preferred
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                        {sub.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Liaison: {sub.contactPerson || 'Works Manager'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center space-x-1">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                        <span>{sub.rating}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-1">
                        ~{sub.typicalLeadTimeDays}d Turnaround
                      </span>
                    </div>
                  </div>

                  {/* Capabilities statement */}
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                    {sub.capabilitiesSummary}
                  </p>

                  {/* Process Badges */}
                  <div className="flex flex-wrap gap-1">
                    {sub.categories.map(cat => (
                      <span 
                        key={cat} 
                        className="text-[9.5px] font-mono font-semibold text-indigo-700 bg-indigo-50/80 border border-indigo-150 px-2 py-0.5 rounded"
                      >
                        {SUBCONTRACT_CATEGORIES.find(c => c.id === cat)?.label || cat}
                      </span>
                    ))}
                  </div>

                  {/* Location & Contact strip */}
                  <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-500 font-mono">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-slate-400">📍</span>
                      <span className="truncate">{sub.city}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>📞 {sub.phone}</span>
                      {sub.gstNumber && <span className="text-[10px] text-slate-400">GST: {sub.gstNumber}</span>}
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubcontractor(sub);
                        setShowAddVendorModal(true);
                      }}
                      className="text-slate-600 hover:text-slate-900 font-mono font-bold text-[10.5px] uppercase cursor-pointer"
                    >
                      Edit
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteVendor(sub.id, sub.name)}
                      className="text-rose-500 hover:text-rose-700 font-mono text-[10.5px] cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateRfqModal(true);
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-mono font-bold text-[10.5px] uppercase px-2.5 py-1 rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <Send className="h-3 w-3" />
                    <span>Send RFQ</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 3: AWARDED ORDERS & PO TRACKING ─────────────────── */}
      {activeTab === 'pos' && (
        <div className="space-y-4">
          {awardedRfqs.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[9px] font-mono uppercase font-bold text-slate-500 border-b border-slate-200">
                      <th className="p-3.5">Subcontract PO#</th>
                      <th className="p-3.5">RFQ Reference</th>
                      <th className="p-3.5">Awarded Subcontractor</th>
                      <th className="p-3.5">Component / Operation</th>
                      <th className="p-3.5">Contract Valuation</th>
                      <th className="p-3.5">Promised Delivery</th>
                      <th className="p-3.5">Award Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                    {awardedRfqs.map(rfq => {
                      const dec = rfq.awardDecision!;
                      return (
                        <tr key={rfq.id} className="hover:bg-slate-50/50">
                          <td className="p-3.5 font-bold text-emerald-800">
                            <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              {dec.poNumber}
                            </span>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-800">
                            {rfq.rfqNumber}
                          </td>
                          <td className="p-3.5 font-bold text-slate-900 font-sans">
                            {dec.subcontractorName}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            <span className="block font-semibold">{rfq.items[0]?.partName}</span>
                            <span className="text-[10px] text-slate-400">Qty: {rfq.items[0]?.quantity} {rfq.items[0]?.unit || 'pcs'}</span>
                          </td>
                          <td className="p-3.5 font-bold text-slate-900 text-xs">
                            ₹{dec.awardedTotalAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {new Date(dec.deliveryDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="p-3.5 max-w-xs font-sans text-slate-600 text-[10.5px]">
                            {dec.decisionReason}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 space-y-2">
              <Award className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">No Awarded Subcontract POs Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Once you evaluate incoming subcontractor bids in the comparison matrix and click "Award to Vendor", formal purchase order records will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Subcontractor Add / Edit Modal */}
      {showAddVendorModal && (
        <SubcontractorFormModal
          isOpen={showAddVendorModal}
          onClose={() => {
            setShowAddVendorModal(false);
            setEditingSubcontractor(null);
          }}
          subcontractor={editingSubcontractor}
          onSaved={saved => {
            setSubcontractors(prev => {
              const idx = prev.findIndex(s => s.id === saved.id);
              if (idx >= 0) {
                return prev.map(s => s.id === saved.id ? saved : s);
              }
              return [saved, ...prev];
            });
          }}
        />
      )}

      {/* Create & Broadcast Subcontract RFQ Modal */}
      {showCreateRfqModal && (
        <CreateSubcontractRfqModal
          isOpen={showCreateRfqModal}
          onClose={() => {
            setShowCreateRfqModal(false);
            setPrefillData({});
          }}
          subcontractors={subcontractors}
          initialCategory={prefillData.category}
          initialJobName={prefillData.jobName}
          initialPartName={prefillData.partName}
          initialQuantity={prefillData.quantity}
          initialOrderNumber={prefillData.orderNumber}
          onRfqCreated={newRfq => {
            setRfqs(prev => [newRfq, ...prev]);
            setPrefillData({});
          }}
        />
      )}

      {/* Side-by-Side Quote Comparison Matrix Modal */}
      {activeMatrixRfq && (
        <QuoteComparisonMatrixModal
          isOpen={!!activeMatrixRfq}
          onClose={() => setActiveMatrixRfq(null)}
          rfq={activeMatrixRfq}
          subcontractors={subcontractors}
          onRfqUpdated={updated => {
            setRfqs(prev => prev.map(r => r.id === updated.id ? updated : r));
            setActiveMatrixRfq(updated);
          }}
        />
      )}

    </div>
  );
};
