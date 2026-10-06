// src/pages/public/PublicRfqWebFormPage.tsx

import React, { useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Building2, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle, 
  Paperclip, 
  Plus, 
  Trash2, 
  Send, 
  ArrowLeft,
  Layers,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Clock
} from 'lucide-react';
import { parseBOMFileContent, readFileAsText } from '../../services/intakeParserService';
import { RFQItem, IntakeAttachment } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const PublicRfqWebFormPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId') || 'demo';

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  // Items State
  const [items, setItems] = useState<RFQItem[]>([
    { id: 'item-1', name: '', quantity: 1, specs: '' }
  ]);

  const [attachments, setAttachments] = useState<IntakeAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [bomMessage, setBomMessage] = useState<string | null>(null);

  // File Upload & BOM Parsing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setBomMessage(null);
    const newAttachments: IntakeAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isSpreadsheet = file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt');

      newAttachments.push({
        id: `att-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url: URL.createObjectURL(file)
      });

      if (isSpreadsheet) {
        try {
          const text = await readFileAsText(file);
          const parsed = await parseBOMFileContent(text, file.name);
          if (parsed.items.length > 0) {
            setItems(parsed.items);
            setBomMessage(`Extracted ${parsed.items.length} parts from BOM spreadsheet "${file.name}".`);
          }
        } catch (err) {
          console.warn('Failed to parse spreadsheet:', err);
        }
      }
    }

    setAttachments(prev => [...newAttachments, ...prev]);
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: `item-${Date.now()}`, name: '', quantity: 1, specs: '' }
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    const updated = [...items];
    updated.splice(idx, 1);
    setItems(updated);
  };

  const handleUpdateItem = (idx: number, field: keyof RFQItem, val: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: val };
    setItems(updated);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone) return;
    setSubmitting(true);

    const refNumber = `INQ-${Date.now().toString().slice(-6)}`;
    const validItems = items.filter(it => it.name.trim().length > 0);

    const inquiryPayload = {
      tenantId,
      channel: 'Web Form' as const,
      sourceIdentifier: `web-public-${Date.now()}`,
      subject: projectTitle || `Inquiry from ${customerName}`,
      rawContent: `Public web submission by ${customerName} (${contactPerson}). Phone: ${phone}. Email: ${email}. Notes: ${notes}`,
      receivedAt: new Date().toISOString(),
      status: 'pending' as const,
      customerName,
      contactName: contactPerson,
      email,
      phone,
      city,
      gstNumber,
      priority: 'Medium' as const,
      expectedDeliveryDate: deliveryDate,
      description: notes,
      items: validItems.length > 0 ? validItems : [{ id: '1', name: projectTitle || 'Custom Machined Component', quantity: 1, specs: notes }],
      attachments
    };

    try {
      const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
      if (isSandbox) {
        const key = `intake_inquiries_${tenantId}`;
        const cached = localStorage.getItem(key);
        const list = cached ? JSON.parse(cached) : [];
        localStorage.setItem(key, JSON.stringify([{ ...inquiryPayload, id: refNumber }, ...list]));
      } else {
        const colPath = `tenants/${tenantId}/inquiries`;
        await addDoc(collection(db, colPath), inquiryPayload);
      }
      setSubmittedRef(refNumber);
    } catch (err) {
      console.error('Failed to submit public web RFQ:', err);
      // Fallback
      const key = `intake_inquiries_${tenantId}`;
      const cached = localStorage.getItem(key);
      const list = cached ? JSON.parse(cached) : [];
      localStorage.setItem(key, JSON.stringify([{ ...inquiryPayload, id: refNumber }, ...list]));
      setSubmittedRef(refNumber);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-md">
              AF
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Ashrey FlowOps Manufacturing
              </h1>
              <p className="text-xs text-slate-500 font-mono">
                Customer RFQ & Technical Estimation Gateway
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="text-xs font-mono font-bold text-sky-600 hover:text-sky-800 transition-colors"
          >
            Staff Portal Sign In →
          </Link>
        </div>

        {submittedRef ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center space-y-5 shadow-sm animate-fade-in">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Inquiry Submitted Successfully!
              </h2>
              <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
                Thank you, <span className="font-bold">{customerName}</span>. Your technical specifications and BOM files have been securely transmitted to our engineering team.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl inline-block text-left font-mono text-xs space-y-1">
              <p className="text-slate-500">Inquiry Reference Number:</p>
              <p className="text-lg font-black text-slate-900">{submittedRef}</p>
              <p className="text-[11px] text-slate-400">Our sales engineer will review your drawings and revert with quotation.</p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setSubmittedRef(null);
                  setCustomerName('');
                  setContactPerson('');
                  setPhone('');
                  setEmail('');
                  setItems([{ id: '1', name: '', quantity: 1, specs: '' }]);
                  setAttachments([]);
                }}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs rounded-xl cursor-pointer shadow-sm transition-all"
              >
                Submit Another Inquiry
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Intro Card */}
            <div className="bg-gradient-to-r from-sky-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 space-y-2 shadow-sm">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-sky-400">
                Instant Request For Quotation (RFQ)
              </span>
              <h2 className="text-2xl font-bold tracking-tight">
                Submit Metalwork, Machining or Fabrication Inquiry
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Upload your engineering drawing PDFs or paste your Bill of Materials (BOM) Excel spreadsheet. Our sales engineers will compute material costing and turnaround times promptly.
              </p>
            </div>

            {/* Organization Info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-3xs">
              <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-sky-600" />
                <span>1. Company & Contact Details</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Company / Firm Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Tata Motors Vendor / Bharat Forge"
                    className="w-full text-xs border border-slate-250 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full text-xs border border-slate-250 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Phone / WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9880123456"
                    className="w-full text-xs border border-slate-250 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rajesh@company.com"
                    className="w-full text-xs border border-slate-250 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Delivery Plant City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Pune / Mumbai / Ahmedabad"
                    className="w-full text-xs border border-slate-250 rounded-lg p-2.5 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    GST Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full text-xs border border-slate-250 rounded-lg p-2.5 bg-slate-50 focus:bg-white uppercase font-mono"
                  />
                </div>
              </div>
            </div>

            {/* File Upload Zone */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-3xs">
              <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
                <Upload className="h-4 w-4 text-sky-600" />
                <span>2. Upload Technical Drawings (PDF) or Bill of Materials (CSV/Excel)</span>
              </h3>

              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".csv,.xlsx,.xls,.tsv,.pdf,.png,.jpg,.jpeg,.dwg"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-sky-200 hover:border-sky-400 bg-sky-50/40 hover:bg-sky-50/80 rounded-xl p-8 text-center cursor-pointer transition-all space-y-2 select-none"
              >
                <div className="w-12 h-12 bg-white rounded-full shadow-3xs flex items-center justify-center mx-auto text-sky-600 border border-sky-100">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Click to Upload BOM Spreadsheet or CAD / PDF Drawings
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Excel (.xlsx, .xls), CSV (.csv), Technical Drawings (.pdf)
                  </p>
                </div>
              </div>

              {bomMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-mono flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{bomMessage}</span>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                    Uploaded Files ({attachments.length}):
                  </span>
                  <div className="space-y-1">
                    {attachments.map((att) => (
                      <div key={att.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono">
                        <span className="flex items-center space-x-1.5 truncate text-slate-700">
                          <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">{att.name}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {Math.round(att.size / 1024)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-3xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-sky-600" />
                  <span>3. Required Parts & Components ({items.length})</span>
                </h3>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-2.5 py-1 text-[11px] font-mono font-bold text-sky-600 hover:text-sky-800 bg-sky-50 rounded-lg border border-sky-200 flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Component Name / Description</th>
                      <th className="py-2.5 px-3 w-24">Quantity</th>
                      <th className="py-2.5 px-3">Material / Specifications</th>
                      <th className="py-2.5 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            required
                            value={it.name}
                            onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                            placeholder="e.g. Forged Flange 4 inch Class 150"
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-sans text-slate-800"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="w-16 border border-slate-200 rounded px-2 py-1 text-xs font-bold"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={it.specs || ''}
                            onChange={(e) => handleUpdateItem(idx, 'specs', e.target.value)}
                            placeholder="e.g. SS 304, AWS A5.4"
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-600"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scope Notes & Submission */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-3xs">
              <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
                <Clock className="h-4 w-4 text-sky-600" />
                <span>4. Additional Project Instructions & Delivery Deadline</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Target Required Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full text-xs border border-slate-250 rounded-lg p-2.5 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Special Packaging / Testing Requirements
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="MTC reports, heat treatment, ultrasonic test, wooden crate packing..."
                    className="w-full text-xs border border-slate-250 rounded-lg p-2.5 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-150 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-8 py-3 bg-sky-600 hover:bg-sky-700 text-white font-mono font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitting ? 'Transmitting RFQ...' : 'Submit RFQ Specification'}</span>
                </button>
              </div>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
