// src/components/DispatchSection.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { Dispatch, Order } from '../types';
import { logActivityEvent } from '../utils/activityLogger';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { Truck, Navigation, PhoneCall, Check, Plus } from 'lucide-react';

interface DispatchSectionProps {
  preselectedOrderForDispatch: Order | null;
  clearPreselectedOrder: () => void;
}

export const DispatchSection: React.FC<DispatchSectionProps> = ({
  preselectedOrderForDispatch,
  clearPreselectedOrder
}) => {
  const { profile, tenant, isSandboxMode } = useAuth();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [transporter, setTransporter] = useState('VRL Logistics India');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [lrNumber, setLrNumber] = useState(''); // Lorry Receipt tracking

  // Prefill Order details
  useEffect(() => {
    if (preselectedOrderForDispatch) {
      setInvoiceNumber(`INV-${Date.now().toString().slice(-4)}`);
      setVehicleNumber('GJ-06-ZZ-');
      setDriverName('');
      setDriverPhone(preselectedOrderForDispatch.phone || '');
      setLrNumber(`LR-${Math.floor(100000 + Math.random() * 900000)}`);
      setShowForm(true);
    }
  }, [preselectedOrderForDispatch]);

  // Load Dispatches
  useEffect(() => {
    if (!profile || !tenant) return;

    if (isSandboxMode) {
      const cached = localStorage.getItem(`dispatches_${tenant.id}`);
      if (cached) {
        setDispatches(JSON.parse(cached));
      } else {
        const initialDispatches: Dispatch[] = [
          {
            id: 'disp_9001',
            tenantId: tenant.id,
            orderId: 'order_test_01',
            invoiceNumber: 'INV-F26-9022',
            vehicleNumber: 'MH-12-PQ-9876',
            driverName: 'Sukhdev Singh',
            driverPhone: '9440612345',
            lrNumber: 'LR-890122',
            transporter: 'SafeExpress Ltd.',
            items: [
              { id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 20, unitPrice: 4200, gstPercent: 18, total: 84000 }
            ],
            status: 'shipped',
            dispatchedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
          }
        ];
        localStorage.setItem(`dispatches_${tenant.id}`, JSON.stringify(initialDispatches));
        setDispatches(initialDispatches);
      }
      setLoading(false);
    } else {
      const path = 'dispatches';
      const q = query(collection(db, path), where('tenantId', '==', tenant.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Dispatch[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data() } as Dispatch);
        });
        setDispatches(list);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => unsubscribe();
    }
  }, [profile, tenant, isSandboxMode]);

  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !tenant || !preselectedOrderForDispatch) return;

    // Compile vehicle number check for standard Indian state prefix (e.g. MH, GJ, DL)
    const formattedVehicle = vehicleNumber.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    const newDispatch: Dispatch = {
      id: `disp_${Date.now().toString().slice(-6)}`,
      tenantId: tenant.id,
      orderId: preselectedOrderForDispatch.id,
      invoiceNumber,
      vehicleNumber: formattedVehicle,
      driverName,
      driverPhone,
      lrNumber,
      transporter,
      items: preselectedOrderForDispatch.items,
      status: 'shipped',
      dispatchedAt: isSandboxMode ? new Date().toISOString() : serverTimestamp()
    };

    if (isSandboxMode) {
      // 1. Add dispatch record
      const updatedList = [newDispatch, ...dispatches];
      localStorage.setItem(`dispatches_${tenant.id}`, JSON.stringify(updatedList));
      setDispatches(updatedList);

      // 2. Advance Underlying Order to 'dispatched'
      const cachedOrders = localStorage.getItem(`orders_${tenant.id}`) || '[]';
      const parsedOrders = JSON.parse(cachedOrders) as Order[];
      const updatedOrders = parsedOrders.map(o => o.id === preselectedOrderForDispatch.id ? { ...o, status: 'dispatched' as const } : o);
      localStorage.setItem(`orders_${tenant.id}`, JSON.stringify(updatedOrders));
    } else {
      const dPath = 'dispatches';
      const oPath = 'orders';
      try {
        await addDoc(collection(db, dPath), newDispatch);
        
        // Update order status doc to 'dispatched'
        const oSnap = await getDocs(query(collection(db, oPath), where('id', '==', preselectedOrderForDispatch.id)));
        if (!oSnap.empty) {
          await updateDoc(doc(db, oPath, oSnap.docs[0].id), { status: 'dispatched' });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, dPath);
      }
    }

    // Trigger WhatsApp notification with driver contact + Lorry Receipt details
    if (preselectedOrderForDispatch.phone) {
      await sendWhatsAppNotification({
        recipientName: preselectedOrderForDispatch.customerName,
        recipientPhone: preselectedOrderForDispatch.phone,
        templateName: 'order_dispatched',
        tenantId: tenant.id,
        parameters: {
          orderNumber: preselectedOrderForDispatch.orderNumber,
          invoiceNumber,
          vehicleNumber: formattedVehicle,
          lrNumber,
          transporter,
          driverPhone
        }
      });
    }

    logActivityEvent({
      tenantId: tenant.id,
      actionType: 'create',
      entityType: 'dispatch',
      entityId: newDispatch.id,
      actor: {
        userId: profile.uid,
        displayName: profile.name || profile.email || 'Dispatch Desk',
        email: profile.email
      },
      description: `Dispatched Order #${preselectedOrderForDispatch.orderNumber} for customer "${preselectedOrderForDispatch.customerName}" via ${transporter} (${formattedVehicle}).`,
      metadata: {
        invoiceNumber,
        customerName: preselectedOrderForDispatch.customerName,
        orderNumber: preselectedOrderForDispatch.orderNumber
      },
      isSandboxMode
    });

    alert(`Dispatch slip issued for ${preselectedOrderForDispatch.customerName}. Order moved to SHIPPED. WhatsApp logistics details dispatched to client.`);
    
    // Reset States
    setShowForm(false);
    setInvoiceNumber('');
    setVehicleNumber('');
    setDriverName('');
    setDriverPhone('');
    setLrNumber('');
    clearPreselectedOrder();
  };

  const handleMarkDelivered = async (dispatch: Dispatch) => {
    if (!profile || !tenant) return;

    if (isSandboxMode) {
      // 1. Update dispatch status to 'delivered'
      const listUpdated = dispatches.map(d => d.id === dispatch.id ? { ...d, status: 'delivered' as const } : d);
      localStorage.setItem(`dispatches_${tenant.id}`, JSON.stringify(listUpdated));
      setDispatches(listUpdated);

      // 2. Update order to 'completed'
      const cachedOrders = localStorage.getItem(`orders_${tenant.id}`) || '[]';
      const parsedOrders = JSON.parse(cachedOrders) as Order[];
      const updatedOrders = parsedOrders.map(o => o.id === dispatch.orderId ? { ...o, status: 'completed' as const } : o);
      localStorage.setItem(`orders_${tenant.id}`, JSON.stringify(updatedOrders));
    } else {
      const dPath = 'dispatches';
      const oPath = 'orders';
      try {
        const dSnap = await getDocs(query(collection(db, dPath), where('id', '==', dispatch.id)));
        if (!dSnap.empty) {
          await updateDoc(doc(db, dPath, dSnap.docs[0].id), { status: 'delivered' });
        }

        const oSnap = await getDocs(query(collection(db, oPath), where('id', '==', dispatch.orderId)));
        if (!oSnap.empty) {
          await updateDoc(doc(db, oPath, oSnap.docs[0].id), { status: 'completed' });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, dPath);
      }
    }

    logActivityEvent({
      tenantId: tenant.id,
      actionType: 'status_change',
      entityType: 'dispatch',
      entityId: dispatch.id,
      actor: {
        userId: profile.uid,
        displayName: profile.name || profile.email || 'Dispatch Desk',
        email: profile.email
      },
      description: `Recorded delivery confirmation for invoice #${dispatch.invoiceNumber}. Order completed.`,
      metadata: {
        invoiceNumber: dispatch.invoiceNumber,
        fromStatus: dispatch.status,
        toStatus: 'delivered',
        customerName: dispatch.customerName
      },
      isSandboxMode
    });

    alert(`Delivery receipt recorded! Order marked complete and closed in database.`);
  };

  return (
    <div className="space-y-6">

      {/* DISPATCH CREATOR */}
      {showForm && preselectedOrderForDispatch && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-lg space-y-4">
          <div className="flex justify-between items-center pb-3 mb-2 border-b border-slate-150">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-sans uppercase tracking-wider">Compile Outbound Dispatch Slip (LR Tracker)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Order: {preselectedOrderForDispatch.orderNumber} ({preselectedOrderForDispatch.customerName})</p>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                clearPreselectedOrder();
              }}
              className="text-slate-400 hover:text-slate-655 text-xs font-mono border border-slate-200 rounded px-2.5 py-1"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmitDispatch} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-800">
            
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Tax Invoice Number *</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-1.5 text-xs focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
                  placeholder="e.g. FY26/INV-1201"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Transporter / Logistics Partner *</label>
                <select
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-1.5 text-xs focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
                >
                  <option value="VRL Logistics Ltd.">VRL Logistics India</option>
                  <option value="SafeExpress Pvt Ltd">SafeExpress</option>
                  <option value="Gati KWE Ltd">Gati Logistics</option>
                  <option value="TCI Freight">TCI Freight (Transport Corp of India)</option>
                  <option value="Direct Truck Arrangement">Direct Factory Truck Arrangement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Lorry Receipt (LR) tracking *</label>
                <input
                  type="text"
                  required
                  value={lrNumber}
                  onChange={(e) => setLrNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
                  placeholder="Consignment Tracking Ref / LR Number"
                />
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Truck/Vehicle Number *</label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
                  placeholder="e.g. GJ-06-ZZ-4012"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Driver's Name</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-1.5 text-xs focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
                  placeholder="e.g. Shivraj Kumar"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Driver's Contact Phone *</label>
                <input
                  type="text"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-205 rounded px-3 py-1.5 text-xs focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
                  placeholder="For transit follow-ups"
                />
              </div>
            </div>

            <div className="md:col-span-2 pt-3 border-t border-slate-150 flex justify-end">
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-5 py-2.5 rounded uppercase tracking-wider flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Navigation className="h-4 w-4 text-sky-200" />
                <span>Publish Dispatch & Alert Client</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* DISPATCH LIST */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : dispatches.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-2.5 mb-3">
            <Truck className="h-4.5 w-4.5 text-sky-500" />
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-widest font-display">En-route Shipments & Outward Deliveries</h3>
          </div>

          {dispatches.map(disp => (
            <div 
              key={disp.id}
              className={`bg-white border rounded-lg p-4.5 shadow-sm relative flex flex-col justify-between ${
                disp.status === 'delivered' ? 'border-emerald-200 bg-emerald-500/[0.01]' : 'border-sky-150 bg-sky-50/5'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
                
                {/* Consignment tracking details */}
                <div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider inline-block mb-2 ${
                    disp.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-sky-50 text-sky-700 border border-sky-100'
                  }`}>
                    {disp.status}
                  </span>
                  
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono leading-none">Invoice & Consignment ID</p>
                  <p className="text-sm font-bold text-slate-905 mt-1">{disp.invoiceNumber}</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">LR Receipt: {disp.lrNumber}</p>
                </div>

                {/* Transporter Details */}
                <div className="space-y-1 text-xs">
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Carrier</p>
                  <p className="font-semibold text-slate-800 leading-none">{disp.transporter}</p>
                  <p className="text-slate-605 font-mono mt-1">Truck Ref: {disp.vehicleNumber}</p>
                </div>

                {/* Driver contacts */}
                <div className="space-y-1 text-xs">
                  <p className="text-[9px] text-slate-450 uppercase font-bold tracking-wider font-mono font-bold">Operations Contact</p>
                  <p className="font-semibold text-slate-800 leading-none">Driver: {disp.driverName || 'N/A'}</p>
                  <p className="text-slate-600 mt-1 flex items-center font-mono">
                    <PhoneCall className="h-3 w-3 mr-1.5 text-slate-405" />
                    <span>{disp.driverPhone}</span>
                  </p>
                </div>

              </div>

              {/* Items loaded specs */}
              <div className="py-3 text-xs text-slate-700">
                <span className="block text-[9px] uppercase font-bold font-mono text-slate-400 tracking-widest mb-2">Transit Cargo Packing details</span>
                <div className="space-y-1">
                  {disp.items.map((itm, index) => (
                    <div key={index} className="flex justify-between max-w-md">
                      <span className="font-semibold text-slate-700">{itm.name}</span>
                      <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[10px] text-slate-500 font-bold">Qty: {itm.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action layout */}
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 -mx-4.5 -mb-4.5 p-3 rounded-b-lg">
                <span className="text-[10px] font-mono text-slate-400">
                  Shipped date: {new Date(disp.dispatchedAt).toLocaleDateString()}
                </span>

                {disp.status !== 'delivered' ? (
                  <button
                    onClick={() => handleMarkDelivered(disp)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded flex items-center space-x-1 cursor-pointer transition-transform hover:scale-102"
                    id={`delivered-btn-${disp.id}`}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    <span>Confirm Order Delivered</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2.5 py-1 flex items-center">
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                    <span>Trip Completed</span>
                  </span>
                )}
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-lg">
          <p className="text-slate-400 text-xs font-semibold">No outbound transit dispatches recorded in this shift.</p>
        </div>
      )}

    </div>
  );
};
