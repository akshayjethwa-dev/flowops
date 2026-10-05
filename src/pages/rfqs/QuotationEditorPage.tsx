// src/pages/rfqs/QuotationEditorPage.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useRfqDetail } from '../../hooks/useRfqDetail';
import { useQuotation, sendQuotationViaWhatsapp } from '../../hooks/useQuotation';
import { DEMO_PRODUCTS } from '../../data/mockData';
import { QuotationItem, QuotationStatus } from '../../types';
import { useToast } from '../../context/ToastContext';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  FileCheck, 
  Send, 
  MessageSquare, 
  Building, 
  Coins, 
  ChevronRight, 
  AlertCircle,
  HelpCircle,
  Calculator,
  Compass,
  FileSpreadsheet,
  Check,
  X,
  FileText,
  Printer
} from 'lucide-react';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentsList } from '../../components/AttachmentsList';
import { FileSymlink } from 'lucide-react';


export const QuotationEditorPage: React.FC = () => {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const tenantId = tenant?.id;
  const { toastSuccess, toastError, toastInfo } = useToast();

  // Load RFQ Specifications detail
  const { 
    rfq, 
    customer, 
    loading: rfqLoading, 
    error: rfqError,
    addTimelineEvent
  } = useRfqDetail(tenant?.id, rfqId);

  // Load Quotation if any
  const { 
    quotation, 
    loading: quoteLoading, 
    error: quoteError, 
    saveQuotation, 
    updateQuotationStatus 
  } = useQuotation(tenant?.id, rfqId);

  // Form Fields State
  const [quotationNumber, setQuotationNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<QuotationStatus>('Draft');

  // Interactive items block
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Manual append item state
  const [selectedProdId, setSelectedProdId] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [addQty, setAddQty] = useState<number>(1);
  const [addPrice, setAddPrice] = useState<number>(0);
  const [addTax, setAddTax] = useState<number>(18); // default 18% GST

  // Map incoming database values once loaded
  useEffect(() => {
    if (quotation) {
      setQuotationNumber(quotation.quotationNumber);
      setDate(quotation.date);
      setValidityDays(quotation.validityDays);
      setNotes(quotation.notes || '');
      setStatus(quotation.status);
      setItems(quotation.items || []);
    } else if (rfq) {
      // Auto-prefill values from RFQ specs if no quotation is logged
      setQuotationNumber(`QTN-2026-${rfq.rfqNumber?.split('-').pop() || Math.floor(1001 + Math.random() * 8999)}`);
      setDate(new Date().toISOString().split('T')[0]);
      setValidityDays(30);
      setNotes(`Quotation compiled in response to client request ref: ${rfq.rfqNumber || rfqId}. Offers subject to structural design validation.`);
      setStatus('Draft');

      // Map components
      const initialItems: QuotationItem[] = rfq.items.map(item => {
        // Try finding matching catalog item to grab price estimate
        const catalogMatch = DEMO_PRODUCTS.find(p => p.id === item.id);
        const unitPrice = catalogMatch ? catalogMatch.price : 1200; // default Indian Rupee base rate for bespoke
        return {
          description: `${item.name}${item.specs ? ` (${item.specs})` : ''}`,
          quantity: item.quantity,
          unitPrice,
          taxRate: 18,
          lineTotal: item.quantity * unitPrice
        };
      });
      setItems(initialItems);
    }
  }, [quotation, rfq, rfqId]);

  // Adjust custom price when Catalog selector updates
  useEffect(() => {
    if (selectedProdId) {
      const match = DEMO_PRODUCTS.find(p => p.id === selectedProdId);
      if (match) {
        setCustomDesc(match.name);
        setAddPrice(match.price);
      }
    }
  }, [selectedProdId]);

  // Total recalculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    
    items.forEach(itm => {
      subtotal += itm.lineTotal;
      taxTotal += itm.lineTotal * (itm.taxRate / 100);
    });

    return {
      subtotal,
      taxTotal,
      totalAmount: subtotal + taxTotal
    };
  }, [items]);

  // Add Item to Estimate
  const handleAddItem = () => {
    const desc = customDesc.trim() || 'Industrial Machinery Bespoke Output';
    if (addQty <= 0) return;

    const newItem: QuotationItem = {
      description: desc,
      quantity: addQty,
      unitPrice: addPrice,
      taxRate: addTax,
      lineTotal: addQty * addPrice
    };

    setItems([...items, newItem]);
    setCustomDesc('');
    setSelectedProdId('');
    setAddQty(1);
    setAddPrice(0);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  // Modify quantities or price inline
  const handleInlineChange = (idx: number, field: keyof QuotationItem, val: any) => {
    const list = [...items];
    const target = { ...list[idx] };
    
    if (field === 'quantity') {
      target.quantity = Math.max(1, parseInt(val) || 1);
    } else if (field === 'unitPrice') {
      target.unitPrice = Math.max(0, parseFloat(val) || 0);
    } else if (field === 'taxRate') {
      target.taxRate = Math.max(0, parseFloat(val) || 0);
    } else if (field === 'description') {
      target.description = val;
    }

    target.lineTotal = target.quantity * target.unitPrice;
    list[idx] = target;
    setItems(list);
  };

  // Save Quotation Handler
  const handleSaveDraft = async () => {
    if (!tenantId || !rfq || !profile) return;
    setSaving(true);
    setFormFeedback(null);

    try {
      if (items.length === 0) {
        throw new Error('Please include at least one structural quotation item line.');
      }

      await saveQuotation({
        quotationNumber,
        rfqId: rfq.id,
        customerId: rfq.customerId || 'generic-cust',
        customerName: rfq.customerName,
        date,
        validityDays,
        items,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        totalAmount: totals.totalAmount,
        status,
        notes,
        createdBy: profile.uid
      });

      addTimelineEvent(
        'Quotation Document Saved',
        `Commercial breakdown sheet ${quotationNumber} saved in status: ${status}. Grand total: ₹${totals.totalAmount.toLocaleString('en-IN')}`,
        profile.name || 'Estimator'
      );

      toastSuccess('Quotation Updated', `Draft ${quotationNumber} is securely saved under ${rfq.customerName}.`);
      setFormFeedback({ type: 'success', text: `Quotation table ${quotationNumber} has been updated in the cloud registry.` });
    } catch (err: any) {
      const msg = getFriendlyErrorMessage(err);
      toastError('Save Aborted', msg);
      setFormFeedback({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  // Dispatch whatsapp template via stub CF
  const handleSendWhatsApp = async () => {
    if (!tenantId || !rfq) return;
    setSendingWa(true);
    setFormFeedback(null);

    try {
      // Auto-save prior to dispatch
      const payloadObj = {
        quotationNumber,
        rfqId: rfq.id,
        customerId: rfq.customerId || 'generic-cust',
        customerName: rfq.customerName,
        date,
        validityDays,
        items,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        totalAmount: totals.totalAmount,
        status: 'Sent' as QuotationStatus, 
        notes,
        createdBy: profile?.uid || 'demo_user'
      };

      const savedQuote = await saveQuotation(payloadObj);
      setStatus('Sent');

      const response = await sendQuotationViaWhatsapp(
        tenantId,
        rfq.id,
        savedQuote.id,
        rfq.customerId || 'generic-cust',
        rfq.customerName,
        rfq.phone || '9999999999',
        totals.totalAmount,
        quotationNumber
      );

      // Log to RFQ Timeline as well
      addTimelineEvent(
        'WhatsApp Invoice Dispatch',
        `WhatsApp template alert pushed to client liaison. Output URL: ${response.url}`,
        profile?.name || 'Automated Gateway'
      );

      toastSuccess('WhatsApp Transmitted', `Commercial breakdown sheet successfully texted to ${rfq.phone || 'client'}.`);
      setFormFeedback({ type: 'success', text: `Simulation Dispatched: Quotation PDF has been successfully texted to ${rfq.phone || 'client'}.` });
    } catch (err: any) {
      const msg = getFriendlyErrorMessage(err);
      toastError('Transmission Failure', msg);
      setFormFeedback({ type: 'error', text: msg });
    } finally {
      setSendingWa(false);
    }
  };

  // Interactive Accept/Reject shortcuts
  const handleLifecycleChange = async (targetStatus: QuotationStatus) => {
    if (!quotation) {
      toastInfo('Draft Required First', 'Please save the initial quotation draft to secure the catalog rows.');
      setFormFeedback({ type: 'error', text: 'Please save draft before modifying the client signature state' });
      return;
    }
    
    try {
      await updateQuotationStatus(targetStatus);
      setStatus(targetStatus);
      
      addTimelineEvent(
        `Quotation ${targetStatus}`,
        `Document signature set to ${targetStatus} by authorized user.`,
        profile?.name || 'System Admin'
      );
      
      toastSuccess('Lifecycle Updated', `Quotation successfully validated as ${targetStatus}.`);
      setFormFeedback({ type: 'success', text: `Quotation successfully marked as ${targetStatus}.` });
    } catch (err: any) {
      const msg = getFriendlyErrorMessage(err);
      toastError('Status Transition Mismatch', msg);
      setFormFeedback({ type: 'error', text: msg });
    }
  };

  if (rfqLoading || quoteLoading) {
    return (
      <div className="text-center py-20 bg-white border border-slate-205 rounded-xl space-y-4">
        <div className="animate-spin h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-slate-450 font-mono uppercase">Syncing Estimator Workspace...</p>
      </div>
    );
  }

  if (rfqError || !rfq) {
    return (
      <div className="bg-red-50/50 border border-red-200 rounded-xl p-8 text-center max-w-lg mx-auto">
        <AlertCircle className="h-10 w-10 text-red-600 mx-auto" />
        <h4 className="font-bold text-slate-900 mt-2">Invalid RFQ Context</h4>
        <p className="text-xs text-slate-500 mt-1">{rfqError || 'Parent RFQ worksheet missing'}</p>
        <button onClick={() => navigate('/rfqs')} className="mt-4 px-4 py-2 border rounded-lg text-xs font-mono uppercase tracking-wider">
          Return
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Navigation Return */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/rfqs/${rfqId}`)}
          className="inline-flex items-center space-x-1 text-slate-450 hover:text-slate-800 text-[10px] font-mono tracking-wider uppercase cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Exit to RFQ Detail Page</span>
        </button>

        <span className="text-[10px] text-slate-400 font-mono">
          Tenant database node: {tenant?.companyName || 'N/A'}
        </span>
      </div>

      {/* Header Info */}
      <div>
        <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
          Commercial Quotation Engine
        </span>
        <h2 className="text-xl font-bold tracking-tight text-slate-905 mt-1">
          Estimate Proposal Worksheet
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Calculate GST elements, compile commercial rates, and push final PDFs to B2B procurement heads via WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN (1/3 weight): RFQ Summary Pane */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* RFQ Meta Card */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-2xs space-y-4 border border-slate-800">
            <div>
              <span className="text-[9px] font-mono font-bold text-sky-400 uppercase tracking-widest leading-none block">
                Source Document
              </span>
              <h3 className="font-mono text-base font-bold mt-1.5">{rfq.rfqNumber || `RFQ #${rfqId}`}</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Received {rfq.dateReceived} • via {rfq.source || 'Email'}
              </p>
            </div>

            <div className="border-t border-slate-800 pt-3 text-xs space-y-2.5">
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase block">Client B2B Company</span>
                <span className="font-bold text-slate-200 block">{rfq.customerName}</span>
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-500 uppercase block">Liaison Contact</span>
                <span className="font-medium text-slate-300 block">{rfq.contactName || 'N/A'}</span>
              </div>
              {rfq.phone && (
                <div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase block">Mobile Phone</span>
                  <span className="font-mono text-slate-300 block">{rfq.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Client Demand checklist */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <FileSpreadsheet className="h-4 w-4 text-sky-500" />
              <span>Original Components Request</span>
            </h4>

            <div className="space-y-3">
              {rfq.items.map((elem, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg text-xs border border-slate-100 flex items-start justify-between gap-2.5">
                  <div>
                    <div className="font-bold text-slate-800">{elem.name}</div>
                    {elem.specs && (
                      <div className="text-[10px] text-slate-450 mt-1 font-mono">{elem.specs}</div>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded text-[10px] inline-block shrink-0">
                    {elem.quantity} pcs
                  </span>
                </div>
              ))}
            </div>

            {rfq.description && (
              <div className="text-[11px] text-slate-500 font-mono bg-amber-50/30 p-3 rounded-lg border border-amber-100/50 leading-relaxed">
                <span className="font-bold text-amber-800 uppercase text-[9px] block mb-1">Estimator engineering notes:</span>
                {rfq.description}
              </div>
            )}
          </div>

          {/* Card: Quotation PDFs & Contract Documents */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <FileSymlink className="h-4 w-4 text-sky-500" />
              <span>Quotation PDFs & Documents</span>
            </h4>
            
            {tenantId && (
              <>
                <AttachmentsList 
                  entityType="quotation" 
                  entityId={rfqId!} 
                  tenantId={tenantId} 
                  userProfile={profile} 
                  userRole={profile?.role} 
                />
                <div className="pt-2">
                  <FileUploader 
                    entityType="quotation" 
                    entityId={rfqId!} 
                    tenantId={tenantId} 
                    userProfile={profile} 
                  />
                </div>
              </>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN (2/3 weight): Invoice-like quotation Editor */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
            
            {/* Form Fields header row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-[11px] pb-4 border-b border-slate-105">
              {/* Quote number */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-450 uppercase tracking-widest block">Quotation Document Ref</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-550 border border-slate-205 rounded-lg p-2 font-sans focus:bg-white text-slate-800 text-xs focus:outline-hidden"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                />
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-450 uppercase tracking-widest block">Quotation Date</label>
                <input
                  type="date"
                  required
                  className="w-full bg-slate-550 border border-slate-205 rounded-lg p-2 font-sans focus:bg-white text-slate-800 text-xs focus:outline-hidden"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Validity days */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-450 uppercase tracking-widest block">Validity Offset (Days)</label>
                <input
                  type="number"
                  min="1"
                  className="w-full bg-slate-550 border border-slate-205 rounded-lg p-1.5 focus:bg-white text-slate-850 text-xs focus:outline-hidden"
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>

            {/* Line Items builder */}
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Quotation line items ledger</span>

              {/* Standard pre-selector */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-slate-50 p-4 border border-slate-200 rounded-lg">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-500 block uppercase">Append Catalog / Custom Item</label>
                  <select
                    className="w-full bg-white border border-slate-220 rounded-lg p-2 text-xs text-slate-705 focus:outline-hidden"
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                  >
                    <option value="">-- Manual customized input --</option>
                    {DEMO_PRODUCTS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Base: ₹{p.price.toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Custom description..."
                    className="w-full bg-white border border-slate-220 rounded-lg p-2 mt-2 text-xs text-slate-700 focus:outline-hidden font-mono"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                  />
                </div>

                <div className="space-y-1 font-mono text-center">
                  <label className="text-[9px] font-bold text-slate-500 block uppercase">Qty</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-white border border-slate-220 rounded-lg p-1.5 text-xs text-center focus:outline-hidden font-sans"
                    value={addQty}
                    onChange={(e) => setAddQty(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-1 font-mono text-right">
                  <label className="text-[9px] font-bold text-slate-500 block uppercase">Unit Price (₹)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-slate-220 rounded-lg p-1.5 text-xs text-right focus:outline-hidden font-sans"
                    value={addPrice}
                    onChange={(e) => setAddPrice(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="sm:col-span-4 flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center space-x-2 font-mono text-[10px]">
                    <span className="text-slate-400 uppercase">GST Slab Percent:</span>
                    <select
                      value={addTax}
                      onChange={(e) => setAddTax(parseInt(e.target.value))}
                      className="bg-white border rounded px-1.5 py-0.5 text-slate-700"
                    >
                      <option value="18">18% Standard GST</option>
                      <option value="12">12% Reduced GST</option>
                      <option value="28">28% Luxury GST</option>
                      <option value="5">5% Direct Consumables</option>
                      <option value="0">0% Exempt</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-mono text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition flex items-center space-x-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Append Line</span>
                  </button>
                </div>
              </div>

              {/* Items Table list */}
              {items.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden select-none">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/60 border-b border-slate-200 font-mono text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                        <th className="py-2.5 px-4 text-left">Description Details</th>
                        <th className="py-2.5 px-2 text-center w-20">Qty Code</th>
                        <th className="py-2.5 px-3 text-right w-28">Unit Price</th>
                        <th className="py-2.5 px-2 text-center w-20">GST Rate</th>
                        <th className="py-2.5 px-4 text-right w-32">Total (excl. Tax)</th>
                        <th className="py-2.5 px-2 text-center w-12">Err</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((itm, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20 font-sans">
                          {/* Desc */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              className="w-full bg-slate-50 p-1 rounded hover:bg-white text-xs text-slate-800 font-mono focus:outline-hidden"
                              value={itm.description}
                              onChange={(e) => handleInlineChange(idx, 'description', e.target.value)}
                            />
                          </td>

                          {/* Qty */}
                          <td className="py-3 px-2">
                            <input
                              type="number"
                              min="1"
                              className="w-full bg-slate-50 p-1 text-center font-mono rounded hover:bg-white text-xs focus:outline-hidden"
                              value={itm.quantity}
                              onChange={(e) => handleInlineChange(idx, 'quantity', e.target.value)}
                            />
                          </td>

                          {/* Price */}
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              className="w-full bg-slate-50 p-1 text-right font-mono rounded hover:bg-white text-xs focus:outline-hidden"
                              value={itm.unitPrice}
                              onChange={(e) => handleInlineChange(idx, 'unitPrice', e.target.value)}
                            />
                          </td>

                          {/* Tax Percent */}
                          <td className="py-3 px-2 text-center">
                            <select
                              className="bg-slate-50 p-1 font-mono rounded text-[11px] focus:outline-hidden"
                              value={itm.taxRate}
                              onChange={(e) => handleInlineChange(idx, 'taxRate', parseInt(e.target.value))}
                            >
                              <option value="18">18%</option>
                              <option value="12">12%</option>
                              <option value="28">28%</option>
                              <option value="5">5%</option>
                              <option value="0">0%</option>
                            </select>
                          </td>

                          {/* Line total */}
                          <td className="py-3 px-4 font-mono font-bold text-slate-700 text-right whitespace-nowrap">
                            ₹{itm.lineTotal.toLocaleString('en-IN')}
                          </td>

                          {/* Action erase */}
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-400 hover:text-red-650 cursor-pointer p-0.5"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-slate-205 rounded-xl text-slate-400 text-xs font-mono bg-slate-50">
                  No billing line-items allocated to current dispatch estimate worksheet.
                </div>
              )}

            </div>

            {/* Calculations total row summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              
              {/* Additional Notes terms */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block">Standard Terms / Custom Remarks</label>
                <textarea
                  rows={3}
                  className="w-full border border-slate-200 bg-slate-50 hover:bg-white rounded-lg p-2.5 text-xs text-slate-700 focus:outline-hidden"
                  placeholder="Insert payment structures, logistics responsibility, delivery terms, inspection procedures..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Calculations Block */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 font-mono text-xs text-right space-y-2.5 self-start select-none">
                <div className="flex items-center justify-between">
                  <span className="text-slate-450 uppercase text-[10px]">Taxable Subtotal:</span>
                  <span className="font-bold text-slate-800">₹{totals.subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-455 uppercase text-[10px]">Calculated GST Tax:</span>
                  <span className="font-bold text-slate-800">+ ₹{totals.taxTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="h-px bg-slate-200 my-2" />
                <div className="flex items-center justify-between text-sm leading-none pt-1">
                  <span className="text-slate-900 border-l-2 border-sky-500 pl-2 text-left font-sans font-bold uppercase tracking-wide">GRAND TOTAL:</span>
                  <span className="font-black text-slate-950 text-base">₹{totals.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

            </div>

            {/* Feedback notification alerts */}
            {formFeedback && (
              <div className={`p-3.5 rounded-lg border text-xs font-mono flex items-center space-x-2 ${
                formFeedback.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-150' 
                  : 'bg-red-50 text-red-800 border-red-150'
              }`}>
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{formFeedback.text}</span>
              </div>
            )}

            {/* Form actions block footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 select-none">
              
              {/* Lifecycle operations shortcuts */}
              <div className="flex items-center space-x-1 w-full sm:w-auto shrink-0">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mr-2">Lifecycle State:</span>
                
                <button
                  type="button"
                  onClick={() => handleLifecycleChange('Accepted')}
                  className={`px-3 py-1.5 border rounded-lg font-mono text-[9px] uppercase font-bold tracking-wider cursor-pointer transition ${
                    status === 'Accepted'
                      ? 'bg-emerald-550 border-emerald-600 bg-emerald-600 font-extrabold text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  Mark Won
                </button>

                <button
                  type="button"
                  onClick={() => handleLifecycleChange('Rejected')}
                  className={`px-3 py-1.5 border rounded-lg font-mono text-[9px] uppercase font-bold tracking-wider cursor-pointer transition ${
                    status === 'Rejected'
                      ? 'bg-rose-600 border-rose-700 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  Mark Lost
                </button>
              </div>

              {/* Blueprint primary CTA */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                {/* Print Proposal */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-mono text-[10px] uppercase tracking-wider font-extrabold px-4 py-2.5 rounded-lg cursor-pointer transition flex items-center space-x-1.5 shadow-3xs"
                  title="Print commercial quotation proposal"
                >
                  <Printer className="h-4 w-4 text-slate-400" />
                  <span>Print Proposal</span>
                </button>

                {/* Save Draft */}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-350 text-white font-mono text-[10px] uppercase tracking-wider font-bold px-4 py-2.5 rounded-lg cursor-pointer transition flex items-center space-x-1.5"
                >
                  <Save className="h-4 w-4 text-slate-300" />
                  <span>{saving ? 'Saving...' : 'Save Draft Sheet'}</span>
                </button>

                {/* Send via WhatsApp */}
                <button
                  type="button"
                  disabled={sendingWa}
                  onClick={handleSendWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-350 text-white font-mono text-[10px] uppercase tracking-wider font-bold px-4 py-2.5 rounded-lg cursor-pointer transition flex items-center space-x-1.5 shadow-sm"
                >
                  <MessageSquare className="h-4 w-4 text-emerald-205" />
                  <span>{sendingWa ? 'Pushing alert...' : 'Send via WhatsApp'}</span>
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
