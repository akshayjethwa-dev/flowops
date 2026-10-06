// src/components/rfq-intake/IntakeQueueList.tsx

import React, { useState } from 'react';
import { 
  Inbox, 
  Mail, 
  MessageSquare, 
  Globe, 
  CheckCircle, 
  Clock, 
  Search, 
  Filter, 
  ArrowRight, 
  Paperclip, 
  Layers, 
  Building, 
  User, 
  Trash2, 
  Eye, 
  Calendar, 
  AlertCircle,
  ExternalLink,
  Factory
} from 'lucide-react';
import { IntakeInquiry, IntakeChannel, IntakeStatus, Plant } from '../../types';
import { useNavigate } from 'react-router-dom';

interface IntakeQueueListProps {
  inquiries: IntakeInquiry[];
  loading: boolean;
  plants: Plant[];
  onConvert: (inquiry: IntakeInquiry, overrides: any) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
}

export const IntakeQueueList: React.FC<IntakeQueueListProps> = ({
  inquiries,
  loading,
  plants,
  onConvert,
  onDelete
}) => {
  const navigate = useNavigate();

  const [channelFilter, setChannelFilter] = useState<'all' | IntakeChannel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | IntakeStatus>('pending');
  const [search, setSearch] = useState('');

  // Selected inquiry for Review & Convert Modal
  const [selectedInquiry, setSelectedInquiry] = useState<IntakeInquiry | null>(null);
  const [converting, setConverting] = useState(false);
  const [overridePlantId, setOverridePlantId] = useState(plants[0]?.id || 'all');
  const [overrideAssignedTo, setOverrideAssignedTo] = useState('Sales Engineer');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editItems, setEditItems] = useState<any[]>([]);

  // Open modal with prefill
  const handleOpenConvertModal = (inq: IntakeInquiry) => {
    setSelectedInquiry(inq);
    setEditCustomerName(inq.customerName || 'Customer');
    setEditItems(inq.items || []);
    setOverridePlantId(plants[0]?.id || 'all');
  };

  // Perform convert
  const handleExecuteConvert = async () => {
    if (!selectedInquiry || converting) return;
    setConverting(true);
    try {
      const createdRfq = await onConvert(selectedInquiry, {
        customerName: editCustomerName,
        plantId: overridePlantId,
        assignedTo: overrideAssignedTo,
        items: editItems
      });
      setSelectedInquiry(null);
      // Navigate to the newly created RFQ detail
      navigate(`/rfqs/${createdRfq.id}`);
    } catch (err) {
      console.error('Failed to convert inquiry to RFQ:', err);
    } finally {
      setConverting(false);
    }
  };

  // Filtered inquiries
  const filtered = inquiries.filter(inq => {
    if (channelFilter !== 'all' && inq.channel !== channelFilter) return false;
    if (statusFilter !== 'all' && inq.status !== statusFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      const matchName = inq.customerName?.toLowerCase().includes(s);
      const matchSubject = inq.subject?.toLowerCase().includes(s);
      const matchId = inq.sourceIdentifier?.toLowerCase().includes(s);
      const matchItem = inq.items?.some(it => it.name.toLowerCase().includes(s));
      if (!matchName && !matchSubject && !matchId && !matchItem) return false;
    }
    return true;
  });

  const countPending = inquiries.filter(i => i.status === 'pending').length;
  const countConverted = inquiries.filter(i => i.status === 'converted').length;
  const countEmail = inquiries.filter(i => i.channel === 'Email').length;
  const countWA = inquiries.filter(i => i.channel === 'WhatsApp').length;
  const countWeb = inquiries.filter(i => i.channel === 'Web Form').length;

  return (
    <div className="space-y-6">
      
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs">
          <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
            Pending Conversion
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-2xl font-black text-amber-600 font-mono">{countPending}</span>
            <span className="text-xs text-slate-400 font-sans">Awaiting review</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs">
          <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
            Converted to RFQs
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-2xl font-black text-emerald-600 font-mono">{countConverted}</span>
            <span className="text-xs text-slate-400 font-sans">Active inquiries</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs">
          <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
            Email & WhatsApp
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-2xl font-black text-sky-600 font-mono">{countEmail + countWA}</span>
            <span className="text-xs text-slate-400 font-sans">Auto-parsed</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs">
          <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
            Web Form & BOMs
          </span>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-2xl font-black text-purple-600 font-mono">{countWeb}</span>
            <span className="text-xs text-slate-400 font-sans">With attachments</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Channel Filters */}
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setChannelFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
              channelFilter === 'all' 
                ? 'bg-slate-900 text-white' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            All Channels ({inquiries.length})
          </button>

          <button
            type="button"
            onClick={() => setChannelFilter('Email')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer transition-all ${
              channelFilter === 'Email' 
                ? 'bg-sky-600 text-white' 
                : 'bg-sky-50 hover:bg-sky-100 text-sky-700'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Email ({countEmail})</span>
          </button>

          <button
            type="button"
            onClick={() => setChannelFilter('WhatsApp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer transition-all ${
              channelFilter === 'WhatsApp' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>WhatsApp ({countWA})</span>
          </button>

          <button
            type="button"
            onClick={() => setChannelFilter('Web Form')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer transition-all ${
              channelFilter === 'Web Form' 
                ? 'bg-purple-600 text-white' 
                : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Web BOMs ({countWeb})</span>
          </button>
        </div>

        {/* Status & Search */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs font-mono font-bold border border-slate-200 bg-slate-50 rounded-lg p-2 focus:ring-1 focus:ring-sky-500 text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="converted">Converted to RFQ</option>
          </select>

          <div className="relative grow md:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inquiries..."
              className="w-full text-xs font-mono border border-slate-200 rounded-lg pl-8 pr-3 py-2 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-sky-500"
            />
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

      </div>

      {/* Inquiry Cards List */}
      {loading ? (
        <div className="p-16 bg-white border border-slate-200 rounded-xl text-center space-y-3">
          <div className="animate-spin h-6 w-6 border-2 border-sky-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Syncing multi-channel inquiries pool...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center space-y-3">
          <Inbox className="h-10 w-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">No Inbound Inquiries Match Filters</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Use the Email, WhatsApp, or Web Form tabs above to simulate or ingest new customer RFQs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filtered.map((inq) => {
            const isEmail = inq.channel === 'Email';
            const isWA = inq.channel === 'WhatsApp';
            const isWeb = inq.channel === 'Web Form';

            return (
              <div 
                key={inq.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-3xs transition-all space-y-3.5"
              >
                {/* Header Line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    {/* Channel Badge */}
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold flex items-center space-x-1.5 ${
                      isEmail ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                      isWA ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {isEmail && <Mail className="h-3 w-3" />}
                      {isWA && <MessageSquare className="h-3 w-3" />}
                      {isWeb && <Globe className="h-3 w-3" />}
                      <span>{inq.channel}</span>
                    </span>

                    <span className="font-bold text-slate-900 text-sm font-sans truncate">
                      {inq.subject || inq.customerName || 'Inbound Inquiry'}
                    </span>

                    {inq.priority === 'High' && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                        High Urgency
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 text-xs font-mono text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(inq.receivedAt).toLocaleDateString()} {new Date(inq.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>

                    {inq.status === 'converted' ? (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3" />
                        <span>RFQ #{inq.convertedRfqNumber || 'Created'}</span>
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        Pending Ingestion
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Customer Info */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Customer Details</span>
                    <p className="font-bold text-slate-800 text-sm flex items-center space-x-1">
                      <Building className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span>{inq.customerName}</span>
                    </p>
                    <p className="text-slate-600 font-mono text-[11px]">
                      {inq.contactName} {inq.phone ? `(📞 ${inq.phone})` : ''}
                    </p>
                    {inq.email && <p className="text-slate-500 font-mono text-[11px] truncate">{inq.email}</p>}
                  </div>

                  {/* Line items preview */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-wider block flex items-center space-x-1">
                      <Layers className="h-3 w-3" />
                      <span>Parsed Items ({inq.items?.length || 0})</span>
                    </span>
                    <div className="space-y-1">
                      {inq.items?.slice(0, 2).map((it, idx) => (
                        <p key={idx} className="font-mono text-[11px] text-slate-700 truncate">
                          • <span className="font-bold">{it.quantity}x</span> {it.name}
                        </p>
                      ))}
                      {(inq.items?.length || 0) > 2 && (
                        <p className="text-[10px] font-mono text-slate-400">
                          + {(inq.items?.length || 0) - 2} more items parsed
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Attachments & Target Date */}
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-wider block">Specs & Attachments</span>
                    <p className="text-slate-700 font-mono text-[11px]">
                      Target Delivery: <span className="font-bold">{inq.expectedDeliveryDate || 'Standard'}</span>
                    </p>
                    {inq.attachments && inq.attachments.length > 0 ? (
                      <div className="flex items-center space-x-1.5 text-slate-600 font-mono text-[11px]">
                        <Paperclip className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                        <span className="font-semibold text-sky-700 truncate">{inq.attachments[0].name}</span>
                        {inq.attachments.length > 1 && <span className="text-slate-400">(+{inq.attachments.length - 1})</span>}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-[11px] font-mono">No files attached</p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onDelete(inq.id)}
                    className="text-slate-400 hover:text-rose-600 text-xs font-mono flex items-center space-x-1 cursor-pointer p-1"
                    title="Dismiss inquiry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Dismiss</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {inq.status === 'converted' && inq.convertedRfqId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/rfqs/${inq.convertedRfqId}`)}
                        className="px-3.5 py-1.5 text-xs font-mono font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center space-x-1 cursor-pointer"
                      >
                        <span>View RFQ #{inq.convertedRfqNumber}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenConvertModal(inq)}
                        className="px-4 py-2 text-xs font-mono font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer transition-all"
                      >
                        <span>Review & Convert to RFQ</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Review & Convert Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
                  Inbound Intake Formalization
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Convert {selectedInquiry.channel} Inquiry to Formal RFQ
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              
              {/* Customer and Assignment Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                    Customer Account
                  </label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-lg p-2 bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                    Assigned Estimator
                  </label>
                  <input
                    type="text"
                    value={overrideAssignedTo}
                    onChange={(e) => setOverrideAssignedTo(e.target.value)}
                    className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                    Fabrication Plant
                  </label>
                  <select
                    value={overridePlantId}
                    onChange={(e) => setOverridePlantId(e.target.value)}
                    className="w-full text-xs font-mono font-bold border border-slate-200 rounded-lg p-2 bg-white"
                  >
                    <option value="all">🏢 Company Wide (Consolidated)</option>
                    {plants.map(p => (
                      <option key={p.id} value={p.id}>🏭 {p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                    Target Delivery Date
                  </label>
                  <span className="font-mono text-slate-800 text-xs block py-2">
                    {selectedInquiry.expectedDeliveryDate || 'Standard Timeline'}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest block">
                  Line Items to be Ingested ({editItems.length})
                </span>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-slate-50 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Part Description</th>
                        <th className="py-2 px-3 w-20">Quantity</th>
                        <th className="py-2 px-3">Specs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {editItems.map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="py-2 px-3 font-semibold text-slate-800">{it.name}</td>
                          <td className="py-2 px-3 font-bold text-sky-700">{it.quantity}</td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">{it.specs || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attached files summary */}
              {selectedInquiry.attachments && selectedInquiry.attachments.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="text-[10px] font-mono font-bold text-slate-450 uppercase block">
                    Associated Drawing/BOM Files ({selectedInquiry.attachments.length}):
                  </span>
                  {selectedInquiry.attachments.map((att, idx) => (
                    <p key={idx} className="text-xs font-mono text-slate-700 flex items-center space-x-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                      <span>{att.name}</span>
                    </p>
                  ))}
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-150 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2 text-xs font-mono font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteConvert}
                disabled={converting}
                className="px-5 py-2 text-xs font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{converting ? 'Creating RFQ...' : 'Confirm & Create RFQ Record'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
