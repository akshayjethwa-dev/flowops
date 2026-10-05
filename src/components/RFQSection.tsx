// src/components/RFQSection.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { RFQ, RFQItem } from '../types';
import { logActivityEvent } from '../utils/activityLogger';
import { triggerRfqAutoAcknowledgement } from '../utils/whatsapp';
import { ActivityTimeline } from './ActivityTimeline';
import { DEMO_CLIENTS, DEMO_PRODUCTS } from '../data/mockData';
import { Plus, ListFilter, Hammer, Send, PhoneCall, Check, XCircle, Search, Clock } from 'lucide-react';

interface RFQSectionProps {
  onInitiateQuote: (rfq: RFQ) => void;
}

export const RFQSection: React.FC<RFQSectionProps> = ({ onInitiateQuote }) => {
  const { profile, tenant, isSandboxMode } = useAuth();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'quoted' | 'declined'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTimelineId, setExpandedTimelineId] = useState<Record<string, boolean>>({});
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [requirements, setRequirements] = useState('');
  const [selectedItems, setSelectedItems] = useState<RFQItem[]>([]);
  const [currentItem, setCurrentItem] = useState('');
  const [currentItemQty, setCurrentItemQty] = useState(1);

  // Load RFQs
  useEffect(() => {
    if (!profile || !tenant) return;

    if (isSandboxMode) {
      // In sandbox, load from localStorage or initialize with some beautiful initial mock records
      const cached = localStorage.getItem(`rfqs_${tenant.id}`);
      if (cached) {
        setRfqs(JSON.parse(cached));
      } else {
        const initialRFQs: RFQ[] = [
          {
            id: 'rfq_1001',
            tenantId: tenant.id,
            customerName: 'Kirloskar Industrial Distributors',
            email: 'anil@kirloskar-dist.in',
            phone: '9880123456',
            requirements: 'Require standard grade spur gears matching Drawing ID B-22 for pump housing.',
            items: [
              { id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 20, specs: 'Material: EN8 Carbon Steel' }
            ],
            status: 'pending',
            createdBy: 'demo_user',
            createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
          },
          {
            id: 'rfq_1002',
            tenantId: tenant.id,
            customerName: 'Techno Welds India Pvt Ltd',
            email: 'rsharma@technowelds.co.in',
            phone: '9123456780',
            requirements: 'Tenders submission quote request for Stainless electrodes. Need premium packaging.',
            items: [
              { id: 'p2', name: 'Stainless Steel Arc Welding Consumables (Grade E308L-16)', quantity: 150, specs: 'Grade: AWS A5.4' }
            ],
            status: 'quoted',
            createdBy: 'demo_user',
            createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
          }
        ];
        localStorage.setItem(`rfqs_${tenant.id}`, JSON.stringify(initialRFQs));
        setRfqs(initialRFQs);
      }
      setLoading(false);
    } else {
      // Direct Firestore Sync scoped securely to the tenantId
      const path = 'rfqs';
      const q = query(
        collection(db, path),
        where('tenantId', '==', tenant.id),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: RFQ[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data() } as RFQ);
        });
        setRfqs(list);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => unsubscribe();
    }
  }, [profile, tenant, isSandboxMode]);

  // Autofill from Indian distributor presets to simplify entry
  const handleClientPresetSelect = (presetIdx: number) => {
    const client = DEMO_CLIENTS[presetIdx];
    setClientName(client.name);
    setClientPhone(client.phone);
    setClientEmail(client.email);
  };

  const handleAddItemToRFQ = () => {
    if (!currentItem) return;
    const prod = DEMO_PRODUCTS.find(p => p.id === currentItem);
    if (!prod) return;

    const newItem: RFQItem = {
      id: prod.id,
      name: prod.name,
      quantity: currentItemQty,
      specs: ''
    };

    setSelectedItems([...selectedItems, newItem]);
    setCurrentItem('');
    setCurrentItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    const filtered = selectedItems.filter((_, i) => i !== index);
    setSelectedItems(filtered);
  };

  const handleSubmitRFQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !tenant) return;
    if (selectedItems.length === 0) {
      alert('Must append at least 1 industrial item request specifications.');
      return;
    }

    const newRfq: RFQ = {
      id: `rfq_${Date.now().toString().slice(-6)}`,
      tenantId: tenant.id,
      customerName: clientName,
      email: clientEmail || '',
      phone: clientPhone || '',
      requirements: requirements || '',
      items: selectedItems,
      status: 'pending',
      createdBy: profile.uid,
      createdAt: isSandboxMode ? new Date().toISOString() : serverTimestamp()
    };

    if (isSandboxMode) {
      const updated = [newRfq, ...rfqs];
      localStorage.setItem(`rfqs_${tenant.id}`, JSON.stringify(updated));
      setRfqs(updated);
    } else {
      const path = 'rfqs';
      try {
        await addDoc(collection(db, path), newRfq);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }

    // Trigger Connected Workflow 6: RFQ Created -> Customer Auto-Acknowledgement on WhatsApp
    try {
      await triggerRfqAutoAcknowledgement(tenant.id, newRfq, tenant.companyName);
    } catch (waErr) {
      console.warn('Silent failure on auto RFQ acknowledgment:', waErr);
    }

    logActivityEvent({
      tenantId: tenant.id,
      actionType: 'create',
      entityType: 'rfq',
      entityId: newRfq.id,
      actor: {
        userId: profile.uid,
        displayName: profile.name || profile.email || 'Plant Operator',
        email: profile.email
      },
      description: `Created RFQ for customer "${newRfq.customerName}" with ${newRfq.items.length} items.`,
      metadata: {
        customerName: newRfq.customerName,
        rfqNumber: newRfq.id
      },
      isSandboxMode
    });

    // Reset Form
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setRequirements('');
    setSelectedItems([]);
    setShowAddForm(false);
  };

  const handleUpdateStatus = async (rfqId: string, itemStatus: 'pending' | 'quoted' | 'declined') => {
    const existingRfq = rfqs.find(r => r.id === rfqId);
    const fromStatus = existingRfq ? existingRfq.status : 'pending';

    if (isSandboxMode) {
      const updated = rfqs.map(r => r.id === rfqId ? { ...r, status: itemStatus } : r);
      localStorage.setItem(`rfqs_${tenant.id}`, JSON.stringify(updated));
      setRfqs(updated);
    } else {
      // Need to find matching firestore doc
      const path = 'rfqs';
      try {
        const qSnap = await getDocs(query(collection(db, path), where('id', '==', rfqId), where('tenantId', '==', tenant?.id)));
        if (!qSnap.empty) {
          const docRef = doc(db, path, qSnap.docs[0].id);
          await updateDoc(docRef, { status: itemStatus });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }

    if (profile && tenant) {
      logActivityEvent({
        tenantId: tenant.id,
        actionType: 'status_change',
        entityType: 'rfq',
        entityId: rfqId,
        actor: {
          userId: profile.uid,
          displayName: profile.name || profile.email || 'Plant Operator',
          email: profile.email
        },
        description: `RFQ ${rfqId} status updated from "${fromStatus}" to "${itemStatus}".`,
        metadata: {
          fromStatus,
          toStatus: itemStatus,
          rfqNumber: rfqId,
          customerName: existingRfq?.customerName
        },
        isSandboxMode
      });
    }
  };

  // Filter listings
  const filteredRFQs = rfqs.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) 
      || (r.id && r.id.toLowerCase().includes(searchQuery.toLowerCase()))
      || (r.requirements && r.requirements.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* SECTION ACTION BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search RFQs, clients, or parts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>

        {/* Buttons & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-slate-200/50 p-0.5 rounded-lg">
            {(['all', 'pending', 'quoted', 'declined'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors capitalize ${
                  statusFilter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-4 py-2 rounded flex items-center space-x-1.5 shadow-sm hover:scale-102 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 text-sky-200" />
            <span>Capture New RFQ</span>
          </button>
        </div>

      </div>

      {/* FORM MODAL PANEL */}
      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8">
          <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">RFQ Intake Details</h3>
              <p className="text-xs text-slate-500">Record customer requirements and raw specifications</p>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 font-mono text-xs cursor-pointer border border-slate-200 rounded-lg px-2.5 py-1"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSubmitRFQ} className="space-y-6">
            
            {/* Presets shortcut */}
            <div>
              <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">Autofill Distributor Preset</span>
              <div className="flex flex-wrap gap-2">
                {DEMO_CLIENTS.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleClientPresetSelect(i)}
                    className="bg-slate-100 hover:bg-amber-500/10 hover:text-amber-600 border border-slate-200 hover:border-amber-500/20 px-2.5 py-1 rounded text-[10px] text-slate-600 cursor-pointer font-medium"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Company / Customer Name *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  placeholder="e.g. Tata Steel"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  placeholder="e.g. purchase@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Inquiry / Technical Project scope description</label>
              <textarea
                value={requirements}
                rows={2}
                onChange={(e) => setRequirements(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                placeholder="Tolerance levels, surface finish, hardness grade EN8/EN24, welding certifications requested..."
              />
            </div>

            {/* Item selector block */}
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
              <span className="block text-xs font-bold text-slate-800 mb-3">Parts / Materials List Requested</span>
              
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-grow">
                  <label className="block text-[10px] uppercase font-mono text-slate-400 mb-0.5">Select Catalog Product</label>
                  <select
                    value={currentItem}
                    onChange={(e) => setCurrentItem(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="">-- Choose Segment --</option>
                    {DEMO_PRODUCTS.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Estimated price: ₹{p.price}/{p.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-24">
                  <label className="block text-[10px] uppercase font-mono text-slate-400 mb-0.5">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={currentItemQty}
                    onChange={(e) => setCurrentItemQty(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddItemToRFQ}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 rounded-xl self-end py-2 h-9 cursor-pointer"
                >
                  Append Item
                </button>
              </div>

              {/* Added items list */}
              {selectedItems.length > 0 ? (
                <div className="space-y-1 bg-white border border-slate-200 rounded-xl p-3 divide-y divide-slate-100">
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        <span className="ml-2.5 bg-slate-150 text-slate-600 px-2.5 py-0.5 rounded font-mono text-[10px]">
                          Qty: {item.quantity}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 text-xs px-2 cursor-pointer font-mono font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 text-center py-4">No parts associated. Add at least one catalog item above.</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 rounded text-xs uppercase tracking-wider flex items-center justify-center space-x-1 shadow-sm cursor-pointer"
            >
              <Send className="h-3.5 w-3.5 text-sky-400" />
              <span>Submit RFQ Record to Archive</span>
            </button>

          </form>
        </div>
      )}

      {/* RFQ CARDS GRID */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-mono">Syncing RFQ tables from cloud...</p>
        </div>
      ) : filteredRFQs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRFQs.map(rfq => (
            <div 
              key={rfq.id} 
              className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-4.5 relative flex flex-col justify-between ${
                rfq.status === 'quoted' ? 'border-sky-100 bg-sky-50/5' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Header card info */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="bg-slate-100 text-slate-700 font-mono text-[9px] font-bold px-2 py-0.5 rounded">
                      ID: {rfq.id}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono ml-2">
                      {new Date(rfq.createdAt?.seconds ? rfq.createdAt.seconds * 1000 : rfq.createdAt).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold tracking-wider font-mono px-2 py-0.5 rounded uppercase ${
                    rfq.status === 'pending' ? 'bg-orange-50 text-orange-700 border border-orange-200/50' :
                    rfq.status === 'quoted' ? 'bg-sky-50 text-sky-700 border border-sky-200/50' :
                    'bg-slate-100 text-slate-500 border border-slate-200/50'
                  }`}>
                    {rfq.status}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-805 mb-1">{rfq.customerName}</h4>
                {rfq.phone && (
                  <p className="text-[11px] text-slate-500 flex items-center mb-2.5">
                    <PhoneCall className="h-3 w-3 text-slate-400 mr-1.5" />
                    <span>{rfq.phone}</span>
                    {rfq.email && <span className="mx-2 text-slate-300">|</span>}
                    <span>{rfq.email}</span>
                  </p>
                )}

                {rfq.requirements && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5 mb-3 mt-1 italic leading-relaxed">
                    "{rfq.requirements}"
                  </p>
                )}

                {/* Line Items */}
                <div className="space-y-1.5 mb-4">
                  <span className="block text-[9px] uppercase font-bold font-mono tracking-widest text-slate-400">Demanded Parts</span>
                  <div className="space-y-1">
                    {rfq.items.map((item, idx) => (
                      <div key={idx} className="flex items-center text-xs text-slate-705">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500 mr-2" />
                        <span className="font-semibold text-slate-700 mr-2">{item.name}</span>
                        <span className="bg-slate-100 font-mono text-[9px] text-slate-500 px-1.5 py-0.10 rounded font-bold">
                          Qty: {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* CARD ACTIONS */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex space-x-1.5">
                  {rfq.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(rfq.id, 'declined')}
                      className="text-slate-450 hover:text-red-500 hover:bg-red-50 text-[10px] py-1 border border-transparent rounded px-2 font-mono flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Decline</span>
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedTimelineId(prev => ({ ...prev, [rfq.id]: !prev[rfq.id] }))}
                    className={`text-slate-500 hover:text-slate-800 text-[10px] py-1 border border-transparent rounded px-2 font-mono flex items-center space-x-1 cursor-pointer transition-colors ${
                      expandedTimelineId[rfq.id] ? 'bg-slate-105 font-bold text-slate-800' : ''
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{expandedTimelineId[rfq.id] ? 'Hide Logs' : 'View Logs'}</span>
                  </button>
                </div>

                {rfq.status === 'pending' ? (
                  <button
                    onClick={() => onInitiateQuote(rfq)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded flex items-center space-x-1.5 cursor-pointer shadow-sm transition-transform hover:scale-102"
                  >
                    <Check className="h-3.5 w-3.5 text-sky-400" />
                    <span>Cost Estimate & Quotation</span>
                  </button>
                ) : rfq.status === 'quoted' ? (
                  <div className="text-[10px] text-sky-700 font-mono font-bold flex items-center bg-sky-50 border border-sky-100 rounded px-2.5 py-1">
                    <Check className="h-3.5 w-3.5 mr-1 text-sky-500" />
                    <span>Quotation Shared</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">Inquiry Closed / Declined</span>
                )}
              </div>

              {expandedTimelineId[rfq.id] && (
                <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/50 p-3 rounded-lg border border-slate-200/40 select-text">
                  <span className="block text-[9px] uppercase font-bold font-mono tracking-wider text-slate-450 mb-2">RFQ Action Audit Log</span>
                  <ActivityTimeline entityId={rfq.id} entityType="rfq" compact={true} maxLimit={5} />
                </div>
              )}

            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-lg">
          <p className="text-slate-400 text-xs font-medium">No RFQ records matching parameters.</p>
        </div>
      )}

    </div>
  );
};
