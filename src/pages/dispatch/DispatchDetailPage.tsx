// src/pages/dispatch/DispatchDetailPage.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDispatchDetail } from '../../hooks/useDispatch';
import { 
  ArrowLeft, 
  Truck, 
  MapPin, 
  Calendar, 
  FileCheck, 
  CheckCircle2, 
  X, 
  PhoneCall, 
  AlertCircle,
  FileText,
  DollarSign,
  Briefcase,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Award,
  ArrowUpRight,
  Clock,
  AlertOctagon
} from 'lucide-react';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentsList } from '../../components/AttachmentsList';
import { FileSymlink, Boxes, RotateCcw, Receipt, QrCode } from 'lucide-react';
import { fqcService } from '../../services/fqcService';
import { CertificateOfConformanceModal } from '../../components/fqc/CertificateOfConformanceModal';
import { qualityHoldService } from '../../services/qualityHoldService';
import { cancelAndVoidDispatch } from '../../services/partialDispatchService';
import { useToast } from '../../context/ToastContext';
import { GeneratePartialInvoiceModal } from '../../components/dispatch/GeneratePartialInvoiceModal';
import { SalesReturnCreditNoteModal } from '../../components/dispatch/SalesReturnCreditNoteModal';
import { checkInvoiceExistsForDispatch, getCreditNotesForInvoice } from '../../services/partialInvoiceService';
import { GenerateEInvoiceModal } from '../../components/dispatch/GenerateEInvoiceModal';
import { EInvoicePanel } from '../../components/dispatch/EInvoicePanel';
import { downloadEInvoicePdf } from '../../utils/eInvoicePdfGenerator';
import { GenerateEWayBillModal } from '../../components/dispatch/GenerateEWayBillModal';
import { EWayBillPanel } from '../../components/dispatch/EWayBillPanel';
import { downloadEWayBillPdf } from '../../utils/ewayBillPdfGenerator';
import { useEWayBillExpiryMonitor } from '../../hooks/useEWayBillExpiryMonitor';
import { ActivityTimeline } from '../../components/ActivityTimeline';
import { Invoice, CreditNote, Dispatch } from '../../types';

export const DispatchDetailPage: React.FC = () => {
  const { dispatchId } = useParams<{ dispatchId: string }>();
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const { dispatchItem, loading, error, updateDispatchStatus } = useDispatchDetail(tenant?.id, dispatchId);

  // Background monitor for expiring e-Way Bills (within 4 hours)
  useEWayBillExpiryMonitor();

  const [currentDispatch, setCurrentDispatch] = useState<Dispatch | null>(null);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showCocModal, setShowCocModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Invoicing & Transit Permit state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false);
  const [showEWayBillModal, setShowEWayBillModal] = useState(false);
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [refreshInvoicingKey, setRefreshInvoicingKey] = useState(0);

  // Keep currentDispatch in sync with loaded dispatch
  useEffect(() => {
    if (dispatchItem) {
      setCurrentDispatch(dispatchItem);
    }
  }, [dispatchItem]);

  const handleReloadDispatch = () => {
    if (!tenant?.id || !dispatchId) return;
    try {
      const cached = localStorage.getItem(`dispatches_${tenant.id}`);
      if (cached) {
        const list = JSON.parse(cached);
        const updated = list.find((d: any) => d.id === dispatchId);
        if (updated) setCurrentDispatch(updated);
      }
    } catch (e) {
      console.warn('Error reloading dispatch', e);
    }
  };

  useEffect(() => {
    const handleEwbUpdated = (e: any) => {
      if (!e.detail?.dispatchId || e.detail.dispatchId === dispatchId) {
        handleReloadDispatch();
      }
    };
    window.addEventListener('ewaybill.updated', handleEwbUpdated);
    return () => window.removeEventListener('ewaybill.updated', handleEwbUpdated);
  }, [dispatchId]);

  // Load linked invoice & credit notes
  useEffect(() => {
    if (!tenant?.id || !dispatchItem) return;

    checkInvoiceExistsForDispatch(tenant.id, dispatchItem).then(res => {
      if (res.exists && res.invoice) {
        setLinkedInvoice(res.invoice);
        getCreditNotesForInvoice(tenant.id, res.invoice.id).then(cns => {
          setCreditNotes(cns);
        });
      } else {
        setLinkedInvoice(null);
        setCreditNotes([]);
      }
    });
  }, [tenant?.id, dispatchItem?.id, dispatchItem?.isInvoiced, refreshInvoicingKey]);

  const releaseCheck = dispatchItem?.orderId ? fqcService.checkDispatchReleaseEligibility(dispatchItem.orderId) : null;
  const holdCheck = dispatchItem?.orderId ? qualityHoldService.checkDispatchBlock(dispatchItem.orderId) : null;

  const handleUpdateStatus = async (newStatus: 'Planned' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'shipped' | 'delivered') => {
    if (newStatus === 'Cancelled') {
      setShowCancelModal(true);
      return;
    }

    if ((newStatus === 'Dispatched' || newStatus === 'shipped' || newStatus === 'Delivered') && holdCheck?.isBlocked) {
      setFeedback(`Blocked: Quality Hold active on batch/WO. ${holdCheck.blockReason}`);
      return;
    }
    setUpdating(true);
    setFeedback(null);
    try {
      await updateDispatchStatus(newStatus);
      setFeedback(`Dispatch status changed to ${newStatus.toUpperCase()}.`);
      setTimeout(() => setFeedback(null), 3050);
    } catch (err: any) {
      setFeedback(`Adjustment Failed: ${err.message || 'Error occurred'}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!tenant?.id || !dispatchId || !profile) return;
    setCancelling(true);
    setFeedback(null);
    try {
      const result = await cancelAndVoidDispatch(tenant.id, dispatchId, profile.name || 'Dispatch Clerk');
      setFeedback(`Dispatch #${result.voidedDispatch.dispatchNumber} voided. Restored quantities to Order #${result.restoredOrder.orderNumber}.`);
      if (result.flaggedBackorder) {
        toastSuccess(
          'Dispatch Voided & Quantities Restored',
          `Restored quantities to Order #${result.restoredOrder.orderNumber}. Backorder #${result.flaggedBackorder.backorderNumber} flagged for review.`
        );
      } else {
        toastSuccess(
          'Dispatch Voided & Quantities Restored',
          `Restored quantities to Order #${result.restoredOrder.orderNumber}.`
        );
      }
      setShowCancelModal(false);
    } catch (err: any) {
      setFeedback(`Cancellation failed: ${err.message || 'Error'}`);
      toastError('Cancellation Failed', err.message);
    } finally {
      setCancelling(false);
    }
  };

  const getStatusColor = (st: string) => {
    switch (st?.toLowerCase()) {
      case 'planned': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'dispatched':
      case 'shipped': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'cancelled': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-24 space-y-4 font-sans">
        <div className="animate-spin h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-slate-450 font-mono uppercase tracking-wider">Syncing logistics route Node...</p>
      </div>
    );
  }

  if (error || !dispatchItem) {
    return (
      <div className="bg-red-50/40 border border-red-200 rounded-xl p-8 max-w-lg mx-auto text-center mt-12 space-y-4 font-sans select-none">
        <AlertCircle className="h-10 w-10 text-rose-600 mx-auto" />
        <h3 className="font-bold text-slate-905">Consignment Reference Missing</h3>
        <p className="text-xs text-slate-500">{error || 'The logistics invoice tracking key does not register inside active tenant workspace records.'}</p>
        <button
          onClick={() => navigate('/dispatch')}
          className="px-4 py-2 bg-slate-905 hover:bg-slate-800 text-white font-mono text-[10px] uppercase font-bold tracking-wider rounded-lg transition"
        >
          Return to Dispatch Desk
        </button>
      </div>
    );
  }

  // Value calculation
  const totalCargoValue = (dispatchItem.items || []).reduce((sum, item) => sum + (item.total || 0), 0);

  return (
    <div className="space-y-6 font-sans select-none">
      
      {/* Top navbar controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dispatch')}
          className="inline-flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-450 hover:text-slate-800 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Exit to dispatch roster</span>
        </button>

        <span className="font-mono text-[10px] text-slate-400">
          Ref Track ID: {dispatchItem.id}
        </span>
      </div>

      {/* Main card panel information */}
      <div className="bg-white border rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono bg-sky-50 border border-sky-100 text-sky-700 px-2.5 py-0.5 rounded font-extrabold uppercase">
              Consignment Registry • out
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-2">
              Slip: {dispatchItem.dispatchNumber || dispatchItem.invoiceNumber}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Associated Invoice ref: <span className="font-mono text-slate-700 font-bold">{dispatchItem.invoiceNumber}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
            {dispatchItem.status !== 'Cancelled' && (
              dispatchItem.isInvoiced || linkedInvoice ? (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => navigate('/payments')}
                    className="border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-3xs transition"
                    title="View linked Tax Invoice in Finance"
                  >
                    <Receipt className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Invoiced #{linkedInvoice?.invoiceNumber || dispatchItem.invoiceNumber}</span>
                  </button>

                  {((currentDispatch || dispatchItem).creditNoteIssued || creditNotes.length > 0) ? (
                    <button
                      type="button"
                      onClick={() => setShowCreditNoteModal(true)}
                      className="border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 px-3 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-3xs transition"
                      title="Credit Note issued and applied to parent invoice"
                    >
                      <RotateCcw className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>Credit Note Issued #{creditNotes[0]?.creditNoteNumber || (currentDispatch || dispatchItem).lastCreditNoteNumber || ''}</span>
                    </button>
                  ) : (currentDispatch || dispatchItem).salesReturnRecorded ? (
                    <button
                      type="button"
                      onClick={() => setShowCreditNoteModal(true)}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs transition animate-pulse"
                      title="Sales return recorded. Click to generate statutory Credit Note"
                    >
                      <RotateCcw className="h-4 w-4 shrink-0" />
                      <span>Generate Credit Note</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCreditNoteModal(true)}
                      className="border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 px-3 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-3xs transition"
                      title="Accept Sales Return and generate statutory Credit Note"
                    >
                      <RotateCcw className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>Sales Return (Credit Note)</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowInvoiceModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs transition"
                    title="Generate Tax Invoice for only the quantity dispatched"
                  >
                    <Receipt className="h-4 w-4 shrink-0" />
                    <span>Generate Invoice</span>
                  </button>
                  {(currentDispatch || dispatchItem).salesReturnRecorded && !((currentDispatch || dispatchItem).creditNoteIssued) && (
                    <button
                      type="button"
                      onClick={() => setShowCreditNoteModal(true)}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs transition"
                      title="Generate Credit Note for returned goods"
                    >
                      <RotateCcw className="h-4 w-4 shrink-0" />
                      <span>Generate Credit Note</span>
                    </button>
                  )}
                </div>
              )
            )}

            {/* e-Invoice Action */}
            {(currentDispatch || dispatchItem).status !== 'Cancelled' && (
              ((currentDispatch as any) || dispatchItem).eInvoice?.status === 'generated' ? (
                <button
                  type="button"
                  onClick={() => {
                    const disp: any = currentDispatch || dispatchItem;
                    downloadEInvoicePdf(
                      disp?.eInvoice || null,
                      disp,
                      {
                        name: tenant?.name || 'NexFlow Manufacturing Industries Ltd',
                        gstin: tenant?.gstin || '27AABCS1429B1ZB',
                        address: { street: 'Industrial Estate', city: 'Pune', state: 'Maharashtra', pincode: '411018' }
                      }
                    );
                  }}
                  className="border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 px-3 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-3xs transition"
                  title="Print official GST e-Invoice with signed QR code"
                >
                  <QrCode className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>e-Invoice (IRN Active)</span>
                </button>
              ) : (
                ['admin', 'finance', 'management'].includes((profile?.role || '').toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => setShowEInvoiceModal(true)}
                    className="border border-indigo-200 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs transition"
                    title="Generate GST e-Invoice (IRN & QR)"
                  >
                    <QrCode className="h-4 w-4 shrink-0" />
                    <span>Generate e-Invoice</span>
                  </button>
                )
              )
            )}

            {/* e-Way Bill Action */}
            {(currentDispatch || dispatchItem).status !== 'Cancelled' && (
              (((currentDispatch as any) || dispatchItem).ewayBill?.status === 'active' || ((currentDispatch as any) || dispatchItem).ewbNumber) ? (
                <button
                  type="button"
                  onClick={() => {
                    const disp: any = currentDispatch || dispatchItem;
                    downloadEWayBillPdf(
                      disp?.ewayBill || null,
                      disp,
                      {
                        name: tenant?.name || 'NexFlow Manufacturing Industries Ltd',
                        gstin: tenant?.gstin || '27AABCS1429B1ZB',
                        address: { street: 'Industrial Estate', city: 'Pune', state: 'Maharashtra', pincode: '411018' }
                      }
                    );
                  }}
                  className="border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-900 px-3 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-3xs transition"
                  title="Print official GST e-Way Bill (Form GST EWB-01)"
                >
                  <Truck className="h-4 w-4 text-sky-600 shrink-0" />
                  <span>e-Way Bill #{((currentDispatch as any) || dispatchItem).ewbNumber || ((currentDispatch as any) || dispatchItem).ewayBill?.ewbNumber}</span>
                </button>
              ) : (
                ['admin', 'dispatch', 'management'].includes((profile?.role || '').toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => setShowEWayBillModal(true)}
                    className="border border-sky-200 bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-lg font-mono text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-xs transition"
                    title="Generate GST e-Way Bill for transit (₹50,000+)"
                  >
                    <Truck className="h-4 w-4 shrink-0" />
                    <span>Generate e-Way Bill</span>
                  </button>
                )
              )
            )}

            <button
              onClick={() => window.print()}
              className="border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-mono text-[10px] uppercase font-black tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-3xs transition-all select-none"
              title="Print standard delivery / dispatch consignment slip"
            >
              <Printer className="h-4 w-4 text-slate-400 shrink-0" />
              <span>Print Slip</span>
            </button>
            <span className={`px-3 py-1 font-mono font-extrabold uppercase rounded-full text-[10px] border tracking-wider shadow-3xs ${getStatusColor(dispatchItem.status)}`}>
              {dispatchItem.status}
            </span>
          </div>
        </div>

        {/* Essential timeline metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 font-mono text-xs">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-440 uppercase block">Logistics Carrier</span>
            <span className="font-bold text-slate-805 block">{dispatchItem.transporter || 'Direct Carrier'}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-440 uppercase block">Transit Vehicle</span>
            <span className="font-bold text-slate-805 uppercase block">{dispatchItem.vehicleNumber || 'Arranged'}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-440 uppercase block">Lorry Receipt (LR)</span>
            <span className="font-bold text-indigo-650 block">{dispatchItem.lrNumber || dispatchItem.LRNumber || 'N/A'}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-440 uppercase block">Dispatch Date</span>
            <span className="font-medium text-slate-700">
              {dispatchItem.dispatchDate ? new Date(dispatchItem.dispatchDate).toLocaleDateString() : new Date(dispatchItem.dispatchedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Cancellation status alert */}
        {dispatchItem.status === 'Cancelled' && (
          <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 flex items-start space-x-3">
            <AlertOctagon className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="font-bold text-rose-950 block text-sm">Consignment Voided & Cancelled</strong>
              <p className="mt-0.5 text-rose-800 leading-relaxed font-sans">
                All dispatched line quantities have been restored back to the parent Sales Order. Any linked follow-on backorder has been flagged for supervisor review.
              </p>
            </div>
          </div>
        )}

        {/* Partial consignment banner */}
        {(dispatchItem.isPartialDispatch || dispatchItem.backorderNumber) && dispatchItem.status !== 'Cancelled' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <Boxes className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Partial Consignment Dispatch</span>
                <span className="text-amber-700 block text-[11px] font-sans">
                  Balance quantity carried forward to linked <strong>Backorder #{dispatchItem.backorderNumber}</strong> ({dispatchItem.totalRemainingQty || 0} units balance).
                </span>
              </div>
            </div>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
              Backorder Auto-Created
            </span>
          </div>
        )}
      </div>

      {/* Primary Split content areas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Loaded Freight specifications list (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Sales Return Notification Banner (Acceptance Criteria 1 & Flow) */}
          {((currentDispatch || dispatchItem).salesReturnRecorded || (currentDispatch || dispatchItem).creditNoteIssued || creditNotes.length > 0) && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-rose-900 font-bold text-xs uppercase font-mono tracking-wider">
                  <RotateCcw className="h-4 w-4 text-rose-600" />
                  <span>{(currentDispatch || dispatchItem).creditNoteIssued || creditNotes.length > 0 ? 'Credit Note Issued & Applied' : 'Sales Return Recorded on Dispatch'}</span>
                </div>
                {((currentDispatch || dispatchItem).creditNoteIssued || creditNotes.length > 0) && (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black uppercase bg-rose-600 text-white">
                    Credit Note Active
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-800 font-sans">
                {((currentDispatch || dispatchItem).creditNoteIssued || creditNotes.length > 0)
                  ? `Statutory Credit Note #${creditNotes[0]?.creditNoteNumber || (currentDispatch || dispatchItem).lastCreditNoteNumber || ''} has been issued and linked to original IRN. Parent order invoiced quantities have been reversed accordingly.`
                  : 'A sales return has been flagged for this dispatch. Please generate an official GST Credit Note to maintain IRP compliance and update invoiced quantities.'}
              </p>
              {(!((currentDispatch || dispatchItem).creditNoteIssued) && creditNotes.length === 0) && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreditNoteModal(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Generate Credit Note</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Loaded components list */}
          <div className="bg-white border rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="text-xs uppercase font-mono font-bold text-slate-450 tracking-wider">
                Loaded dispatch Cargo Breakdown
              </h3>
              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black">
                {(dispatchItem.items || []).length} lines itemized
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {dispatchItem.items && dispatchItem.items.length > 0 ? (
                dispatchItem.items.map((itm, idx) => (
                  <div key={idx} className="py-4 flex justify-between items-start text-xs font-mono first:pt-0 last:pb-0">
                    <div>
                      <p className="font-bold text-slate-805 font-sans mb-1">{itm.name}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                        <span>Rate: ₹{itm.unitPrice.toLocaleString('en-IN')}</span>
                        {typeof itm.orderedQty === 'number' && (
                          <span className="font-bold text-slate-700">Total Ordered: {itm.orderedQty}</span>
                        )}
                        {typeof itm.remainingQty === 'number' && (
                          <span className="font-bold text-amber-700">Balance: {itm.remainingQty}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-0.5 rounded font-extrabold text-[10px]">
                        Dispatched Qty: {itm.quantity}
                      </span>
                      <p className="text-[10px] font-bold text-slate-700 mt-1">
                        ₹{(itm.total || (itm.quantity * itm.unitPrice)).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 font-mono">
                  No discrete product items logged on this shipping container.
                </div>
              )}
            </div>

            {/* Total Freight Contract Value */}
            <div className="flex justify-between items-center pt-4 border-t text-sm font-sans pt-3 font-bold bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-xl">
              <span className="text-xs font-mono uppercase text-slate-500">Shipped Consignment Valuation (Est):</span>
              <span className="text-indigo-950 font-black text-base">₹{totalCargoValue.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Operational driver and packaging notes annotation */}
          <div className="bg-white border rounded-xl p-6 shadow-2xs space-y-3.5">
            <h3 className="text-xs uppercase font-mono font-bold text-slate-450 tracking-wider">
              Transit notes & Handling Instructions
            </h3>
            <div className="p-3.5 bg-slate-50 rounded-lg text-xs leading-relaxed font-mono border border-slate-105 text-slate-700">
              {dispatchItem.notes || 'Standard industrial wood pallet cargo consolidation. Drivers instructed to report transit delays immediately.'}
            </div>
          </div>

          {/* Audit Trail & Compliance History (Acceptance Criteria 5) */}
          <div className="bg-white border rounded-xl p-6 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-xs uppercase font-mono font-bold text-slate-600 tracking-wider flex items-center space-x-1.5">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>Audit Trail & Statutory Compliance History</span>
              </h3>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                IRP Audit Trail
              </span>
            </div>
            <ActivityTimeline entityId={dispatchId} entityType="dispatch" compact={true} maxLimit={6} />
          </div>

        </div>

        {/* RIGHT COLUMN: Action triggers, transporter details (1/3 width) */}
        <div className="space-y-6">

          {/* GST e-Invoice Panel (IRN & Signed QR) */}
          <EInvoicePanel
            dispatch={currentDispatch || dispatchItem}
            onOpenGenerateModal={() => setShowEInvoiceModal(true)}
            onOpenCreditNoteModal={() => setShowCreditNoteModal(true)}
            onRefreshDispatch={handleReloadDispatch}
          />

          {/* GST e-Way Bill Panel (Form GST EWB-01 & Part B updates) */}
          <EWayBillPanel
            dispatch={currentDispatch || dispatchItem}
            onOpenGenerateModal={() => setShowEWayBillModal(true)}
            onRefreshDispatch={handleReloadDispatch}
          />

          {/* Card: Final Quality Control & Dispatch Release Gate */}
          <div className="bg-white border rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
                <Award className="h-4 w-4 text-emerald-600" />
                <span>Final Quality & Release Gate</span>
              </h4>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                ISO 9001:2015
              </span>
            </div>

            {holdCheck?.isBlocked ? (
              <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-lg space-y-2">
                <div className="flex items-center space-x-2 text-rose-900 font-bold">
                  <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0 animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-wide">QUALITY HOLD: DISPATCH LOCKED</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-tight">
                  {holdCheck.blockReason}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/quality-holds')}
                  className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold font-mono uppercase tracking-wider transition flex items-center justify-center space-x-1 cursor-pointer shadow-sm"
                >
                  <span>Review in Quality Holds Desk</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            ) : releaseCheck?.isEligible && releaseCheck.status === 'released' ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                <div className="flex items-center space-x-2 text-emerald-800">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold font-mono">CLEARED FOR DISPATCH</span>
                </div>
                <div className="text-[11px] text-emerald-900 space-y-0.5 font-sans">
                  <div className="flex justify-between">
                    <span className="text-slate-500">CoC Number:</span>
                    <span className="font-mono font-bold text-emerald-800">{releaseCheck.cocNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Authorized by:</span>
                    <span className="font-semibold">{releaseCheck.signedBy}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCocModal(true)}
                  className="w-full mt-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold font-mono uppercase tracking-wider transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>View Certificate of Conformance (CoC)</span>
                </button>
              </div>
            ) : releaseCheck?.status === 'quarantined' ? (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg space-y-2">
                <div className="flex items-center space-x-2 text-rose-800">
                  <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 animate-pulse" />
                  <span className="text-xs font-bold font-mono">QUARANTINED (BLOCKED)</span>
                </div>
                <p className="text-[11px] text-rose-900 leading-tight">
                  {releaseCheck?.holdReason || 'Order is quarantined under Non-Conformance Report.'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/fqc')}
                  className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold font-mono uppercase tracking-wider transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Review in FQC Desk</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-2">
                <div className="flex items-center space-x-2 text-amber-800">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold font-mono">AUTO-HOLD: FQC PENDING</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-tight">
                  Final Quality Control inspection has not cleared this consignment. Product cannot be dispatched without QA Manager sign-off.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/fqc')}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold font-mono uppercase tracking-wider transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>Launch FQC Inspection</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Carrier update panel */}
          <div className="bg-white border rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider">
              Transit Controller
            </h4>

            {feedback && (
              <div className="p-2.5 bg-sky-50 border border-sky-150 text-[10px] font-mono text-sky-800 rounded">
                {feedback}
              </div>
            )}

            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Set route segment:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={updating || dispatchItem.status === 'Dispatched'}
                  onClick={() => handleUpdateStatus('Dispatched')}
                  className="p-2.5 bg-white border border-slate-200 hover:border-slate-350 text-slate-700 rounded-lg text-[9px] uppercase font-mono tracking-widest font-black transition cursor-pointer"
                >
                  DISPATCHED
                </button>
                <button
                  type="button"
                  disabled={updating || dispatchItem.status === 'Delivered'}
                  onClick={() => handleUpdateStatus('Delivered')}
                  className="p-2.5 bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-lg text-[9px] uppercase font-mono tracking-widest font-black transition cursor-pointer"
                >
                  DELIVERED
                </button>
                <button
                  type="button"
                  disabled={updating || dispatchItem.status === 'Planned'}
                  onClick={() => handleUpdateStatus('Planned')}
                  className="p-2.5 bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 rounded-lg text-[9px] uppercase font-mono tracking-widest font-black transition cursor-pointer"
                >
                  PLANNED
                </button>
                <button
                  type="button"
                  disabled={updating || dispatchItem.status === 'Cancelled'}
                  onClick={() => handleUpdateStatus('Cancelled')}
                  className="p-2.5 bg-white border border-rose-200 text-rose-800 hover:bg-rose-50 rounded-lg text-[9px] uppercase font-mono tracking-widest font-black transition cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>

          {/* Card: LR Scans & Dispatch Proof of Deliveries */}
          <div className="bg-white border rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <FileSymlink className="h-4 w-4 text-sky-500" />
              <span>Receipt Scans & Delivery Proofs</span>
            </h4>
            
            {tenant?.id && (
              <>
                <AttachmentsList 
                  entityType="dispatch" 
                  entityId={dispatchId!} 
                  tenantId={tenant.id} 
                  userProfile={profile} 
                  userRole={profile?.role} 
                />
                <div className="pt-2">
                  <FileUploader 
                    entityType="dispatch" 
                    entityId={dispatchId!} 
                    tenantId={tenant.id} 
                    userProfile={profile} 
                  />
                </div>
              </>
            )}
          </div>

          {/* Liaison contacts directory */}
          <div className="bg-white border rounded-xl p-5 shadow-2xs space-y-4.5">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider">
              Logistics Contacts Directory
            </h4>

            <div className="space-y-3 font-mono text-xs text-slate-755">
              
              {/* Linked Client customer record */}
              <div className="p-3 bg-slate-50 border border-slate-105 rounded-lg space-y-1">
                <span className="text-[9px] text-slate-405 uppercase block font-bold">Consignee client</span>
                <span className="font-bold text-slate-900 block font-sans">{dispatchItem.customerName || 'B2B Client'}</span>
              </div>

              {/* Driver liaison block */}
              {dispatchItem.driverPhone && (
                <div className="p-3 bg-slate-50 border border-slate-105 rounded-lg space-y-1">
                  <span className="text-[9px] text-slate-405 uppercase block font-bold leading-none">Vehicle operator</span>
                  <p className="font-semibold text-slate-805 block font-sans">{dispatchItem.driverName || 'Shivraj Singh'}</p>
                  <a 
                    href={`tel:${dispatchItem.driverPhone}`}
                    className="inline-flex items-center space-x-1.5 text-indigo-650 hover:underline text-[11px] font-bold"
                  >
                    <PhoneCall className="h-3 w-3" />
                    <span>Call: {dispatchItem.driverPhone}</span>
                  </a>
                </div>
              )}

              {/* Linked Sales original order reference link */}
              {dispatchItem.orderId && (
                <div className="p-3 bg-slate-50 border border-slate-105 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-405 uppercase block font-bold">Sales Context order</span>
                    <span className="font-bold text-slate-905 text-[11px]">{dispatchItem.orderId}</span>
                  </div>
                  <button
                    onClick={() => navigate(`/orders`, { state: { preselectedOrderId: dispatchItem.orderId } })}
                    className="p-1.5 bg-white border rounded hover:text-indigo-655 cursor-pointer"
                    title="View original work order timeline"
                  >
                    <Briefcase className="h-4 w-4" />
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>

      {/* Certificate of Conformance Modal */}
      {showCocModal && releaseCheck?.fqcOrder && (
        <CertificateOfConformanceModal
          order={releaseCheck.fqcOrder}
          isOpen={showCocModal}
          onClose={() => setShowCocModal(false)}
        />
      )}

      {/* Cancellation & Voiding Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Void & Cancel Consignment?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to cancel dispatch <strong>#{dispatchItem.dispatchNumber || dispatchItem.invoiceNumber}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1.5 text-amber-900 font-mono">
              <div className="flex items-center space-x-1.5 font-bold">
                <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                <span>Automated Cancellation Reversals:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800 font-sans">
                <li>Dispatch record will be marked as <strong>Cancelled & Voided</strong>.</li>
                <li>Dispatched quantities will be <strong>restored to the parent Sales Order</strong>.</li>
                <li>Parent order status will revert to <strong>Partially Dispatched</strong> or <strong>In Production</strong>.</li>
                <li>Linked follow-on Backorders will be <strong>flagged for review</strong> (preserved for audit history, not deleted).</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold rounded-lg transition cursor-pointer"
              >
                Keep Active
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-lg transition cursor-pointer flex items-center space-x-1.5"
              >
                <AlertOctagon className="h-3.5 w-3.5" />
                <span>{cancelling ? 'Voiding Consignment...' : 'Confirm Void & Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Partial Invoice Modal */}
      {showInvoiceModal && dispatchItem && (
        <GeneratePartialInvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          dispatch={dispatchItem}
          onSuccess={(inv) => {
            setLinkedInvoice(inv);
            setRefreshInvoicingKey(k => k + 1);
          }}
        />
      )}

      {/* Sales Return Credit Note Modal (Acceptance Criteria 1 & 2) */}
      {showCreditNoteModal && (linkedInvoice || currentDispatch || dispatchItem) && (
        <SalesReturnCreditNoteModal
          isOpen={showCreditNoteModal}
          onClose={() => setShowCreditNoteModal(false)}
          invoice={linkedInvoice || {
            id: (currentDispatch || dispatchItem).invoiceId || (currentDispatch || dispatchItem).invoiceNumber,
            invoiceNumber: (currentDispatch || dispatchItem).invoiceNumber,
            tenantId: tenant?.id || '',
            orderId: (currentDispatch || dispatchItem).orderId,
            orderNumber: (currentDispatch || dispatchItem).orderId,
            dispatchId: (currentDispatch || dispatchItem).id,
            dispatchNumber: (currentDispatch || dispatchItem).dispatchNumber,
            customerId: (currentDispatch || dispatchItem).customerId || '',
            customerName: (currentDispatch || dispatchItem).customerName || 'Customer',
            amount: totalCargoValue,
            subtotal: totalCargoValue,
            taxAmount: Math.round(totalCargoValue * 0.18),
            total: Math.round(totalCargoValue * 1.18),
            outstanding: Math.round(totalCargoValue * 1.18),
            totalPaid: 0,
            totalCredited: 0,
            status: 'issued',
            invoiceDate: (currentDispatch || dispatchItem).dispatchDate || new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            items: (currentDispatch || dispatchItem).items?.map((it, idx) => ({
              id: it.id || `line-${idx}`,
              lineItemId: it.id || `line-${idx}`,
              name: it.name,
              hsn: (it as any).hsn || '8483',
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              gstPercent: it.gstPercent || 18,
              taxableValue: it.quantity * it.unitPrice,
              cgst: Math.round(it.quantity * it.unitPrice * 0.09),
              sgst: Math.round(it.quantity * it.unitPrice * 0.09),
              igst: 0,
              gstAmount: Math.round(it.quantity * it.unitPrice * 0.18),
              total: Math.round(it.quantity * it.unitPrice * 1.18)
            })) || [],
            eInvoice: (currentDispatch || dispatchItem).eInvoice,
            irn: (currentDispatch || dispatchItem).irn || (currentDispatch || dispatchItem).eInvoice?.irn,
            createdAt: new Date().toISOString(),
            createdBy: profile?.uid || 'user',
            createdByName: profile?.name || 'User'
          }}
          dispatch={currentDispatch || dispatchItem}
          onSuccess={(cn) => {
            setCreditNotes(prev => [cn, ...prev]);
            setCurrentDispatch(prev => prev ? {
              ...prev,
              creditNoteIssued: true,
              lastCreditNoteNumber: cn.creditNoteNumber,
              lastCreditNoteIrn: cn.creditNoteIrn,
              salesReturnRecorded: true
            } : null);
            setRefreshInvoicingKey(k => k + 1);
            handleReloadDispatch();
          }}
        />
      )}

      {/* Generate e-Invoice Modal (IRN & Signed QR) */}
      {showEInvoiceModal && (currentDispatch || dispatchItem) && (
        <GenerateEInvoiceModal
          isOpen={showEInvoiceModal}
          onClose={() => setShowEInvoiceModal(false)}
          dispatch={currentDispatch || dispatchItem}
          onSuccess={(eInvoiceData) => {
            setCurrentDispatch(prev => prev ? { 
              ...prev, 
              eInvoice: eInvoiceData, 
              eInvoiceStatus: eInvoiceData.status, 
              irn: eInvoiceData.irn, 
              ackNo: eInvoiceData.ackNo 
            } : null);
            setShowEInvoiceModal(false);
          }}
        />
      )}

      {/* Generate e-Way Bill Modal (Part A & Part B) */}
      {showEWayBillModal && (currentDispatch || dispatchItem) && (
        <GenerateEWayBillModal
          isOpen={showEWayBillModal}
          onClose={() => setShowEWayBillModal(false)}
          dispatch={currentDispatch || dispatchItem}
          onSuccess={(ewbData) => {
            setCurrentDispatch(prev => prev ? {
              ...prev,
              ewayBill: ewbData,
              ewbNumber: ewbData.ewayBillNumber || ewbData.ewbNumber,
              ewbValidUntil: ewbData.validUntil || ewbData.validUpto,
              ewbStatus: ewbData.status,
              ewbDistanceKm: ewbData.distanceKm,
              transporterId: ewbData.transporterId || prev.transporterId,
              vehicleNumber: ewbData.vehicleNumber || prev.vehicleNumber
            } : null);
            setShowEWayBillModal(false);
          }}
        />
      )}

    </div>
  );
};
