// src/pages/dispatch/DispatchCreateForm.tsx

import React, { useState, useEffect } from 'react';
import { Order, QuoteItem } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { createDispatchRecord } from '../../hooks/useDispatch';
import { X, Truck, Landmark, User, FileText, MapPin, Calendar, HelpCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { FieldError } from '../../components/ui/FieldError';
import { getFriendlyErrorMessage } from '../../utils/errors';

interface DispatchCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  availableOrders: Order[];
  preselectedOrder?: Order | null;
  onSuccess: () => void;
}

export const DispatchCreateForm: React.FC<DispatchCreateFormProps> = ({
  isOpen,
  onClose,
  availableOrders,
  preselectedOrder,
  onSuccess
}) => {
  const { tenant, profile } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // States
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [dispatchNumber, setDispatchNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [transporter, setTransporter] = useState('VRL Logistics India');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [destination, setDestination] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [itemsSummary, setItemsSummary] = useState('');
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto pre-fill when preselectedOrder changes
  useEffect(() => {
    if (preselectedOrder) {
      setSelectedOrderId(preselectedOrder.id);
      setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
      setDispatchNumber(`DISP-${Date.now().toString().slice(-4)}`);
      setVehicleNumber('GJ-06-ZZ-');
      setDestination('Client Registered Address');
      
      const summary = (preselectedOrder.items || []).map(itm => `${itm.name} (Qty: ${itm.quantity})`).join(', ');
      setItemsSummary(summary);
      setDriverPhone(preselectedOrder.phone || '');
    } else {
      setSelectedOrderId('');
      setInvoiceNumber('');
      setDispatchNumber(`DISP-${Date.now().toString().slice(-4)}`);
      setVehicleNumber('');
      setDestination('');
      setItemsSummary('');
      setDriverPhone('');
    }
  }, [preselectedOrder, isOpen]);

  // Read selected order details and adjust fields if changed manually
  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOrderId(val);
    const ord = availableOrders.find(o => o.id === val);
    if (ord) {
      setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
      setDispatchNumber(`DISP-${Date.now().toString().slice(-4)}`);
      setDriverPhone(ord.phone || '');
      const summary = (ord.items || []).map(itm => `${itm.name} (Qty: ${itm.quantity})`).join(', ');
      setItemsSummary(summary);
      setDestination('Customer site location');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !profile) return;
    setFieldErrors({});
    setErrorMsg(null);

    // Form Field inline validation checks (Requirement 2)
    const errors: Record<string, string> = {};
    if (!selectedOrderId) {
      errors.selectedOrderId = 'Target B2B order selection is required.';
    }
    if (!vehicleNumber.trim()) {
      errors.vehicleNumber = 'Logistics vehicle fleet registration plate number is required.';
    }
    if (!destination.trim()) {
      errors.destination = 'Consignment shipping destination address is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toastError('Validation Failed', 'Please inspect the highlighted fields before verifying departure.');
      return;
    }

    setSubmitting(true);

    try {
      const activeOrder = availableOrders.find(o => o.id === selectedOrderId);
      const itemsToShip = activeOrder ? activeOrder.items : [] as QuoteItem[];

      const formData = {
        orderId: selectedOrderId,
        dispatchNumber: dispatchNumber || `DISP-${Date.now().toString().slice(-4)}`,
        invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
        customerId: activeOrder?.createdBy || 'system_fallback',
        customerName: activeOrder?.customerName || 'Direct B2B Hub',
        dispatchDate,
        transporter,
        vehicleNumber: vehicleNumber.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
        driverName,
        driverPhone,
        lrNumber: lrNumber || `LR-${Math.floor(100000 + Math.random() * 900000)}`,
        LRNumber: lrNumber || `LR-${Math.floor(100000 + Math.random() * 900000)}`,
        destination: destination || 'Registered Depot',
        itemsSummary: itemsSummary || 'Standard industrial freight items',
        items: itemsToShip,
        status: 'Dispatched' as const,
        notes: notes || 'Standard packaging validation completed.'
      };

      await createDispatchRecord(tenant.id, formData as any, profile.name || 'Dispatcher Team');
      
      // Trigger C: dispatch_sent notification
      const dispatchNotifUserId = activeOrder?.createdBy || 'all';
      const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

      if (isSandbox) {
        const key = `flowops_notifications_${tenant.id}`;
        const cached = localStorage.getItem(key);
        let notifs = cached ? JSON.parse(cached) : [];
        const newNotif = {
          id: `notif_dispatch_sent_${formData.dispatchNumber}_${Date.now()}`,
          tenantId: tenant.id,
          userId: dispatchNotifUserId,
          type: 'dispatch_sent',
          title: 'Cargo Dispatched',
          message: `Order #${activeOrder?.orderNumber} for ${activeOrder?.customerName} has been dispatched via ${transporter} (Vehicle: ${vehicleNumber.toUpperCase()})`,
          entityId: selectedOrderId,
          entityType: 'order',
          link: '/orders',
          read: false,
          createdAt: new Date().toISOString()
        };
        notifs.push(newNotif);
        localStorage.setItem(key, JSON.stringify(notifs));
        window.dispatchEvent(new Event('storage'));
      } else {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const newNotifId = `dispatch_sent_${formData.dispatchNumber}_${Date.now()}`;
          const docRef = doc(db, 'notifications', newNotifId);
          await setDoc(docRef, {
            id: newNotifId,
            tenantId: tenant.id,
            userId: dispatchNotifUserId,
            type: 'dispatch_sent',
            title: 'Cargo Dispatched',
            message: `Order #${activeOrder?.orderNumber} for ${activeOrder?.customerName} has been dispatched via ${transporter} (Vehicle: ${vehicleNumber.toUpperCase()})`,
            entityId: selectedOrderId,
            entityType: 'order',
            link: '/orders',
            read: false,
            createdAt: new Date()
          });
        } catch (err) {
          console.error('Failed to write dispatch created notification', err);
        }
      }

      // Global Toast Notification feedback (Requirement 1)
      toastSuccess('Consignment Dispatched', `Lorry receipt ${formData.dispatchNumber} successfully logged.`, 4500);
      
      onSuccess();
      onClose();
    } catch (err: any) {
      // Backend error code mapping (Requirement 2)
      const mappedMsg = getFriendlyErrorMessage(err);
      setErrorMsg(mappedMsg);
      toastError('Dispatch Logging Aborted', mappedMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col font-sans select-none">
        
        {/* Modal Header */}
        <div className="p-5 border-b flex items-center justify-between bg-slate-55/40">
          <div className="flex items-center space-x-2">
            <Truck className="h-5 w-5 text-indigo-650" />
            <h3 className="font-bold text-slate-900 font-sans tracking-tight">Record Outbound Dispatch Slip (Lorry Receipt)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form contents */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-850 p-3 rounded-lg text-xs font-mono">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Order linkage select */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-450">
                1. Select Target Order *
              </label>
              <select
                value={selectedOrderId}
                onChange={handleOrderChange}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
              >
                <option value="">-- Choose active pending order --</option>
                {availableOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} ({o.customerName}) - {o.status.toUpperCase()}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.selectedOrderId} />
              <span className="text-[9px] text-slate-400 font-mono italic">Shows accepted sales orders ready for transit.</span>
            </div>

            {/* Dispatch number & Invoice Number */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-450">
                2. Dispatch & Slip Number *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="DS-No"
                  value={dispatchNumber}
                  onChange={(e) => setDispatchNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
                />
                <input
                  type="text"
                  required
                  placeholder="Invoice No"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Logistics Transporter and LR receipt number */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-450">
                3. Transporter & Lorry Receipt (LR) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
                >
                  <option value="VRL Logistics India">VRL Logistics India</option>
                  <option value="SafeExpress Pvt Ltd">SafeExpress</option>
                  <option value="Gati KWE Ltd">Gati Logistics</option>
                  <option value="TCI Freight">TCI Freight (Corp of India)</option>
                  <option value="Direct Truck Arrangement">Direct Factory Truck</option>
                </select>
                <input
                  type="text"
                  placeholder="LR-Number"
                  value={lrNumber}
                  onChange={(e) => setLrNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Vehicle Number & Driver details */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-455">
                4. Vehicle Tracking Ref *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. GJ-06-ZZ-4012"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono uppercase focus:bg-white focus:outline-hidden"
              />
              <FieldError message={fieldErrors.vehicleNumber} />
            </div>

            {/* Driver designation */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-450">
                5. Driver Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sukhdev Singh"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Contact details */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-450">
                6. Driver Operations Mobile
              </label>
              <input
                type="text"
                placeholder="e.g. +91 9440612345"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Destination depot */}
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-450">
                7. Shipping Destination Address *
              </label>
              <input
                type="text"
                required
                placeholder="Industrial zone, sector b, phase 4 city"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
              />
              <FieldError message={fieldErrors.destination} />
            </div>

            {/* Items Summary particulars */}
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-450">
                8. Loaded Cargo Summary Info
              </label>
              <textarea
                value={itemsSummary}
                onChange={(e) => setItemsSummary(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden leading-relaxed"
                placeholder="e.g. Forged Steel Spur Gear x20, accompanying quality certificate."
              />
            </div>

            {/* Dispatch date setting */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-450">
                9. Expected Departure Date
              </label>
              <input
                type="date"
                required
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Telemetry notes details */}
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-450">
                10. Additional Transit Instructions (Notes)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono focus:bg-white focus:outline-hidden leading-relaxed"
                placeholder="Include custom instructions for transit checks, tarp requirements, and forklift details at delivery point..."
              />
            </div>

          </div>

          {/* Action bottom bars */}
          <div className="flex justify-end space-x-2 pt-4 border-t select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 text-xs font-mono uppercase font-bold rounded-lg cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 disabled:bg-indigo-350 text-white text-xs font-mono uppercase font-bold rounded-lg cursor-pointer transition flex items-center space-x-1.5"
            >
              <Truck className="h-4 w-4" />
              <span>{submitting ? 'Recording Log...' : 'Confirm Dispatch out'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
