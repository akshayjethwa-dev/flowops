// src/components/job-work/CreateOutwardGatePassModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Truck, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  Building2, 
  Package, 
  FileText, 
  ShieldCheck, 
  Hash, 
  CheckCircle2,
  Info
} from 'lucide-react';
import { JobWorkGatePass, GatePassItem, VehicleAndTransporterDetails } from '../../types/jobWork';
import { StockItem } from '../../types';
import { Subcontractor } from '../../types/subcontractor';
import { fetchSubcontractors } from '../../services/subcontractorService';
import { createOutwardGatePass, validateOwnStockAvailability } from '../../services/jobWorkService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';

interface CreateOutwardGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newPass: JobWorkGatePass) => void;
  stockItems: StockItem[];
  prefillVendor?: Subcontractor | null;
  prefillOrderNumber?: string;
}

const COMMON_NATURE_OF_WORK = [
  'Heat Treatment (Carburizing & Hardening)',
  'Induction Hardening & Tempering',
  'Electroplating & Zinc Phosphating',
  'Hard Chrome Plating',
  'Powder Coating & 7-Tank Painting',
  'CNC 4/5-Axis Milling & Turning',
  'Precision Cylindrical Grinding',
  'Gear Hobbing & Spline Broaching',
  'Laser Cutting & CNC Bending',
  'NDT Testing & CMM Inspection'
];

export const CreateOutwardGatePassModal: React.FC<CreateOutwardGatePassModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  stockItems,
  prefillVendor,
  prefillOrderNumber
}) => {
  const { tenant, user, isSandboxMode } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [customVendorName, setCustomVendorName] = useState<string>('');
  const [vendorGst, setVendorGst] = useState<string>('');
  const [vendorAddress, setVendorAddress] = useState<string>('');
  const [vendorPhone, setVendorPhone] = useState<string>('');

  const [natureOfWork, setNatureOfWork] = useState<string>('Heat Treatment');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [dispatchedDate, setDispatchedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [linkedJwoNumber, setLinkedJwoNumber] = useState<string>(prefillOrderNumber || '');
  const [linkedWorkOrderNumber, setLinkedWorkOrderNumber] = useState<string>('');

  // Transport details
  const [transportMode, setTransportMode] = useState<'road' | 'courier' | 'hand_delivery' | 'rail' | 'air'>('road');
  const [transporterName, setTransporterName] = useState<string>('Direct Factory Pickup');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [lrNumber, setLrNumber] = useState<string>('');
  const [ewayBillNumber, setEwayBillNumber] = useState<string>('');
  const [internalRemarks, setInternalRemarks] = useState<string>('');

  // Multi-material line items
  const [items, setItems] = useState<Array<{
    tempId: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    quantity: number | '';
    uom: string;
    batchHeatNo: string;
    ratePerUnit: number | '';
    remarks: string;
  }>>([
    {
      tempId: 'line-1',
      materialId: '',
      materialCode: 'MS-CAST-01',
      materialName: 'MS Casting Grade FG260',
      quantity: 500,
      uom: 'Kg',
      batchHeatNo: '',
      ratePerUnit: 140,
      remarks: 'Sealed Quench Carburizing required.'
    }
  ]);

  // Load registered vendors
  useEffect(() => {
    if (tenant?.id) {
      setLoadingVendors(true);
      fetchSubcontractors(tenant.id, isSandboxMode)
        .then(subs => {
          setSubcontractors(subs);
          if (prefillVendor) {
            setSelectedVendorId(prefillVendor.id);
            setCustomVendorName(prefillVendor.name);
            setVendorGst(prefillVendor.gstNumber || '');
            setVendorAddress(prefillVendor.address || prefillVendor.city || '');
            setVendorPhone(prefillVendor.phone || '');
          } else if (subs.length > 0 && !selectedVendorId) {
            const first = subs[0];
            setSelectedVendorId(first.id);
            setCustomVendorName(first.name);
            setVendorGst(first.gstNumber || '');
            setVendorAddress(first.address || first.city || '');
            setVendorPhone(first.phone || '');
          }
        })
        .finally(() => setLoadingVendors(false));
    }
  }, [tenant?.id, isSandboxMode, prefillVendor]);

  // Handle vendor dropdown change
  const handleVendorChange = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    if (vendorId === 'custom') {
      setCustomVendorName('');
      setVendorGst('');
      setVendorAddress('');
      setVendorPhone('');
    } else {
      const match = subcontractors.find(s => s.id === vendorId);
      if (match) {
        setCustomVendorName(match.name);
        setVendorGst(match.gstNumber || '');
        setVendorAddress(match.address || match.city || '');
        setVendorPhone(match.phone || '');
      }
    }
  };

  // Add line item
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        tempId: `line-${Date.now()}`,
        materialId: '',
        materialCode: '',
        materialName: '',
        quantity: '',
        uom: 'Kg',
        batchHeatNo: '',
        ratePerUnit: '',
        remarks: ''
      }
    ]);
  };

  // Remove line item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toastError('At least one material line item is required.');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Handle material selection from dropdown
  const handleSelectMaterial = (index: number, stockItemId: string) => {
    const matched = stockItems.find(s => s.id === stockItemId);
    if (matched) {
      setItems(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          materialId: matched.id,
          materialCode: matched.code,
          materialName: matched.name,
          uom: matched.unit || 'Kg'
        };
        return next;
      });
    }
  };

  // Update line item field
  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Live stock validations
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    items.forEach((it, idx) => {
      const qtyNum = typeof it.quantity === 'number' ? it.quantity : parseFloat(it.quantity as string);
      if (!it.materialName && !it.materialCode) {
        errors.push(`Line #${idx + 1}: Please enter a Material Name or Code.`);
      }
      if (isNaN(qtyNum) || qtyNum <= 0) {
        errors.push(`Line #${idx + 1}: Please enter a valid dispatch quantity (> 0).`);
      } else {
        // Find in stock items
        const stockMatch = stockItems.find(s => 
          (it.materialId && s.id === it.materialId) ||
          (it.materialCode && s.code?.toLowerCase() === it.materialCode.toLowerCase()) ||
          (it.materialName && s.name?.toLowerCase() === it.materialName.toLowerCase())
        );

        if (stockMatch && qtyNum > stockMatch.currentQty) {
          errors.push(
            `Insufficient own stock for "${stockMatch.name || it.materialName}". Available: ${stockMatch.currentQty} ${stockMatch.unit || it.uom}.`
          );
        }
      }
    });

    if (!customVendorName.trim()) {
      errors.push('Please specify the Job Worker / Vendor name.');
    }
    if (!natureOfWork.trim()) {
      errors.push('Please specify the Nature of Job Work.');
    }
    if (!expectedReturnDate) {
      errors.push('Please select the Expected Return Date.');
    }

    return errors;
  }, [items, stockItems, customVendorName, natureOfWork, expectedReturnDate]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validationErrors.length > 0) {
      toastError(validationErrors[0]);
      return;
    }

    if (!tenant?.id || !user) {
      toastError('Session expired. Please log in.');
      return;
    }

    setSubmitting(true);
    try {
      const finalItems: GatePassItem[] = items.map((it, idx) => {
        const qty = typeof it.quantity === 'number' ? it.quantity : parseFloat(it.quantity as string);
        const rate = it.ratePerUnit ? (typeof it.ratePerUnit === 'number' ? it.ratePerUnit : parseFloat(it.ratePerUnit as string)) : 0;
        return {
          id: `item-gp-${Date.now()}-${idx}`,
          materialId: it.materialId || undefined,
          materialCode: it.materialCode || `SKU-${idx + 1}`,
          materialName: it.materialName,
          quantity: qty,
          uom: it.uom || 'Kg',
          batchHeatNo: it.batchHeatNo || undefined,
          ratePerUnit: rate > 0 ? rate : undefined,
          totalValue: rate > 0 ? qty * rate : undefined,
          remarks: it.remarks || undefined,
          returnedQty: 0,
          rejectedQty: 0,
          shortClosedQty: 0,
          balanceWithVendor: qty
        };
      });

      const totalDispatchedQty = finalItems.reduce((acc, curr) => acc + curr.quantity, 0);
      const totalEstimatedValue = finalItems.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);

      const vehicleDetails: VehicleAndTransporterDetails = {
        modeOfTransport: transportMode,
        transporterName: transporterName || 'Direct Factory Pick-up',
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
        lrNumber: lrNumber || undefined,
        lrDate: lrNumber ? dispatchedDate : undefined,
        ewayBillNumber: ewayBillNumber || undefined
      };

      const result = await createOutwardGatePass(
        tenant.id,
        {
          plantId: (user as any)?.assignedPlantIds?.[0] || undefined,
          jobWorkerId: selectedVendorId === 'custom' ? `sub-custom-${Date.now()}` : selectedVendorId,
          jobWorkerName: customVendorName,
          jobWorkerGst: vendorGst || undefined,
          jobWorkerAddress: vendorAddress || undefined,
          jobWorkerPhone: vendorPhone || undefined,
          natureOfWork,
          expectedReturnDate,
          dispatchedDate,
          linkedJobWorkOrderNumber: linkedJwoNumber || undefined,
          linkedWorkOrderNumber: linkedWorkOrderNumber || undefined,
          vehicleDetails,
          items: finalItems,
          totalDispatchedQty,
          totalEstimatedValue,
          gstChallanRule: 'Delivery Challan for Job Work as per Section 143 of CGST Act, 2017 & Rule 45',
          internalRemarks: internalRemarks || undefined
        },
        user,
        isSandboxMode
      );

      toastSuccess(`Gate Pass ${result.gatePassNumber} issued successfully! Own stock deducted.`);
      onCreated(result);
      onClose();
    } catch (err: any) {
      console.error('Failed to create outward gate pass:', err);
      toastError(err.message || 'Failed to issue Gate Pass.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">Create Job-Work Gate Pass (Outward)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Sec 143 CGST Compliant
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Issue a formal digital outward challan to job worker. Own inventory will be reduced & tracked at vendor.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          
          {/* Section 1: Job Worker (Vendor) Selection */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                1. Job Worker (Vendor) Details
              </h3>
              <span className="text-xs text-slate-500">Required</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Certified Subcontractor / Job Worker *
                </label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 bg-white"
                >
                  <option value="" disabled>-- Select Vendor --</option>
                  {subcontractors.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.city || 'Verified'})
                    </option>
                  ))}
                  <option value="custom">+ Other / New Job Worker</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  value={customVendorName}
                  onChange={(e) => setCustomVendorName(e.target.value)}
                  placeholder="e.g. XYZ Heat Treatment Works"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vendor GSTIN (for GST Rule 45 Delivery Challan)
                </label>
                <input
                  type="text"
                  value={vendorGst}
                  onChange={(e) => setVendorGst(e.target.value.toUpperCase())}
                  placeholder="e.g. 27AABCT9981K1Z3"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vendor Workshop Address & Phone
                </label>
                <input
                  type="text"
                  value={vendorAddress}
                  onChange={(e) => setVendorAddress(e.target.value)}
                  placeholder="e.g. Plot W-41, MIDC Chakan Phase 2, Pune"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Process Specifications & Expected Dates */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                2. Job Work Nature & Schedule
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nature of Job Work *
                </label>
                <input
                  type="text"
                  required
                  list="jobwork-suggestions"
                  value={natureOfWork}
                  onChange={(e) => setNatureOfWork(e.target.value)}
                  placeholder="e.g. Heat Treatment"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
                <datalist id="jobwork-suggestions">
                  {COMMON_NATURE_OF_WORK.map(w => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
                <p className="text-[11px] text-slate-500 mt-1">Specify technical treatment / outsourced operation</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dispatched Date *
                </label>
                <input
                  type="date"
                  required
                  value={dispatchedDate}
                  onChange={(e) => setDispatchedDate(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expected Return Date *
                </label>
                <input
                  type="date"
                  required
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 font-semibold text-indigo-900 bg-indigo-50/50"
                />
                <p className="text-[11px] text-indigo-600 mt-1">Used to alert overdue stock with job worker</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Linked Job Work Order / Purchase Order Ref (Optional)
                </label>
                <input
                  type="text"
                  value={linkedJwoNumber}
                  onChange={(e) => setLinkedJwoNumber(e.target.value)}
                  placeholder="e.g. JWO-2026-0042 or SPO-2026-0018 (or Standalone)"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Linked Work Order / Job No (Optional)
                </label>
                <input
                  type="text"
                  value={linkedWorkOrderNumber}
                  onChange={(e) => setLinkedWorkOrderNumber(e.target.value)}
                  placeholder="e.g. WO-2026-001 or JOB-9021"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Material(s) with Quantity and UOM (Core Acceptance Criteria) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-600" />
                  3. Dispatched Material(s) & Own Stock Verification
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Own stock will be automatically deducted. If quantity exceeds available stock, submission will be blocked.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Material
              </button>
            </div>

            <div className="space-y-3">
              {items.map((line, idx) => {
                // Determine matched stock item
                const matchedStock = stockItems.find(s => 
                  (line.materialId && s.id === line.materialId) ||
                  (line.materialCode && s.code?.toLowerCase() === line.materialCode.toLowerCase()) ||
                  (line.materialName && s.name?.toLowerCase() === line.materialName.toLowerCase())
                );
                const availableOwnStock = matchedStock ? matchedStock.currentQty : null;
                const qtyVal = typeof line.quantity === 'number' ? line.quantity : parseFloat(line.quantity as string);
                const isInsufficient = availableOwnStock !== null && !isNaN(qtyVal) && qtyVal > availableOwnStock;

                return (
                  <div 
                    key={line.tempId} 
                    className={`p-3.5 rounded-xl border bg-white space-y-3 transition-colors ${
                      isInsufficient ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">
                          Item Line #{idx + 1}
                        </span>
                        {matchedStock && (
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            isInsufficient 
                              ? 'bg-rose-100 text-rose-800 font-bold border border-rose-300' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            Own Stock: {matchedStock.currentQty} {matchedStock.unit} available
                          </span>
                        )}
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      {/* Pick from stock master */}
                      <div className="md:col-span-5">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Select from Stock Master (or Enter Custom)
                        </label>
                        <select
                          value={line.materialId}
                          onChange={(e) => handleSelectMaterial(idx, e.target.value)}
                          className="w-full text-xs rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-2 bg-white"
                        >
                          <option value="">-- Choose Stock Item --</option>
                          {stockItems.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code}) — [{s.currentQty} {s.unit} available]
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          required
                          value={line.materialName}
                          onChange={(e) => handleItemChange(idx, 'materialName', e.target.value)}
                          placeholder="Material description e.g. MS Casting Grade FG260"
                          className="w-full text-xs rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-2 mt-1.5"
                        />
                      </div>

                      {/* Code */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Material Code / SKU
                        </label>
                        <input
                          type="text"
                          value={line.materialCode}
                          onChange={(e) => handleItemChange(idx, 'materialCode', e.target.value)}
                          placeholder="e.g. MS-CAST-01"
                          className="w-full text-xs rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-2 font-mono"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Dispatch Qty *
                        </label>
                        <input
                          type="number"
                          step="any"
                          required
                          min="0.001"
                          value={line.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="e.g. 500"
                          className={`w-full text-xs font-bold rounded-lg border py-1.5 px-2 ${
                            isInsufficient 
                              ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500' 
                              : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
                          }`}
                        />
                      </div>

                      {/* UOM */}
                      <div className="md:col-span-1">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          UOM *
                        </label>
                        <input
                          type="text"
                          required
                          value={line.uom}
                          onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                          placeholder="Kg, Pcs"
                          className="w-full text-xs font-medium rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-2 uppercase"
                        />
                      </div>

                      {/* Heat / Batch No */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Batch / Heat No
                        </label>
                        <input
                          type="text"
                          value={line.batchHeatNo}
                          onChange={(e) => handleItemChange(idx, 'batchHeatNo', e.target.value)}
                          placeholder="e.g. HT-2026-B89"
                          className="w-full text-xs rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-1.5 px-2"
                        />
                      </div>
                    </div>

                    {/* Insufficient stock error message banner (Exact edge case requirement) */}
                    {isInsufficient && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs font-semibold">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>
                          Insufficient own stock for {matchedStock?.name || line.materialName}. Available: {availableOwnStock} {matchedStock?.unit || line.uom}.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Vehicle and Transporter Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                4. Vehicle & Transporter Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mode of Transport *
                </label>
                <select
                  value={transportMode}
                  onChange={(e: any) => setTransportMode(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 bg-white"
                >
                  <option value="road">Road (Lorry / Factory Tempo)</option>
                  <option value="hand_delivery">Hand Delivery / Direct Pickup</option>
                  <option value="courier">Courier / Parcel</option>
                  <option value="rail">Rail Transport</option>
                  <option value="air">Air Cargo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transporter Name
                </label>
                <input
                  type="text"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  placeholder="e.g. Direct / Own Tempo or VRL Logistics"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. MH-12-PQ-9021"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Sanjay Pawar"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Driver Phone Number
                </label>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="e.g. +91 98901 22345"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  LR / Bilty Number (if any)
                </label>
                <input
                  type="text"
                  value={lrNumber}
                  onChange={(e) => setLrNumber(e.target.value)}
                  placeholder="e.g. LR-XYZ-4491"
                  className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                E-Way Bill Number (Optional - for values exceeding ₹50,000)
              </label>
              <input
                type="text"
                value={ewayBillNumber}
                onChange={(e) => setEwayBillNumber(e.target.value)}
                placeholder="12-digit E-Way Bill e.g. 291039481920"
                className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3 font-mono"
              />
            </div>
          </div>

          {/* Section 5: Internal Remarks */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Internal Instructions & Delivery Notes
            </label>
            <textarea
              rows={2}
              value={internalRemarks}
              onChange={(e) => setInternalRemarks(e.target.value)}
              placeholder="e.g. Special packing boxes provided. Ensure material test certificate copy attached with traveler."
              className="w-full text-sm rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 py-2 px-3"
            />
          </div>

          {/* Validation Warnings */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Please correct the following before issuing:
              </div>
              <ul className="list-disc list-inside text-xs text-rose-700 pl-1 space-y-0.5">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Initial status will be <strong>Issued</strong>. Printable delivery challan ready immediately.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || validationErrors.length > 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-sm font-bold shadow-md hover:shadow transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Issuing Gate Pass...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Issue Gate Pass (GP/OUT)
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
