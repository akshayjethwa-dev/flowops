// src/components/job-work/VendorStockLedgerView.tsx

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowDownLeft, 
  Truck, 
  Boxes, 
  FileSpreadsheet, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  Download
} from 'lucide-react';
import { 
  JobWorkerStockBalance, 
  VendorStockLedgerTransaction, 
  JobWorkGatePass 
} from '../../types/jobWork';
import * as XLSX from 'xlsx';

interface VendorStockLedgerViewProps {
  stocks: JobWorkerStockBalance[];
  ledgerTransactions: VendorStockLedgerTransaction[];
  gatePasses: JobWorkGatePass[];
  onReceiveReturn?: (gatePass: JobWorkGatePass) => void;
  onViewGatePass?: (gatePass: JobWorkGatePass) => void;
}

export const VendorStockLedgerView: React.FC<VendorStockLedgerViewProps> = ({
  stocks,
  ledgerTransactions,
  gatePasses,
  onReceiveReturn,
  onViewGatePass
}) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'balance_summary' | 'detailed_transactions'>('balance_summary');

  // List of unique vendors
  const vendorOptions = useMemo(() => {
    const map = new Map<string, string>();
    stocks.forEach(s => map.set(s.vendorId, s.vendorName));
    ledgerTransactions.forEach(t => map.set(t.vendorId, t.vendorName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [stocks, ledgerTransactions]);

  // Filtered Stock Balances
  const filteredBalances = useMemo(() => {
    return stocks.filter(s => {
      if (selectedVendorId !== 'all' && s.vendorId !== selectedVendorId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const mVendor = s.vendorName.toLowerCase().includes(q);
        const mMat = s.materialName.toLowerCase().includes(q);
        const mCode = s.materialCode.toLowerCase().includes(q);
        if (!mVendor && !mMat && !mCode) return false;
      }
      return true;
    });
  }, [stocks, selectedVendorId, searchQuery]);

  // Filtered Ledger Transactions
  const filteredTransactions = useMemo(() => {
    return ledgerTransactions.filter(t => {
      if (selectedVendorId !== 'all' && t.vendorId !== selectedVendorId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const mVendor = t.vendorName.toLowerCase().includes(q);
        const mMat = t.materialName.toLowerCase().includes(q);
        const mCode = t.materialCode.toLowerCase().includes(q);
        const mRef = t.refNumber.toLowerCase().includes(q);
        if (!mVendor && !mMat && !mCode && !mRef) return false;
      }
      return true;
    });
  }, [ledgerTransactions, selectedVendorId, searchQuery]);

  // High-level aggregates
  const aggregates = useMemo(() => {
    const totalSent = filteredBalances.reduce((acc, s) => acc + (s.totalOutwardQty || 0), 0);
    const totalReturned = filteredBalances.reduce((acc, s) => acc + (s.totalReturnedQty || 0), 0);
    const totalRejected = filteredBalances.reduce((acc, s) => acc + (s.totalRejectedQty || 0), 0);
    const totalBalance = filteredBalances.reduce((acc, s) => acc + (s.quantityWithVendor || 0), 0);

    return { totalSent, totalReturned, totalRejected, totalBalance };
  }, [filteredBalances]);

  // Export to Excel function
  const handleExportExcel = () => {
    const exportData = filteredBalances.map(s => ({
      'Job Worker (Vendor)': s.vendorName,
      'Material Code': s.materialCode,
      'Material Description': s.materialName,
      'UOM': s.uom,
      'Sent Qty (Outward)': s.totalOutwardQty,
      'Returned Qty (Processed)': s.totalReturnedQty,
      'Rejected Qty': s.totalRejectedQty,
      'Balance Qty With Vendor': s.quantityWithVendor,
      'Last Gate Pass': s.lastGatePassNumber,
      'Last Dispatched Date': s.lastDispatchedDate,
      'Expected Return': s.expectedReturnDate || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendor Stock Ledger');
    XLSX.writeFile(workbook, `Vendor_Stock_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Vendor Dropdown */}
          <div className="w-full sm:w-64">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Filter by Job Worker
            </label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full text-xs font-semibold rounded-lg border-slate-300 py-1.5 px-2.5 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Vendors ({vendorOptions.length})</option>
              {vendorOptions.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-72">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Search Material / Code / Ref
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search material or code..."
                className="w-full text-xs pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* View Switcher & Export */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs">
            <button
              type="button"
              onClick={() => setActiveSubTab('balance_summary')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeSubTab === 'balance_summary'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vendor Material Balances
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('detailed_transactions')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeSubTab === 'detailed_transactions'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chronological Ledger Log
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
            title="Export Ledger to Excel"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Dispatched (Sent Qty)
          </span>
          <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
            {aggregates.totalSent.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500">Cumulative sent to job workers</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
            Total Returned (Processed Qty)
          </span>
          <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
            {aggregates.totalReturned.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600">Restored into Usable Own Stock</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
            Total Rejected (Damaged Qty)
          </span>
          <div className="text-xl font-black text-rose-700 font-mono mt-0.5">
            {aggregates.totalRejected.toLocaleString()}
          </div>
          <span className="text-[11px] text-rose-600">Quarantine / Defect Tracking</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
            Balance Qty With Vendors
          </span>
          <div className="text-xl font-black text-amber-700 font-mono mt-0.5">
            {aggregates.totalBalance.toLocaleString()}
          </div>
          <span className="text-[11px] text-amber-700 font-semibold">Active Subcontracted Stock</span>
        </div>
      </div>

      {/* SUB-TAB 1: Vendor Material Balance Table (Sent, Returned, Balance) */}
      {activeSubTab === 'balance_summary' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Vendor Stock Ledger — Material Balances
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredBalances.length} Material Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Job Worker (Vendor)</th>
                  <th className="px-4 py-3">Material Code & Name</th>
                  <th className="px-4 py-3 text-center">UOM</th>
                  <th className="px-4 py-3 text-right">Sent Qty</th>
                  <th className="px-4 py-3 text-right text-emerald-800">Returned Qty</th>
                  <th className="px-4 py-3 text-right text-rose-800">Rejected Qty</th>
                  <th className="px-4 py-3 text-right text-indigo-950 bg-indigo-50/50">Balance Qty with Vendor</th>
                  <th className="px-4 py-3">Last Dispatched GP</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                      <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <div className="font-semibold">No vendor stock balance records found</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Dispatch materials via Outward Gate Pass to establish vendor ledger balances.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map(stock => {
                    const isReconciled = stock.quantityWithVendor <= 0.0001;
                    
                    // Match any open outward gate pass for this vendor & material
                    const openPass = gatePasses.find(p => 
                      p.type === 'outward' && 
                      p.jobWorkerId === stock.vendorId && 
                      (p.status === 'issued' || p.status === 'partially_returned') &&
                      p.items.some(i => i.materialCode === stock.materialCode || i.materialId === stock.materialId)
                    );

                    return (
                      <tr key={stock.id} className="hover:bg-slate-50 transition-colors">
                        
                        {/* Vendor Name */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{stock.vendorName}</div>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {stock.vendorId}</span>
                        </td>

                        {/* Material */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{stock.materialName}</div>
                          <div className="text-[10px] font-mono text-slate-500">{stock.materialCode}</div>
                        </td>

                        {/* UOM */}
                        <td className="px-4 py-3 text-center font-mono text-slate-600">
                          {stock.uom}
                        </td>

                        {/* Sent Qty */}
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">
                          {stock.totalOutwardQty.toLocaleString()}
                        </td>

                        {/* Returned Qty */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                          {stock.totalReturnedQty.toLocaleString()}
                        </td>

                        {/* Rejected Qty */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-700">
                          {stock.totalRejectedQty > 0 ? stock.totalRejectedQty.toLocaleString() : '0'}
                        </td>

                        {/* Balance Qty with Vendor */}
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-950 bg-indigo-50/40">
                          {isReconciled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              0 (Reconciled)
                            </span>
                          ) : (
                            <span className="text-sm text-indigo-950">
                              {stock.quantityWithVendor.toLocaleString()} {stock.uom}
                            </span>
                          )}
                        </td>

                        {/* Last Gate Pass */}
                        <td className="px-4 py-3 font-mono text-slate-600">
                          <div className="font-bold text-slate-800">{stock.lastGatePassNumber}</div>
                          <div className="text-[10px] text-slate-400">{stock.lastDispatchedDate}</div>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {!isReconciled && openPass && onReceiveReturn && (
                            <button
                              type="button"
                              onClick={() => onReceiveReturn(openPass)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm inline-flex items-center gap-1 transition-colors"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>Receive</span>
                            </button>
                          )}
                          {isReconciled && (
                            <span className="text-[11px] text-slate-400 italic">Fully Closed</span>
                          )}
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

      {/* SUB-TAB 2: Chronological Transaction Ledger Log */}
      {activeSubTab === 'detailed_transactions' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Vendor Stock Ledger — Transaction Journal
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredTransactions.length} Audit Entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Timestamp / Date</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Transaction Type</th>
                  <th className="px-4 py-3">Ref Document</th>
                  <th className="px-4 py-3 text-right text-indigo-900">Sent Qty (+)</th>
                  <th className="px-4 py-3 text-right text-emerald-800">Returned (-)</th>
                  <th className="px-4 py-3 text-right text-rose-800">Rejected (-)</th>
                  <th className="px-4 py-3 text-right text-slate-950 bg-slate-200/50">Balance Qty</th>
                  <th className="px-4 py-3">Remarks & User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500 font-sans">
                      No transaction entries recorded for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      
                      {/* Date */}
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-3 font-sans font-bold text-slate-900">
                        {tx.vendorName}
                      </td>

                      {/* Material */}
                      <td className="px-4 py-3">
                        <span className="font-sans font-semibold text-slate-900 block">{tx.materialName}</span>
                        <span className="text-[10px] text-slate-500">{tx.materialCode}</span>
                      </td>

                      {/* Transaction Type */}
                      <td className="px-4 py-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          tx.transactionType === 'outward_dispatch'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : tx.transactionType === 'inward_processed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : tx.transactionType === 'inward_rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {tx.transactionType.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Ref Document */}
                      <td className="px-4 py-3 font-bold text-indigo-950">
                        {tx.refNumber}
                      </td>

                      {/* Sent Qty */}
                      <td className="px-4 py-3 text-right text-indigo-700 font-bold">
                        {tx.sentQty > 0 ? `+${tx.sentQty} ${tx.uom}` : '—'}
                      </td>

                      {/* Returned Qty */}
                      <td className="px-4 py-3 text-right text-emerald-700 font-bold">
                        {tx.returnedQty > 0 ? `-${tx.returnedQty} ${tx.uom}` : '—'}
                      </td>

                      {/* Rejected Qty */}
                      <td className="px-4 py-3 text-right text-rose-700 font-bold">
                        {tx.rejectedQty > 0 ? `-${tx.rejectedQty} ${tx.uom}` : '—'}
                      </td>

                      {/* Balance Qty */}
                      <td className="px-4 py-3 text-right font-black text-slate-950 bg-slate-100/60">
                        {tx.balanceQty} {tx.uom}
                      </td>

                      {/* Remarks & User */}
                      <td className="px-4 py-3 font-sans text-[11px] text-slate-600 max-w-xs truncate">
                        <div>{tx.remarks || 'Standard transaction'}</div>
                        <span className="text-[10px] text-slate-400">By: {tx.performedByName}</span>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
