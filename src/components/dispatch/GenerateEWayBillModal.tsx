// src/components/dispatch/GenerateEWayBillModal.tsx

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  MapPin, 
  ShieldCheck, 
  FileText, 
  Send, 
  RefreshCw, 
  Info,
  Calendar,
  Navigation,
  ExternalLink
} from 'lucide-react';
import { Dispatch } from '../../types';
import { EWayBillData, EwbVehicleType, EwbTransportMode } from '../../types/ewayBill';
import { EWayBillService, DEFAULT_EWAY_BILL_CONFIG } from '../../services/ewayBillService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { downloadEWayBillPdf } from '../../utils/ewayBillPdfGenerator';

interface GenerateEWayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: Dispatch;
  onSuccess: (ewb: EWayBillData) => void;
}

export const GenerateEWayBillModal: React.FC<GenerateEWayBillModalProps> = ({
  isOpen,
  onClose,
  dispatch,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();

  // Form Fields
  const [transporterId, setTransporterId] = useState(dispatch.carrierGstin || (dispatch as any).transporterId || '27AABCT9981K1Z3');
  const [transporterName, setTransporterName] = useState(dispatch.transporter || 'VRL Logistics India Ltd');
  const [vehicleNumber, setVehicleNumber] = useState(dispatch.vehicleNumber || 'MH12AB1234');
  const [vehicleType, setVehicleType] = useState<EwbVehicleType>('regular');
  const [transportMode, setTransportMode] = useState<EwbTransportMode>('road');
  const [distanceKm, setDistanceKm] = useState<number>((dispatch as any).distanceKm || (dispatch as any).ewbDistanceKm || 180);
  const [fromPincode, setFromPincode] = useState('410501'); // Chakan plant
  const [toPincode, setToPincode] = useState('411018'); // Recipient
  const [thresholdValue, setThresholdValue] = useState<number>(DEFAULT_EWAY_BILL_CONFIG.thresholdValue);
  const [allowVoluntary, setAllowVoluntary] = useState(false);

  // Simulation Toggle for Acceptance Criteria EC 6
  const [simulateDistanceMismatch, setSimulateDistanceMismatch] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedEwb, setGeneratedEwb] = useState<EWayBillData | null>(null);

  // Initialize values
  useEffect(() => {
    if (!isOpen || !dispatch) return;
    setTransporterId(dispatch.carrierGstin || (dispatch as any).transporterId || '27AABCT9981K1Z3');
    setTransporterName(dispatch.transporter || 'VRL Logistics India Ltd');
    setVehicleNumber(dispatch.vehicleNumber || 'MH12AB1234');
    setDistanceKm((dispatch as any).distanceKm || (dispatch as any).ewbDistanceKm || 180);
    setErrorMessage(null);
    setGeneratedEwb(dispatch.ewayBill || null);
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  // Real-time pre-flight eligibility check
  const validation = EWayBillService.validateEWayBillEligibility(dispatch, {
    thresholdValue,
    distanceKm,
    vehicleNumber,
    transporterId
  });

  const isEligible = validation.isValid || (allowVoluntary && validation.checks.vehicleFormatValid && validation.checks.transporterIdValid && validation.checks.distanceValid);

  // Calculate estimated validity duration preview
  const validityPreview = EWayBillService.calculateValidity(distanceKm, vehicleType);

  const handleGenerate = async () => {
    if (!tenant?.id) {
      toastError('Error', 'Tenant workspace not identified.');
      return;
    }

    if (!isEligible) {
      const primaryErr = validation.errors[0] || 'Validation failed for e-Way Bill.';
      setErrorMessage(primaryErr);
      toastError('Validation Failed', primaryErr);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const ewbData = await EWayBillService.generateEWayBillForDispatch(
        tenant.id,
        dispatch,
        {
          transporterId: transporterId.trim().toUpperCase(),
          transporterName: transporterName.trim(),
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
          vehicleType,
          transportMode,
          distanceKm,
          fromPincode,
          toPincode,
          simulateDistanceMismatch
        },
        profile ? {
          userId: profile.uid,
          name: profile.name || profile.email || 'Dispatch Clerk',
          role: profile.role || 'dispatch'
        } : undefined
      );

      setGeneratedEwb(ewbData);
      onSuccess(ewbData);
      toastSuccess(
        'e-Way Bill Generated Successfully',
        `EWB No: ${ewbData.ewayBillNumber} · Valid until ${new Date(ewbData.validUntil).toLocaleDateString()}`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate e-Way Bill via API.');
      toastError('Generation Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 font-sans animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-150">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded uppercase">
                  GST FORM GST EWB-01
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Rule 138 Transit Permit
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                Generate e-Way Bill for #{dispatch.dispatchNumber || dispatch.invoiceNumber}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success View */}
        {generatedEwb && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>e-Way Bill Active on National Portal</span>
            </div>

            <div className="bg-white p-3 rounded-lg border border-emerald-200 font-mono text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[10px] uppercase font-bold">E-Way Bill Number:</span>
                <span className="text-emerald-700 font-bold text-[10px] uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Active
                </span>
              </div>
              <p className="text-xl font-black text-indigo-950 tracking-wider">
                {generatedEwb.ewayBillNumber}
              </p>
              
              <div className="grid grid-cols-2 gap-2 pt-1 border-t text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Vehicle No:</span>
                  <span className="font-bold text-slate-800 uppercase">{generatedEwb.vehicleNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Valid Until:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(generatedEwb.validUntil).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => downloadEWayBillPdf(dispatch, generatedEwb)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                <span>Print e-Way Bill Slip (PDF)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Input Form & Verification Checklist */}
        {!generatedEwb && (
          <div className="space-y-4">

            {/* Pre-flight Checklist Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <span>Statutory Transit Pre-flight Checks</span>
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  isEligible 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  {isEligible ? 'Passed Validations' : 'Requirements Incomplete'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* 1. Value threshold check (EC 1) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {validation.checks.thresholdExceeded ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">Consignment Value:</span>
                      <span className="font-mono text-[11px] text-slate-600 ml-1.5">
                        ₹{validation.dispatchValue.toLocaleString('en-IN')} (Threshold: ₹{thresholdValue.toLocaleString('en-IN')})
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${
                    validation.checks.thresholdExceeded ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {validation.checks.thresholdExceeded ? 'Exceeds ₹50k Mandatory' : 'Below ₹50k (EC 1)'}
                  </span>
                </div>

                {/* 2. Vehicle format check (EC 2) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {validation.checks.vehicleFormatValid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">Vehicle Number:</span>
                      <span className="font-mono text-[11px] text-slate-600 ml-1.5 uppercase">
                        {vehicleNumber || 'Missing'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${
                    validation.checks.vehicleFormatValid ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {validation.checks.vehicleFormatValid ? 'Valid Format (MH12AB1234)' : 'Invalid Format (EC 2)'}
                  </span>
                </div>

                {/* 3. Transporter ID check (EC 3) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {validation.checks.transporterIdValid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">Transporter ID:</span>
                      <span className="font-mono text-[11px] text-slate-600 ml-1.5 uppercase">
                        {transporterId || 'Missing'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${
                    validation.checks.transporterIdValid ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {validation.checks.transporterIdValid ? 'Populated' : 'Missing ID (EC 3)'}
                  </span>
                </div>

                {/* 4. Distance & Document check */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {validation.checks.distanceValid && validation.checks.irnOrInvoicePresent ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">Distance & Document:</span>
                      <span className="font-mono text-[11px] text-slate-600 ml-1.5">
                        {distanceKm} KM · {dispatch.irn ? 'e-Invoice IRN Linked' : (dispatch.invoiceNumber || 'Invoice Linked')}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-600">
                    Est. Validity: {validityPreview.totalDays} day(s)
                  </span>
                </div>
              </div>

              {/* EC 1 Notice when below threshold */}
              {!validation.checks.thresholdExceeded && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between text-xs text-amber-900 mt-2">
                  <div className="flex items-center space-x-2">
                    <Info className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-[11px]">
                      <strong>Notice:</strong> e-Way Bill not required below ₹50,000.
                    </span>
                  </div>
                  <label className="flex items-center space-x-1.5 text-[10px] font-mono font-bold text-amber-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowVoluntary}
                      onChange={(e) => setAllowVoluntary(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Voluntary EWB</span>
                  </label>
                </div>
              )}
            </div>

            {/* Input Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              
              {/* Vehicle Number Input (EC 2) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Vehicle Number * (Format: MH12AB1234)
                </label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    required
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. MH12AB1234"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setVehicleNumber('GJ06ZZ4012')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-mono text-slate-600 cursor-pointer"
                    title="Fill sample valid vehicle"
                  >
                    Sample
                  </button>
                </div>
                {!validation.checks.vehicleFormatValid && vehicleNumber.length > 0 && (
                  <span className="text-[10px] text-rose-600 block mt-0.5 font-sans">
                    Vehicle number must be in format MH12AB1234.
                  </span>
                )}
              </div>

              {/* Transporter ID Input (EC 3) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Transporter ID / GSTIN *
                </label>
                <div className="flex space-x-1">
                  <input
                    type="text"
                    required
                    value={transporterId}
                    onChange={(e) => setTransporterId(e.target.value.toUpperCase())}
                    placeholder="e.g. 27AABCT9981K1Z3"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTransporterId('27AABCT9981K1Z3')}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-mono text-slate-600 cursor-pointer"
                    title="Fill sample transporter ID"
                  >
                    Sample
                  </button>
                </div>
              </div>

              {/* Distance in KM */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Transit Distance (in KM) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={4000}
                  required
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                  placeholder="Distance between pins"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Statutory Rule: 1 day per 200 KM (approx {validityPreview.totalDays} day validity)
                </span>
              </div>

              {/* Vehicle Type */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Vehicle Type Cargo Category
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as EwbVehicleType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                >
                  <option value="regular">Regular Road Freight (200 KM / Day)</option>
                  <option value="over_dimensional">Over Dimensional Cargo (20 KM / Day)</option>
                </select>
              </div>

              {/* Transporter Name */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Transporter / Fleet Partner Name
                </label>
                <input
                  type="text"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
                  placeholder="e.g. VRL Logistics / SafeExpress"
                />
              </div>
            </div>

            {/* Edge Case 6 Simulation Toggle: Distance Mismatch */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Verification Simulation Scenarios
              </span>
              <label className="flex items-center space-x-2 text-xs cursor-pointer p-1 rounded hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={simulateDistanceMismatch}
                  onChange={(e) => setSimulateDistanceMismatch(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-slate-800">Simulate Distance Mismatch Error (EC 6)</span>
                  <span className="text-[10px] text-slate-500 block">
                    Tests API rejection: "Distance validation failed. Correct the distance and retry."
                  </span>
                </div>
              </label>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-1 text-xs text-rose-900">
                <div className="flex items-center space-x-1.5 font-bold">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>e-Way Bill Generation Error</span>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed font-sans">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-150">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting || !isEligible}
                onClick={handleGenerate}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-sm cursor-pointer transition"
                title={!isEligible ? validation.errors[0] : 'Call e-Way Bill API and generate statutory permit'}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Calling e-Way Bill API...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Generate e-Way Bill</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
