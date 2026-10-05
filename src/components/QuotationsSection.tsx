// src/components/QuotationsSection.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  getDocs,
  updateDoc,
  setDoc,
  doc,
  serverTimestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { Quote, RFQ, Order, ProductionJob } from '../types';
import { sendWhatsAppNotification } from '../utils/whatsapp';
import { logActivityEvent } from '../utils/activityLogger';

// Modular core quotation pieces
import { QuotationEditor } from './quotations/QuotationEditor';
import { QuotationPDFPreviewModal } from './quotations/QuotationPDFPreviewModal';

import { 
  Plus, Check, FileText, Send, Share2, Eye, Printer, ShieldCheck, FileCheck, Layers, Calendar, ChevronRight 
} from 'lucide-react';

interface QuotationsSectionProps {
  prefillRFQ: RFQ | null;
  clearPrefillRFQ: () => void;
  onInitiateOrder: (order: Order) => void;
}

export const QuotationsSection: React.FC<QuotationsSectionProps> = ({ 
  prefillRFQ, 
  clearPrefillRFQ,
  onInitiateOrder
}) => {
  const { profile, tenant, isSandboxMode } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  // Flow State triggers
  const [showAddForm, setShowAddForm] = useState(false);
  const [activePreviewQuote, setActivePreviewQuote] = useState<Quote | null>(null);

  // Prefill hook trigger when page receives RFQ prefills
  useEffect(() => {
    if (prefillRFQ) {
      setShowAddForm(true);
    }
  }, [prefillRFQ]);

  // Read Quotes collection mapping real-time snapshot
  useEffect(() => {
    if (!profile || !tenant) return;

    if (isSandboxMode) {
      const fetchCached = () => {
        const cached = localStorage.getItem(`quotes_${tenant.id}`);
        if (cached) {
          setQuotes(JSON.parse(cached));
        } else {
          const initialQuotes: Quote[] = [
            {
              id: 'quote_301',
              tenantId: tenant.id,
              rfqId: 'rfq_1002',
              quoteNumber: 'AQ/2026/05-022',
              customerName: 'Techno Welds India Pvt Ltd',
              email: 'rsharma@technowelds.co.in',
              phone: '9123456780',
              items: [
                { id: 'p2', name: 'Stainless Steel Arc Welding Consumables (Grade E308L-16)', quantity: 150, unitPrice: 340, gstPercent: 18, total: 60180 }
              ],
              subtotal: 51000,
              gstAmount: 9180,
              total: 60180,
              validUntil: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0],
              status: 'sent',
              createdBy: 'demo_user',
              createdAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString()
            }
          ];
          localStorage.setItem(`quotes_${tenant.id}`, JSON.stringify(initialQuotes));
          setQuotes(initialQuotes);
        }
        setLoading(false);
      };

      fetchCached();

      // Listen for local changes to keep UI reactive
      window.addEventListener('storage', fetchCached);
      return () => window.removeEventListener('storage', fetchCached);
    } else {
      const path = 'quotes';
      const q = query(
        collection(db, path),
        where('tenantId', '==', tenant.id)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Quote[] = [];
        snapshot.forEach(docSnap => {
          list.push(docSnap.data() as Quote);
        });
        // Sort by date locally to avoid index errors on unindexed parameters
        list.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
        setQuotes(list);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => unsubscribe();
    }
  }, [profile, tenant, isSandboxMode]);

  // Handle order approval and transitioning Quote to 'approved' and spawning Production lines
  const handleApproveQuotation = async (quote: Quote) => {
    if (!profile || !tenant) return;
    
    // 1. Create matching Confirmed Order
    const oNumber = `OD-${Date.now().toString().slice(-5)}`;
    const newOrder: Order = {
      id: `order_${Date.now().toString().slice(-6)}`,
      tenantId: tenant.id,
      quoteId: quote.id,
      orderNumber: oNumber,
      customerName: quote.customerName,
      phone: quote.phone,
      items: quote.items,
      totalAmount: quote.total,
      deliveryDate: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: 'pending',
      createdBy: profile.uid,
      createdAt: isSandboxMode ? new Date().toISOString() : serverTimestamp()
    };

    // 2. Map line items to active Production Jobs
    const jobs: ProductionJob[] = quote.items.map((item, idx) => ({
      id: `job_${Date.now().toString().slice(-5)}_${idx}`,
      tenantId: tenant.id,
      orderId: newOrder.id,
      itemName: item.name,
      quantity: item.quantity,
      currentStage: 'cutting', 
      stagesHistory: [
        {
          stage: 'cutting',
          notes: 'Assembly schedule initialized automatically from Quotation Approval.',
          updatedBy: profile.uid,
          updatedByName: profile.name,
          updatedAt: new Date().toISOString()
        }
      ],
      updatedBy: profile.uid,
      updatedAt: isSandboxMode ? new Date().toISOString() : serverTimestamp()
    }));

    if (isSandboxMode) {
      // Update Quote Status locally
      const cachedQuotes = localStorage.getItem(`quotes_${tenant.id}`);
      if (cachedQuotes) {
        const parsed = JSON.parse(cachedQuotes) as Quote[];
        const updatedQuotes = parsed.map(q => q.id === quote.id ? { ...q, status: 'approved' as const } : q);
        localStorage.setItem(`quotes_${tenant.id}`, JSON.stringify(updatedQuotes));
        setQuotes(updatedQuotes);
      }

      // Save Order
      const cachedOrders = localStorage.getItem(`orders_${tenant.id}`) || '[]';
      const ordersList = JSON.parse(cachedOrders);
      localStorage.setItem(`orders_${tenant.id}`, JSON.stringify([newOrder, ...ordersList]));

      // Save Jobs
      const cachedJobs = localStorage.getItem(`jobs_${tenant.id}`) || '[]';
      const jobsList = JSON.parse(cachedJobs);
      localStorage.setItem(`jobs_${tenant.id}`, JSON.stringify([...jobs, ...jobsList]));
    } else {
      try {
        // Update Quotes collection doc
        const quotesSnap = await getDocs(query(collection(db, 'quotes'), where('id', '==', quote.id)));
        if (!quotesSnap.empty) {
          await updateDoc(doc(db, 'quotes', quotesSnap.docs[0].id), { status: 'approved' });
        }

        // Add to orders
        await setDoc(doc(db, 'orders', newOrder.id), newOrder);

        // Add each line item production job
        for (const job of jobs) {
          await setDoc(doc(db, 'productionJobs', job.id), job);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'orders');
      }
    }

    // Trigger WhatsApp notification on Order Confirmation
    if (quote.phone) {
      await sendWhatsAppNotification({
        recipientName: quote.customerName,
        recipientPhone: quote.phone,
        templateName: 'order_confirmed',
        tenantId: tenant.id,
        parameters: {
          orderNumber: oNumber,
          deliveryDate: new Date(Date.now() + 21 * 24 * 3600 * 1000).toLocaleDateString(),
          companyName: tenant.companyName
        }
      });
    }

    logActivityEvent({
      tenantId: tenant.id,
      actionType: 'accepted',
      entityType: 'quotation',
      entityId: quote.id,
      actor: {
        userId: profile.uid,
        displayName: profile.name || profile.email || 'Plant Manager',
        email: profile.email
      },
      description: `Quotation ${quote.quoteNumber} for customer "${quote.customerName}" was approved. Spawned production Order #${oNumber}.`,
      metadata: {
        fromStatus: quote.status,
        toStatus: 'approved',
        quoteNumber: quote.quoteNumber,
        orderNumber: oNumber,
        customerName: quote.customerName
      },
      isSandboxMode
    });

    logActivityEvent({
      tenantId: tenant.id,
      actionType: 'create',
      entityType: 'job',
      entityId: newOrder.id,
      actor: {
        userId: profile.uid,
        displayName: profile.name || profile.email || 'Plant Manager',
        email: profile.email
      },
      description: `Created confirmed production Order #${oNumber} for customer "${quote.customerName}" with ${jobs.length} manufacturing lines.`,
      metadata: {
        orderNumber: oNumber,
        customerName: quote.customerName
      },
      isSandboxMode
    });

    alert(`Quotation approved! Order #${oNumber} created successfully. Live production lines spawned for all ${quote.items.length} technical components.`);
    onInitiateOrder(newOrder);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* SECTION HEADER BLOCK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 border-b border-slate-200/70 p-4 rounded-xl gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="bg-sky-50 text-sky-600 p-2 rounded-xl border border-sky-100">
            <FileText className="h-5.5 w-5.5" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 leading-none">Quotations Repository</h4>
            <p className="text-xs text-slate-450 mt-1">Design and publish custom commercial B2B documents attaching dynamic terms and conditions.</p>
          </div>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-3xs hover:scale-101 transition-all"
          >
            <Plus className="h-4.5 w-4.5 text-sky-102" />
            <span>Draft New Quote</span>
          </button>
        )}
      </div>

      {/* RENDER DRAFT BUILDER */}
      {showAddForm ? (
        <QuotationEditor
          prefillRFQ={prefillRFQ}
          clearPrefillRFQ={clearPrefillRFQ}
          onSaved={(newQuote) => {
            setShowAddForm(false);
            // Open PDF Preview Modal right after saving so they can compile/verify PDF instantly!
            setActivePreviewQuote(newQuote);
          }}
          onCancel={() => {
            setShowAddForm(false);
            clearPrefillRFQ();
          }}
        />
      ) : (
        /* INDEX CARDS LIST */
        loading ? (
          <div className="text-center py-20">
            <div className="animate-spin h-8 w-8 border-3 border-sky-505 border-t-transparent rounded-full mx-auto" />
            <p className="text-xs text-slate-400 font-mono mt-3">Accessing B2B database records...</p>
          </div>
        ) : quotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {quotes.map(q => {
              const itemsCount = q.items?.length || 0;
              const hasPdf = !!q.downloadUrl;

              return (
                <div 
                  key={q.id}
                  className={`bg-white border rounded-2xl p-5 shadow-3xs flex flex-col hover:shadow-xs transition-all border-slate-200 relative ${
                    q.status === 'approved' 
                      ? 'border-emerald-200 bg-emerald-50/5' 
                      : ''
                  }`}
                >
                  {/* Status index bar */}
                  <div className="flex justify-between items-start pb-3.5 mb-3.5 border-b border-slate-100">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                          q.status === 'draft' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                          q.status === 'sent' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          q.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {q.status.toUpperCase()}
                        </span>
                        
                        {q.pdfVersion && (
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            v{q.pdfVersion}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-1.5">{q.quoteNumber}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider font-mono">Quotation Value</p>
                      <p className="text-base font-extrabold font-mono text-slate-800">
                        ₹{q.total.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-tight line-clamp-1">{q.customerName}</h4>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono mt-1">
                        {q.phone && <span>Cel: {q.phone}</span>}
                        {q.phone && q.email && <span>•</span>}
                        {q.email && <span className="truncate max-w-28">{q.email}</span>}
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
                      <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold mb-1 pb-1 border-b border-slate-200/50">
                        <span>BOM list ({itemsCount})</span>
                        <span>value</span>
                      </div>
                      <div className="space-y-1.5 font-sans">
                        {q.items?.slice(0, 2).map((itm, i) => (
                          <div key={itm.id} className="flex justify-between text-slate-650">
                            <span className="truncate max-w-[160px] font-semibold">{itm.name}</span>
                            <span className="font-mono text-slate-500">₹{itm.total.toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                        {itemsCount > 2 && (
                          <p className="text-[10px] text-slate-400 font-mono font-semibold">
                            + {itemsCount - 2} additional technical lines listed
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer metadata */}
                  <div className="pt-3.5 mt-3.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono shrink-0">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>Expiry: {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : 'N/A'}</span>
                    </span>

                    {hasPdf ? (
                      <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                        PDF Stored
                      </span>
                    ) : (
                      <span className="text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        No PDF Yet
                      </span>
                    )}
                  </div>

                  {/* Card bottom actions strip */}
                  <div className="pt-4.5 mt-3.5 border-t border-slate-100 flex flex-wrap gap-2 justify-end shrink-0">
                    <button
                      onClick={() => setActivePreviewQuote(q)}
                      className="bg-white border border-slate-250 text-slate-700 font-bold text-[10px] px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors flex items-center space-x-1 cursor-pointer uppercase tracking-wider"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{hasPdf ? 'View PDF Desk' : 'Inspect Details'}</span>
                    </button>

                    {q.status === 'sent' && (
                      <button
                        onClick={() => handleApproveQuotation(q)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-3 py-2 rounded-lg flex items-center space-x-1 uppercase tracking-wider shadow-3xs cursor-pointer transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Quote</span>
                      </button>
                    )}

                    {q.status === 'approved' && (
                      <div className="text-[9.5px] font-bold font-mono text-emerald-700 bg-emerald-50/70 border border-emerald-150 rounded-lg px-2.5 py-1.5 flex items-center">
                        <ShieldCheck className="h-4 w-4 text-emerald-500 mr-1" />
                        <span>Order Confirmed</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white border border-slate-202 rounded-2xl">
            <p className="text-slate-500 text-sm font-semibold">No commercial quotation sheets exists in active database archives.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Formulate your first proposal by clicking "Draft New Quote" at top.
            </p>
          </div>
        )
      )}

      {/* RENDER PDF LIVE PREVIEW MODAL */}
      {activePreviewQuote && (
        <QuotationPDFPreviewModal
          quote={activePreviewQuote}
          onClose={() => setActivePreviewQuote(null)}
          onRefreshList={() => {
            // Hot refresh active quote from cache to reflect incremented PDF version strings
            if (isSandboxMode && tenant) {
              const cached = localStorage.getItem(`quotes_${tenant.id}`);
              if (cached) {
                const list = JSON.parse(cached) as Quote[];
                const found = list.find(q => q.id === activePreviewQuote.id);
                if (found) setActivePreviewQuote(found);
              }
            }
          }}
        />
      )}

    </div>
  );
};
