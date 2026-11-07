// src/pages/job-work/JobWorkPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Truck, 
  Plus, 
  Search, 
  Filter, 
  Printer, 
  Ban, 
  PackageMinus, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Package, 
  FileText, 
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  Download,
  Boxes,
  FileCheck,
  IndianRupee,
  Layers,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { 
  JobWorkGatePass, 
  JobWorkerStockBalance, 
  JobWorkGRN, 
  VendorStockLedgerTransaction 
} from '../../types/jobWork';
import { StockItem } from '../../types';
import { 
  fetchGatePasses, 
  fetchJobWorkerStocks, 
  fetchJobWorkGrns, 
  fetchVendorStockLedger, 
  calculateJobWorkKPIs 
} from '../../services/jobWorkService';
import { useStockItems } from '../../hooks/useStockInventory';
import { CreateOutwardGatePassModal } from '../../components/job-work/CreateOutwardGatePassModal';
import { PrintableGatePassModal } from '../../components/job-work/PrintableGatePassModal';
import { CancelGatePassModal } from '../../components/job-work/CancelGatePassModal';
import { ShortCloseGatePassModal } from '../../components/job-work/ShortCloseGatePassModal';
import { ReceiveInwardGatePassModal } from '../../components/job-work/ReceiveInwardGatePassModal';
import { PrintableGrnModal } from '../../components/job-work/PrintableGrnModal';
import { VendorStockLedgerView } from '../../components/job-work/VendorStockLedgerView';
import { FinanceDisputeModal } from '../../components/job-work/FinanceDisputeModal';
import { JobWorkerStockTable } from '../../components/job-work/JobWorkerStockTable';
import { ITC04ExportModal } from '../../components/job-work/ITC04ExportModal';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

export const JobWorkPage: React.FC = () => {
  const { tenant, user, isSandboxMode } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Primary data states
  const [gatePasses, setGatePasses] = useState<JobWorkGatePass[]>([]);
  const [jobWorkerStocks, setJobWorkerStocks] = useState<JobWorkerStockBalance[]>([]);
  const [grns, setGrns] = useState<JobWorkGRN[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<VendorStockLedgerTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'outward' | 'inward' | 'ledger' | 'stock_balance' | 'grns'>('outward');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showInwardModal, setShowInwardModal] = useState<boolean>(false);
  const [showITC04Modal, setShowITC04Modal] = useState<boolean>(false);
  const [selectedGatePassForPrint, setSelectedGatePassForPrint] = useState<JobWorkGatePass | null>(null);
  const [selectedGatePassForCancel, setSelectedGatePassForCancel] = useState<JobWorkGatePass | null>(null);
  const [selectedGatePassForShortClose, setSelectedGatePassForShortClose] = useState<JobWorkGatePass | null>(null);
  const [selectedGatePassForInward, setSelectedGatePassForInward] = useState<JobWorkGatePass | null>(null);
  const [selectedGrnForPrint, setSelectedGrnForPrint] = useState<JobWorkGRN | null>(null);
  const [selectedGrnForDispute, setSelectedGrnForDispute] = useState<JobWorkGRN | null>(null);

  // Stock items from store inventory hook
  const { items: stockItems } = useStockItems(tenant?.id);

  // Load initial data
  const loadData = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [passes, stocks, grnList, ledger] = await Promise.all([
        fetchGatePasses(tenant.id, isSandboxMode),
        fetchJobWorkerStocks(tenant.id, isSandboxMode),
        fetchJobWorkGrns(tenant.id, isSandboxMode),
        fetchVendorStockLedger(tenant.id, undefined, isSandboxMode)
      ]);
      setGatePasses(passes);
      setJobWorkerStocks(stocks);
      setGrns(grnList);
      setLedgerTransactions(ledger);
    } catch (e) {
      console.error('Failed to load Job Work data:', e);
      toastError('Failed to load Job Work records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id, isSandboxMode]);

  // Handle location state navigation if prefilled from other views
  useEffect(() => {
    if (location.state) {
      const state = location.state as { openCreateModal?: boolean; initialTab?: 'outward' | 'inward' | 'ledger' | 'stock_balance' | 'grns' };
      if (state.openCreateModal) {
        setShowCreateModal(true);
      }
      if (state.initialTab) {
        setActiveTab(state.initialTab);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Compute KPIs
  const kpis = useMemo(() => {
    return calculateJobWorkKPIs(gatePasses, jobWorkerStocks);
  }, [gatePasses, jobWorkerStocks]);

  const totalDisputedCharges = useMemo(() => {
    return grns.filter(g => g.isProcessingChargeDisputed && g.disputeStatus === 'disputed').length;
  }, [grns]);

  // Filtered passes
  const filteredOutwardPasses = useMemo(() => {
    return gatePasses.filter(p => {
      if (p.type !== 'outward') return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNum = p.gatePassNumber?.toLowerCase().includes(q);
        const matchVendor = p.jobWorkerName?.toLowerCase().includes(q);
        const matchWork = p.natureOfWork?.toLowerCase().includes(q);
        const matchVeh = p.vehicleDetails?.vehicleNumber?.toLowerCase().includes(q);
        const matchItem = p.items.some(i => i.materialName.toLowerCase().includes(q) || i.materialCode.toLowerCase().includes(q));
        if (!matchNum && !matchVendor && !matchWork && !matchVeh && !matchItem) return false;
      }
      return true;
    });
  }, [gatePasses, statusFilter, searchQuery]);

  const filteredInwardPasses = useMemo(() => {
    return gatePasses.filter(p => {
      if (p.type !== 'inward') return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNum = p.gatePassNumber?.toLowerCase().includes(q);
        const matchVendor = p.jobWorkerName?.toLowerCase().includes(q);
        const matchOutward = p.linkedOutwardGatePassNumber?.toLowerCase().includes(q);
        const matchGrn = p.grnNumber?.toLowerCase().includes(q);
        const matchItem = p.items.some(i => i.materialName.toLowerCase().includes(q) || i.materialCode.toLowerCase().includes(q));
        if (!matchNum && !matchVendor && !matchOutward && !matchGrn && !matchItem) return false;
      }
      return true;
    });
  }, [gatePasses, searchQuery]);

  const filteredGrns = useMemo(() => {
    return grns.filter(g => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNum = g.grnNumber.toLowerCase().includes(q);
        const matchVendor = g.jobWorkerName.toLowerCase().includes(q);
        const matchOutward = g.outwardGatePassNumber.toLowerCase().includes(q);
        const matchInward = g.inwardGatePassNumber.toLowerCase().includes(q);
        const matchItem = g.items.some(i => i.materialName.toLowerCase().includes(q) || i.materialCode.toLowerCase().includes(q));
        if (!matchNum && !matchVendor && !matchOutward && !matchInward && !matchItem) return false;
      }
      return true;
    });
  }, [grns, searchQuery]);

  // Handlers for modal callbacks
  const handleGatePassCreated = (newPass: JobWorkGatePass) => {
    setGatePasses(prev => [newPass, ...prev]);
    loadData(); // reload to get updated stock balances and ledger
  };

  const handleGatePassCancelled = (updated: JobWorkGatePass) => {
    setGatePasses(prev => prev.map(p => p.id === updated.id ? updated : p));
    loadData();
  };

  const handleGatePassShortClosed = (updated: JobWorkGatePass) => {
    setGatePasses(prev => prev.map(p => p.id === updated.id ? updated : p));
    loadData();
  };

  const handleInwardReceived = (inward: JobWorkGatePass, updatedOutward: JobWorkGatePass, grn: JobWorkGRN) => {
    setGatePasses(prev => [inward, ...prev.map(p => p.id === updatedOutward.id ? updatedOutward : p)]);
    setGrns(prev => [grn, ...prev]);
    loadData();
    // Prompt to view the generated GRN
    setSelectedGrnForPrint(grn);
  };

  const handleDisputeResolved = (updatedGrn: JobWorkGRN) => {
    setGrns(prev => prev.map(g => g.id === updatedGrn.id ? updatedGrn : g));
    loadData();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Job Work & Gate Pass Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Stores / Production
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Create outward & inward gate passes, reconcile returned stock, generate auto-GRNs, and monitor vendor stock ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* ITC-04 GST Export action button */}
          <button
            type="button"
            onClick={() => setShowITC04Modal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow hover:shadow-md transition-all border border-slate-700"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>ITC-04 GST Export</span>
          </button>

          {/* Create Inward Gate Pass button */}
          <button
            type="button"
            onClick={() => {
              setSelectedGatePassForInward(null);
              setShowInwardModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow hover:shadow-md transition-all"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Create Inward Gate Pass</span>
          </button>

          {/* Create Outward Gate Pass button */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Outward Gate Pass</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Card 1: Active Passes */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{kpis.totalActiveGatePasses}</div>
            <div className="text-xs font-medium text-slate-500">Active Outward Passes</div>
          </div>
        </div>

        {/* Card 2: Materials with Vendors */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{kpis.totalStockItemsWithVendors}</div>
            <div className="text-xs font-medium text-slate-500">Materials with Vendors</div>
          </div>
        </div>

        {/* Card 3: Auto-Generated GRNs */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{grns.length}</div>
            <div className="text-xs font-medium text-slate-500">Goods Receipt Notes (GRN)</div>
          </div>
        </div>

        {/* Card 4: Disputed Charges or Overdue */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className={`p-3 rounded-xl ${totalDisputedCharges > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'}`}>
            {totalDisputedCharges > 0 ? <IndianRupee className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {totalDisputedCharges > 0 ? totalDisputedCharges : kpis.totalPendingReturns}
            </div>
            <div className="text-xs font-medium text-slate-500">
              {totalDisputedCharges > 0 ? 'Disputed Charges (Review)' : 'Pending Returns'}
            </div>
          </div>
        </div>

      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center justify-between overflow-x-auto">
        <div className="flex space-x-6">
          
          {/* Tab 1: Outward Passes */}
          <button
            type="button"
            onClick={() => setActiveTab('outward')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'outward'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Outward Gate Passes</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-bold">
              {gatePasses.filter(p => p.type === 'outward').length}
            </span>
          </button>

          {/* Tab 2: Inward Gate Passes (Returns) */}
          <button
            type="button"
            onClick={() => setActiveTab('inward')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'inward'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Inward Gate Passes</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-bold">
              {gatePasses.filter(p => p.type === 'inward').length}
            </span>
          </button>

          {/* Tab 3: Vendor Stock Ledger (New Acceptance Criteria) */}
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Vendor Stock Ledger</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 font-bold">
              Sent / Returned / Balance
            </span>
          </button>

          {/* Tab 4: GRNs (Goods Receipt Notes) */}
          <button
            type="button"
            onClick={() => setActiveTab('grns')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'grns'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Goods Receipt Notes (GRN)</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-bold">
              {grns.length}
            </span>
          </button>

          {/* Tab 5: Live Vendor Stock Balances */}
          <button
            type="button"
            onClick={() => setActiveTab('stock_balance')}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'stock_balance'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Stock with Job Workers</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-bold">
              {jobWorkerStocks.filter(s => s.quantityWithVendor > 0).length}
            </span>
          </button>

          {/* ITC-04 GST Filing Button */}
          <button
            type="button"
            onClick={() => setShowITC04Modal(true)}
            className="py-3 text-sm font-semibold border-b-2 border-transparent text-slate-600 hover:text-emerald-700 hover:border-emerald-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>ITC-04 GST Statement</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
              GST Portal
            </span>
          </button>

        </div>
      </div>

      {/* TAB 1: Outward Gate Passes */}
      {activeTab === 'outward' && (
        <div className="space-y-4">
          
          {/* Search & Status Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search GP #, vendor, material, vehicle..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              {(['all', 'issued', 'partially_returned', 'fully_returned', 'completed', 'short_closed', 'cancelled'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Gate Pass No</th>
                    <th className="px-4 py-3">Dispatched Date</th>
                    <th className="px-4 py-3">Job Worker (Vendor)</th>
                    <th className="px-4 py-3">Nature of Work</th>
                    <th className="px-4 py-3">Material(s) & Qty</th>
                    <th className="px-4 py-3">Expected Return</th>
                    <th className="px-4 py-3">Vehicle Details</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOutwardPasses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                        <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <div className="font-semibold">No Outward Gate Passes found</div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Click "Create Outward Gate Pass" to dispatch materials to an external job worker.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredOutwardPasses.map(pass => {
                      const isOverdue = pass.status !== 'completed' && pass.status !== 'cancelled' && pass.status !== 'short_closed' && pass.status !== 'fully_returned' &&
                        pass.expectedReturnDate && new Date(pass.expectedReturnDate) < new Date();

                      return (
                        <tr key={pass.id} className="hover:bg-slate-50 transition-colors">
                          
                          {/* GP Number */}
                          <td className="px-4 py-3 font-mono font-bold text-indigo-950">
                            <div>{pass.gatePassNumber}</div>
                            {pass.linkedJobWorkOrderNumber && (
                              <div className="text-[10px] text-slate-500 font-sans font-normal">
                                Ref: {pass.linkedJobWorkOrderNumber}
                              </div>
                            )}
                          </td>

                          {/* Dispatched Date */}
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            {pass.dispatchedDate}
                          </td>

                          {/* Vendor */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{pass.jobWorkerName}</div>
                            {pass.jobWorkerGst && (
                              <div className="text-[10px] text-slate-500 font-mono">GST: {pass.jobWorkerGst}</div>
                            )}
                          </td>

                          {/* Nature of Work */}
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900 block">{pass.natureOfWork}</span>
                          </td>

                          {/* Materials */}
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              {pass.items.map((it, i) => (
                                <div key={it.id || i} className="font-mono text-[11px]">
                                  <span className="font-bold text-slate-900">{it.quantity} {it.uom}</span>
                                  <span className="text-slate-600 ml-1.5">{it.materialName}</span>
                                  {(it.balanceWithVendor ?? it.quantity) < it.quantity && (
                                    <span className="text-[10px] text-emerald-600 block">
                                      Bal: {it.balanceWithVendor} {it.uom} (Ret: {it.returnedQty || 0}, Rej: {it.rejectedQty || 0})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Expected Return */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                              {pass.expectedReturnDate}
                            </div>
                            {isOverdue && (
                              <span className="text-[10px] font-bold text-rose-600 block">Overdue</span>
                            )}
                          </td>

                          {/* Vehicle Details */}
                          <td className="px-4 py-3">
                            <div className="font-mono font-semibold text-slate-900">
                              {pass.vehicleDetails.vehicleNumber || 'Hand / Direct'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                              {pass.vehicleDetails.transporterName}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                              pass.status === 'issued' 
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : pass.status === 'partially_returned'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : pass.status === 'fully_returned' || pass.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : pass.status === 'short_closed'
                                ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {pass.status.replace('_', ' ')}
                            </span>
                            {pass.materialPhysicallyLeft && pass.status === 'cancelled' && (
                              <span className="text-[10px] text-rose-600 block mt-0.5 font-medium">
                                With Vendor
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              
                              {/* Print Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedGatePassForPrint(pass)}
                                title="Print Delivery Challan (Rule 45)"
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Receive Inward Button */}
                              {(pass.status === 'issued' || pass.status === 'partially_returned') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedGatePassForInward(pass);
                                    setShowInwardModal(true);
                                  }}
                                  title="Receive Inward / Job Worker Return"
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                >
                                  <ArrowDownLeft className="w-4 h-4" />
                                </button>
                              )}

                              {/* Short-Close Button */}
                              {(pass.status === 'issued' || pass.status === 'partially_returned') && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedGatePassForShortClose(pass)}
                                  title="Short-Close (Write off scrap/burning loss)"
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                >
                                  <PackageMinus className="w-4 h-4" />
                                </button>
                              )}

                              {/* Cancel Button */}
                              {pass.status !== 'cancelled' && pass.status !== 'completed' && pass.status !== 'fully_returned' && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedGatePassForCancel(pass)}
                                  title="Cancel Gate Pass (with reason)"
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}

                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Inward Gate Passes (Returns) */}
      {activeTab === 'inward' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Inward GP #, vendor, GRN, or material..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredInwardPasses.length} Inward Receipts
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Inward GP No</th>
                  <th className="px-4 py-3">Receipt Date</th>
                  <th className="px-4 py-3">Linked Outward GP</th>
                  <th className="px-4 py-3">Generated GRN</th>
                  <th className="px-4 py-3">Job Worker</th>
                  <th className="px-4 py-3">Returned Breakdown</th>
                  <th className="px-4 py-3">Processing Charges</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInwardPasses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      <ArrowDownLeft className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <div>No Inward Gate Passes recorded yet.</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Receive items back from an Outward Gate Pass to generate an Inward Challan & GRN.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredInwardPasses.map(inward => {
                    const matchedGrn = grns.find(g => g.inwardGatePassId === inward.id || g.grnNumber === inward.grnNumber);

                    return (
                      <tr key={inward.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-emerald-900">
                          {inward.gatePassNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {inward.dispatchedDate}
                        </td>
                        <td className="px-4 py-3 font-mono text-indigo-700 font-semibold">
                          {inward.linkedOutwardGatePassNumber || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                          {inward.grnNumber ? (
                            <button
                              type="button"
                              onClick={() => matchedGrn && setSelectedGrnForPrint(matchedGrn)}
                              className="hover:underline flex items-center gap-1"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>{inward.grnNumber}</span>
                            </button>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {inward.jobWorkerName}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {inward.items.map((it, i) => (
                              <div key={i} className="text-[11px]">
                                <span className="font-bold text-emerald-800">+{it.returnedQty || it.quantity} {it.uom}</span>
                                <span className="text-slate-700 ml-1.5">{it.materialName}</span>
                                {it.rejectedQty && it.rejectedQty > 0 ? (
                                  <span className="text-rose-600 font-semibold block text-[10px]">
                                    ({it.rejectedQty} {it.uom} rejected / damaged)
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-slate-900">
                            ₹{(inward.processingCharges || 0).toLocaleString('en-IN')}
                          </div>
                          {inward.isProcessingChargeDisputed && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 block w-max mt-0.5">
                              Disputed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {matchedGrn && (
                              <button
                                type="button"
                                onClick={() => setSelectedGrnForPrint(matchedGrn)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="View Goods Receipt Note (GRN)"
                              >
                                <FileCheck className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedGatePassForPrint(inward)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Print Inward Challan"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Vendor Stock Ledger (Sent, Returned, Balance) */}
      {activeTab === 'ledger' && (
        <VendorStockLedgerView
          stocks={jobWorkerStocks}
          ledgerTransactions={ledgerTransactions}
          gatePasses={gatePasses}
          onReceiveReturn={(gp) => {
            setSelectedGatePassForInward(gp);
            setShowInwardModal(true);
          }}
          onViewGatePass={(gp) => setSelectedGatePassForPrint(gp)}
        />
      )}

      {/* TAB 4: Goods Receipt Notes (GRN) */}
      {activeTab === 'grns' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search GRN #, vendor, gate pass..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredGrns.length} GRNs
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">GRN No</th>
                  <th className="px-4 py-3">Receipt Date</th>
                  <th className="px-4 py-3">Inward GP</th>
                  <th className="px-4 py-3">Outward GP</th>
                  <th className="px-4 py-3">Job Worker</th>
                  <th className="px-4 py-3 text-right">Processed (Good)</th>
                  <th className="px-4 py-3 text-right">Rejected</th>
                  <th className="px-4 py-3">Processing Charges</th>
                  <th className="px-4 py-3 text-center">Audit Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredGrns.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      <FileCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <div>No Goods Receipt Notes generated yet.</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        GRNs are auto-generated when an Inward Gate Pass is recorded against an Outward pass.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredGrns.map(g => (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-900">
                        {g.grnNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {g.receiptDate}
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-700">
                        {g.inwardGatePassNumber}
                      </td>
                      <td className="px-4 py-3 font-mono text-indigo-700 font-semibold">
                        {g.outwardGatePassNumber}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {g.jobWorkerName}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                        +{g.totalProcessedQty}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-700">
                        {g.totalRejectedQty > 0 ? g.totalRejectedQty : '0'}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        ₹{g.processingCharges.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          g.isProcessingChargeDisputed && g.disputeStatus === 'disputed'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : g.disputeStatus === 'approved' || g.disputeStatus === 'settled'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {g.isProcessingChargeDisputed && g.disputeStatus === 'disputed'
                            ? '⚠️ Disputed'
                            : g.disputeStatus === 'approved'
                            ? 'Approved'
                            : g.disputeStatus === 'settled'
                            ? 'Settled'
                            : 'Cleared'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {g.isProcessingChargeDisputed && g.disputeStatus === 'disputed' && (
                            <button
                              type="button"
                              onClick={() => setSelectedGrnForDispute(g)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-sm"
                              title="Review & Settle Dispute"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedGrnForPrint(g)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Print GRN"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Stock at Job Workers (Live Table) */}
      {activeTab === 'stock_balance' && (
        <JobWorkerStockTable
          stocks={jobWorkerStocks}
          gatePasses={gatePasses}
          onReceiveInward={(gp) => {
            setSelectedGatePassForInward(gp);
            setShowInwardModal(true);
          }}
          onViewGatePass={(gp) => setSelectedGatePassForPrint(gp)}
        />
      )}

      {/* MODALS */}
      <CreateOutwardGatePassModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleGatePassCreated}
        stockItems={stockItems}
      />

      <PrintableGatePassModal
        isOpen={!!selectedGatePassForPrint}
        onClose={() => setSelectedGatePassForPrint(null)}
        gatePass={selectedGatePassForPrint}
      />

      <CancelGatePassModal
        isOpen={!!selectedGatePassForCancel}
        onClose={() => setSelectedGatePassForCancel(null)}
        gatePass={selectedGatePassForCancel}
        onCancelled={handleGatePassCancelled}
      />

      <ShortCloseGatePassModal
        isOpen={!!selectedGatePassForShortClose}
        onClose={() => setSelectedGatePassForShortClose(null)}
        gatePass={selectedGatePassForShortClose}
        onShortClosed={handleGatePassShortClosed}
      />

      <ReceiveInwardGatePassModal
        isOpen={showInwardModal || !!selectedGatePassForInward}
        onClose={() => {
          setShowInwardModal(false);
          setSelectedGatePassForInward(null);
        }}
        gatePass={selectedGatePassForInward}
        availableOutwardPasses={gatePasses.filter(p => p.type === 'outward' && (p.status === 'issued' || p.status === 'partially_returned'))}
        onInwardCreated={handleInwardReceived}
      />

      <PrintableGrnModal
        isOpen={!!selectedGrnForPrint}
        onClose={() => setSelectedGrnForPrint(null)}
        grn={selectedGrnForPrint}
      />

      <FinanceDisputeModal
        isOpen={!!selectedGrnForDispute}
        onClose={() => setSelectedGrnForDispute(null)}
        grn={selectedGrnForDispute}
        onResolved={handleDisputeResolved}
      />

      <ITC04ExportModal
        isOpen={showITC04Modal}
        onClose={() => setShowITC04Modal(false)}
        gatePasses={gatePasses}
        grns={grns}
        onGatePassUpdated={loadData}
      />

    </div>
  );
};
