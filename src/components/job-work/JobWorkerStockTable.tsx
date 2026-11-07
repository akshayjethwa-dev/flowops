// src/components/job-work/JobWorkerStockTable.tsx

import React, { useState } from 'react';
import { 
  Building2, 
  Package, 
  Calendar, 
  AlertCircle, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  Clock, 
  ExternalLink,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { JobWorkerStockBalance, JobWorkGatePass } from '../../types/jobWork';

interface JobWorkerStockTableProps {
  stocks: JobWorkerStockBalance[];
  gatePasses: JobWorkGatePass[];
  onReceiveInward: (gatePass: JobWorkGatePass) => void;
  onViewGatePass: (gatePass: JobWorkGatePass) => void;
}

export const JobWorkerStockTable: React.FC<JobWorkerStockTableProps> = ({
  stocks,
  gatePasses,
  onReceiveInward,
  onViewGatePass
}) => {
  const [search, setSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [showOnlyWithBalance, setShowOnlyWithBalance] = useState(true);

  // Extract unique vendors
  const vendors = Array.from(new Set(stocks.map(s => s.vendorName))).sort();

  const filteredStocks = stocks.filter(s => {
    if (showOnlyWithBalance && s.quantityWithVendor <= 0) return false;
    if (selectedVendor !== 'all' && s.vendorName !== selectedVendor) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchVendor = s.vendorName?.toLowerCase().includes(q);
      const matchMat = s.materialName?.toLowerCase().includes(q) || s.materialCode?.toLowerCase().includes(q);
      const matchGp = s.lastGatePassNumber?.toLowerCase().includes(q);
      if (!matchVendor && !matchMat && !matchGp) return false;
    }
    return true;
  });

  const now = new Date();

  return (
    <div className="space-y-4">
      
      {/* Search and Filter bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor, material, or GP #..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 py-2 px-3 bg-white focus:border-indigo-500"
          >
            <option value="all">All Vendors ({vendors.length})</option>
            {vendors.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyWithBalance}
              onChange={(e) => setShowOnlyWithBalance(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Active Balances Only</span>
          </label>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Job Worker (Vendor)</th>
                <th className="px-4 py-3">Material & SKU</th>
                <th className="px-4 py-3 text-right">Qty With Vendor</th>
                <th className="px-4 py-3">Last Outward GP</th>
                <th className="px-4 py-3">Dispatched Date</th>
                <th className="px-4 py-3">Expected Return</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <div>No materials currently recorded with external job workers.</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Issue an Outward Gate Pass to track materials with outside processors.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStocks.map(stock => {
                  const isOverdue = stock.expectedReturnDate && new Date(stock.expectedReturnDate) < now && stock.quantityWithVendor > 0;
                  const matchedGp = gatePasses.find(g => g.gatePassNumber === stock.lastGatePassNumber);

                  return (
                    <tr key={stock.id} className="hover:bg-slate-50 transition-colors">
                      {/* Vendor */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{stock.vendorName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 pl-5">Vendor ID: {stock.vendorId}</div>
                      </td>

                      {/* Material */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{stock.materialName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{stock.materialCode}</div>
                      </td>

                      {/* Quantity With Vendor (Core KPI) */}
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-black text-indigo-950 font-mono">
                          {stock.quantityWithVendor.toLocaleString('en-IN')} {stock.uom}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Total Sent: {stock.totalOutwardQty} | Ret: {stock.totalReturnedQty}
                        </div>
                      </td>

                      {/* Last Outward GP */}
                      <td className="px-4 py-3">
                        {matchedGp ? (
                          <button
                            type="button"
                            onClick={() => onViewGatePass(matchedGp)}
                            className="font-mono text-indigo-600 hover:text-indigo-800 font-semibold hover:underline flex items-center gap-1"
                          >
                            <span>{stock.lastGatePassNumber}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="font-mono font-medium text-slate-700">{stock.lastGatePassNumber}</span>
                        )}
                      </td>

                      {/* Dispatched Date */}
                      <td className="px-4 py-3 text-slate-700">
                        {stock.lastDispatchedDate || '—'}
                      </td>

                      {/* Expected Return */}
                      <td className="px-4 py-3">
                        <div className={`font-semibold ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                          {stock.expectedReturnDate || '—'}
                        </div>
                        {isOverdue && (
                          <div className="text-[10px] text-rose-600 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3" />
                            Overdue for Return
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        {stock.quantityWithVendor > 0 ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isOverdue 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <Clock className="w-3 h-3" />
                            With Vendor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Fully Returned
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {stock.quantityWithVendor > 0 && matchedGp && (
                          <button
                            type="button"
                            onClick={() => onReceiveInward(matchedGp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                          >
                            <ArrowDownLeft className="w-3 h-3" />
                            Receive Inward
                          </button>
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

    </div>
  );
};
