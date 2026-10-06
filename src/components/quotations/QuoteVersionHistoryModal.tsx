// src/components/quotations/QuoteVersionHistoryModal.tsx

import React, { useState } from 'react';
import { Quote, QuoteItem } from '../../types';
import { QuoteVersionRecord } from '../../types/quoteApproval';
import { 
  X, 
  History, 
  Layers, 
  Calendar, 
  User, 
  FileText, 
  ArrowRight, 
  TrendingDown, 
  TrendingUp,
  CheckCircle2,
  Clock,
  ExternalLink,
  RotateCcw,
  Tag
} from 'lucide-react';

interface QuoteVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote;
  onRevertToVersion?: (version: QuoteVersionRecord) => void;
}

export const QuoteVersionHistoryModal: React.FC<QuoteVersionHistoryModalProps> = ({
  isOpen,
  onClose,
  quote,
  onRevertToVersion
}) => {
  const [selectedVersionIdx, setSelectedVersionIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  // Build combined version list: past archived versions + current live version
  const currentLiveVersion: QuoteVersionRecord = {
    version: quote.currentVersion || (quote.versions?.length ? quote.versions.length + 1 : 1),
    versionLabel: `v${quote.currentVersion || (quote.versions?.length ? quote.versions.length + 1 : 1)}.0 (Active)`,
    createdAt: typeof quote.createdAt === 'string' ? quote.createdAt : new Date().toISOString(),
    createdBy: {
      uid: quote.createdBy,
      name: 'Current Drafter',
      email: ''
    },
    changeSummary: quote.notes || 'Current active quotation formulation',
    items: quote.items || [],
    subtotal: quote.subtotal,
    discountTotal: quote.discountTotal || 0,
    gstAmount: quote.gstAmount,
    total: quote.total,
    approvalStatus: quote.status,
    pdfUrl: quote.downloadUrl
  };

  const allVersions: QuoteVersionRecord[] = [
    currentLiveVersion,
    ...(quote.versions ? [...quote.versions].reverse() : [])
  ];

  const activeInspection = selectedVersionIdx !== null ? allVersions[selectedVersionIdx] : allVersions[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-in font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 border border-sky-500/20">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900 leading-none">
                Quotation Version History & Audit Trail
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Ref: {quote.quoteNumber} • Customer: {quote.customerName} • {allVersions.length} Revision(s) Recorded
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-450 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body 2-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200">
          
          {/* Left Column: Revision selector timeline */}
          <div className="md:col-span-5 p-4 overflow-y-auto max-h-[60vh] md:max-h-[75vh] space-y-2.5 bg-slate-50/40">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Revision Log Timeline:
            </span>

            {allVersions.map((ver, idx) => {
              const isSelected = (selectedVersionIdx === null && idx === 0) || selectedVersionIdx === idx;
              const isLive = idx === 0;

              return (
                <div
                  key={`${ver.version}-${idx}`}
                  onClick={() => setSelectedVersionIdx(idx)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                    isSelected 
                      ? 'border-sky-500 bg-white shadow-xs ring-1 ring-sky-500/20' 
                      : 'border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        isLive 
                          ? 'bg-sky-100 text-sky-800 border border-sky-200' 
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        v{ver.version}.0 {isLive ? '• Active' : ''}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(ver.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>

                    <span className="font-mono font-black text-slate-900 text-xs">
                      ₹{ver.total.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-2 leading-relaxed">
                    {ver.changeSummary || 'Standard formulation update.'}
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{ver.createdBy.name || 'Sales Staff'}</span>
                    </span>
                    <span className={`uppercase font-bold ${
                      ver.approvalStatus === 'approved' ? 'text-emerald-600' :
                      ver.approvalStatus === 'pending_approval' ? 'text-amber-600' :
                      ver.approvalStatus === 'rejected' ? 'text-rose-600' : 'text-slate-500'
                    }`}>
                      {ver.approvalStatus}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed inspection of the selected revision */}
          <div className="md:col-span-7 p-6 overflow-y-auto max-h-[60vh] md:max-h-[75vh] space-y-5 bg-white">
            
            {/* Version Meta Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-base font-extrabold text-slate-900">
                    Revision Specification v{activeInspection.version}.0
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    activeInspection.approvalStatus === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                    activeInspection.approvalStatus === 'pending_approval' ? 'bg-amber-100 text-amber-800' :
                    activeInspection.approvalStatus === 'rejected' ? 'bg-rose-100 text-rose-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {activeInspection.approvalStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Logged: {new Date(activeInspection.createdAt).toLocaleString()} by {activeInspection.createdBy.name}
                </p>
              </div>

              {/* Restore action if inspecting an older version */}
              {onRevertToVersion && selectedVersionIdx !== 0 && (
                <button
                  type="button"
                  onClick={() => onRevertToVersion(activeInspection)}
                  className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Revert to this Revision</span>
                </button>
              )}
            </div>

            {/* Change Rationale */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                Revision Changelog Notes:
              </span>
              <p className="text-slate-700 font-medium leading-relaxed italic">
                "{activeInspection.changeSummary || 'No specific notes recorded for this revision snapshot.'}"
              </p>
            </div>

            {/* Commercial Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[9px] font-mono uppercase text-slate-400 font-bold block">Subtotal</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹{activeInspection.subtotal.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-mono uppercase text-slate-400 font-bold block">Discount</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹{activeInspection.discountTotal.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-mono uppercase text-slate-400 font-bold block">GST Tax</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹{activeInspection.gstAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-mono uppercase text-slate-400 font-bold block">Grand Total</span>
                <span className="font-mono font-black text-sky-700 text-sm">
                  ₹{activeInspection.total.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Items Table in this Version */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block tracking-wider">
                Line Items in v{activeInspection.version}.0 ({activeInspection.items.length}):
              </span>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold font-mono uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Item Description</th>
                      <th className="p-2.5 text-center w-16">Qty</th>
                      <th className="p-2.5 text-right w-24">Rate (₹)</th>
                      <th className="p-2.5 text-right w-28">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeInspection.items.map((itm, i) => (
                      <tr key={itm.id || i} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-semibold text-slate-800">{itm.name}</td>
                        <td className="p-2.5 text-center font-mono">{itm.quantity}</td>
                        <td className="p-2.5 text-right font-mono">₹{itm.unitPrice}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          ₹{itm.total.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {activeInspection.items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 font-mono text-xs">
                          No line items archived in this revision snapshot.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-mono font-bold hover:bg-slate-800 cursor-pointer"
          >
            Close Version History
          </button>
        </div>

      </div>
    </div>
  );
};
