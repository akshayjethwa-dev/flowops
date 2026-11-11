// src/components/dispatch/ExtendEWayBillModal.tsx

import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Calendar,
  Navigation,
  MapPin
} from 'lucide-react';
import { Dispatch } from '../../types';
import { EWayBillData } from '../../types/ewayBill';
import { EWayBillService } from '../../services/ewayBillService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface ExtendEWayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: Dispatch;
  onSuccess: (updatedEwb: EWayBillData) => void;
}

export const ExtendEWayBillModal: React.FC<ExtendEWayBillModalProps> = ({
  isOpen,
  onClose,
  dispatch,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const ewb: EWayBillData | undefined = dispatch.ewayBill;

  const [remainingDistanceKm, setRemainingDistanceKm] = useState<number>(120);
  const [currentLocation, setCurrentLocation] = useState('Highway Toll Plaza, Navsari Checkpoint');
  const [consignmentStatus, setConsignmentStatus] = useState<'in_transit' | 'in_movement'>('in_transit');
  const [reason, setReason] = useState('Transit delay due to heavy congestion / road work');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !ewb) return null;

  // Extension calculation preview (200 km per day for regular road freight)
  const additionalDays = Math.max(1, Math.ceil(remainingDistanceKm / (ewb.vehicleType === 'over_dimensional' ? 20 : 200)));
  const prevValidDate = new Date(ewb.validUntil);
  const baseDate = new Date() > prevValidDate ? new Date() : prevValidDate;
  const newDate = new Date(baseDate.getTime());
  newDate.setDate(newDate.getDate() + additionalDays);
  newDate.setHours(23, 59, 59, 999);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;

    if (remainingDistanceKm <= 0) {
      setErrorMsg('Remaining distance must be at least 1 KM.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMsg('Mandatory delay reason (min 5 characters) is required by GST rules.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const updatedEwb = await EWayBillService.extendEWayBillValidity(
        tenant.id,
        dispatch.id,
        {
          remainingDistanceKm,
          currentLocation: currentLocation.trim(),
          reason: reason.trim(),
          consignmentStatus
        },
        profile ? {
          userId: profile.uid,
          name: profile.name || profile.email || 'Dispatch Supervisor',
          role: profile.role || 'dispatch'
        } : undefined
      );

      toastSuccess(
        'e-Way Bill Validity Extended',
        `Validity extended by ${additionalDays} day(s) until ${new Date(updatedEwb.validUntil).toLocaleDateString()}. EWB is now Active.`
      );
      onSuccess(updatedEwb);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to extend e-Way Bill validity.');
      toastError('Extension Failed', err.message);
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
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded uppercase">
                Statutory Validity Extension (EC 4)
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Extend Validity for EWB #{ewb.ewayBillNumber}
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

        {/* Validity Comparison Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
            <span className="text-slate-500 uppercase text-[10px]">Previous Expiry:</span>
            <span className="font-bold text-rose-700">
              {new Date(ewb.validUntil).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500 uppercase text-[10px]">New Extended Expiry:</span>
            <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {newDate.toLocaleString()} (+{additionalDays} Day{additionalDays > 1 ? 's' : ''})
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          {/* Remaining Distance */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              Remaining Distance to Destination (in KM) *
            </label>
            <input
              type="number"
              min={1}
              max={3000}
              required
              value={remainingDistanceKm}
              onChange={(e) => setRemainingDistanceKm(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
              placeholder="e.g. 120"
            />
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Calculates +1 Day validity per 200 KM remaining
            </span>
          </div>

          {/* Current Location */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              Current Consignment Location (Checkpost / City) *
            </label>
            <input
              type="text"
              required
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              placeholder="e.g. Highway Toll Plaza, Navsari Checkpoint"
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
            />
          </div>

          {/* Consignment Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              Consignment Status in Transit *
            </label>
            <select
              value={consignmentStatus}
              onChange={(e) => setConsignmentStatus(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
            >
              <option value="in_transit">In Transit (Vehicle moving on route)</option>
              <option value="in_movement">In Movement (Halted at transshipment point / depot)</option>
            </select>
          </div>

          {/* Reason for Extension */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
              Statutory Reason for Extension (min 5 chars) *
            </label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Traffic block on NH48 due to heavy rains and road repair..."
              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
              {errorMsg}
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
              disabled={submitting || remainingDistanceKm <= 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm cursor-pointer transition"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Calling Extension API...</span>
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  <span>Extend Validity by {additionalDays} Day(s)</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
