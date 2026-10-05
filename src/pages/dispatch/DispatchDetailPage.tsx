// src/pages/dispatch/DispatchDetailPage.tsx

import React, { useState } from 'react';
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
  Printer
} from 'lucide-react';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentsList } from '../../components/AttachmentsList';
import { FileSymlink } from 'lucide-react';


export const DispatchDetailPage: React.FC = () => {
  const { dispatchId } = useParams<{ dispatchId: string }>();
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { dispatchItem, loading, error, updateDispatchStatus } = useDispatchDetail(tenant?.id, dispatchId);

  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleUpdateStatus = async (newStatus: 'Planned' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'shipped' | 'delivered') => {
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

          <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
            <button
              onClick={() => window.print()}
              className="border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase font-black tracking-wider flex items-center space-x-1.5 cursor-pointer shadow-3xs transition-all select-none mr-2"
              title="Print standard delivery / dispatch consignment slip"
            >
              <Printer className="h-4 w-4 text-slate-400 shrink-0" />
              <span>Print Slip</span>
            </button>
            <span className="text-[10px] font-mono text-slate-450 uppercase">Current Status:</span>
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
      </div>

      {/* Primary Split content areas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Loaded Freight specifications list (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">

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
                      <p className="text-[10px] text-slate-400">Component Unit rate: ₹{itm.unitPrice.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-extrabold text-[10px]">Qty: {itm.quantity}</span>
                      <p className="text-[10px] font-bold text-slate-700 mt-1">₹{(itm.total || (itm.quantity * itm.unitPrice)).toLocaleString('en-IN')}</p>
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

        </div>

        {/* RIGHT COLUMN: Action triggers, transporter details (1/3 width) */}
        <div className="space-y-6">

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

    </div>
  );
};
