// src/pages/dispatch/DispatchListPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePaginatedCollectionQuery } from '../../hooks/usePaginatedCollectionQuery';
import { DispatchCreateForm } from './DispatchCreateForm';
import { FilterBar } from '../../components/FilterBar';
import { ExportButton } from '../../components/ExportButton';
import { db } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  Plus, 
  ChevronRight, 
  AlertCircle,
  Calendar,
  ClipboardList,
  Truck,
  ShieldCheck,
  AlertOctagon,
  Boxes,
  Receipt
} from 'lucide-react';
import { Order, Backorder, Dispatch } from '../../types';
import { DispatchReleaseGateBadge } from '../../components/fqc/DispatchReleaseGateBadge';
import { qualityHoldService } from '../../services/qualityHoldService';
import { getBackordersSync } from '../../services/partialDispatchService';
import { GeneratePartialInvoiceModal } from '../../components/dispatch/GeneratePartialInvoiceModal';

export const DispatchListPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  
  // Dynamic filter state conforming to FilterBar
  const [filters, setFilters] = useState<Record<string, any>>({
    search: '',
    status: 'all',
    startDate: '',
    endDate: ''
  });

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  // Translate filters.status 'all' into undefined for exact matching
  const queryFilters = {
    search: filters.search,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    status: filters.status && filters.status !== 'all' ? filters.status : undefined
  };

  // Cursor-based Firestore chunk loading
  const {
    data: dispatches,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    reset
  } = usePaginatedCollectionQuery<any>(
    tenant?.id ? `tenants/${tenant.id}/dispatches` : 'dispatches',
    {
      filters: queryFilters,
      pageSize: 8,
      sortField: 'dispatchedAt',
      sortDirection: 'desc',
      isSandbox,
      localBackupKey: `dispatches_${tenant?.id}`
    }
  );

  const location = useLocation();
  const routeState = location.state as { 
    preselectedOrderForDispatch?: Order;
    sourceBackorderId?: string;
    sourceBackorderNumber?: string;
  } | null;

  const [sourceBackorderId, setSourceBackorderId] = useState<string | undefined>();
  const [sourceBackorderNumber, setSourceBackorderNumber] = useState<string | undefined>();

  useEffect(() => {
    if (routeState?.preselectedOrderForDispatch) {
      setPreselectedOrder(routeState.preselectedOrderForDispatch);
      setSourceBackorderId(routeState.sourceBackorderId);
      setSourceBackorderNumber(routeState.sourceBackorderNumber);
      setIsCreateOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [routeState]);
  
  // Available orders for new dispatch creation
  const [orders, setOrders] = useState<Order[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [preselectedOrder, setPreselectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<'dispatches' | 'backorders'>('dispatches');
  const [backordersList, setBackordersList] = useState<Backorder[]>([]);

  // Partial Invoicing Modal state
  const [invoicingDispatch, setInvoicingDispatch] = useState<Dispatch | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Load orders & backorders for dispatch dropdown selection
  useEffect(() => {
    if (!tenant?.id) return;

    const loadOrdersData = async () => {
      if (isSandbox) {
        const cached = localStorage.getItem(`orders_${tenant.id}`) || '[]';
        setOrders(JSON.parse(cached));
      } else {
        const q = query(collection(db, 'orders'), where('tenantId', '==', tenant.id));
        const snap = await getDocs(q);
        const list: Order[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as Order));
        setOrders(list);
      }
    };
    loadOrdersData();

    // Load backorders
    const bos = getBackordersSync(tenant.id);
    setBackordersList(bos);
  }, [tenant?.id, isCreateOpen]);

  const getStatusBadge = (st: string) => {
    switch (st?.toLowerCase()) {
      case 'planned': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'partially dispatched':
      case 'partially-dispatched':
      case 'partial': return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
      case 'dispatched':
      case 'shipped': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled': return 'bg-rose-100 text-rose-800 border-rose-250';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const handleOpenCreateNew = () => {
    setPreselectedOrder(null);
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-6 font-sans select-none">
      
      {/* Top action header desk */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
            Outward transit logistics
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block mt-1.5">
            Logistics & Freight Dispatches
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track outbound carrier dispatches, monitor Lorry Receipt (LR) tracking, publish invoice updates, and verify delivery completions.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
          <ExportButton
            data={dispatches}
            filenamePrefix="dispatches_master"
            headersMap={{
              dispatchNumber: 'Dispatch No / Invoice',
              orderId: 'Order ID',
              customerName: 'Consignee',
              dispatchDate: 'Departure Date',
              transporter: 'Transporter/Carrier',
              lrNumber: 'Lorry Receipt No (LR)',
              driverName: 'Driver Name',
              driverPhone: 'Driver Phone',
              vehicleNumber: 'Vehicle Number',
              itemsSummary: 'Cargo Description',
              status: 'Logistics Status'
            }}
            label="Export CSV"
          />
          <button
            onClick={() => navigate('/fqc')}
            className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[10px] uppercase font-bold tracking-wider px-3 py-2.5 rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Inspect final quality checklist and release certificates"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>FQC Desk</span>
          </button>
          <button
            onClick={() => navigate('/quality-holds')}
            className="bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-900/60 font-mono text-[10px] uppercase font-bold tracking-wider px-3 py-2.5 rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Manage batch/WO quality holds and release gates"
          >
            <AlertOctagon className="h-4 w-4 text-rose-400" />
            <span>Quality Holds</span>
          </button>
          <button
            onClick={handleOpenCreateNew}
            className="bg-indigo-650 hover:bg-indigo-700 text-white font-mono text-[10px] uppercase font-extrabold tracking-widest px-4 py-2.5 rounded-lg flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="h-4 w-4 text-indigo-200" />
            <span>New dispatch cargo</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs: Dispatches vs Backorders */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('dispatches')}
          className={`font-mono text-xs uppercase font-bold tracking-wider px-3.5 py-2 rounded-lg flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === 'dispatches'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          <span>Outward Dispatches ({dispatches.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backorders')}
          className={`font-mono text-xs uppercase font-bold tracking-wider px-3.5 py-2 rounded-lg flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === 'backorders'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Boxes className="h-3.5 w-3.5" />
          <span>Follow-on Backorders ({backordersList.length})</span>
          {backordersList.some(b => b.reviewFlagged || b.status === 'review_required') && (
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" title="Review required on backorder" />
          )}
        </button>
      </div>

      {activeTab === 'dispatches' && (
        <FilterBar
          entityType="dispatches"
          tenantId={tenant?.id || 'demo'}
          filters={filters}
          onFilterChange={(updated) => setFilters(updated)}
          onClearFilters={() => setFilters({
            search: '',
            status: 'all',
            startDate: '',
            endDate: ''
          })}
          searchPlaceholder="Search dispatch items, invoice references, transporters or carrier names..."
          statusOptions={[
            { label: 'All Dispatches', value: 'all' },
            { label: 'Planned / Loaded', value: 'planned' },
            { label: 'Dispatched / Shipped', value: 'dispatched' },
            { label: 'Delivered', value: 'delivered' },
            { label: 'Cancelled', value: 'cancelled' }
          ]}
        />
      )}

      {/* Main visual Table of lists */}
      {activeTab === 'dispatches' && (
        loading ? (
        <div className="text-center py-20 bg-white border border-slate-20o rounded-xl space-y-4">
          <div className="animate-spin h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-[11px] text-slate-450 font-mono uppercase tracking-widest">Constructing logs manifest table...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-slate-20o p-12 text-center text-xs text-rose-800 font-mono rounded-xl max-w-lg mx-auto">
          Unable to bind collection: {error}
        </div>
      ) : dispatches.length > 0 ? (
        <div className="space-y-4">
          
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-150 text-slate-450 font-mono uppercase tracking-widest text-[9px] select-none">
                <tr>
                  <th className="p-3.5 pl-5 font-bold">Dispatch No</th>
                  <th className="p-3.5 font-bold">Order Reference</th>
                  <th className="p-3.5 font-bold">Client Consignee</th>
                  <th className="p-3.5 font-bold">Departure Date</th>
                  <th className="p-3.5 font-bold font-sans">Transporter / LR</th>
                  <th className="p-3.5 font-bold">Cargo Summary</th>
                  <th className="p-3.5 font-bold font-sans">FQC Release Gate</th>
                  <th className="p-3.5 text-center font-bold">Status</th>
                  <th className="p-3.5 pr-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans text-slate-705">
                {dispatches.map(disp => (
                  <tr key={disp.id} className="hover:bg-slate-50/50 transition">
                    
                    {/* Dispatch No */}
                    <td className="p-3.5 pl-5">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900">{disp.dispatchNumber || disp.invoiceNumber}</span>
                        {disp.isPartialDispatch && (
                          <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded uppercase">
                            Partial
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-405 block font-mono">Ref: {disp.id}</span>
                    </td>

                    {/* Order Reference */}
                    <td className="p-3.5 font-mono font-semibold text-indigo-650">
                      {disp.orderId}
                    </td>

                    {/* Client Consignee */}
                    <td className="p-3.5 truncate max-w-[150px]">
                      <span className="font-bold text-slate-805 block">{disp.customerName || 'B2B Procurement'}</span>
                    </td>

                    {/* Departure Date */}
                    <td className="p-3.5 font-mono text-slate-655">
                      {disp.dispatchDate ? new Date(disp.dispatchDate).toLocaleDateString() : new Date(disp.dispatchedAt).toLocaleDateString()}
                    </td>

                    {/* Transporter / LR */}
                    <td className="p-3.5 font-mono max-w-[180px] truncate">
                      <span className="block font-semibold text-slate-707 font-sans">{disp.transporter}</span>
                      <span className="text-[10px] text-slate-450 block">LR: {disp.lrNumber || disp.LRNumber || 'N/A'}</span>
                    </td>

                    {/* Cargo Summary */}
                    <td className="p-3.5 text-slate-502 font-mono text-[10px] max-w-[160px] truncate">
                      {disp.itemsSummary || 'Standard components'}
                    </td>

                    {/* Quality Release Gate & Holds Status */}
                    <td className="p-3.5">
                      {(() => {
                        const holdCheck = qualityHoldService.checkDispatchBlock(disp.orderId);
                        if (holdCheck.isBlocked) {
                          const topHold = holdCheck.blockingHolds[0];
                          return (
                            <span
                              onClick={() => navigate('/quality-holds')}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer hover:bg-rose-200 transition"
                              title={`Quality Hold Active [${topHold.id}]: ${topHold.holdReason}`}
                            >
                              <AlertOctagon className="w-3 h-3 text-rose-600 animate-pulse" />
                              <span>HOLD BLOCKED</span>
                            </span>
                          );
                        }
                        return <DispatchReleaseGateBadge orderIdOrNumber={disp.orderId} />;
                      })()}
                    </td>

                    {/* Status badge */}
                    <td className="p-3.5 text-center shrink-0">
                      <span className={`px-2.5 py-0.5 font-mono uppercase text-[9px] tracking-wider rounded-full border ${getStatusBadge(disp.status)}`}>
                        {disp.status}
                      </span>
                    </td>

                    {/* Action trigger buttons */}
                    <td className="p-3.5 pr-5 text-right select-none">
                      <div className="flex items-center justify-end space-x-2">
                        {disp.status !== 'Cancelled' && (
                          disp.isInvoiced ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/payments');
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-[9px] font-mono font-bold uppercase cursor-pointer transition"
                              title={`Invoiced (${disp.invoiceNumber || disp.invoiceId}). Click to view in Payments.`}
                            >
                              <Receipt className="h-3 w-3 text-emerald-600" />
                              <span>Invoiced</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInvoicingDispatch(disp);
                                setShowInvoiceModal(true);
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-mono font-bold uppercase shadow-2xs transition cursor-pointer"
                              title="Generate GST Tax Invoice for only the quantity dispatched"
                            >
                              <Receipt className="h-3 w-3" />
                              <span>Generate Invoice</span>
                            </button>
                          )
                        )}

                        <button
                          onClick={() => navigate(`/dispatch/${disp.id}`)}
                          className="p-1 px-2.5 border border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-655 hover:bg-indigo-50/20 transition cursor-pointer font-mono font-bold uppercase text-[9px]"
                        >
                          Details
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE RESPONSIVE LIST VIEW */}
          <div className="md:hidden bg-white border rounded-xl divide-y divide-slate-100 overflow-hidden">
            {dispatches.map(disp => (
              <div 
                key={disp.id} 
                className="p-4 space-y-3.5"
                onClick={() => navigate(`/dispatch/${disp.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-905">{disp.dispatchNumber || disp.invoiceNumber}</h4>
                    <span className="text-[10px] font-mono text-slate-400">Order: {disp.orderId}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-mono uppercase text-[9px] border ${getStatusBadge(disp.status)}`}>
                    {disp.status}
                  </span>
                </div>

                <div className="text-xs space-y-1 font-mono text-slate-605">
                  <p><span className="text-slate-400 font-sans block text-[9px] uppercase">Consignee</span> {disp.customerName || 'B2B Client'}</p>
                  <p><span className="text-slate-400 font-sans block text-[9px] uppercase">Carrier</span> {disp.transporter} (LR: {disp.lrNumber || disp.LRNumber || 'N/A'})</p>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-405 pt-2 border-t">
                  <span>Date: {disp.dispatchDate || new Date(disp.dispatchedAt).toLocaleDateString()}</span>
                  <div className="flex items-center space-x-2">
                    {disp.status !== 'Cancelled' && (
                      disp.isInvoiced ? (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Invoiced
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInvoicingDispatch(disp);
                            setShowInvoiceModal(true);
                          }}
                          className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-bold uppercase"
                        >
                          Generate Invoice
                        </button>
                      )
                    )}
                    <span className="text-indigo-650 font-bold flex items-center">
                      Review <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More Controller */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-mono text-[10.5px] uppercase font-bold tracking-wider rounded-xl transition-all shadow-xs shrink-0 flex items-center space-x-2 disabled:cursor-not-allowed cursor-pointer"
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Syncing Next segment...</span>
                  </>
                ) : (
                  <span>Load More Dispatches</span>
                )}
              </button>
            </div>
          )}

        </div>
      ) : (
        <div className="bg-white border text-center p-12 space-y-4 rounded-xl max-w-2xl mx-auto">
          <div className="p-4 bg-sky-50 text-sky-550 rounded-full inline-block">
            <ClipboardList className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-slate-805">No Outward Logistics Records Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You do not have any transport dispatches issued with your chosen parameter filters. Let's create a new shipping log!
          </p>
          <button
            onClick={handleOpenCreateNew}
            className="px-4 py-2.5 bg-slate-900 border border-slate-900 text-white font-mono text-[10px] font-extrabold uppercase tracking-widest hover:bg-slate-800 transition-all rounded-lg cursor-pointer"
          >
            Create Disp Slip
          </button>
        </div>
      ))}

      {/* Backorders View */}
      {activeTab === 'backorders' && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Boxes className="h-4 w-4 text-amber-600" />
                <h3 className="font-mono font-bold text-slate-900 uppercase tracking-wider">
                  Follow-on Backorders & Remaining Balances
                </h3>
              </div>
              <p className="text-slate-600 font-sans max-w-2xl">
                When order lines are partially fulfilled, remaining quantities are automatically isolated into locked Backorders. 
                Original pricing, tax rates, and customer delivery terms are snapshotted to maintain strict audit integrity.
              </p>
            </div>
            <div className="text-[11px] font-mono text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300 font-bold shrink-0">
              Total Active: {backordersList.filter(b => b.status === 'open').length} Open
            </div>
          </div>

          {backordersList.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-400 font-mono uppercase tracking-widest text-[9px] select-none">
                    <tr>
                      <th className="p-3.5 pl-5 font-bold">Backorder #</th>
                      <th className="p-3.5 font-bold">Parent Order</th>
                      <th className="p-3.5 font-bold">Customer / Consignee</th>
                      <th className="p-3.5 font-bold">Unfulfilled Balance</th>
                      <th className="p-3.5 font-bold">Locked Line Items Snapshot</th>
                      <th className="p-3.5 font-bold">Target Date</th>
                      <th className="p-3.5 text-center font-bold">Status</th>
                      <th className="p-3.5 pr-5 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                    {backordersList.map(bo => {
                      const matchedOrder = orders.find(o => o.id === bo.orderId || o.orderNumber === bo.orderNumber);

                      return (
                        <tr key={bo.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3.5 pl-5">
                            <span className="font-bold font-mono text-slate-900">{bo.backorderNumber}</span>
                            <span className="text-[9px] text-slate-400 block font-mono">ID: {bo.id}</span>
                          </td>

                          <td className="p-3.5 font-mono font-semibold text-indigo-600">
                            {bo.orderNumber}
                          </td>

                          <td className="p-3.5">
                            <span className="font-bold text-slate-800 block">{bo.customerName}</span>
                          </td>

                          <td className="p-3.5 font-mono">
                            <span className="px-2 py-0.5 rounded font-extrabold text-[11px] bg-amber-50 text-amber-800 border border-amber-200">
                              {bo.totalRemainingQty} units
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-600 font-mono text-[10px] max-w-[220px]">
                            {bo.items && bo.items.map(it => (
                              <div key={it.lineItemId} className="truncate">
                                • {it.name}: <strong>{it.remainingQty ?? it.backorderQty}</strong> remaining @ ₹{it.unitPrice.toLocaleString('en-IN')}
                              </div>
                            ))}
                          </td>

                          <td className="p-3.5 font-mono text-slate-500">
                            {bo.deliveryDate ? new Date(bo.deliveryDate).toLocaleDateString() : 'Pending'}
                          </td>

                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-0.5 font-mono uppercase text-[9px] tracking-wider rounded-full border ${
                              bo.reviewFlagged || bo.status === 'review_required'
                                ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                                : bo.status === 'open'
                                ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}>
                              {bo.status === 'review_required' ? 'Review Required' : bo.status}
                            </span>
                            {(bo.reviewReason || bo.statusReason) && (
                              <span className="text-[8.5px] font-mono text-rose-600 block mt-0.5 max-w-[130px] mx-auto truncate" title={bo.reviewReason || bo.statusReason}>
                                {bo.reviewReason || bo.statusReason}
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 pr-5 text-right">
                            {bo.status !== 'fulfilled' && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (matchedOrder) {
                                    setPreselectedOrder(matchedOrder);
                                    setIsCreateOpen(true);
                                  } else {
                                    const fallbackOrd: Order = {
                                      id: bo.orderId || bo.originalOrderId,
                                      tenantId: bo.tenantId,
                                      quoteId: 'Q-BACKORDER',
                                      orderNumber: bo.orderNumber || bo.originalOrderNumber,
                                      customerName: bo.customerName,
                                      phone: '',
                                      totalAmount: bo.items.reduce((s, it) => s + (it.unitPrice * (it.remainingQty ?? it.backorderQty)), 0),
                                      deliveryDate: bo.deliveryDate || new Date().toISOString(),
                                      status: 'Partially Dispatched',
                                      createdBy: 'dispatch',
                                      items: bo.items.map(it => {
                                        const rem = it.remainingQty ?? it.backorderQty;
                                        return {
                                          id: it.lineItemId,
                                          name: it.name,
                                          quantity: it.originalOrderedQty,
                                          unitPrice: it.unitPrice,
                                          total: it.unitPrice * rem,
                                          gstPercent: 18,
                                          specs: it.specs,
                                          orderedQty: it.originalOrderedQty,
                                          dispatchedQty: it.originalOrderedQty - rem,
                                          remainingQty: rem,
                                          dispatchStatus: 'partially-dispatched'
                                        };
                                      }),
                                      createdAt: bo.createdAt
                                    };
                                    setPreselectedOrder(fallbackOrd);
                                    setIsCreateOpen(true);
                                  }
                                }}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[9px] uppercase font-bold tracking-wider px-2.5 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
                              >
                                Dispatch Remaining →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border text-center p-12 space-y-4 rounded-xl max-w-2xl mx-auto">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-full inline-block">
                <Boxes className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-slate-800">No Active Backorders</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All manufacturing purchase orders are currently either fully fulfilled or awaiting their initial dispatch run.
              </p>
            </div>
          )}
        </div>
      )}

      {/* DISPATCH CREATE SIDE FORM OVERLAY MODAL */}
      <DispatchCreateForm
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setSourceBackorderId(undefined);
          setSourceBackorderNumber(undefined);
        }}
        availableOrders={orders}
        preselectedOrder={preselectedOrder}
        sourceBackorderId={sourceBackorderId}
        sourceBackorderNumber={sourceBackorderNumber}
        onSuccess={() => {
          setIsCreateOpen(false);
          setSourceBackorderId(undefined);
          setSourceBackorderNumber(undefined);
          reset();
        }}
      />

      {/* PARTIAL INVOICE GENERATION MODAL */}
      {showInvoiceModal && invoicingDispatch && (
        <GeneratePartialInvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setInvoicingDispatch(null);
          }}
          dispatch={invoicingDispatch}
          onSuccess={() => {
            reset();
          }}
        />
      )}

    </div>
  );
};
