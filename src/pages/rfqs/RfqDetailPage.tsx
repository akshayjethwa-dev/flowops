// src/pages/rfqs/RfqDetailPage.tsx

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useRfqDetail } from '../../hooks/useRfqDetail';
import { useQuotation } from '../../hooks/useQuotation';
import { useToast } from '../../context/ToastContext';
import { 
  ArrowLeft, 
  Layers, 
  Calendar, 
  User, 
  PhoneCall, 
  Mail, 
  MessageSquare, 
  ChevronRight, 
  Play, 
  AlertCircle,
  Clock,
  Sparkles,
  Link,
  ChevronDown,
  ExternalLink,
  Plus,
  Send,
  FileCheck,
  Building,
  Printer,
  CheckCircle2
} from 'lucide-react';
import { RfqStatus } from '../../types';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentsList } from '../../components/AttachmentsList';
import { FileSymlink } from 'lucide-react';


export const RfqDetailPage: React.FC = () => {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();
  
  const { 
    rfq, 
    customer, 
    quotes, 
    whatsappLogs, 
    timeline, 
    loading, 
    error,
    updateRfqFields,
    addTimelineEvent,
    convertToOrder
  } = useRfqDetail(tenant?.id, rfqId);

  // Load standard customized quotation if saved
  const { quotation } = useQuotation(tenant?.id, rfqId);

  // Convert to order state and handler
  const [converting, setConverting] = useState(false);
  const handleConvertToOrder = async () => {
    if (converting || !rfq) return;
    setConverting(true);
    try {
      const created = await convertToOrder(profile?.uid, profile?.name || 'Operations Lead');
      toastSuccess(`Order #${created.orderNumber} created from RFQ #${rfq.rfqNumber || rfqId}`);
      navigate('/orders', { state: { preselectedOrderId: created.id } });
    } catch (err: any) {
      toastError(`Conversion failed: ${err.message || err}`);
    } finally {
      setConverting(false);
    }
  };

  // WhatsApp simulation state
  const [waMessage, setWaMessage] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [wsLogsLocal, setWsLogsLocal] = useState<{message: string, sentAt: string, type: string}[]>([]);

  // Local state for interactive notes
  const [notesInput, setNotesInput] = useState('');
  const [customEventTitle, setCustomEventTitle] = useState('');

  if (loading) {
    return (
      <div className="text-center py-24 bg-white border border-slate-205 rounded-xl space-y-4">
        <div className="animate-spin h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-slate-450 font-mono uppercase">Decoding RFQ costing profile from registry...</p>
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center max-w-lg mx-auto space-y-4">
        <AlertCircle className="h-10 w-10 text-amber-600 mx-auto" />
        <h3 className="font-bold text-slate-900 text-sm">Failed to open RFQ profile</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          {error || `The RFQ profile reference ID: "${rfqId}" does not exist in this tenancy environment.`}
        </p>
        <button
          onClick={() => navigate('/rfqs')}
          className="text-xs text-sky-600 font-mono font-bold tracking-wider uppercase border border-sky-200 px-4 py-2 rounded-lg hover:bg-white cursor-pointer"
        >
          Back to list
        </button>
      </div>
    );
  }

  // Linked quotes status indicator
  const hasAssociatedQuote = quotes.length > 0 || !!quotation;
  const primaryQuote = quotes.length > 0 ? quotes[0] : null;

  // Handle CTA button click
  const handlePrimaryCTA = () => {
    navigate(`/rfqs/${rfqId}/quotation`);
  };

  // Add custom manual timeline log
  const handleAddTimelineMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notesInput.trim()) return;
    
    addTimelineEvent(
      customEventTitle.trim() || 'Internal Review note',
      notesInput.trim(),
      profile?.name || profile?.email || 'Sales Specialist'
    );
    
    setNotesInput('');
    setCustomEventTitle('');
  };

  // Handle WhatsApp simulation trigger
  const handleSimulateWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waMessage.trim()) return;
    setWaSending(true);

    try {
      // Append to local WhatsApp logs
      const newMsg = {
        message: waMessage.trim(),
        sentAt: new Date().toLocaleTimeString(),
        type: 'rfq_update'
      };

      setWsLogsLocal(prev => [newMsg, ...prev]);
      
      // Also write timeline
      addTimelineEvent(
        'WhatsApp Alert Sent',
        `Dispatched text: "${waMessage.trim().length > 60 ? waMessage.trim().slice(0, 57) + '...' : waMessage.trim()}" to ${rfq.phone || 'client'}`,
        profile?.name || 'WhatsApp Sandbox'
      );

      setWaMessage('');
    } catch {
      // Ignore
    } finally {
      setWaSending(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Return to Listing */}
      <button
        onClick={() => navigate('/rfqs')}
        className="inline-flex items-center space-x-1 text-slate-450 hover:text-slate-800 text-[10px] font-mono tracking-wider uppercase cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Inquiries Registry Pool</span>
      </button>

      {/* Ribbon Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest bg-sky-50 border border-sky-100 px-2 py-0.5 rounded leading-none block">
              Active Worksheet
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Ref: {rfqId}
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 mt-1 flex items-center space-x-2">
            <span>{rfq.rfqNumber || `Enquiry Worksheet #${rfqId}`}</span>
            <span className="text-[#3b82f6] text-xs font-mono font-bold font-normal">({rfq.priority || 'Medium'} Priority)</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Acquired via {rfq.source || 'Email'} • Standard pricing turnaround metrics active.
          </p>
        </div>

        {/* Actions cluster */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-3 rounded-lg font-mono text-[10px] uppercase font-black tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-3xs transition-all pointer-events-auto shrink-0 select-none"
            title="Print this RFQ worksheet profile"
          >
            <Printer className="h-4 w-4 text-slate-400" />
            <span>Print Worksheet</span>
          </button>

          {/* Primary Call-to-Action based on Quotation completeness */}
          <button
            onClick={handlePrimaryCTA}
            className={`font-bold font-mono text-[10px] uppercase tracking-wider px-5 py-3 rounded-lg cursor-pointer transition shadow-xs flex items-center space-x-2 shrink-0 ${
              hasAssociatedQuote 
                ? 'bg-slate-900 hover:bg-slate-800 text-white' 
                : 'bg-[#ef4444] hover:bg-red-650 text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 shrink-0 text-white" />
            <span>{hasAssociatedQuote ? 'Manage/Edit Estimation Sheet' : '🎯 Formulate & Dispatch Quotation'}</span>
          </button>

          {/* Convert to Order trigger button */}
          {rfq.orderId ? (
            <button
              onClick={() => navigate('/orders', { state: { preselectedOrderId: rfq.orderId } })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-mono text-[10px] uppercase tracking-wider px-5 py-3 rounded-lg cursor-pointer transition shadow-xs flex items-center space-x-1.5 shrink-0"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
              <span>View Booked Order</span>
            </button>
          ) : (
            rfq.status === 'Won' && (
              <button
                onClick={handleConvertToOrder}
                disabled={converting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-mono text-[10px] uppercase tracking-wider px-5 py-3 rounded-lg cursor-pointer transition shadow-xs flex items-center space-x-1.5 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
              >
                <FileCheck className="h-4 w-4 shrink-0 text-white" />
                <span>{converting ? 'Converting...' : '🎯 Convert to Order'}</span>
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Column Left (2 cols wide): specs details & items list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Customer Profile Overview */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-2">
              <Building className="h-4 w-4 text-sky-500" />
              <span>Client Entity Liaison File</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3 bg-slate-50/50 p-4 border border-slate-100 rounded-lg">
                <div>
                  <span className="text-[9px] font-mono font-bold text-slate-400 block uppercase">Procurement Lead Company</span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">{rfq.customerName}</span>
                </div>
                {customer && (
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 block uppercase">Industrial City Hub</span>
                    <span className="font-bold text-slate-650 mt-1 block">{customer.city || 'Pune Headquarters'}</span>
                  </div>
                )}
                {rfq.customerId && (
                  <button
                    onClick={() => navigate(`/customers/${rfq.customerId}`)}
                    className="inline-flex items-center space-x-1 text-sky-600 hover:text-sky-800 text-[10px] font-mono tracking-wider font-bold uppercase transition"
                  >
                    <span>Inspect CRM Dossier</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="space-y-3 p-4 border border-slate-200 rounded-lg">
                <div>
                  <span className="text-[9px] font-mono font-bold text-slate-450 block uppercase">Contact Person Liaison</span>
                  <span className="font-bold text-slate-800 block mt-0.5">{rfq.contactName || 'Trade Buyer Contact'}</span>
                </div>
                <div className="flex flex-col space-y-1.5 pt-1 text-slate-600 font-mono text-[10px]">
                  {rfq.phone && (
                    <div className="flex items-center space-x-1.5">
                      <PhoneCall className="h-3.5 w-3.5 text-slate-400" />
                      <span>{rfq.phone}</span>
                    </div>
                  )}
                  {rfq.email && (
                    <div className="flex items-center space-x-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span>{rfq.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Items list table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-2">
              <Layers className="h-4 w-4 text-sky-500" />
              <span>Metal Fabrications Specifications</span>
            </h3>

            {rfq.items && rfq.items.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden select-none">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[9px] font-bold text-slate-400 uppercase">
                      <th className="py-2.5 px-4 text-left">Industrial Component Specification</th>
                      <th className="py-2.5 px-4 text-right w-32">Purchase Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {rfq.items.map((component, id) => (
                      <tr key={id} className="hover:bg-slate-50/20">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{component.name}</div>
                          {component.specs && (
                            <div className="text-[10px] text-slate-450 font-mono mt-1">
                              Requirements: {component.specs}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 text-right">
                          {component.quantity} pcs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-mono bg-slate-50 border rounded-lg">
                No individual components defined in initial request checklist.
              </div>
            )}

            {/* Description Remarks */}
            {rfq.description && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 text-xs">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Additional procurement remarks</span>
                <p className="text-slate-700 leading-relaxed font-mono whitespace-pre-wrap">{rfq.description}</p>
              </div>
            )}
          </div>

          {/* Card: Engineering Drawings & Attachment Specs */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-2">
              <FileSymlink className="h-4 w-4 text-sky-500" />
              <span>RFQ Technical Layouts & Drawings</span>
            </h3>
            
            {tenant?.id && (
              <>
                <AttachmentsList 
                  entityType="rfq" 
                  entityId={rfqId!} 
                  tenantId={tenant.id} 
                  userProfile={profile} 
                  userRole={profile?.role} 
                />
                <div className="pt-2">
                  <FileUploader 
                    entityType="rfq" 
                    entityId={rfqId!} 
                    tenantId={tenant.id} 
                    userProfile={profile} 
                  />
                </div>
              </>
            )}
          </div>

          {/* Card 3: Quotation Summary and CTA */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-2">
                <FileCheck className="h-4 w-4 text-sky-500" />
                <span>Quotation Dispatched Metrics</span>
              </h3>
              {hasAssociatedQuote && (
                <button
                  onClick={handlePrimaryCTA}
                  className="text-[9px] font-mono hover:underline font-extrabold text-sky-600 uppercase"
                >
                  Edit Sheet
                </button>
              )}
            </div>

            {hasAssociatedQuote ? (
              <div className="space-y-4">
                {quotation ? (
                  <div className="border border-sky-100 bg-sky-50/25 rounded-xl p-4 space-y-3.5 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 uppercase block">Invoice ID</span>
                        <span className="font-extrabold text-slate-900">{quotation.quotationNumber}</span>
                      </div>
                      <span className={`font-bold border text-[9px] px-2.5 py-0.5 rounded-full uppercase ${
                        quotation.status === 'Accepted'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-150'
                          : quotation.status === 'Rejected'
                          ? 'bg-red-50 text-red-800 border-red-150'
                          : quotation.status === 'Sent'
                          ? 'bg-blue-50 text-blue-800 border-blue-150'
                          : 'bg-amber-50 text-amber-800 border-amber-150'
                      }`}>
                        {quotation.status}
                      </span>
                    </div>

                    <div className="border-t border-dashed border-sky-100/70 pt-2.5 space-y-2">
                      <span className="text-[9px] font-mono text-slate-400 uppercase block">Earmarked Estimates:</span>
                      <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                        {quotation.items?.map((item, i) => (
                          <div key={i} className="flex justify-between text-[10px] text-slate-600 bg-white/70 px-2 py-1 rounded border border-slate-100">
                            <span className="truncate font-medium">{item.description} ({item.quantity} pcs)</span>
                            <span className="font-mono font-bold text-slate-800">₹{item.lineTotal.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-dashed border-sky-100/70 text-[11px] font-mono text-slate-650 text-right">
                      <div className="text-left font-sans text-slate-400">GST element:</div>
                      <div>₹{quotation.taxTotal.toLocaleString('en-IN')}</div>
                      <div className="text-left font-sans font-extrabold text-slate-800 uppercase text-[10px]">Grand total:</div>
                      <div className="font-black text-slate-950 text-xs">₹{quotation.totalAmount.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-sky-100 bg-sky-50/20 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-sky-850">Quote Reference: {primaryQuote?.quoteNumber}</span>
                      <span className="bg-emerald-50 text-emerald-800 font-bold border border-emerald-100 text-[9px] px-2 py-0.5 rounded-full uppercase">Approved / Logged</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 border-y border-dashed border-sky-100 text-[11px] font-mono text-slate-650">
                      <div>Subtotal: ₹{primaryQuote?.subtotal?.toLocaleString('en-IN') || '0.00'}</div>
                      <div>GST (18%): ₹{primaryQuote?.gstAmount?.toLocaleString('en-IN') || '0.00'}</div>
                      <div className="font-bold text-slate-900">Total: ₹{primaryQuote?.total?.toLocaleString('en-IN') || '0.00'}</div>
                    </div>
                    <div className="text-[10px] text-slate-450 font-mono">
                      Legacy Quote format detected. Access standard quote pipelines to adjust.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-red-150 bg-red-50/10 rounded-xl p-6 text-center space-y-3">
                <AlertCircle className="h-6 w-6 text-red-500 mx-auto" />
                <h4 className="font-bold text-slate-900 text-xs">No formal quote issued yet</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Sales estimators have not prepared a commercial quote. Launch quotation formulation now.
                </p>
                <button
                  onClick={handlePrimaryCTA}
                  className="bg-indigo-650 hover:bg-indigo-700 text-white font-mono text-[9px] uppercase tracking-wider font-bold px-4 py-2 rounded-lg cursor-pointer transition shadow-xs"
                >
                  🎯 Draft Commercial Quote
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Column Right (1 col wide): Status controls, activity timeline, and WhatsApp simulator logs */}
        <div className="space-y-6">
          
          {/* Box 1: RFQ status controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider">
              Worksheet Lifecycle
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-mono font-bold text-slate-450 block uppercase tracking-wide">
                  Assigned Estimator
                </label>
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-2 mt-1 font-mono text-[11px]">
                  <User className="h-4 w-4 text-slate-400" />
                  <span className="font-bold text-slate-700">{rfq.assignedTo || 'Unassigned'}</span>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-mono font-bold text-slate-450 block uppercase tracking-wide">
                  Worksheet Status
                </label>
                <div className="relative mt-1">
                  <select
                    value={rfq.status}
                    onChange={(e) => updateRfqFields({ status: e.target.value as RfqStatus })}
                    className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-slate-800 focus:bg-white focus:outline-hidden"
                  >
                    <option value="New">🟢 New (Unprocessed)</option>
                    <option value="In Progress">🟡 In Progress</option>
                    <option value="Quoted">🔵 Quoted & Shared</option>
                    <option value="Won">🏆 Won (Order Booked)</option>
                    <option value="Lost">❌ Lost / Declined</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Box 2: Timeline Activity Logger */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <Clock className="h-4 w-4 text-sky-500" />
              <span>Logs & Activity Timeline</span>
            </h3>

            {/* Quick notes logging form */}
            <form onSubmit={handleAddTimelineMsg} className="space-y-2">
              <input
                type="text"
                placeholder="Log milestone tag (e.g. Call Client, Specs confirmed)"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[10px] font-mono focus:outline-hidden focus:bg-white"
                value={customEventTitle}
                onChange={(e) => setCustomEventTitle(e.target.value)}
              />
              <div className="flex space-x-1.5">
                <input
                  type="text"
                  placeholder="Review observations details..."
                  className="w-full flex-grow bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 focus:outline-hidden focus:bg-white font-sans"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold p-1.5 rounded-lg flex items-center justify-center shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            <div className="flow-root pt-2 select-none">
              <ul className="-mb-8">
                {timeline.map((event, idx) => (
                  <li key={event.id || idx}>
                    <div className="relative pb-8 text-xs font-sans">
                      {idx !== timeline.length - 1 ? (
                        <span className="absolute top-4 left-3 -ml-px h-full w-0.5 bg-slate-150" aria-hidden="true" />
                      ) : null}
                      <div className="relative flex space-x-3 items-start">
                        <div>
                          <span className="h-6 w-6 rounded-full bg-slate-100 border border-slate-250 flex items-center justify-center font-mono text-[9px] font-bold text-slate-600">
                            {idx + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[11px] font-extrabold text-slate-800 leading-none">{event.title}</p>
                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{event.description}</p>
                          <div className="text-[9px] text-slate-400 font-mono mt-1 flex items-center space-x-1.5">
                            <span>by {event.operatorName}</span>
                            <span>•</span>
                            <span>{new Date(event.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Box 3: WhatsApp log messaging outbox */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
              <span>WhatsApp Alerts Simulator</span>
            </h3>

            {rfq.phone ? (
              <form onSubmit={handleSimulateWhatsApp} className="space-y-2">
                <textarea
                  rows={2}
                  placeholder={`Send WhatsApp update to ${rfq.customerName}...`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-sans focus:outline-hidden text-slate-700 focus:bg-white"
                  value={waMessage}
                  required
                  onChange={(e) => setWaMessage(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={waSending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-mono uppercase tracking-wider font-bold py-2 rounded-lg cursor-pointer transition flex items-center justify-center space-x-1"
                >
                  <Send className="h-3 w-3" />
                  <span>{waSending ? 'Sending alert...' : 'Simulate WhatsApp Outbound'}</span>
                </button>
              </form>
            ) : (
              <div className="text-[10px] text-slate-450 font-mono border border-dashed rounded-lg p-3 text-center">
                Configure phone parameters to open outbox simulation alerts.
              </div>
            )}

            {/* Simulated WhatsApp history */}
            {(wsLogsLocal.length > 0 || whatsappLogs.length > 0) ? (
              <div className="pt-2 select-none">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wide block mb-2">Simulated Outbox thread</span>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {/* Local Simulated Outbox */}
                  {wsLogsLocal.map((msg, index) => (
                    <div key={index} className="p-2 border border-emerald-100 bg-emerald-50/30 rounded-lg text-xs leading-relaxed">
                      <p className="text-slate-800 font-sans">{msg.message}</p>
                      <div className="text-[8px] text-emerald-600 font-mono mt-1 text-right">
                        DISPATCHED • {msg.sentAt}
                      </div>
                    </div>
                  ))}
                  {/* Database logged Messages */}
                  {whatsappLogs.map(log => (
                    <div key={log.id} className="p-2 border border-slate-150 bg-slate-50/50 rounded-lg text-xs leading-relaxed">
                      <p className="text-slate-650 font-sans">{log.message}</p>
                      <div className="text-[8px] text-slate-400 font-mono mt-1 text-right">
                        {log.status.toUpperCase()} • {log.sentAt}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

        </div>

      </div>

    </div>
  );
};
