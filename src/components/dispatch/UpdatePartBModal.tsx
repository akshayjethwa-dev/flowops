// src/components/dispatch/UpdatePartBModal.tsx

import React, { useState } from 'react';
import { 
  X, 
  Truck, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  MapPin, 
  Navigation,
  FileText
} from 'lucide-react';
import { Dispatch } from '../../types';
import { EWayBillData } from '../../types/ewayBill';
import { EWayBillService } from '../../services/ewayBillService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface UpdatePartBModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: Dispatch;
  onSuccess: (updatedEwb: EWayBillData) => void;
}

export const UpdatePartBModal: React.FC<UpdatePartBModalProps> = ({
  isOpen,
  onClose,
  dispatch,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const ewb: EWayBillData | undefined = dispatch.ewayBill;

  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  const [fromPlace, setFromPlace] = useState('Pune Transit Hub');
  const [fromState, setFromState] = useState('Maharashtra');
  const [reasonCode, setReasonCode] = useState<'1' | '2' | '3'>('2'); // 1-Breakdown, 2-Transshipment, 3-Others
  const [remarks, setRemarks] = useState('');
  const [transDocNo, setTransDocNo] = useState(`LR-TR-${Math.floor(100000 + Math.random() * 900000)}`);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !ewb) return null;

  const normalizedVehicle = EWayBillService.normalizeVehicleNumber(newVehicleNumber);
  const isVehicleFormatValid = EWayBillService.isValidVehicleFormat(newVehicleNumber);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;

    if (!isVehicleFormatValid) {
      setErrorMsg('Vehicle number must be in format MH12AB1234.');
      toastError('Invalid Vehicle', 'Vehicle number must be in format MH12AB1234.');
      return;
    }

    if (!remarks.trim() || remarks.trim().length < 5) {
      setErrorMsg('Mandatory transit justification remarks (min 5 characters) are required.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const updatedEwb = await EWayBillService.updatePartBVehicle(
        tenant.id,
        dispatch.id,
        {
          newVehicleNumber: normalizedVehicle,
          fromPlace: fromPlace.trim(),
          fromState: fromState.trim(),
          reasonCode,
          remarks: remarks.trim(),
          transDocNo
        },
        profile ? {
          userId: profile.uid,
          name: profile.name || profile.email || 'Dispatch Supervisor',
          role: profile.role || 'dispatch'
        } : undefined
      );

      toastSuccess(
        'Part-B Updated (Vehicle Changed)',
        `Vehicle on EWB #${ewb.ewayBillNumber} updated to ${normalizedVehicle}. Audit trail updated.`
      );
      onSuccess(updatedEwb);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update Part B vehicle on e-Way Bill portal.');
      toastError('Update Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-150">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded uppercase">
                Part-B Vehicle Update (EC 5)
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Update Vehicle on EWB #{ewb.ewayBillNumber}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Vehicle Context */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-xs font-mono">
          <div>
            <span className="text-[9px] text-slate-400 uppercase block font-bold">Active Vehicle:</span>
            <span className="font-bold text-slate-800 uppercase">{ewb.vehicleNumber}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase block font-bold">Transporter:</span>
            <span className="font-semibold text-slate-700">{ewb.transporterName}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          {/* New Vehicle Number */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              New Vehicle Number * (Format: MH12AB1234)
            </label>
            <div className="flex space-x-1">
              <input
                type="text"
                required
                value={newVehicleNumber}
                onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g. MH12AB1234"
                className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setNewVehicleNumber('DL01AB9876')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-mono text-slate-600 cursor-pointer"
              >
                Sample
              </button>
            </div>
            {!isVehicleFormatValid && newVehicleNumber.length > 0 && (
              <span className="text-[10px] text-rose-600 block mt-0.5 font-sans">
                Vehicle number must be in format MH12AB1234.
              </span>
            )}
          </div>

          {/* Reason for Change */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              Statutory Reason for Vehicle Change *
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
            >
              <option value="2">2 - Due to Transshipment (Hub consolidation / vehicle relay)</option>
              <option value="1">1 - Due to Breakdown (Mechanical failure mid-transit)</option>
              <option value="3">3 - Others (Carrier operational routing re-assignment)</option>
            </select>
          </div>

          {/* Current Location / Hub */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                From Place (Current Hub / City) *
              </label>
              <input
                type="text"
                required
                value={fromPlace}
                onChange={(e) => setFromPlace(e.target.value)}
                placeholder="e.g. Surat Hub"
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                From State *
              </label>
              <input
                type="text"
                required
                value={fromState}
                onChange={(e) => setFromState(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
              />
            </div>
          </div>

          {/* Justification remarks */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              Transit Audit Justification Remarks (min 5 chars) *
            </label>
            <textarea
              rows={2}
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Transferred cargo to replacement truck at Chakan checkpoint..."
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center space-x-1.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-150">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !isVehicleFormatValid}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm cursor-pointer transition"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting Part-B...</span>
                </>
              ) : (
                <>
                  <Truck className="h-3.5 w-3.5" />
                  <span>Update Vehicle on Portal</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
