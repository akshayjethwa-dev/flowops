// src/components/quotations/QuotationEditor.tsx

import React, { useState, useEffect } from 'react';
import { Quote, QuoteItem, Customer, QuotationTotals } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useCreateQuotation, useUpdateQuotation } from '../../hooks/useQuotations';
import { LineItemsTable } from './LineItemsTable';
import { QuotationTotalsPanel } from './QuotationTotalsPanel';
import { 
  calculateQuotationTotals, 
  generateQuotationNumber,
  calculateLineItemAmount
} from '../../utils/quotationUtils';
import { 
  FileText, Calendar, Plus, Clock, Save, FileCheck, Check, AlertCircle, ShoppingBag, Calculator, Sparkles, History, RotateCcw 
} from 'lucide-react';
import { useCostEngine } from '../../hooks/useCostEngine';
import { InteractiveCostEstimatorModal } from '../cost-engine/InteractiveCostEstimatorModal';
import { 
  getApprovalWorkflowConfig, 
  evaluateQuoteApproval, 
  dispatchApprovalNotification,
  createQuoteRevision
} from '../../services/quoteApprovalService';

interface QuotationEditorProps {
  prefillRFQ?: any;
  clearPrefillRFQ: () => void;
  editingQuote?: Quote | null;
  onSaved: (newQuote: Quote) => void;
  onCancel: () => void;
}

export const QuotationEditor: React.FC<QuotationEditorProps> = ({ 
  prefillRFQ, 
  clearPrefillRFQ, 
  editingQuote,
  onSaved, 
  onCancel 
}) => {
  const { tenant, profile } = useAuth();
  const { createQuotation, loading: creating, error: createError } = useCreateQuotation();
  const { updateQuotation, loading: updating, error: updateError } = useUpdateQuotation();
  const saving = creating || updating;
  const saveError = createError || updateError;

  const isRevision = Boolean(editingQuote);
  const nextVersionNumber = editingQuote ? (editingQuote.currentVersion || (editingQuote.versions?.length ? editingQuote.versions.length : 1)) + 1 : 1;

  // State Management
  const [customerName, setCustomerName] = useState(editingQuote?.customerName || '');
  const [phone, setPhone] = useState(editingQuote?.phone || '');
  const [email, setEmail] = useState(editingQuote?.email || '');
  const [date, setDate] = useState(editingQuote?.date || new Date().toISOString().split('T')[0]);
  const [validDays, setValidDays] = useState(30);
  const [items, setItems] = useState<QuoteItem[]>(editingQuote?.items || []);
  
  // Terms Prepopulation
  const [termsAndConditions, setTermsAndConditions] = useState(editingQuote?.termsAndConditions || '');
  const [notes, setNotes] = useState(editingQuote?.notes || '');
  const [changeSummary, setChangeSummary] = useState(
    editingQuote?.status === 'rejected'
      ? `Revision addressing rejection: ${editingQuote.approvalState?.rejectionReason || 'Adjusted margins and rates'}`
      : ''
  );

  // Customer Master Suggestions
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Cost Engine integration
  const { activeTemplate } = useCostEngine(tenant?.id);
  const [costEngineModalOpen, setCostEngineModalOpen] = useState(false);

  const handleApplyCostEngine = (result: {
    partName: string;
    quantity: number;
    unitPrice: number;
    breakdown: any;
    specSummary: string;
  }) => {
    const calculatedTotal = calculateLineItemAmount({
      quantity: result.quantity,
      unitPrice: result.unitPrice,
      discount: 0,
      gstPercent: 18
    });

    const newItem: QuoteItem = {
      id: `itm_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `${result.partName} [${result.specSummary}]`,
      hsn: '7308',
      quantity: result.quantity,
      unit: 'PCS',
      unitPrice: result.unitPrice,
      discount: 0,
      gstPercent: 18,
      total: calculatedTotal
    };

    setItems(prev => [...prev, newItem]);
    setCostEngineModalOpen(false);
  };

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  // Load defaults and customers list
  useEffect(() => {
    if (!tenant?.id) return;

    // Load Default Terms and Conditions
    const defaultTerms = `1. Price Validity: ${validDays} days from dispatch.
2. Delivery Lead Time: 2-3 weeks post official technical approval.
3. Tax Assessment: Subject to 18% standard Integrated/Central and State GST.
4. Transport Freight: Borne exclusively by client works unless stated otherwise.
5. Standard Payment: 50% advance allocation, 50% post foundry inspection before loading.`;
    setTermsAndConditions(defaultTerms);

    // Fetch master customers for selection
    const fetchCustomers = async () => {
      try {
        if (isSandbox) {
          const cached = localStorage.getItem(`customers_${tenant.id}`);
          if (cached) {
            setAllCustomers(JSON.parse(cached));
          } else {
            // Seed a few defaults if empty
            const defaults: Customer[] = [
              {
                tenantId: tenant.id,
                name: 'Karan Metals Ltd.',
                type: 'customer',
                contactPerson: 'Karan Sharma',
                phone: '9876543210',
                email: 'procurement@karanmetals.com',
                billingAddress: '42, Industrial Area Phase 1, Mumbai',
                shippingAddress: '42, Industrial Area Phase 1, Mumbai',
                city: 'Mumbai'
              },
              {
                tenantId: tenant.id,
                name: 'Sharma Pipelines Corp',
                type: 'customer',
                contactPerson: 'Sunil Sharma',
                phone: '7654321098',
                email: 'sunil@sharmapipelines.com',
                billingAddress: 'G-12, MIDC Hinjewadi, Pune',
                shippingAddress: 'G-12, MIDC Hinjewadi, Pune',
                city: 'Pune'
              },
              {
                tenantId: tenant.id,
                name: 'Pradeep Forge India',
                type: 'dealer',
                contactPerson: 'Pradeep Singh',
                phone: '8888877777',
                email: 'purchase@pradeepforge.in',
                billingAddress: 'Plot 99, GIDC, Vadodara, Gujarat',
                shippingAddress: 'Plot 99, GIDC, Vadodara, Gujarat',
                city: 'Vadodara'
              }
            ];
            localStorage.setItem(`customers_${tenant.id}`, JSON.stringify(defaults));
            setAllCustomers(defaults);
          }
        } else {
          const q = query(collection(db, 'customers'), where('tenantId', '==', tenant.id));
          const snapshot = await getDocs(q);
          const list: Customer[] = [];
          snapshot.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() } as Customer);
          });
          setAllCustomers(list);
        }
      } catch (err) {
        console.error('Error fetching customers master:', err);
      }
    };

    fetchCustomers();
  }, [tenant?.id, isSandbox]);

  // Adjust Validity terms dynamically when expiry period changes
  useEffect(() => {
    setTermsAndConditions(prev => {
      if (prev.includes('Price Validity:')) {
        return prev.replace(/Price Validity: \d+ days/, `Price Validity: ${validDays} days`);
      }
      return prev;
    });
  }, [validDays]);

  // Prefill RFQ logic if passed
  useEffect(() => {
    if (prefillRFQ) {
      setCustomerName(prefillRFQ.customerName || '');
      setPhone(prefillRFQ.phone || prefillRFQ.customerPhone || '');
      setEmail(prefillRFQ.email || prefillRFQ.customerEmail || '');

      // Check if items are in parent RFQ and map them
      if (prefillRFQ.items && prefillRFQ.items.length > 0) {
        const mappedItems: QuoteItem[] = prefillRFQ.items.map((i: any, index: number) => {
          const quantity = i.quantity || 1;
          const unitPrice = i.estimatedPrice || i.unitPrice || 1000; // default estimated seed rate
          const discount = 0;
          const gstPercent = 18;
          const gross = quantity * unitPrice;
          const tax = gross * (gstPercent / 100);

          return {
            id: i.id || `rfq_itm_${index}_${Date.now()}`,
            name: i.name || i.description || 'Custom Machining Bracket Part',
            hsn: i.hsn || '7308',
            quantity,
            unit: i.unit || 'PCS',
            unitPrice,
            discount,
            gstPercent,
            total: gross + tax
          };
        });
        setItems(mappedItems);
      }
    }
  }, [prefillRFQ]);

  // Handle Customer profile selection
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const found = allCustomers.find(c => c.id === customerId || (c.name === customerId && !c.id));
    if (found) {
      setCustomerName(found.name);
      setPhone(found.phone);
      setEmail(found.email);
    }
  };

  const totals: QuotationTotals = calculateQuotationTotals(items);

  const handlePublishForm = async (status: 'draft' | 'sent') => {
    if (!tenant?.id) return;
    if (!customerName.trim()) {
      alert('Buying Company / Customer Name is a required field.');
      return;
    }
    if (items.length === 0) {
      alert('Kindly configure at least one engineering line item component before saving.');
      return;
    }

    const calculatedValidity = new Date(new Date(date).getTime() + Number(validDays) * 24 * 3600 * 1000)
      .toISOString().split('T')[0];

    // Branch 1: If editing/revising existing quote, snapshot revision and update
    if (editingQuote) {
      const config = await getApprovalWorkflowConfig(tenant.id);
      const revisedQuote = createQuoteRevision(
        editingQuote,
        {
          customerName: customerName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          items,
          subtotal: totals.subtotal,
          gstAmount: totals.taxTotal,
          discountTotal: totals.discountTotal,
          total: totals.grandTotal,
          validUntil: calculatedValidity,
          date,
          termsAndConditions,
          notes: notes.trim() || undefined,
        },
        { uid: profile?.uid || 'user', name: profile?.name || 'Sales Staff', email: profile?.email || '' },
        changeSummary.trim() || notes.trim() || `Revision v${nextVersionNumber}.0 modifications`,
        config
      );

      try {
        await updateQuotation(editingQuote.id, revisedQuote);
        clearPrefillRFQ();

        if (revisedQuote.approvalState?.requiresApproval) {
          await dispatchApprovalNotification({
            tenantId: tenant.id,
            type: 'approval_requested',
            quote: revisedQuote,
            actor: {
              uid: profile?.uid || 'user',
              name: profile?.name || 'Sales Staff',
              email: profile?.email || ''
            }
          });
        }

        onSaved(revisedQuote);
      } catch (err) {
        console.error('Revision update error:', err);
      }
      return;
    }

    // Branch 2: Standard new quote creation
    const generatedNumber = generateQuotationNumber(tenant.id);

    // Evaluate approval workflow against value & discount thresholds
    const config = await getApprovalWorkflowConfig(tenant.id);
    const approvalState = evaluateQuoteApproval(
      { total: totals.grandTotal, discountTotal: totals.discountTotal, subtotal: totals.subtotal, items },
      config,
      { uid: profile?.uid || 'user', name: profile?.name || 'Sales Staff', email: profile?.email || '' }
    );

    const initialVersion = {
      version: 1,
      versionLabel: 'v1.0',
      createdAt: new Date().toISOString(),
      createdBy: {
        uid: profile?.uid || 'user',
        name: profile?.name || 'Sales Staff',
        email: profile?.email || ''
      },
      changeSummary: notes.trim() || 'Initial drafted formulation',
      items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      gstAmount: totals.taxTotal,
      total: totals.grandTotal,
      approvalStatus: approvalState.requiresApproval ? ('pending_approval' as const) : status
    };

    const finalStatus = approvalState.requiresApproval ? ('pending_approval' as const) : status;

    const payload: Omit<Quote, 'id' | 'tenantId' | 'createdBy' | 'createdAt'> = {
      rfqId: prefillRFQ?.id || 'direct_quote',
      quoteNumber: generatedNumber,
      customerName: customerName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      items,
      subtotal: totals.subtotal,
      gstAmount: totals.taxTotal,
      discountTotal: totals.discountTotal,
      total: totals.grandTotal,
      validUntil: calculatedValidity,
      date,
      termsAndConditions,
      notes: notes.trim() || undefined,
      status: finalStatus,
      approvalState,
      currentVersion: 1,
      versions: [initialVersion]
    };

    try {
      const newQuote = await createQuotation(payload);
      clearPrefillRFQ();

      if (approvalState.requiresApproval) {
        await dispatchApprovalNotification({
          tenantId: tenant.id,
          type: 'approval_requested',
          quote: newQuote,
          actor: {
            uid: profile?.uid || 'user',
            name: profile?.name || 'Sales Staff',
            email: profile?.email || ''
          }
        });
      }

      onSaved(newQuote);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-5 sm:p-7 space-y-7 animate-slide-up font-sans leading-relaxed">
      
      {/* FORM TITLE */}
      <div className="flex justify-between items-center pb-4.5 border-b border-slate-150">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-xl border ${
            isRevision 
              ? 'bg-amber-50 text-amber-600 border-amber-200' 
              : 'bg-sky-50 text-sky-600 border-sky-100'
          }`}>
            {isRevision ? <History className="h-5.5 w-5.5" /> : <FileText className="h-5.5 w-5.5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-extrabold tracking-tight text-slate-900">
                {isRevision 
                  ? `Quotation Revision: ${editingQuote?.quoteNumber} (Target v${nextVersionNumber}.0)` 
                  : 'Custom B2B Quotation Desk'}
              </h3>
              {isRevision && (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 font-mono font-bold text-[10px] px-2 py-0.5 rounded-full uppercase">
                  v{nextVersionNumber}.0 Revision Draft
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isRevision 
                ? `Revising previous version v${editingQuote?.currentVersion || 1}.0. All edits will snapshot into official audit version history.` 
                : 'Draft raw models or compile multi-item technical PDFs.'}
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          type="button"
          className="text-slate-450 hover:text-slate-700 bg-white border border-slate-250 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
        >
          {isRevision ? 'Cancel Revision' : 'Discard Draft'}
        </button>
      </div>

      {/* REVISION NOTICE & PREVIOUS REJECTION FEEDBACK BANNER */}
      {isRevision && editingQuote?.status === 'rejected' && editingQuote.approvalState?.rejectionReason && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-xs text-rose-900">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase font-mono text-[10px] text-rose-800 tracking-wider block">
              Previous Managerial Rejection Reason:
            </span>
            <p className="font-semibold italic">
              "{editingQuote.approvalState.rejectionReason}"
            </p>
            <p className="text-[11px] text-rose-700 pt-0.5">
              Please adjust component margins, discounts, or labor rates accordingly. Submitting will advance this quote to v{nextVersionNumber}.0 and re-route for authorization.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        
        {/* SECTION 1: CUSTOMER MASTER & TARGET METADATA */}
        <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-xl space-y-4">
          <span className="block text-[11px] font-extrabold font-mono text-slate-500 uppercase tracking-wider">
            1. Customer Specification Profile
          </span>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-medium">
            
            {/* Customer Search select */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-slate-600 font-semibold block">Select Existing Profile / Or Type Directly</label>
              <div className="flex gap-2">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 grow focus:outline-hidden text-xs"
                >
                  <option value="">-- Choose Profile Suggestion --</option>
                  {allCustomers.map((c, i) => (
                    <option key={c.id || c.name} value={c.id || c.name}>
                      {c.name} ({c.city})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="Insert Company Name"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setSelectedCustomerId(''); // Clear selection if typing custom
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 max-w-xs focus:ring-1 focus:ring-sky-505 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Cell Phone */}
            <div className="space-y-1">
              <label className="text-slate-600 font-semibold block">WhatsApp Contact Contact *</label>
              <input
                type="text"
                required
                placeholder="e.g. 9176543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1 font-sans">
              <label className="text-slate-600 font-semibold block">Client Procurement Email</label>
              <input
                type="email"
                placeholder="procurement@buyingcompany.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
            </div>

          </div>
        </div>

        {/* SECTION 2: DATES & EXPINING LIMITS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="space-y-1 text-xs">
            <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
              <Calendar className="h-4 w-4 text-sky-500" />
              <span>Quotation Issue Date</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="text-slate-600 font-bold uppercase tracking-wider text-[10px] flex items-center space-x-1">
              <Clock className="h-4 w-4 text-rose-500" />
              <span>Validity Expiry Limit</span>
            </label>
            <select
              value={validDays}
              onChange={(e) => setValidDays(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
            >
              <option value={15}>15 Calendar Days</option>
              <option value={30}>30 Calendar Days</option>
              <option value={45}>45 Calendar Days</option>
              <option value={60}>60 Calendar Days</option>
            </select>
          </div>

          <div className="space-y-1 text-xs">
            <label className="text-slate-450 block uppercase font-mono text-[9px] tracking-wider leading-none">Computed Deadline:</label>
            <p className="border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-600 bg-rose-50/10">
              {new Date(new Date(date).getTime() + Number(validDays) * 24 * 3600 * 1000).toLocaleDateString()} (Auto-Tracked)
            </p>
          </div>
        </div>

        {/* SECTION 3: EDITABLE LINE ITEMS TABLE */}
        <div className="pt-2">
          <LineItemsTable 
            items={items} 
            onChangeItems={setItems}
            onOpenCostEngine={() => setCostEngineModalOpen(true)}
            activeTemplateName={activeTemplate ? `${activeTemplate.name} (${activeTemplate.version})` : undefined}
          />
        </div>

        {/* SECTION 4: TEXT BLOCKS & FINANCES ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          
          {/* Notes and TCs */}
          <div className="lg:col-span-7 space-y-4 font-sans text-xs">
            <div className="space-y-1">
              <label className="text-slate-600 font-bold">Standard Terms & Legal Disclaimers (Prefilled)</label>
              <textarea
                rows={5}
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                placeholder="Insert contractual clauses, payment stages, warranty parameters..."
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono leading-relaxed"
              />
            </div>

            {/* REVISION CHANGE SUMMARY FIELD */}
            {isRevision && (
              <div className="space-y-1 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                <label className="text-amber-900 font-bold flex items-center space-x-1.5">
                  <History className="h-3.5 w-3.5 text-amber-600" />
                  <span>Revision Change Summary (Logged to Audit Trail & Version History) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="e.g. Reduced line item markup by 5% and renegotiated subcontract rate per Director instructions."
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
                <p className="text-[10px] text-amber-700/80 font-mono">
                  This note will be attached to v{nextVersionNumber}.0 in the version history changelog.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-slate-600 font-bold">Internal Reference Notes (Non-Printable)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Spoken with Karan over phone; he requested extra discount."
                className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal text-slate-700"
              />
            </div>
          </div>

          {/* Cost Panel */}
          <div className="lg:col-span-5 space-y-3">
            <QuotationTotalsPanel totals={totals} />

            {totals.grandTotal > 100000 && (
              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <span className="font-bold block text-[11px] uppercase tracking-wider font-mono text-amber-800">
                    Commercial Policy Threshold (&gt;₹1,00,000)
                  </span>
                  <p className="text-[11px] text-amber-700/90 mt-0.5">
                    Quote total of ₹{totals.grandTotal.toLocaleString('en-IN')} exceeds ₹1L. Saving will automatically route through Director Authorization before client release.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* FOOTER ACTIONS AND ERRORS */}
        {saveError && (
          <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg flex items-center space-x-2 text-[11px] text-rose-700">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <span>Save Failed: {saveError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center border-t border-slate-150 pt-5 gap-3">
          <button
            onClick={onCancel}
            type="button"
            className="text-slate-500 hover:text-slate-700 font-bold text-xs uppercase px-4 py-2 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors w-full sm:w-auto"
          >
            Cancel Estimation Builder
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => handlePublishForm('draft')}
              disabled={saving}
              type="button"
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-350 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center space-x-1.5"
            >
              <Save className="h-4.5 w-4.5 text-slate-400" />
              <span>Save Raw Draft</span>
            </button>

            <button
              onClick={() => handlePublishForm('sent')}
              disabled={saving}
              type="button"
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center space-x-1.5 shadow-sm"
            >
              {saving ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileCheck className="h-4 w-4 text-sky-200" />
              )}
              <span>Publish & Design PDF</span>
            </button>
          </div>
        </div>

      </div>

      {activeTemplate && (
        <InteractiveCostEstimatorModal
          isOpen={costEngineModalOpen}
          onClose={() => setCostEngineModalOpen(false)}
          template={activeTemplate}
          initialPartName={customerName ? `Precision Part - ${customerName}` : 'Custom Manufactured Component'}
          onApplyToQuote={handleApplyCostEngine}
        />
      )}

    </div>
  );
};
