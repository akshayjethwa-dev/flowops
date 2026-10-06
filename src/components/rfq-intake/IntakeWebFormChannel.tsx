// src/components/rfq-intake/IntakeWebFormChannel.tsx

import React, { useState, useRef } from 'react';
import { 
  Globe, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  Paperclip, 
  CheckCircle, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ExternalLink, 
  Copy, 
  Building, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Layers,
  Sparkles,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { 
  parseBOMFileContent, 
  readFileAsText, 
  SAMPLE_INTAKE_PRESETS 
} from '../../services/intakeParserService';
import { RFQItem, IntakeAttachment, IntakeInquiry } from '../../types';

interface IntakeWebFormChannelProps {
  tenantId?: string;
  onQueueInquiry: (inquiry: Omit<IntakeInquiry, 'id' | 'tenantId' | 'receivedAt' | 'status'>) => Promise<void>;
  onDirectConvert: (inquiryData: any) => Promise<void>;
}

export const IntakeWebFormChannel: React.FC<IntakeWebFormChannelProps> = ({
  tenantId,
  onQueueInquiry,
  onDirectConvert
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Customer form fields
  const [customerName, setCustomerName] = useState('Larsen & Toubro Heavy Engineering');
  const [contactName, setContactName] = useState('P. V. Rao');
  const [phone, setPhone] = useState('9845012345');
  const [email, setEmail] = useState('p.rao@lt-heavy.com');
  const [city, setCity] = useState('Vadodara');
  const [gstNumber, setGstNumber] = useState('24AAACL1234F1Z5');
  const [subject, setSubject] = useState('Web Inquiry: Heavy Foundation Baseplate Fabrication');
  const [description, setDescription] = useState('Fabrication and precision machining of baseframes with ultrasonic testing.');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('2026-11-15');

  // Items State (can be populated from BOM upload)
  const [items, setItems] = useState<RFQItem[]>([
    { id: 'item-1', name: 'Baseplate 50mm IS 2062 E250', quantity: 8, specs: 'Dimensions: 1500mm x 800mm x 50mm' },
    { id: 'item-2', name: 'Gusset Plate 16mm Rib Stiffener', quantity: 32, specs: 'Beveled edges for full penetration weld' },
    { id: 'item-3', name: 'Anchor Bolt Assemblies M36 Grade 8.8', quantity: 64, specs: 'Hot Dip Galvanized with double nuts' }
  ]);

  // Uploaded Attachments
  const [attachments, setAttachments] = useState<IntakeAttachment[]>([
    {
      id: 'att-bom-sample',
      name: 'Foundation_Baseplate_BOM_v2.csv',
      size: 18200,
      type: 'text/csv'
    }
  ]);

  const [parsingBOM, setParsingBOM] = useState(false);
  const [bomNotice, setBomNotice] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Handle uploaded files (CSV / Excel / PDF)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setParsingBOM(true);
    setBomNotice(null);

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

      // Parse BOM if spreadsheet or CSV
      if (isSpreadsheet) {
        try {
          const text = await readFileAsText(file);
          const parsed = await parseBOMFileContent(text, file.name);
          if (parsed.items.length > 0) {
            setItems(parsed.items);
            setBomNotice(`Successfully parsed ${parsed.items.length} line items from ${file.name}`);
          }
        } catch (err: any) {
          console.warn('BOM parse error:', err);
          setBomNotice(`Notice: Uploaded file attached, manual review recommended.`);
        }
      } else {
        setBomNotice(`Attached drawing/spec file "${file.name}".`);
      }
    }

    setAttachments(prev => [...newAttachments, ...prev]);
    setParsingBOM(false);
  };

  // Add line item manually
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        name: 'Fabricated Steel Component',
        quantity: 1,
        specs: 'Grade / Drawing Specs'
      }
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    const updated = [...items];
    updated.splice(idx, 1);
    setItems(updated);
  };

  const handleUpdateItem = (idx: number, field: keyof RFQItem, val: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: val };
    setItems(updated);
  };

  // Remove attachment
  const handleRemoveAttachment = (attId: string) => {
    setAttachments(attachments.filter(a => a.id !== attId));
  };

  // Queue to Intake
  const handleQueue = async () => {
    await onQueueInquiry({
      channel: 'Web Form',
      sourceIdentifier: `web-portal-${Date.now()}`,
      subject,
      rawContent: `Web Form submission by ${customerName} (${contactName}). Description: ${description}`,
      customerName,
      contactName,
      email,
      phone,
      city,
      gstNumber,
      priority,
      expectedDeliveryDate,
      description,
      items,
      attachments
    });
    setActionSuccess('Inquiry received via Web Form and queued successfully!');
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // Direct convert to RFQ
  const handleDirectConvert = async () => {
    await onDirectConvert({
      channel: 'Web Form',
      sourceIdentifier: `web-portal-${Date.now()}`,
      subject,
      rawContent: `Web Form submission by ${customerName} (${contactName}). Description: ${description}`,
      customerName,
      contactName,
      email,
      phone,
      city,
      gstNumber,
      priority,
      expectedDeliveryDate,
      description,
      items,
      attachments
    });
  };

  const shareableUrl = `${window.location.origin}/rfq-submit?tenantId=${tenantId || 'demo'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 shrink-0">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm">
                Web Form Intake & BOM Spreadsheet Uploader
              </h3>
              <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                Excel / CSV / PDF Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Empower customers and sales reps to upload Excel/CSV Bill of Materials (BOM) and engineering drawings directly into structured RFQ items.
            </p>
          </div>
        </div>

        {/* Public Portal Link Copy CTA */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3.5 py-2 text-xs font-mono font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-all"
            title="Copy Public Web Form URL to share with customers"
          >
            {copiedLink ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Public Intake URL'}</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-mono flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Form: Customer Info, File Upload & BOM Parsing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Customer Profile & Details */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 shadow-3xs">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center space-x-1.5 pb-2 border-b border-slate-100">
              <Building className="h-4 w-4 text-purple-600" />
              <span>Customer Organization & Contacts</span>
            </span>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full text-xs font-sans font-bold border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white text-slate-800"
                placeholder="e.g. Larsen & Toubro Heavy Engineering"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                  Contact Person *
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white"
                  placeholder="P. V. Rao"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white"
                  placeholder="9845012345"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white"
                  placeholder="p.rao@lt-heavy.com"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                  City / Location
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white"
                  placeholder="Vadodara"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                  GSTIN (Tax ID)
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white uppercase"
                  placeholder="24AAACL1234F1Z5"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                  Priority Urgency
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Standard</option>
                  <option value="High">High Urgency</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                Project / RFQ Title
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs font-mono font-semibold border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white text-slate-800"
                placeholder="e.g. Baseplate Fabrication Order"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                Target Delivery Date
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                Fabrication Notes / Scope Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs font-sans border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white text-slate-700"
                placeholder="Scope of work, testing requirements, coating specifications..."
              />
            </div>
          </div>
        </div>

        {/* Right Column: File Dropzone, BOM Auto-Parser & Editable Item List */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* File Upload Dropzone */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-3xs">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center space-x-1.5 pb-2 border-b border-slate-100">
              <Upload className="h-4 w-4 text-purple-600" />
              <span>Upload Bill of Materials (Excel / CSV) & Technical Drawings (PDF)</span>
            </span>

            {/* Hidden Input */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".csv,.xlsx,.xls,.tsv,.pdf,.png,.jpg,.jpeg,.dwg"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Dropzone Container */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50/80 rounded-xl p-6 text-center cursor-pointer transition-all space-y-2 select-none"
            >
              <div className="w-12 h-12 bg-white rounded-full shadow-3xs flex items-center justify-center mx-auto text-purple-600 border border-purple-100">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 font-sans">
                  Click to Browse or Drag & Drop BOM Files
                </p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  Supports Excel (.xlsx, .xls), CSV (.csv), Technical Drawings (.pdf, .dwg)
                </p>
              </div>
              <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-[10px] font-mono font-bold rounded-full">
                Auto-Parsing Active: Rows instantly convert to line items
              </span>
            </div>

            {bomNotice && (
              <div className="p-3 bg-purple-50 border border-purple-100 text-purple-800 rounded-lg text-xs font-mono flex items-center space-x-2 animate-fade-in">
                <FileCheck className="h-4 w-4 text-purple-600 shrink-0" />
                <span>{bomNotice}</span>
              </div>
            )}

            {/* Uploaded Attachments List */}
            {attachments.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block">
                  Attached Ingestion Files ({attachments.length})
                </label>
                <div className="space-y-1">
                  {attachments.map((att) => (
                    <div key={att.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center space-x-2 truncate pr-2">
                        {att.name.endsWith('.csv') || att.name.endsWith('.xlsx') ? (
                          <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-sky-600 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-800 truncate">{att.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">({Math.round(att.size / 1024)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                        title="Remove attachment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Structured Line Items Table Editor */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-3xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center space-x-1.5">
                <Layers className="h-4 w-4 text-purple-600" />
                <span>BOM Line Items Table ({items.length})</span>
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 text-[10px] font-mono font-bold text-purple-700 hover:text-purple-900 bg-purple-50 rounded border border-purple-200 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Add Part Row</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">#</th>
                    <th className="py-2 px-3 font-semibold">Component / Part Description</th>
                    <th className="py-2 px-3 font-semibold w-24">Quantity</th>
                    <th className="py-2 px-3 font-semibold">Material / Specification</th>
                    <th className="py-2 px-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-slate-800 text-xs"
                          placeholder="Part Name / SKU"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-800 text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        <input
                          type="text"
                          value={item.specs || ''}
                          onChange={(e) => handleUpdateItem(idx, 'specs', e.target.value)}
                          className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-500 text-xs"
                          placeholder="Grade, thickness, tolerances"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Execution CTA */}
            <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleQueue}
                className="w-full sm:w-auto px-4 py-2 text-xs font-mono font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-all"
              >
                Log to Inbound Queue
              </button>

              <button
                type="button"
                onClick={handleDirectConvert}
                className="w-full sm:w-auto px-5 py-2 text-xs font-mono font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
              >
                <span>Save & Create Formal RFQ Record</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
