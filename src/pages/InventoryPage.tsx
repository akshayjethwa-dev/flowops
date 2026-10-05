// src/pages/InventoryPage.tsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import {
  useStockItems,
  useStockLedger,
  useAddStockEntry,
  SEED_STOCK_ITEMS,
} from '../hooks/useStockInventory';
import { usePlants } from '../hooks/usePlants';
import { ExportButton } from '../components/ExportButton';
import { StockCategory, StockItem, StockLedgerEntry, AppNotification } from '../types';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  TrendingUp,
  ArrowRightLeft,
  X,
  History,
  Layers,
  User,
  ScanLine,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
} from 'lucide-react';

// ── STEP 4.3 — Scanner imports ─────────────────────────────
import { BarcodeScanner } from '../components/BarcodeScanner';
import { useScanToIdentify } from '../hooks/useScanToIdentify';
import { ScanResult } from '../services/scannerService';

// Scanner intent for the shop-floor user
type ScanMode = 'search' | 'receive' | 'issue';

export const InventoryPage: React.FC = () => {
  const { tenant } = useAuth();

  // ═════════════════════════════════════════════════════════════
  // ⚠️  ORDER MATTERS — all useAuth/useState/usePlants/useScanToIdentify
  //     hooks must be called in a stable order every render, and any
  //     `const` referenced by a hook must be declared BEFORE that hook.
  //     That is why `selectedPlantId` and `usePlants` are near the top.
  // ═════════════════════════════════════════════════════════════

  // ── Core filter state ─────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<StockCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Plant filter — MUST be declared before useScanToIdentify ──
  const [selectedPlantId, setSelectedPlantId] = useState<string>(() => {
    return localStorage.getItem('inventory_selected_plant_id') || 'all';
  });
  const { plants } = usePlants(tenant?.id);

  // ── Data hooks ────────────────────────────────────────────
  const {
    items: filteredItems,
    rawItems,
    loading,
    error,
    addStockItem,
  } = useStockItems(tenant?.id, {
    category: selectedCategory,
    search: searchQuery,
  });

  const { addStockEntry, submitting: entrySubmitting } = useAddStockEntry(tenant?.id);

  // ── Detail side drawer ────────────────────────────────────
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const activeItem = (rawItems || []).find((x) => x.id === activeItemId);
  const { ledgerEntries, loading: ledgerLoading } = useStockLedger(
    tenant?.id,
    activeItemId || undefined
  );

  // ═════════════════════════════════════════════════════════════
  // STEP 4.3 — Barcode scanner wiring (all 3 patterns)
  // ═════════════════════════════════════════════════════════════
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('search');
  const [scannedEntity, setScannedEntity] = useState<{
    code: string;
    name?: string;
    source: string;
    mode: ScanMode;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Hook is called AFTER selectedPlantId is declared — no more TS errors.
  const { resolve: resolveScan } = useScanToIdentify(tenant?.id ?? null, {
    plantId: selectedPlantId === 'all' ? undefined : selectedPlantId,
  });

  const handleScan = async (result: ScanResult) => {
    setScanError(null);
    const entity = await resolveScan(result);
    if (!entity) return;

    setScannedEntity({
      code: entity.code,
      name: (entity.data?.name as string) || undefined,
      source: entity.source,
      mode: scanMode,
    });
    setScannerOpen(false);

    // Find the matching stock row for this SKU
    const match = (rawItems || []).find(
      (i) =>
        i.code === entity.code ||
        i.code === (entity.data?.code as string) ||
        i.code === (entity.data?.sku as string)
    );

    // ── Pattern 1: SEARCH — filter + open detail drawer ────
    if (scanMode === 'search') {
      setSearchQuery(entity.code);
      if (match) setActiveItemId(match.id);
      return;
    }

    // ── Patterns 2 & 3 require a registered SKU ────────────
    if (!match) {
      setScanError(
        `SKU "${entity.code}" is not registered in this plant. Register it first.`
      );
      return;
    }

    // ── Pattern 2: RECEIVE — open modal preset to "inward" ──
    // ── Pattern 3: ISSUE   — open modal preset to "outward" ─
    setTxType(scanMode === 'receive' ? 'inward' : 'outward');
    setTxQty('');
    setTxReason('');
    setTxStatusMsg(null);
    setQuickUpdateItem(match);
  };

  const clearScanBanner = () => {
    setScannedEntity(null);
    setScanError(null);
    setSearchQuery('');
  };

  // ── Low stock notification automation (unchanged) ─────────
  useEffect(() => {
    if (loading || !rawItems || rawItems.length === 0 || !tenant?.id) return;

    const generateLowStockNotifications = async () => {
      const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

      for (const item of rawItems) {
        if (item.currentQty < item.reorderLevel) {
          const itemId = item.id;

          if (isSandbox) {
            const key = `flowops_notifications_${tenant.id}`;
            const cached = localStorage.getItem(key);
            let notifs: AppNotification[] = cached ? JSON.parse(cached) : [];
            const exists = notifs.some(
              (n) => n.type === 'low_stock' && n.entityId === itemId
            );
            if (!exists) {
              const newNotif: AppNotification = {
                id: `notif_low_stock_${itemId}`,
                tenantId: tenant.id,
                userId: 'all',
                type: 'low_stock',
                title: 'Low Stock Alert',
                message: `${item.name} has fallen below the minimum stock of ${item.reorderLevel} ${item.unit} (Current: ${item.currentQty})`,
                entityId: itemId,
                entityType: 'inventory',
                link: '/inventory',
                read: false,
                createdAt: new Date().toISOString(),
              };
              notifs.push(newNotif);
              localStorage.setItem(key, JSON.stringify(notifs));
              window.dispatchEvent(new Event('storage'));
            }
          } else {
            try {
              const { getDocs, query, collection, where, setDoc, doc } = await import(
                'firebase/firestore'
              );
              const notificationsRef = collection(db, 'notifications');
              const q = query(
                notificationsRef,
                where('tenantId', '==', tenant.id),
                where('type', '==', 'low_stock'),
                where('entityId', '==', itemId)
              );
              const querySnap = await getDocs(q);
              if (querySnap.empty) {
                const newNotifId = `low_stock_${itemId}_${Date.now()}`;
                const docRef = doc(db, 'notifications', newNotifId);
                await setDoc(docRef, {
                  id: newNotifId,
                  tenantId: tenant.id,
                  userId: 'all',
                  type: 'low_stock',
                  title: 'Low Stock Alert',
                  message: `${item.name} has fallen below the minimum stock of ${item.reorderLevel} ${item.unit} (Current: ${item.currentQty})`,
                  entityId: itemId,
                  entityType: 'inventory',
                  link: '/inventory',
                  read: false,
                  createdAt: new Date(),
                });
              }
            } catch (err) {
              console.error('Failed to create low stock notification', err);
            }
          }
        }
      }
    };

    generateLowStockNotifications();
  }, [rawItems, loading, tenant]);

  // ── Transaction modal state ───────────────────────────────
  const [quickUpdateItem, setQuickUpdateItem] = useState<StockItem | null>(null);

  // ── SKU registration modal state ──────────────────────────
  const [isNewProfileOpen, setIsNewProfileOpen] = useState(false);

  // ── Transaction form state ────────────────────────────────
  const [txType, setTxType] = useState<'inward' | 'outward' | 'adjustment'>('inward');
  const [txQty, setTxQty] = useState<number | ''>('');
  const [txReason, setTxReason] = useState('');
  const [txStatusMsg, setTxStatusMsg] = useState<{
    type: 'success' | 'err';
    text: string;
  } | null>(null);

  // ── SKU registration form state ───────────────────────────
  const [newItemPlantId, setNewItemPlantId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<StockCategory>('raw_material');
  const [newItemUnit, setNewItemUnit] = useState('units');
  const [newItemReorder, setNewItemReorder] = useState<number | ''>('');
  const [newProfileStatusMsg, setNewProfileStatusMsg] = useState<{
    type: 'success' | 'err';
    text: string;
  } | null>(null);

  // ── Format helpers ────────────────────────────────────────
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getCategoryLabel = (catStr: StockCategory) => {
    switch (catStr) {
      case 'raw_material':
        return 'Raw Material';
      case 'finished_goods':
        return 'Finished Goods';
      case 'consumable':
        return 'Consumable';
      case 'spare':
        return 'Spare / Part';
      default:
        return catStr;
    }
  };

  const getScanModeLabel = (mode: ScanMode) => {
    switch (mode) {
      case 'search':
        return 'Search Mode';
      case 'receive':
        return 'Receive Mode';
      case 'issue':
        return 'Issue Mode';
    }
  };

  const getScanModeIcon = (mode: ScanMode) => {
    switch (mode) {
      case 'search':
        return <Eye className="h-4 w-4 text-sky-400" />;
      case 'receive':
        return <ArrowDownLeft className="h-4 w-4 text-emerald-400" />;
      case 'issue':
        return <ArrowUpRight className="h-4 w-4 text-amber-400" />;
    }
  };

  const getScanHint = (mode: ScanMode) => {
    switch (mode) {
      case 'search':
        return 'Scan material SKU to filter the register';
      case 'receive':
        return 'Scan material SKU to record an incoming stock entry';
      case 'issue':
        return 'Scan material SKU to record an outgoing stock issue';
    }
  };

  const getAlertStatusState = (item: StockItem) => {
    if (item.currentQty <= item.reorderLevel) return 'critical';
    if (item.currentQty <= item.reorderLevel * 1.2) return 'warning';
    return 'healthy';
  };

  // ── Submit stock transaction ──────────────────────────────
  const handlePostEntry = async (itemId: string, forceCloseModal = false) => {
    if (!txQty || Number(txQty) <= 0) {
      setTxStatusMsg({
        type: 'err',
        text: 'Please input a valid quantity greater than 0.',
      });
      return;
    }

    setTxStatusMsg(null);
    try {
      await addStockEntry(itemId, {
        type: txType,
        qty: Number(txQty),
        reason:
          txReason.trim() ||
          `${txType.toUpperCase()} entry adjustment posted manually`,
      });

      setTxStatusMsg({ type: 'success', text: 'Stock transaction logged successfully!' });
      setTxQty('');
      setTxReason('');

      if (forceCloseModal) {
        setTimeout(() => {
          setQuickUpdateItem(null);
          setTxStatusMsg(null);
        }, 1200);
      }
    } catch (err: any) {
      setTxStatusMsg({ type: 'err', text: err.message || 'Transaction failed.' });
    }
  };

  // ── Submit new SKU profile ────────────────────────────────
  const handlePostNewProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemCode.trim() || newItemReorder === '') {
      setNewProfileStatusMsg({
        type: 'err',
        text: 'Please fill out all mandatory fields.',
      });
      return;
    }

    setNewProfileStatusMsg(null);
    try {
      const createdItem = await addStockItem({
        name: newItemName.trim(),
        code: newItemCode.trim().toUpperCase(),
        category: newItemCategory,
        unit: newItemUnit.trim().toLowerCase(),
        reorderLevel: Number(newItemReorder),
        plantId: newItemPlantId || plants?.[0]?.id || '',
      });

      setNewProfileStatusMsg({
        type: 'success',
        text: `Product SKU "${createdItem.code}" registered.`,
      });

      setNewItemName('');
      setNewItemCode('');
      setNewItemCategory('raw_material');
      setNewItemUnit('units');
      setNewItemReorder('');
      setNewItemPlantId('');

      setTimeout(() => {
        setIsNewProfileOpen(false);
        setNewProfileStatusMsg(null);
      }, 1500);
    } catch (err: any) {
      setNewProfileStatusMsg({
        type: 'err',
        text: err.message || 'Verification rejected.',
      });
    }
  };

  // ── Plant-scoped lists + KPIs ─────────────────────────────
  const plantFilteredRawItems = (rawItems || []).filter(
    (item) => selectedPlantId === 'all' || item.plantId === selectedPlantId
  );
  const plantFilteredItems = (filteredItems || []).filter(
    (item) => selectedPlantId === 'all' || item.plantId === selectedPlantId
  );

  const totalSKUsCount = plantFilteredRawItems.length;
  const criticalItemsCount = plantFilteredRawItems.filter(
    (item) => getAlertStatusState(item) === 'critical'
  ).length;
  const warningItemsCount = plantFilteredRawItems.filter(
    (item) => getAlertStatusState(item) === 'warning'
  ).length;
  const finishedSKUsCount = plantFilteredRawItems.filter(
    (item) => item.category === 'finished_goods'
  ).length;

  return (
    <div
      id="inventory-pane-root"
      className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-8 select-none font-sans text-slate-800"
    >
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-205 pb-6">
        <div>
          <span className="text-xs font-mono uppercase text-sky-600 bg-sky-50 px-2 py-1 rounded font-bold tracking-wider">
            Enterprise Module
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight mt-2 flex items-center gap-2">
            <Package className="h-7 w-7 text-sky-600" />
            Stock & Material Visibility Register
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time manual plant floor inventory register, stock ledger, and automated WhatsApp alert levels.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2 items-stretch">
          {/* Scan Mode Selector + Scan Button */}
          <div className="flex items-stretch rounded-lg overflow-hidden border border-slate-300 shadow-sm">
            <select
              value={scanMode}
              onChange={(e) => setScanMode(e.target.value as ScanMode)}
              className="text-xs font-mono uppercase font-bold bg-slate-900 text-white px-3 pr-8 border-none focus:ring-0 cursor-pointer"
              title="Choose scanner behavior"
            >
              <option value="search">🔍 Search Mode</option>
              <option value="receive">📥 Receive Mode</option>
              <option value="issue">📤 Issue Mode</option>
            </select>
            <button
              onClick={() => {
                setScanError(null);
                setScannerOpen(true);
              }}
              id="scan-material-btn"
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono uppercase py-2.5 px-4 font-bold transition-colors cursor-pointer"
            >
              {getScanModeIcon(scanMode)}
              Scan Material
            </button>
          </div>

          <ExportButton
            data={plantFilteredItems}
            filenamePrefix="inventory_stock_vis"
            headersMap={{
              code: 'Item Code',
              name: 'Item Name',
              category: 'Category',
              currentQty: 'Current Quantity',
              unit: 'Base Unit',
              reorderLevel: 'Reorder Trigger Level',
              lastUpdated: 'Last Updated Date',
            }}
            label="Export CSV"
          />

          <button
            onClick={() => setIsNewProfileOpen(true)}
            id="register-sku-btn"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono uppercase py-2.5 px-4 rounded-lg font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add SKU Profile
          </button>
        </div>
      </div>

      {/* ── Scanned entity banner ───────────────────────────── */}
      {scannedEntity && (
        <div
          className={`flex items-center justify-between p-3 rounded-lg border ${
            scannedEntity.mode === 'receive'
              ? 'bg-emerald-50 border-emerald-200'
              : scannedEntity.mode === 'issue'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-sky-50 border-sky-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2
              className={`h-5 w-5 shrink-0 ${
                scannedEntity.mode === 'receive'
                  ? 'text-emerald-600'
                  : scannedEntity.mode === 'issue'
                  ? 'text-amber-600'
                  : 'text-sky-600'
              }`}
            />
            <div>
              <p
                className={`text-sm font-bold ${
                  scannedEntity.mode === 'receive'
                    ? 'text-emerald-800'
                    : scannedEntity.mode === 'issue'
                    ? 'text-amber-800'
                    : 'text-sky-800'
                }`}
              >
                Scanned: <span className="font-mono">{scannedEntity.code}</span>
              </p>
              <p
                className={`text-xs ${
                  scannedEntity.mode === 'receive'
                    ? 'text-emerald-700'
                    : scannedEntity.mode === 'issue'
                    ? 'text-amber-700'
                    : 'text-sky-700'
                }`}
              >
                {scannedEntity.name ?? 'Not registered in system'}
                <span className="ml-2 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/60">
                  {getScanModeLabel(scannedEntity.mode)} · via {scannedEntity.source}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={clearScanBanner}
            className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
            title="Clear scanned filter"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Scan error banner ──────────────────────────────── */}
      {scanError && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50 border border-rose-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <p className="text-sm font-semibold text-rose-800">{scanError}</p>
          </div>
          <button
            onClick={() => setScanError(null)}
            className="p-1.5 rounded-lg hover:bg-rose-100 transition-colors"
          >
            <X className="h-4 w-4 text-rose-600" />
          </button>
        </div>
      )}

      {/* 2. KPI Board */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Total Registered SKUs
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalSKUsCount}</h3>
          </div>
          <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-100 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-rose-500 font-bold">
              Critical Outages
            </p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{criticalItemsCount}</h3>
          </div>
          <div className="h-10 w-10 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500 animate-pulse">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-amber-600 font-bold">
              Reorder Warnings
            </p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{warningItemsCount}</h3>
          </div>
          <div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Finished Goods SKUs
            </p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{finishedSKUsCount}</h3>
          </div>
          <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-emerald-500">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 3. Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-1 md:pb-0 scrollbar-none">
            {(['all', 'raw_material', 'finished_goods', 'consumable', 'spare'] as const).map(
              (tab) => {
                const active = selectedCategory === tab;
                const count =
                  tab === 'all'
                    ? (rawItems || []).length
                    : (rawItems || []).filter((x) => x.category === tab).length;

                return (
                  <button
                    key={tab}
                    onClick={() => setSelectedCategory(tab)}
                    className={`
                    px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wide cursor-pointer transition-all shrink-0 flex items-center gap-1.5
                    ${
                      active
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 border border-slate-200/60'
                    }
                  `}
                  >
                    {tab === 'all' ? 'All Materials' : getCategoryLabel(tab)}
                    <span
                      className={`px-1 py-0.2 rounded text-[10px] font-mono ${
                        active ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center grow max-w-2xl">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-3xs">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 shrink-0">
                Plant:
              </span>
              <select
                value={selectedPlantId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPlantId(val);
                  localStorage.setItem('inventory_selected_plant_id', val);
                }}
                className="text-xs font-bold text-slate-705 bg-transparent border-none focus:ring-0 p-0 pr-6 cursor-pointer"
              >
                <option value="all">🌐 All Plants Stock</option>
                {plants?.map((p) => (
                  <option key={p.id} value={p.id}>
                    🏭 {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative grow">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search items by code or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white text-slate-800"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2 text-[10px] text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Main Data Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            Syncing live material register database...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 bg-red-50/50 rounded-lg m-4 text-xs font-mono">
            {error}
          </div>
        ) : plantFilteredItems.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No SKU inventory profiles found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Adjust your search parameters or query keywords.'
                : 'Add your first material register blueprint using the button above.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                    <th className="py-3.5 px-4 font-semibold">SKU Code</th>
                    <th className="py-3.5 px-4 font-semibold">Description / Name</th>
                    <th className="py-3.5 px-4 font-semibold">Category</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Available Qty</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Reorder Threshold</th>
                    <th className="py-3.5 px-4 font-semibold">Last movement</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plantFilteredItems.map((item) => {
                    const status = getAlertStatusState(item);
                    const rowBgClass =
                      status === 'critical'
                        ? 'bg-rose-500/5 hover:bg-rose-500/10'
                        : status === 'warning'
                        ? 'bg-amber-500/5 hover:bg-amber-500/10'
                        : 'hover:bg-slate-50/70 border-l-4 border-transparent';

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setActiveItemId(item.id)}
                        className={`
                          cursor-pointer transition-all duration-150 relative text-xs
                          ${rowBgClass}
                          ${
                            activeItemId === item.id
                              ? 'bg-sky-500/10 hover:bg-sky-500/15 border-l-4 border-sky-500'
                              : ''
                          }
                        `}
                      >
                        <td className="py-4 px-4 font-mono font-bold text-slate-900 tracking-tight">
                          {item.code}
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-700">{item.name}</td>
                        <td className="py-4 px-4">
                          <span
                            className={`
                            px-2 py-0.5 rounded text-[10px] font-mono tracking-wide uppercase font-bold
                            ${
                              item.category === 'raw_material'
                                ? 'bg-teal-50 text-teal-600 border border-teal-200/50'
                                : ''
                            }
                            ${
                              item.category === 'finished_goods'
                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200/50'
                                : ''
                            }
                            ${
                              item.category === 'consumable'
                                ? 'bg-purple-50 text-purple-600 border border-purple-200/50'
                                : ''
                            }
                            ${
                              item.category === 'spare'
                                ? 'bg-slate-100 text-slate-600 border border-slate-300/45'
                                : ''
                            }
                          `}
                          >
                            {getCategoryLabel(item.category)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono font-black">
                          <span
                            className={`
                            px-2 py-1 rounded text-xs
                            ${
                              status === 'critical'
                                ? 'bg-rose-100 text-rose-700 font-black animate-pulse'
                                : ''
                            }
                            ${
                              status === 'warning'
                                ? 'bg-amber-100 text-amber-700 font-bold'
                                : 'text-slate-800'
                            }
                          `}
                          >
                            {item.currentQty} {item.unit}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-slate-500">
                          {item.reorderLevel} {item.unit}
                        </td>
                        <td className="py-4 px-4 text-slate-500 font-mono text-[10px]">
                          <div>{item.updatedByName || 'Supervisor'}</div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            {formatDateTime(item.lastUpdated)}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setTxType('inward');
                                setQuickUpdateItem(item);
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 text-[10px] font-mono uppercase font-bold px-2 py-1 rounded cursor-pointer transition-colors"
                              title="Receive stock"
                            >
                              + In
                            </button>
                            <button
                              onClick={() => {
                                setTxType('outward');
                                setQuickUpdateItem(item);
                              }}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 text-[10px] font-mono uppercase font-bold px-2 py-1 rounded cursor-pointer transition-colors"
                              title="Issue stock"
                            >
                              − Out
                            </button>
                            <button
                              onClick={() => setActiveItemId(item.id)}
                              className="bg-sky-50 hover:bg-sky-100 text-sky-600 text-[10px] font-mono uppercase font-bold px-2 py-1 rounded cursor-pointer transition-colors"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100">
              {plantFilteredItems.map((item) => {
                const status = getAlertStatusState(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveItemId(item.id)}
                    className={`p-4 flex flex-col gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors ${
                      activeItemId === item.id ? 'bg-sky-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              status === 'critical'
                                ? 'bg-rose-500 animate-ping'
                                : status === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span className="font-mono font-bold text-slate-900 text-sm tracking-tight">
                            {item.code}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-700 mt-1">{item.name}</h4>
                      </div>
                      <span className="text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-600 font-mono text-[10px]">
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">Available</span>
                        <span
                          className={`text-xs font-bold ${
                            status === 'critical'
                              ? 'text-rose-600'
                              : status === 'warning'
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {item.currentQty} {item.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px] uppercase">
                          Threshold
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {item.reorderLevel} {item.unit}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono mt-1">
                      <span>Updated: {formatDateTime(item.lastUpdated)}</span>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setTxType('inward');
                            setQuickUpdateItem(item);
                          }}
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-1 rounded"
                        >
                          + In
                        </button>
                        <button
                          onClick={() => {
                            setTxType('outward');
                            setQuickUpdateItem(item);
                          }}
                          className="bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-1 rounded"
                        >
                          − Out
                        </button>
                        <button
                          onClick={() => setActiveItemId(item.id)}
                          className="bg-sky-50 text-sky-600 font-bold px-2 py-1 rounded"
                        >
                          Ledger ➜
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 5. Detail Side Drawer (unchanged) */}
      {activeItemId && activeItem && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30 transition-opacity"
            onClick={() => setActiveItemId(null)}
          />
          <div
            id="item-detail-drawer"
            className="fixed inset-y-0 right-0 w-full md:w-7/12 lg:w-5/12 bg-white h-screen shadow-2xl z-40 overflow-y-auto border-l border-slate-200 transition-all duration-300 ease-in-out transform flex flex-col"
          >
            <div className="p-4 md:p-6 border-b border-slate-150 flex items-center justify-between sticky top-0 bg-white z-10 shadow-xs">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                  Item Profile Details
                </span>
                <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5 flex items-center gap-1.5 uppercase font-display">
                  <Package className="h-5 w-5 text-sky-600 shrink-0" />
                  {activeItem.code}
                </h2>
              </div>
              <button
                onClick={() => setActiveItemId(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Close Side Drawer Panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    Registered Blueprint
                  </span>
                  <span
                    className={`text-[9px] font-mono tracking-wider font-bold px-1.5 py-0.5 rounded ${
                      getAlertStatusState(activeItem) === 'critical'
                        ? 'bg-red-100 text-red-600 animate-pulse'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {getAlertStatusState(activeItem).toUpperCase()} STOCK
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">
                      SKU Description
                    </span>
                    <span className="font-semibold text-slate-800">{activeItem.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">
                      Category Code
                    </span>
                    <span className="font-semibold text-slate-800 uppercase">
                      {getCategoryLabel(activeItem.category)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">
                      Available Balance
                    </span>
                    <span className="font-black text-slate-900 text-sm">
                      {activeItem.currentQty}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        {activeItem.unit}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">
                      Reorder Level Alert
                    </span>
                    <span className="font-semibold text-slate-700">
                      {activeItem.reorderLevel}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        {activeItem.unit}
                      </span>
                    </span>
                  </div>
                </div>
                {getAlertStatusState(activeItem) === 'critical' && (
                  <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-[11px] text-rose-700 font-semibold leading-relaxed flex gap-2 items-start mt-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                    <span>
                      Low Stock warning active. The automated fallback has queued background alerts
                      dispatch to procurement contacts.
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <ArrowRightLeft className="h-4 w-4 text-sky-600" />
                  <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-bold">
                    Post New Material Ledger Entry
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-50 rounded-lg border border-slate-200/60">
                  {(['inward', 'outward', 'adjustment'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTxType(type)}
                      className={`
                        py-1.5 text-[10px] uppercase font-mono font-bold tracking-wider rounded-md cursor-pointer transition-all
                        ${
                          txType === type
                            ? 'bg-white text-slate-900 shadow-xs scale-102 border border-slate-200'
                            : 'text-slate-400 hover:text-slate-700'
                        }
                      `}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                      Quantity ({activeItem.unit})
                    </label>
                    <input
                      type="number"
                      required
                      placeholder={`0.0`}
                      value={txQty}
                      onChange={(e) =>
                        setTxQty(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-250/90 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                      Reason / Notes / Invoice Ref
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Inward from supplier invoice IN-220"
                      value={txReason}
                      onChange={(e) => setTxReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-250/90 rounded placeholder:text-slate-400 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {txStatusMsg && (
                  <div
                    className={`p-2.5 rounded text-[11px] font-mono ${
                      txStatusMsg.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {txStatusMsg.text}
                  </div>
                )}

                <button
                  onClick={() => handlePostEntry(activeItem.id)}
                  disabled={entrySubmitting}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-mono uppercase text-[10px] tracking-widest py-2 px-4 rounded-lg font-bold shadow-xs shrink-0 disabled:opacity-50 cursor-pointer text-center"
                >
                  {entrySubmitting ? 'Posting Ledger entry...' : 'Post Stock Entry'}
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <History className="h-4 w-4 text-slate-500" />
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                      Audit Ledger Trail
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Order: Newest First
                  </span>
                </div>

                {ledgerLoading ? (
                  <div className="text-center p-8 text-xs text-slate-400 font-mono">
                    Generating ledger report...
                  </div>
                ) : ledgerEntries.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-mono text-xs">
                    No timeline transactions recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {ledgerEntries.map((led: StockLedgerEntry) => {
                      const isPositive = led.type === 'inward';
                      const isNegative = led.type === 'outward';

                      return (
                        <div
                          key={led.id}
                          className="p-3 bg-slate-50 border border-slate-150 rounded-lg flex flex-col gap-2 hover:border-slate-350 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span
                                className={`
                                px-2 py-0.2 rounded text-[8px] font-mono tracking-wider font-bold uppercase
                                ${
                                  led.type === 'inward'
                                    ? 'bg-green-150 text-green-700 border border-green-200'
                                    : ''
                                }
                                ${
                                  led.type === 'outward'
                                    ? 'bg-red-150 text-red-700 border border-red-200'
                                    : ''
                                }
                                ${
                                  led.type === 'adjustment'
                                    ? 'bg-blue-150 text-blue-700 border border-blue-200'
                                    : ''
                                }
                              `}
                              >
                                {led.type}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400 ml-2">
                                {formatDateTime(led.timestamp)}
                              </span>
                            </div>

                            <span
                              className={`font-mono text-xs font-black ${
                                isPositive
                                  ? 'text-green-600'
                                  : isNegative
                                  ? 'text-rose-600'
                                  : 'text-slate-500'
                              }`}
                            >
                              {isPositive ? '+' : isNegative ? '-' : '±'}
                              {led.qty}{' '}
                              <span className="text-[9px] text-slate-400 font-normal">
                                {activeItem.unit}
                              </span>
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 font-medium">{led.reason}</p>

                          <div className="flex justify-between items-center border-t border-slate-200/50 pt-1.5 text-[9px] font-mono text-slate-400">
                            <span className="flex items-center gap-0.5">
                              <User className="h-3 w-3 shrink-0" />
                              By: {led.updatedByName || 'Supervisor'}
                            </span>
                            <span className="text-slate-600 font-semibold">
                              Balance After: {led.qtyAfter} {activeItem.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 6. Quick Update Modal — reused for Receive and Issue patterns */}
      {quickUpdateItem && (
        <div
          id="quick-update-modal"
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-4">
            <button
              onClick={() => {
                setQuickUpdateItem(null);
                setTxStatusMsg(null);
                setTxQty('');
                setTxReason('');
              }}
              className="absolute right-4 top-4 p-1 rounded-lg hover:bg-slate-150 text-slate-400 hover:text-slate-600"
              title="Close Dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span
                className={`text-[9px] font-mono tracking-widest uppercase font-bold ${
                  txType === 'inward'
                    ? 'text-emerald-600'
                    : txType === 'outward'
                    ? 'text-amber-600'
                    : 'text-sky-600'
                }`}
              >
                {txType === 'inward'
                  ? '📥 Receiving Material'
                  : txType === 'outward'
                  ? '📤 Issuing Material'
                  : '⚖ Adjustment Entry'}
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1 uppercase">
                {quickUpdateItem.code}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{quickUpdateItem.name}</p>
              <p className="text-xs text-slate-500 mt-1.5">
                On hand:{' '}
                <strong className="text-slate-700">
                  {quickUpdateItem.currentQty} {quickUpdateItem.unit}
                </strong>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                  Post Adjustment Type
                </label>
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-50 rounded-lg border border-slate-200">
                  {(['inward', 'outward', 'adjustment'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTxType(type)}
                      className={`
                        py-1 text-[9px] font-mono uppercase tracking-wider font-bold rounded-md cursor-pointer transition-all
                        ${
                          txType === type
                            ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                            : 'text-slate-400 hover:text-slate-700'
                        }
                      `}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                  Transaction Quantity ({quickUpdateItem.unit})
                </label>
                <input
                  type="number"
                  placeholder={`Amount in ${quickUpdateItem.unit}`}
                  value={txQty}
                  onChange={(e) => setTxQty(e.target.value === '' ? '' : Number(e.target.value))}
                  autoFocus
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                  {txType === 'inward'
                    ? 'Supplier / Invoice Reference'
                    : txType === 'outward'
                    ? 'Work Order / Department Reference'
                    : 'Adjustment Reason'}
                </label>
                <input
                  type="text"
                  placeholder={
                    txType === 'inward'
                      ? 'e.g. Supplier invoice IN-220'
                      : txType === 'outward'
                      ? 'e.g. WO-00456 · CNC Line'
                      : 'e.g. Physical count correction'
                  }
                  value={txReason}
                  onChange={(e) => setTxReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {txStatusMsg && (
                <div
                  className={`p-2.5 rounded text-[11px] font-mono ${
                    txStatusMsg.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {txStatusMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setQuickUpdateItem(null);
                    setTxStatusMsg(null);
                    setTxQty('');
                    setTxReason('');
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono text-xs uppercase py-2 px-4 rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePostEntry(quickUpdateItem.id, true)}
                  disabled={entrySubmitting}
                  className={`flex-1 font-mono text-xs uppercase py-2 px-4 rounded-lg font-bold disabled:opacity-50 cursor-pointer text-center text-white ${
                    txType === 'inward'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : txType === 'outward'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {entrySubmitting
                    ? 'Posting...'
                    : txType === 'inward'
                    ? 'Receive Stock'
                    : txType === 'outward'
                    ? 'Issue Stock'
                    : 'Post Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. New SKU Profile Modal (unchanged) */}
      {isNewProfileOpen && (
        <div
          id="new-profile-modal"
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full shadow-2xl p-6 relative flex flex-col gap-4">
            <button
              onClick={() => {
                setIsNewProfileOpen(false);
                setNewProfileStatusMsg(null);
              }}
              className="absolute right-4 top-4 p-1 rounded-lg hover:bg-slate-150 text-slate-400 hover:text-slate-600"
              title="Close New Profile Dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono tracking-widest text-sky-600 uppercase font-bold">
                Blueprint Registration catalog
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1 uppercase">
                Register New Stock SKU Profile
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Register a new raw material or finished product profile on the factory list.
              </p>
            </div>

            <form onSubmit={handlePostNewProfile} className="space-y-3">
              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                  Item Code / Catalogue ref (Unique)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WR-1209"
                  value={newItemCode}
                  onChange={(e) => setNewItemCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded font-mono text-slate-800 uppercase focus:outline-none focus:ring-1 focus:ring-sky-500 font-bold"
                />
              </div>

              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                  Product SKU Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wire Rod - High Strength carbon 12mm"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                  Target Plant Facility
                </label>
                <select
                  value={newItemPlantId}
                  onChange={(e) => setNewItemPlantId(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                  required
                >
                  <option value="">-- Select Plant --</option>
                  {plants?.map((p) => (
                    <option key={p.id} value={p.id}>
                      🏭 {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                    Category Group
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as StockCategory)}
                    className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                  >
                    <option value="raw_material">Raw Material</option>
                    <option value="finished_goods">Finished Goods</option>
                    <option value="consumable">Consumable</option>
                    <option value="spare">Spare Part</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                    Standard UoM / Unit
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. tonnes, units, kg"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">
                  Threshold Reorder Warning Level
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 10"
                  value={newItemReorder}
                  onChange={(e) =>
                    setNewItemReorder(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-250 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {newProfileStatusMsg && (
                <div
                  className={`p-2 rounded text-[11px] font-mono ${
                    newProfileStatusMsg.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-150'
                      : 'bg-rose-50 text-rose-700 border border-rose-150'
                  }`}
                >
                  {newProfileStatusMsg.text}
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewProfileOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono text-xs uppercase py-2 px-4 rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs uppercase py-2 px-4 rounded-lg font-bold cursor-pointer text-center"
                >
                  Register Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── STEP 4.3 — Barcode Scanner Modal ─────────────────── */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        hint={getScanHint(scanMode)}
      />
    </div>
  );
};