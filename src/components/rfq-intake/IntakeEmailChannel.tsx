// src/components/rfq-intake/IntakeEmailChannel.tsx

import React, { useState } from 'react';
import { 
  Mail, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  FileText, 
  Paperclip, 
  ArrowRight, 
  Settings2, 
  Plus, 
  Trash2, 
  Sliders, 
  Send,
  Building,
  User,
  Phone,
  Calendar,
  Layers
} from 'lucide-react';
import { 
  parseEmailInquiry, 
  ParsedInquiryResult, 
  SAMPLE_INTAKE_PRESETS 
} from '../../services/intakeParserService';
import { EmailInboxConfig, IntakeInquiry, RFQItem, IntakeAttachment } from '../../types';

interface IntakeEmailChannelProps {
  emailConfig: EmailInboxConfig;
  onSaveConfig: (cfg: EmailInboxConfig) => Promise<void>;
  onQueueInquiry: (inquiry: Omit<IntakeInquiry, 'id' | 'tenantId' | 'receivedAt' | 'status'>) => Promise<void>;
  onDirectConvert: (inquiryData: any) => Promise<void>;
}

export const IntakeEmailChannel: React.FC<IntakeEmailChannelProps> = ({
  emailConfig,
  onSaveConfig,
  onQueueInquiry,
  onDirectConvert
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Form config state
  const [cfg, setCfg] = useState<EmailInboxConfig>(emailConfig);

  // Email Parser workbench state
  const samplePreset = SAMPLE_INTAKE_PRESETS[0];
  const [fromInput, setFromInput] = useState(samplePreset.sender);
  const [subjectInput, setSubjectInput] = useState(samplePreset.subject);
  const [bodyInput, setBodyInput] = useState(samplePreset.body);
  const [attachedFiles, setAttachedFiles] = useState<IntakeAttachment[]>([samplePreset.mockAttachment!]);

  // Parsing outputs
  const [parsedResult, setParsedResult] = useState<ParsedInquiryResult | null>(() => {
    return parseEmailInquiry(samplePreset.body, {
      from: samplePreset.sender,
      subject: samplePreset.subject,
      attachments: [samplePreset.mockAttachment!]
    });
  });

  const [parsing, setParsing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Trigger Parsing
  const handleParseEmail = () => {
    setParsing(true);
    setTimeout(() => {
      const res = parseEmailInquiry(bodyInput, {
        from: fromInput,
        subject: subjectInput,
        attachments: attachedFiles
      });
      setParsedResult(res);
      setParsing(false);
    }, 250);
  };

  // Simulate Mailbox Sync (IMAP / Graph API)
  const handleSyncMailbox = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setTimeout(() => {
      setSyncing(false);
      const now = new Date().toLocaleTimeString();
      setSyncMessage(`Synced with ${cfg.protocol} mailbox (${cfg.username}) at ${now}. Found 1 new unread inquiry.`);
      // Load sample into parser
      setFromInput(samplePreset.sender);
      setSubjectInput(samplePreset.subject);
      setBodyInput(samplePreset.body);
      setAttachedFiles([samplePreset.mockAttachment!]);
      setParsedResult(parseEmailInquiry(samplePreset.body, {
        from: samplePreset.sender,
        subject: samplePreset.subject,
        attachments: [samplePreset.mockAttachment!]
      }));
    }, 1200);
  };

  // Add line item manually to parsed result
  const handleAddLineItem = () => {
    if (!parsedResult) return;
    const newItem: RFQItem = {
      id: `item-${Date.now()}`,
      name: 'New Custom Fabrication Part',
      quantity: 10,
      specs: 'Material: IS 2062 MS / EN8'
    };
    setParsedResult({
      ...parsedResult,
      items: [...parsedResult.items, newItem]
    });
  };

  const handleRemoveLineItem = (idx: number) => {
    if (!parsedResult) return;
    const updated = [...parsedResult.items];
    updated.splice(idx, 1);
    setParsedResult({
      ...parsedResult,
      items: updated
    });
  };

  const handleUpdateLineItem = (idx: number, field: keyof RFQItem, val: any) => {
    if (!parsedResult) return;
    const updated = [...parsedResult.items];
    updated[idx] = { ...updated[idx], [field]: val };
    setParsedResult({
      ...parsedResult,
      items: updated
    });
  };

  // Queue to Intake
  const handleQueue = async () => {
    if (!parsedResult) return;
    await onQueueInquiry({
      channel: 'Email',
      sourceIdentifier: parsedResult.email || fromInput,
      subject: parsedResult.subject,
      rawContent: bodyInput,
      customerName: parsedResult.customerName,
      contactName: parsedResult.contactName,
      email: parsedResult.email,
      phone: parsedResult.phone,
      city: parsedResult.city,
      priority: parsedResult.priority,
      expectedDeliveryDate: parsedResult.expectedDeliveryDate,
      description: parsedResult.description,
      items: parsedResult.items,
      attachments: parsedResult.attachments
    });
    setActionSuccess('Inquiry successfully logged into the Inbound Queue!');
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // Direct convert to RFQ
  const handleDirectConvert = async () => {
    if (!parsedResult) return;
    await onDirectConvert({
      channel: 'Email',
      sourceIdentifier: parsedResult.email || fromInput,
      subject: parsedResult.subject,
      rawContent: bodyInput,
      customerName: parsedResult.customerName,
      contactName: parsedResult.contactName,
      email: parsedResult.email,
      phone: parsedResult.phone,
      city: parsedResult.city,
      priority: parsedResult.priority,
      expectedDeliveryDate: parsedResult.expectedDeliveryDate,
      description: parsedResult.description,
      items: parsedResult.items,
      attachments: parsedResult.attachments
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Mailbox Header & Status Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm">
                Corporate Email Inbox Parser
              </h3>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span>{cfg.protocol} Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Listening on <span className="font-mono text-slate-700 font-semibold">{cfg.username}</span> ({cfg.protocol} port {cfg.port})
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-2 text-xs font-mono font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-all"
          >
            <Settings2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Server Settings</span>
          </button>
          
          <button
            type="button"
            onClick={handleSyncMailbox}
            disabled={syncing}
            className="px-4 py-2 text-xs font-mono font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing Mailbox...' : 'Sync Mailbox (IMAP/Graph)'}</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3 bg-sky-50 border border-sky-100 text-sky-800 rounded-lg text-xs font-mono flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="h-4 w-4 text-sky-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs font-mono flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Config Drawer */}
      {showConfig && (
        <div className="bg-slate-50 border border-slate-250 rounded-xl p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="text-xs font-bold font-mono text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Sliders className="h-3.5 w-3.5 text-sky-600" />
              <span>Email Protocol & Mailbox Gateway Configuration</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">TLS / SSL Secured</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                Protocol Provider
              </label>
              <select
                value={cfg.protocol}
                onChange={(e) => setCfg({ ...cfg, protocol: e.target.value as any })}
                className="w-full text-xs font-mono border border-slate-250 bg-white rounded-lg p-2 focus:ring-1 focus:ring-sky-500"
              >
                <option value="IMAP">IMAP4 (Direct Mail Server / Exchange)</option>
                <option value="Graph API">Microsoft Graph API (Office 365 / Azure AD)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                Server Hostname
              </label>
              <input
                type="text"
                value={cfg.host || ''}
                onChange={(e) => setCfg({ ...cfg, host: e.target.value })}
                placeholder="imap.secureserver.net"
                className="w-full text-xs font-mono border border-slate-250 bg-white rounded-lg p-2"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                Port / Security
              </label>
              <input
                type="number"
                value={cfg.port || 993}
                onChange={(e) => setCfg({ ...cfg, port: parseInt(e.target.value, 10) })}
                className="w-full text-xs font-mono border border-slate-250 bg-white rounded-lg p-2"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                Inbound Mailbox Account
              </label>
              <input
                type="email"
                value={cfg.username || ''}
                onChange={(e) => setCfg({ ...cfg, username: e.target.value })}
                placeholder="inquiries@ashreyflowops.com"
                className="w-full text-xs font-mono border border-slate-250 bg-white rounded-lg p-2"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                Mail Folder Target
              </label>
              <input
                type="text"
                value={cfg.folder || 'INBOX'}
                onChange={(e) => setCfg({ ...cfg, folder: e.target.value })}
                className="w-full text-xs font-mono border border-slate-250 bg-white rounded-lg p-2"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={async () => {
                  await onSaveConfig(cfg);
                  setShowConfig(false);
                }}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs rounded-lg cursor-pointer transition-all shadow-3xs"
              >
                Save Protocol Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Parser Workbench: Left (Raw Email), Right (Structured Extraction) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Inbound Email Inspector */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-3.5 shadow-3xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <FileText className="h-4 w-4 text-sky-600" />
                <span>Raw Inbound Email Stream</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setFromInput(samplePreset.sender);
                  setSubjectInput(samplePreset.subject);
                  setBodyInput(samplePreset.body);
                  setAttachedFiles([samplePreset.mockAttachment!]);
                  handleParseEmail();
                }}
                className="text-[10px] font-mono text-sky-600 hover:text-sky-800 font-bold underline cursor-pointer"
              >
                Reset to Sample Email
              </button>
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                From Header
              </label>
              <input
                type="text"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white"
                placeholder="Sanjay Deshmukh <s.deshmukh@vendor.com>"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                className="w-full text-xs font-mono font-bold border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white text-slate-800"
                placeholder="URGENT RFQ: Machined Transmission Flanges"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                Email Message Body
              </label>
              <textarea
                rows={10}
                value={bodyInput}
                onChange={(e) => setBodyInput(e.target.value)}
                className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white leading-relaxed text-slate-700"
                placeholder="Paste incoming RFQ inquiry email text here..."
              />
            </div>

            {/* Email Attachments detected */}
            <div>
              <label className="text-[10px] font-mono font-bold text-slate-450 uppercase block mb-1">
                Detected Email Attachments ({attachedFiles.length})
              </label>
              <div className="space-y-1.5">
                {attachedFiles.map((att) => (
                  <div key={att.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center space-x-1.5 text-slate-700 truncate">
                      <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{att.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-sans">
                      {Math.round(att.size / 1024)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleParseEmail}
              disabled={parsing}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-mono font-bold text-xs rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{parsing ? 'Extracting Fields...' : 'Re-Run Email Parsing Engine'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Extracted Structured RFQ Entity */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-3xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-widest block leading-none">
                  AI & Heuristic Extractor Output
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">
                  Structured RFQ Entities
                </h4>
              </div>

              {parsedResult && (
                <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded text-[11px] font-mono font-bold">
                  <span>Confidence: {parsedResult.confidenceScore}%</span>
                </div>
              )}
            </div>

            {parsedResult ? (
              <div className="space-y-4">
                
                {/* Identified Customer Identity Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Customer Company</span>
                    <span className="font-bold text-slate-800 font-sans text-sm flex items-center space-x-1 mt-0.5">
                      <Building className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span>{parsedResult.customerName}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Contact Person</span>
                    <span className="font-medium text-slate-700 flex items-center space-x-1 mt-0.5">
                      <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{parsedResult.contactName}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                    <span className="font-mono text-slate-700 mt-0.5 block truncate">
                      {parsedResult.email || 'Not specified'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Phone & City</span>
                    <span className="font-mono text-slate-700 mt-0.5 flex items-center space-x-2">
                      <span>📞 {parsedResult.phone || 'N/A'}</span>
                      <span className="text-slate-300">|</span>
                      <span>📍 {parsedResult.city}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Urgency / Priority</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase mt-1 ${
                      parsedResult.priority === 'High' 
                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {parsedResult.priority} Urgency
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Target Delivery Date</span>
                    <span className="font-mono text-slate-700 font-semibold mt-0.5 flex items-center space-x-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{parsedResult.expectedDeliveryDate || 'Immediate / Standard'}</span>
                    </span>
                  </div>
                </div>

                {/* Parsed Line Items Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center space-x-1">
                      <Layers className="h-3.5 w-3.5 text-sky-600" />
                      <span>Extracted Line Items ({parsedResult.items.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-2 py-1 text-[10px] font-mono font-bold text-sky-600 hover:text-sky-800 bg-sky-50 rounded border border-sky-100 flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="bg-slate-50 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-semibold">#</th>
                          <th className="py-2 px-3 font-semibold">Part / Component Description</th>
                          <th className="py-2 px-3 font-semibold w-24">Quantity</th>
                          <th className="py-2 px-3 font-semibold">Material / Specs</th>
                          <th className="py-2 px-2 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {parsedResult.items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateLineItem(idx, 'name', e.target.value)}
                                className="w-full bg-transparent border-none p-0 focus:ring-0 font-medium text-slate-800 text-xs"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => handleUpdateLineItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                                className="w-16 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-800 text-xs"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                              <input
                                type="text"
                                value={item.specs || ''}
                                onChange={(e) => handleUpdateLineItem(idx, 'specs', e.target.value)}
                                className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-500 text-xs"
                                placeholder="Specs, Grade, Finish"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                                title="Remove line item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Parsing Trace Diagnostics */}
                {parsedResult.parsingNotes.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-500 space-y-1">
                    <span className="font-bold text-slate-600 uppercase text-[9px] block">Extractor Diagnostics:</span>
                    {parsedResult.parsingNotes.map((note, idx) => (
                      <p key={idx}>✓ {note}</p>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleQueue}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-mono font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-all"
                  >
                    Save to Inbound Queue
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectConvert}
                    className="w-full sm:w-auto px-5 py-2 text-xs font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
                  >
                    <span>Create Formal RFQ Record</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs font-mono">
                Click "Re-Run Email Parsing Engine" to extract structured RFQ data.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
