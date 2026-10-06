// src/components/bom-scrubber/BomScrubberView.tsx

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Package, 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Layers, 
  Sparkles, 
  Sliders, 
  Search, 
  X, 
  ArrowRight, 
  ExternalLink, 
  Info, 
  FileText,
  ShieldAlert,
  ChevronDown,
  Edit2,
  Check
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStockItems } from '../../hooks/useStockInventory';
import { useToast } from '../../context/ToastContext';
import { useBomScrubber, SAMPLE_BOM_PRESETS } from '../../hooks/useBomScrubber';
import { SupplierCatalogModal } from './SupplierCatalogModal';
import { AlternateComponent, ScrubbedBomLineItem } from '../../types/bomScrubber';

interface BomScrubberViewProps {
  initialRfqId?: string;
  initialRfqNumber?: string;
  initialCustomerName?: string;
  onPushToQuotation?: (items: { name: string; quantity: number; unitPrice: number; specs?: string }[]) => void;
}

export const BomScrubberView: React.FC<BomScrubberViewProps> = ({
  initialRfqId,
  initialRfqNumber,
  initialCustomerName,
  onPushToQuotation
}) => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const { toastSuccess, toastError, toastInfo } = useToast();
  
  // Real-time stock from tenant inventory
  const { items: warehouseStock } = useStockItems(tenant?.id);

  // Initialize BOM Scrubber hook
  const {
    activeBomTitle,
    setActiveBomTitle,
    sourceFileName,
    sourceFileType,
    scrubbedItems,
    filteredItems,
    summary,
    marginPercent,
    setMarginPercent,
    scrapBufferPercent,
    setScrapBufferPercent,
    isProcessing,
    isRefreshingPrices,
    parsingNotes,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    loadPreset,
    importExcelFile,
    importTextBom,
    refreshLivePricing,
    substituteAlternateComponent,
    updateItemOverride,
    downloadSampleTemplate,
    exportScrubbedReport,
    saveScrubbedBomRecord,
    isSaving
  } = useBomScrubber(tenant?.id, warehouseStock);

  // Modal / Drawer states
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [textImportModalOpen, setTextImportModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [pastedTitle, setPastedTitle] = useState('Customer PDF BOM Extract');
  const [activeItemForAlternate, setActiveItemForAlternate] = useState<ScrubbedBomLineItem | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string; price: number; leadTime: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await importExcelFile(file);
      toastSuccess(`Imported ${res.count} BOM items from "${file.name}". Automated scrubbing complete!`);
    } catch (err: any) {
      toastError(`Failed to import file: ${err.message || err}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Drag & Drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toastError('Please drop a valid Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    try {
      const res = await importExcelFile(file);
      toastSuccess(`Imported ${res.count} BOM items from "${file.name}". Automated scrubbing complete!`);
    } catch (err: any) {
      toastError(`Failed to import file: ${err.message || err}`);
    }
  };

  // Handle text BOM submission
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) return;

    try {
      const res = importTextBom(pastedText, pastedTitle);
      setTextImportModalOpen(false);
      setPastedText('');
      toastSuccess(`Parsed ${res.count} line items from text. Scrubbing complete!`);
    } catch (err: any) {
      toastError(err.message || 'Could not parse text BOM.');
    }
  };

  // Handle Live Pricing Refresh
  const handleRefreshLivePricing = async () => {
    try {
      await refreshLivePricing();
      toastSuccess('Refreshed real-time supplier catalog spot rates with live commodity index adjustments!');
    } catch (err: any) {
      toastError('Failed to refresh pricing.');
    }
  };

  // Handle 1-Click Alternate Swap
  const handleSwapAlternate = (item: ScrubbedBomLineItem, alternate: AlternateComponent) => {
    substituteAlternateComponent(item.id, alternate);
    setActiveItemForAlternate(null);
    toastSuccess(`Replaced obsolete ${item.partNumber} with active ${alternate.partNumber}!`);
  };

  // 1-Click Substitute All Obsolete Items
  const handleSubstituteAllObsolete = () => {
    const obsoleteItems = scrubbedItems.filter(i => i.risk.isObsolete && i.risk.recommendedAlternates.length > 0);
    if (obsoleteItems.length === 0) return;

    obsoleteItems.forEach(item => {
      const bestAlternate = item.risk.recommendedAlternates[0];
      if (bestAlternate) {
        substituteAlternateComponent(item.id, bestAlternate);
      }
    });

    toastSuccess(`Substituted ${obsoleteItems.length} obsolete components with approved active equivalents!`);
  };

  // Push to Quotation
  const handlePushToQuotation = () => {
    if (!summary || scrubbedItems.length === 0) return;

    const quoteLineItems = scrubbedItems.map(item => ({
      name: `${item.partNumber} - ${item.description}`,
      quantity: item.quantity,
      unitPrice: Math.round(item.effectiveUnitPrice * (1 + marginPercent / 100)),
      specs: `${item.materialGrade ? 'Grade: ' + item.materialGrade + ' | ' : ''}Lead Time: ${item.effectiveLeadTimeDays}d | Source: ${item.selectedSource}`
    }));

    if (onPushToQuotation) {
      onPushToQuotation(quoteLineItems);
    } else {
      // Route to RFQs create or quotation editor with state
      navigate('/rfqs/new', {
        state: {
          prefilledItems: quoteLineItems,
          customerName: initialCustomerName || 'Industrial Client',
          description: `Derived from Scrubbed BOM: ${activeBomTitle}. Critical Path Lead Time: ${summary.criticalPathLeadTimeDays} Days.`
        }
      });
      toastSuccess('Exported scrubbed BOM lines into new RFQ Quotation form!');
    }
  };

  // Save Scrubbed Record
  const handleSaveAudit = async () => {
    try {
      await saveScrubbedBomRecord(initialRfqId, initialRfqNumber, initialCustomerName);
      toastSuccess('Saved scrubbed BOM validation audit to database!');
    } catch (err: any) {
      toastError('Could not save audit to database.');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
                Costing & Estimations Engine
              </span>
              {initialRfqNumber && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono font-bold">
                  Linked to RFQ #{initialRfqNumber}
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold font-display uppercase tracking-tight mt-1.5 flex items-center space-x-2.5">
              <span>Automated BOM Scrubbing & Validation</span>
              <Sparkles className="h-5 w-5 text-amber-400" />
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Import customer BOMs (Excel/PDF) to cross-reference factory inventory, query supplier catalogs, 
              detect obsolete/long-lead bottlenecks, and pull real-time procurement pricing before quoting.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCatalogModalOpen(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Building2 className="h-4 w-4 text-sky-400" />
              <span>Supplier Catalogs</span>
            </button>

            <button
              onClick={exportScrubbedReport}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Download Excel Report (.xlsx)"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={handlePushToQuotation}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold rounded-lg shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span>Push to Quotation</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 1-Click Test Scenarios Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mr-1">
            1-Click Sample Scenarios:
          </span>
          {SAMPLE_BOM_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => loadPreset(preset.id)}
              className={`px-3 py-1 text-xs rounded-full border transition-all cursor-pointer font-sans ${
                sourceFileName === preset.fileName
                  ? 'bg-sky-600/30 text-sky-200 border-sky-400 font-bold'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {preset.title.split(' ')[0]} {preset.title.split(' ')[1]}
            </button>
          ))}
          <div className="ml-auto flex items-center space-x-2 text-[11px] text-slate-400">
            <span>Download Blank Template:</span>
            <button
              onClick={() => downloadSampleTemplate('hydraulic')}
              className="text-sky-400 hover:text-sky-300 underline font-mono cursor-pointer"
            >
              .XLSX Template
            </button>
          </div>
        </div>
      </div>

      {/* ── File Import Dropzone & Title Bar ──────────────────────── */}
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="bg-white rounded-xl border border-dashed border-slate-300 p-5 shadow-xs hover:border-sky-400 transition-colors"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={activeBomTitle}
                  onChange={(e) => setActiveBomTitle(e.target.value)}
                  className="font-bold text-sm text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:outline-none bg-transparent"
                />
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  ({sourceFileName})
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Drop Excel spreadsheet (.xlsx, .xls, .csv) or paste tabular data from drawing BOM block.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5 text-sky-400" />
              <span>Browse Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => setTextImportModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1.5 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Paste Text / PDF</span>
            </button>
            <button
              onClick={handleSaveAudit}
              disabled={isSaving}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-mono font-semibold flex items-center space-x-1 cursor-pointer"
              title="Save validation audit to history"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Audit'}</span>
            </button>
          </div>
        </div>

        {/* Parsing feedback notes */}
        {parsingNotes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-start space-x-2 text-[11px] text-slate-500">
            <Info className="h-3.5 w-3.5 text-sky-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {parsingNotes.map((note, idx) => (
                <div key={idx}>{note}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPI & Validation Metrics Scoreboard ────────────────────── */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Quotability Health Score */}
          <div className={`p-4 rounded-xl border ${
            summary.quotabilityGrade === 'A_READY_TO_QUOTE'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : summary.quotabilityGrade === 'B_QUOTABLE_WITH_CONDITIONS'
              ? 'bg-sky-50/70 border-sky-200 text-sky-950'
              : summary.quotabilityGrade === 'C_HIGH_RISK'
              ? 'bg-amber-50/70 border-amber-200 text-amber-950'
              : 'bg-rose-50/70 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Quotability Feasibility
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                summary.quotabilityGrade === 'A_READY_TO_QUOTE'
                  ? 'bg-emerald-600 text-white'
                  : summary.quotabilityGrade === 'B_QUOTABLE_WITH_CONDITIONS'
                  ? 'bg-sky-600 text-white'
                  : summary.quotabilityGrade === 'C_HIGH_RISK'
                  ? 'bg-amber-600 text-white'
                  : 'bg-rose-600 text-white'
              }`}>
                {summary.quotabilityGrade.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-display">
                {summary.quotabilityScore}
              </span>
              <span className="text-xs text-slate-500 font-mono">/ 100 Score</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              {summary.obsoleteCount > 0 
                ? `Blocked by ${summary.obsoleteCount} obsolete/EOL part(s)`
                : summary.longLeadCount > 0
                ? `${summary.longLeadCount} long-lead part(s) flagged`
                : '100% Producible without supply constraints'}
            </p>
          </div>

          {/* Card 2: Warehouse Stock vs Shortage */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Factory Inventory Match
              </span>
              <Package className="h-4 w-4 text-sky-600" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-display text-slate-900">
                {summary.inStockCount}
              </span>
              <span className="text-xs text-slate-500 font-mono">/ {summary.totalItems} In Stock</span>
            </div>
            <div className="mt-1 flex items-center space-x-1.5 text-[11px] text-slate-600">
              <span className="font-semibold text-emerald-600">{Math.round((summary.inStockCount / (summary.totalItems || 1)) * 100)}% available</span>
              <span>•</span>
              <span className="text-slate-500">{summary.outOfStockCount} require vendor order</span>
            </div>
          </div>

          {/* Card 3: Critical Path Procurement Lead Time */}
          <div className={`p-4 rounded-xl border ${
            summary.criticalPathLeadTimeDays > 40
              ? 'bg-amber-50/60 border-amber-200'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Critical Path Lead Time
              </span>
              <Clock className={`h-4 w-4 ${summary.criticalPathLeadTimeDays > 40 ? 'text-amber-600' : 'text-slate-600'}`} />
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-bold font-display text-slate-900">
                {summary.criticalPathLeadTimeDays}
              </span>
              <span className="text-xs text-slate-500 font-mono">Days Critical</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate" title={`Bottleneck: ${summary.bottleneckItemName}`}>
              Bottleneck: <span className="font-medium text-slate-700">{summary.bottleneckItemName}</span>
            </p>
          </div>

          {/* Card 4: Total Component Cost & Margin */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Net Procurement Cost
              </span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-bold font-display text-slate-900">
                ₹{summary.totalComponentCost.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>Scrap Buffer: +{scrapBufferPercent}%</span>
              <span>Margin: {marginPercent}%</span>
            </div>
          </div>

          {/* Card 5: Suggested Quote Price & Real-time pull */}
          <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-800">
                Suggested Quotation
              </span>
              <button
                onClick={handleRefreshLivePricing}
                disabled={isRefreshingPrices}
                className="p-1 rounded text-sky-600 hover:bg-sky-100 transition-colors cursor-pointer"
                title="Pull real-time market commodity prices"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingPrices ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-bold font-display text-sky-950">
                ₹{summary.suggestedQuotePrice.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-sky-700">
              <span>HRC Spot: +{summary.realtimeMarketIndexDelta}%</span>
              <span>Updated: {summary.lastPriceRefreshAt}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Obsolescence / High Risk Alert Banner ──────────────────── */}
      {summary && summary.obsoleteCount > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-rose-600 text-white rounded-lg shrink-0 mt-0.5">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-950 font-display uppercase tracking-wide">
                Critical Procurement Warning: {summary.obsoleteCount} Obsolete / EOL Part(s) Detected
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Customer specifications contain discontinued, banned (e.g. Cadmium / lead-lined), or out-of-production components. 
                Quoting on these parts risks severe shopfloor production stoppage.
              </p>
            </div>
          </div>
          <button
            onClick={handleSubstituteAllObsolete}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider shadow-xs whitespace-nowrap cursor-pointer transition-colors"
          >
            Substitute All With Approved Alternates
          </button>
        </div>
      )}

      {/* ── Margin & Buffer Interactive Sliders Bar ───────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center space-x-2.5">
            <Sliders className="h-4 w-4 text-slate-500" />
            <span className="font-mono text-slate-700 uppercase font-semibold text-[11px]">
              Target Margin:
            </span>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={marginPercent}
              onChange={(e) => setMarginPercent(parseInt(e.target.value, 10))}
              className="w-28 accent-sky-600 cursor-pointer"
            />
            <span className="font-mono font-bold text-sky-700 w-8 text-right">
              {marginPercent}%
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            <span className="font-mono text-slate-700 uppercase font-semibold text-[11px]">
              Scrap & Buffer:
            </span>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={scrapBufferPercent}
              onChange={(e) => setScrapBufferPercent(parseInt(e.target.value, 10))}
              className="w-24 accent-slate-600 cursor-pointer"
            />
            <span className="font-mono font-bold text-slate-700 w-8 text-right">
              {scrapBufferPercent}%
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-slate-500">
          <span>Active Plant: <strong className="text-slate-800">{tenant?.companyName || 'SME Forge'}</strong></span>
          <span>•</span>
          <span>Index Feeds: <strong className="text-slate-800">Tata Steel / JSL / SKF / Unbrako Spot</strong></span>
        </div>
      </div>

      {/* ── Filter and Search Bar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: 'ALL', label: `All Parts (${scrubbedItems.length})` },
            { id: 'IN_STOCK', label: `In Stock (${summary?.inStockCount || 0})` },
            { id: 'SUPPLIER', label: `Supplier Catalog (${summary?.supplierAvailableCount || 0})` },
            { id: 'LONG_LEAD', label: `Long Lead >21d (${summary?.longLeadCount || 0})` },
            { id: 'OBSOLETE', label: `Obsolete / EOL (${summary?.obsoleteCount || 0})` },
            { id: 'UNVERIFIED', label: `Unverified (${summary?.unverifiedCount || 0})` },
          ].map(pill => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                statusFilter === pill.id
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search part #, grade, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* ── Validated Scrubbed Table ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100/80 text-slate-600 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-3 px-3.5">#</th>
                <th className="py-3 px-3.5">Part # / Description</th>
                <th className="py-3 px-3.5">Req Qty</th>
                <th className="py-3 px-3.5">Inventory Stock</th>
                <th className="py-3 px-3.5">Supplier / Lead Time</th>
                <th className="py-3 px-3.5">Lifecycle & Risk</th>
                <th className="py-3 px-3.5">Unit Cost (₹)</th>
                <th className="py-3 px-3.5">Extended (₹)</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-mono text-xs">
                    No components found matching current filter selection.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isObsolete = item.risk.isObsolete;
                  const isLongLead = item.risk.isLongLead;
                  const isInStock = item.inventory.status === 'IN_STOCK';
                  const isEditingThis = editingItem?.id === item.id;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isObsolete ? 'bg-rose-50/30' : isLongLead ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Item Number */}
                      <td className="py-3 px-3.5 font-mono text-slate-400 text-[11px]">
                        {item.itemNumber}
                      </td>

                      {/* Part # and Spec */}
                      <td className="py-3 px-3.5 max-w-xs">
                        <div className="font-mono font-bold text-slate-900 flex items-center space-x-1.5">
                          <span>{item.partNumber}</span>
                          {item.hasSubstitutedAlternate && (
                            <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] rounded font-mono font-bold">
                              SUBSTITUTE
                            </span>
                          )}
                        </div>
                        <div className="text-slate-700 truncate text-[11px]" title={item.description}>
                          {item.description}
                        </div>
                        {item.materialGrade && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Grade: {item.materialGrade}
                          </div>
                        )}
                      </td>

                      {/* Required Qty */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800">
                          {item.quantity.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">
                          {item.unit}
                        </span>
                      </td>

                      {/* Inventory Stock Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isInStock ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                              IN STOCK ({item.inventory.currentQty} {item.unit})
                            </span>
                          </div>
                        ) : item.inventory.status === 'PARTIAL_STOCK' ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" />
                              PARTIAL ({item.inventory.currentQty}/{item.quantity})
                            </span>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              Shortage: {item.inventory.shortageQty} {item.unit}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              OUT OF STOCK
                            </span>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              Procure full {item.quantity} {item.unit}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Supplier Match & Lead Time */}
                      <td className="py-3 px-3.5 max-w-[200px]">
                        {item.supplier.matched ? (
                          <div>
                            <div className="font-semibold text-slate-800 truncate" title={item.supplier.supplierName}>
                              {item.supplier.supplierName}
                            </div>
                            <div className="flex items-center space-x-1 mt-0.5">
                              <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                item.effectiveLeadTimeDays <= 7
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isLongLead
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                <Clock className="h-3 w-3 mr-1" />
                                {item.effectiveLeadTimeDays}d Lead Time
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-500 italic text-[11px]">Unindexed Component</span>
                            <div className="text-[10px] text-slate-400 font-mono">14d Standard RFQ</div>
                          </div>
                        )}
                      </td>

                      {/* Lifecycle & Obsolescence Flag */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isObsolete ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-black bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="h-3 w-3 mr-1 text-rose-600" />
                              {item.risk.lifecycleStatus}
                            </span>
                            <div className="text-[9px] text-rose-600 mt-0.5 font-sans font-medium">
                              Non-RoHS / EOL
                            </div>
                          </div>
                        ) : isLongLead ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              LONG LEAD ({item.supplier.leadTimeDays}d)
                            </span>
                          </div>
                        ) : item.risk.lifecycleStatus === 'NRND' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            NRND Phase-Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                            ACTIVE
                          </span>
                        )}
                      </td>

                      {/* Unit Cost */}
                      <td className="py-3 px-3.5 font-mono whitespace-nowrap">
                        {isEditingThis ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              value={editingItem.price}
                              onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                              className="w-16 px-1 py-0.5 border rounded text-xs"
                            />
                            <button
                              onClick={() => {
                                updateItemOverride(item.id, { price: editingItem.price, leadTime: editingItem.leadTime });
                                setEditingItem(null);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-900 flex items-center space-x-1">
                              <span>₹{item.effectiveUnitPrice.toLocaleString('en-IN')}</span>
                              {item.userOverridePrice && (
                                <span className="text-[9px] text-amber-600 font-mono">*</span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 block">
                              Source: {item.selectedSource === 'INVENTORY' ? 'Stock Cost' : 'Vendor Spot'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Extended Total */}
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        ₹{item.extendedPrice.toLocaleString('en-IN')}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Swap Alternate Button */}
                          {item.risk.recommendedAlternates.length > 0 && (
                            <button
                              onClick={() => setActiveItemForAlternate(item)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors"
                              title="Substitute with qualified drop-in alternate"
                            >
                              Swap Alt ({item.risk.recommendedAlternates.length})
                            </button>
                          )}

                          {/* Quick Edit */}
                          <button
                            onClick={() => {
                              if (isEditingThis) {
                                setEditingItem(null);
                              } else {
                                setEditingItem({ id: item.id, price: item.effectiveUnitPrice, leadTime: item.effectiveLeadTimeDays });
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                            title="Edit price or lead time"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Alternate Component Substitution Modal ─────────────────── */}
      {activeItemForAlternate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-scale-up">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold font-display uppercase tracking-wider">
                  Select Form-Fit-Function Alternate
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Replacing obsolete component: <span className="text-rose-300 font-mono font-bold">{activeItemForAlternate.partNumber}</span>
                </p>
              </div>
              <button
                onClick={() => setActiveItemForAlternate(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                The following active components are verified drop-in form-fit-function replacements compliant with modern RoHS/REACH environmental standards:
              </p>

              <div className="space-y-2.5">
                {activeItemForAlternate.risk.recommendedAlternates.map((alt, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {alt.partNumber}
                        </span>
                        <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[9px] font-mono font-bold">
                          ACTIVE
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 mt-0.5">
                        {alt.description}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center space-x-3">
                        <span>Mfr: {alt.manufacturer}</span>
                        <span>•</span>
                        <span>Lead Time: {alt.leadTimeDays}d</span>
                        <span>•</span>
                        <span className="font-bold text-slate-800">Unit: ₹{alt.unitPrice}</span>
                      </div>
                      <div className="text-[10px] text-emerald-700 mt-1 italic">
                        {alt.statusReason}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSwapAlternate(activeItemForAlternate, alt)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider shrink-0 cursor-pointer shadow-xs"
                    >
                      Use Alternate
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveItemForAlternate(null)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-mono font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Text / PDF BOM Paste Modal ────────────────────────────── */}
      {textImportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-scale-up">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold font-display uppercase tracking-wider">
                  Paste Customer Text / PDF Drawing BOM Table
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste tabular text copied from PDF inspection sheets, CAD drawing revision tables, or emails.
                </p>
              </div>
              <button
                onClick={() => setTextImportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleTextSubmit} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                  BOM Title / Assembly Name
                </label>
                <input
                  type="text"
                  value={pastedTitle}
                  onChange={(e) => setPastedTitle(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. Pump Skidding Revision C"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-700 uppercase mb-1">
                  Raw BOM Table Text
                </label>
                <textarea
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Example lines:\nTS-EN8-RD45\tPrecision Piston Rod Dia 45mm\t120\tEN8\nSKF-6205-2RSH\tDeep Groove Ball Bearing 25x52\t60\t100Cr6\nUNB-M12X50-10.9\tSocket Head Cap Screw M12x50\t240\tAlloy 10.9`}
                  className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports tab-delimited, comma-separated, vertical pipe (|), or aligned space columns.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTextImportModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold rounded-lg cursor-pointer"
                >
                  Scrub & Validate BOM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Supplier Catalog Modal ─────────────────────────────────── */}
      <SupplierCatalogModal
        isOpen={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
      />
    </div>
  );
};
