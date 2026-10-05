// src/components/ProductionSection.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { Order, ProductionJob, ProductionStageChange } from '../types';
import { logActivityEvent } from '../utils/activityLogger';
import { ActivityTimeline } from './ActivityTimeline';
import { PRODUCTION_STAGES_ENUM } from '../data/mockData';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { Layers, Calendar, ArrowRight, ClipboardList, PenTool, CheckCircle2, MessageSquare, Plus, Clock } from 'lucide-react';

interface ProductionSectionProps {
  preselectedOrderId: string | null;
  clearPreselectedOrder: () => void;
  onInitiateDispatch: (order: Order) => void;
}

export const ProductionSection: React.FC<ProductionSectionProps> = ({ 
  preselectedOrderId,
  clearPreselectedOrder,
  onInitiateDispatch
}) => {
  const navigate = useNavigate();
  const { profile, tenant, isSandboxMode } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);

  // Focus View / Operations States
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [expandedJobLogsId, setExpandedJobLogsId] = useState<Record<string, boolean>>({});
  const [stageNotes, setStageNotes] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('cutting');

  // Load Orders & Jobs
  useEffect(() => {
    if (!profile || !tenant) return;

    if (isSandboxMode) {
      // Direct load from local stores
      const cachedOrders = localStorage.getItem(`orders_${tenant.id}`) || '[]';
      const parsedOrders = JSON.parse(cachedOrders);
      setOrders(parsedOrders);

      const cachedJobs = localStorage.getItem(`jobs_${tenant.id}`);
      if (cachedJobs) {
        setJobs(JSON.parse(cachedJobs));
      } else {
        // Initialize with default jobs mapped to our dummy order
        const initialJobs: ProductionJob[] = [
          {
            id: 'job_22101',
            tenantId: tenant.id,
            orderId: 'order_test_01',
            itemName: 'Forged Steel Spur Gear (Mod 4, 32T)',
            quantity: 20,
            currentStage: 'cutting',
            stagesHistory: [
              {
                stage: 'cutting',
                notes: 'Tooling layouts mapped. Materials loading on blank shearing machines.',
                updatedBy: 'demo_user',
                updatedByName: 'Rajesh Patel',
                updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
              }
            ],
            updatedBy: 'demo_user',
            updatedAt: new Date().toISOString()
          }
        ];
        // Create matching order for jobs if empty
        if (parsedOrders.length === 0) {
          const defaultOrder: Order = {
            id: 'order_test_01',
            tenantId: tenant.id,
            quoteId: 'quote_301',
            orderNumber: 'OD-DEMO-991',
            customerName: 'Kirloskar Industrial Distributors',
            phone: '9880123456',
            items: [
              { id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 20, unitPrice: 4200, gstPercent: 18, total: 84000 }
            ],
            totalAmount: 99120,
            deliveryDate: new Date(Date.now() + 18 * 24 * 3600 * 1000).toISOString().split('T')[0],
            status: 'in-production',
            createdBy: 'demo_user',
            createdAt: new Date().toISOString()
          };
          localStorage.setItem(`orders_${tenant.id}`, JSON.stringify([defaultOrder]));
          setOrders([defaultOrder]);
        }
        localStorage.setItem(`jobs_${tenant.id}`, JSON.stringify(initialJobs));
        setJobs(initialJobs);
      }
      setLoading(false);
    } else {
      // Live Firebase sync securely filtering data to active tenantId scope
      const oPath = 'orders';
      const jPath = 'productionJobs';

      // Load orders
      const oUnsubscribe = onSnapshot(query(collection(db, oPath), where('tenantId', '==', tenant.id)), (snap) => {
        const list: Order[] = [];
        snap.forEach(dSnap => {
          list.push({ ...dSnap.data() } as Order);
        });
        setOrders(list);
      }, (e) => handleFirestoreError(e, OperationType.LIST, oPath));

      // Load active production line jobs
      const jUnsubscribe = onSnapshot(query(collection(db, jPath), where('tenantId', '==', tenant.id)), (snap) => {
        const list: ProductionJob[] = [];
        snap.forEach(dSnap => {
          list.push({ ...dSnap.data() } as ProductionJob);
        });
        setJobs(list);
        setLoading(false);
      }, (e) => handleFirestoreError(e, OperationType.LIST, jPath));

      return () => {
        oUnsubscribe();
        jUnsubscribe();
      };
    }
  }, [profile, tenant, isSandboxMode]);

  const handleOpenJobStageEditor = (job: ProductionJob) => {
    setSelectedJob(job);
    setSelectedStage(job.currentStage);
    setStageNotes('');
  };

  const handleUpdateJobStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !tenant || !selectedJob) return;

    // Build the structural state change history record
    const historyItem: ProductionStageChange = {
      stage: selectedStage,
      notes: stageNotes || 'Advanced by supervisor.',
      updatedBy: profile.uid,
      updatedByName: profile.name,
      updatedAt: new Date().toISOString()
    };

    const updatedJob: ProductionJob = {
      ...selectedJob,
      currentStage: selectedStage,
      stagesHistory: [...selectedJob.stagesHistory, historyItem],
      updatedBy: profile.uid,
      updatedAt: isSandboxMode ? new Date().toISOString() : new Date() // Firestore Server Timestamp or date representation
    };

    // Find the associated order to fetch client phone details
    const orderRef = orders.find(o => o.id === selectedJob.orderId);

    if (isSandboxMode) {
      // 1. Update active job list
      const updatedJobs = jobs.map(j => j.id === selectedJob.id ? updatedJob : j);
      localStorage.setItem(`jobs_${tenant.id}`, JSON.stringify(updatedJobs));
      setJobs(updatedJobs);

      // 2. Adjust order status depending on shopfloor stage
      if (orderRef && orderRef.status === 'pending') {
        const updatedOrders = orders.map(o => o.id === orderRef.id ? { ...o, status: 'in-production' as const } : o);
        localStorage.setItem(`orders_${tenant.id}`, JSON.stringify(updatedOrders));
        setOrders(updatedOrders);
      }
    } else {
      const jPath = 'productionJobs';
      const oPath = 'orders';
      try {
        // Sync production line changes
        const jSnap = await getDocs(query(collection(db, jPath), where('id', '==', selectedJob.id)));
        if (!jSnap.empty) {
          await updateDoc(doc(db, jPath, jSnap.docs[0].id), {
            currentStage: selectedStage,
            stagesHistory: updatedJob.stagesHistory,
            updatedBy: profile.uid,
            updatedAt: serverTimestamp()
          });
        }

        // Advance Order Status to in-production automatically on first tooling step
        if (orderRef && orderRef.status === 'pending') {
          const oSnap = await getDocs(query(collection(db, oPath), where('id', '==', orderRef.id)));
          if (!oSnap.empty) {
            await updateDoc(doc(db, oPath, oSnap.docs[0].id), { status: 'in-production' });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, jPath);
      }
    }

    // Trigger WhatsApp notification explaining shopfloor advancement
    if (orderRef?.phone) {
      const displayStage = PRODUCTION_STAGES_ENUM.find(s => s.value === selectedStage)?.label || selectedStage;
      await sendWhatsAppNotification({
        recipientName: orderRef.customerName,
        recipientPhone: orderRef.phone,
        templateName: 'production_update',
        tenantId: tenant.id,
        orderId: orderRef.id,
        customerId: (orderRef as any).customerId || '',
        parameters: {
          itemName: selectedJob.itemName,
          quantity: selectedJob.quantity.toString(),
          orderNumber: orderRef.orderNumber,
          stage: displayStage
        }
      });
    }

    logActivityEvent({
      tenantId: tenant.id,
      actionType: 'stage_change',
      entityType: 'job',
      entityId: selectedJob.id,
      actor: {
        userId: profile.uid,
        displayName: profile.name || profile.email || 'Shopfloor Lead',
        email: profile.email
      },
      description: `Advanced shopfloor component "${selectedJob.itemName}" from "${selectedJob.currentStage.toUpperCase()}" to "${selectedStage.toUpperCase()}" for Order #${orderRef?.orderNumber || 'Unknown'}.`,
      metadata: {
        fromStage: selectedJob.currentStage,
        toStage: selectedStage,
        jobCode: selectedJob.id,
        customerName: orderRef?.customerName,
        orderNumber: orderRef?.orderNumber
      },
      isSandboxMode
    });

    alert(`Production line updated for ${selectedJob.itemName}. Stage advanced to: ${selectedStage.toUpperCase()}. WhatsApp delivery notification log queued.`);
    
    setSelectedJob(null);
    setStageNotes('');
    clearPreselectedOrder();
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'cutting': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'welding': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'machining': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'assembly': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'quality_check': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'ready': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'in-production': return 'bg-indigo-50 text-indigo-800 border-indigo-200/80 animate-pulse';
      case 'produced': return 'bg-blue-50 text-blue-800 border-blue-200/80';
      case 'dispatched': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'completed': return 'bg-green-50 text-green-800 border-green-200';
      default: return 'bg-slate-50 text-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ACTIVE PRODUCTION EDITOR FORM OVERLAY */}
      {selectedJob && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-lg space-y-4">
          <div className="flex justify-between items-center border-b border-slate-150 pb-2.5">
            <div>
              <h3 className="font-bold text-slate-900 text-sm font-sans uppercase tracking-wider">Update Shopfloor Operations Stage</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Component: {selectedJob.itemName} (Qty: {selectedJob.quantity})</p>
            </div>
            <button 
              onClick={() => setSelectedJob(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-mono border border-slate-200 rounded px-2.5 py-1"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleUpdateJobStage} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">Advance active stage</label>
              <div className="grid grid-cols-2 gap-2">
                {PRODUCTION_STAGES_ENUM.map(st => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setSelectedStage(st.value)}
                    className={`px-3 py-1.5 border rounded text-left text-xs transition-colors flex items-center justify-between font-medium cursor-pointer ${
                      selectedStage === st.value 
                        ? 'bg-sky-600 text-white font-bold border-sky-600' 
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{st.label}</span>
                    {selectedJob.currentStage === st.value && (
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${selectedStage === st.value ? 'bg-white' : 'bg-slate-950'}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Add Shopfloor Notes</label>
                <textarea
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs focus:ring-2 focus:ring-sky-500/30 focus:outline-none"
                  placeholder="e.g. Dimensions verified by digital caliper. Transitioned to quality workbench."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white hover:bg-slate-800 py-2.5 rounded text-xs font-bold uppercase tracking-widest mt-2 transition-transform hover:scale-101 shadow-xs"
              >
                Log Status Note & Notify Client
              </button>
            </div>
          </form>
        </div>
      )}

      {/* JOBS WORKLOAD MANAGEMENT TABLE */}
      <div>
        <div className="flex items-center space-x-1.5 pb-2.5 mb-3 border-b border-slate-200">
          <Layers className="h-4.5 w-4.5 text-sky-500" />
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest font-display">Active Foundry Component Lines (WIP)</h3>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : jobs.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[9px] font-bold font-mono uppercase text-slate-500 border-b border-slate-200">
                    <th className="p-3">Order Code</th>
                    <th className="p-3">Component particulars</th>
                    <th className="p-3">Yield Vol</th>
                    <th className="p-3">Current Segment</th>
                    <th className="p-3">Last Checked Timestamp</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {jobs.map(job => {
                    const orderItem = orders.find(o => o.id === job.orderId);
                    const isLogsExpanded = !!expandedJobLogsId[job.id];
                    return (
                      <React.Fragment key={job.id}>
                        <tr className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-900">
                            {orderItem?.orderNumber || 'Demo Ref'}
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-800 leading-none">{job.itemName}</p>
                            <p className="text-[10px] text-slate-400 mt-1 truncate max-w-sm">
                              Latest Update: {job.stagesHistory[job.stagesHistory.length - 1]?.notes || 'N/A'}
                            </p>
                          </td>
                          <td className="p-3">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-700">
                              {job.quantity} units
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`border text-[9px] px-2 py-0.5 rounded font-bold tracking-wider uppercase ${getStageColor(job.currentStage)}`}>
                              {PRODUCTION_STAGES_ENUM.find(s => s.value === job.currentStage)?.label || job.currentStage}
                            </span>
                          </td>
                          <td className="p-3 text-[10px] font-mono text-slate-400">
                            {new Date(job.updatedAt).toLocaleDateString()} at {new Date(job.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => setExpandedJobLogsId(prev => ({ ...prev, [job.id]: !prev[job.id] }))}
                                className={`text-[10px] font-bold px-2 py-1 rounded border border-transparent hover:border-slate-300 font-mono flex items-center space-x-1 cursor-pointer transition-all ${
                                  isLogsExpanded ? 'bg-slate-150 text-slate-800 border-slate-200' : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span>{isLogsExpanded ? 'Hide' : 'Logs'}</span>
                              </button>
                              {job.currentStage !== 'ready' ? (
                                <button
                                  onClick={() => handleOpenJobStageEditor(job)}
                                  className="bg-slate-900 text-white hover:bg-slate-805 px-3 py-1 rounded text-[10px] font-bold tracking-medium inline-flex items-center space-x-1 cursor-pointer shrink-0"
                                >
                                  <PenTool className="h-3 w-3 text-sky-400" />
                                  <span>Advance Stage</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-mono font-bold flex items-center justify-end whitespace-nowrap">
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  <span>Ready</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isLogsExpanded && (
                          <tr className="bg-slate-50/40 select-text">
                            <td colSpan={6} className="p-4 border-l-2 border-indigo-500">
                              <span className="block text-[9px] uppercase font-bold font-mono tracking-wider text-indigo-700 mb-2">Shopfloor Production Run History</span>
                              <ActivityTimeline entityId={job.id} entityType="job" compact={true} maxLimit={5} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 bg-white border border-slate-200 rounded-lg">
            <p className="text-slate-400 text-xs">No active shopfloor jobs. Approve custom quotes to spawn fabrications.</p>
          </div>
        )}
      </div>

      {/* ORDERS SUMMARY LIST */}
      <div>
        <div className="flex items-center space-x-1.5 pb-2.5 mb-3 border-b border-slate-200">
          <ClipboardList className="h-4.5 w-4.5 text-sky-500" />
          <h3 className="font-bold text-slate-805 text-xs uppercase tracking-widest font-display">Active Confirmed Purchase Orders</h3>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : orders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orders.map(order => {
              // Check if all lines for this order are in 'ready' stage
              const associatedJobs = jobs.filter(j => j.orderId === order.id);
              const allJobsReady = associatedJobs.length > 0 && associatedJobs.every(j => j.currentStage === 'ready');

              return (
                <div 
                  key={order.id}
                  className={`bg-white border rounded-lg p-4 shadow-sm relative flex flex-col justify-between ${
                    allJobsReady ? 'border-emerald-200 bg-emerald-500/[0.01]' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          OR: {order.orderNumber}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 ml-2">
                          Est: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>

                      <span className={`border text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wide ${getOrderStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-809 mb-1">{order.customerName}</h4>
                    <p className="text-[11px] text-slate-500 font-mono">Invoice Value: ₹{order.totalAmount.toLocaleString('en-IN')}</p>

                    {/* Associated Job checklist progress */}
                    <div className="mt-4 pt-4 border-t border-slate-100/60">
                      <span className="block text-[9px] uppercase font-bold font-mono tracking-widest text-slate-400 mb-2">Shopfloor Line Items WIP</span>
                      <div className="space-y-1.5 animate-pulse-slow">
                        {associatedJobs.map(j => (
                          <div key={j.id} className="flex justify-between items-center text-xs">
                            <span className="text-slate-650 truncate max-w-xs">{j.itemName}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold capitalize ${
                              j.currentStage === 'ready' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {j.currentStage}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Move to dispatch button if all ready */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">
                      Line parts: {associatedJobs.filter(j => j.currentStage === 'ready').length} / {associatedJobs.length} ready
                    </span>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => navigate('/payments', { state: { preselectedOrderForInvoice: order } })}
                        className="border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded flex items-center space-x-1 cursor-pointer transition-all shrink-0"
                        title="Generate Invoice & Track Payments"
                      >
                        <Plus className="h-3 w-3 text-slate-500" />
                        <span>Create Invoice</span>
                      </button>

                      {allJobsReady && order.status !== 'dispatched' && order.status !== 'completed' ? (
                        <button
                          onClick={() => onInitiateDispatch(order)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-1.5 rounded flex items-center space-x-1.5 shadow-xs cursor-pointer hover:scale-102 transition-transform"
                        >
                          <span>Move to Dispatch</span>
                          <ArrowRight className="h-3.5 w-3.5 text-white" />
                        </button>
                      ) : order.status === 'dispatched' ? (
                        <span className="text-[10px] font-mono text-sky-600 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          Dispatched Slip Loaded
                        </span>
                      ) : null}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-4">No active manufacturing orders found.</p>
        )}
      </div>

    </div>
  );
};
