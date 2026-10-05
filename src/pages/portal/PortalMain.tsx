// src/pages/portal/PortalMain.tsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  ShoppingBag, 
  FileText, 
  User, 
  LogOut, 
  Menu, 
  X, 
  TrendingUp, 
  ChevronRight, 
  Clock, 
  CreditCard, 
  MapPin, 
  CheckCircle2, 
  Search, 
  Plus, 
  Minus, 
  Trash2,
  Calendar,
  AlertCircle,
  Download,
  Building2,
  Phone,
  Mail,
  Truck,
  ArrowRight,
  Info
} from 'lucide-react';
import { useMyOrders, useMyInvoices, useMyBalance, usePlaceOrder } from '../../hooks/usePortal';
import { CustomerOrder, CustomerOrderComponent, Invoice, Customer, StockItem } from '../../types';

interface PortalMainProps {
  authenticatedUser: { id: string; name: string; phone: string; tenantId: string };
  onLogout: () => void;
}

export const PortalMain: React.FC<PortalMainProps> = ({ authenticatedUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'invoices' | 'profile'>('home');
  const [cart, setCart] = useState<{ product: any; qty: number }[]>([]);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  
  // Custom Flow states inside "Place Order"
  const [portalOrderStep, setPortalOrderStep] = useState<'catalog' | 'review' | 'success'>('catalog');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [placedOrderRef, setPlacedOrderRef] = useState<CustomerOrder | null>(null);

  // Firestore & Local Queries
  const { orders, loading: ordersLoading } = useMyOrders(authenticatedUser.id);
  const { invoices, loading: invoicesLoading } = useMyInvoices(authenticatedUser.id);
  const { stats, loading: statsLoading } = useMyBalance(authenticatedUser.id);
  const { placeOrder, submitting: orderSubmitting } = usePlaceOrder();

  const currentCustomer = stats.customerDetail;

  // Initialize pre-filled address if loading ends
  React.useEffect(() => {
    if (currentCustomer && !deliveryAddress) {
      setDeliveryAddress(currentCustomer.shippingAddress || currentCustomer.billingAddress || '');
    }
  }, [currentCustomer, deliveryAddress]);

  // Demo Product Catalog matching Ashrey components
  const DEMO_CATALOG: StockItem[] = [
    {
      id: 'prod-1',
      tenantId: 'tenant_1',
      name: 'Wire rod 5.5mm — Grade SAE1008 Carbon Steel',
      code: 'WR-5.5-SAE',
      category: 'raw_material',
      currentQty: 100,
      unit: 'tonnes',
      reorderLevel: 20,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 'prod-2',
      tenantId: 'tenant_1',
      name: 'Copper wire 1.2mm — High Conductivity',
      code: 'CW-1.2-HC',
      category: 'raw_material',
      currentQty: 120,
      unit: 'rolls',
      reorderLevel: 15,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 'prod-3',
      tenantId: 'tenant_1',
      name: 'M12 Hex Bolts — Grade 8.8 High Tensile Black',
      code: 'SP-M12B',
      category: 'spare',
      currentQty: 850,
      unit: 'units',
      reorderLevel: 500,
      lastUpdated: new Date().toISOString()
    },
    {
      id: 'prod-4',
      tenantId: 'tenant_1',
      name: 'Hot Rolled Steel Sheets 4mm CNC Cut Plate',
      code: 'HR-SHEET-4',
      category: 'raw_material',
      currentQty: 45,
      unit: 'pieces',
      reorderLevel: 10,
      lastUpdated: new Date().toISOString()
    }
  ];

  // Cart operations
  const handleAddToCart = (product: any) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { product, qty: 1 }]);
    }
  };

  const handleUpdateQty = (productId: string, val: number) => {
    if (val <= 0) {
      setCart(cart.filter(item => item.product.id !== productId));
    } else {
      setCart(cart.map(item => item.product.id === productId ? { ...item, qty: val } : item));
    }
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setPortalOrderStep('review');
  };

  const handlePlaceOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const orderComponents: CustomerOrderComponent[] = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.qty,
      unit: item.product.unit,
      unitPrice: 0, // pricing resolved back-office
      total: 0
    }));

    const orderPayload = {
      tenantId: authenticatedUser.tenantId || 'tenant_1',
      customerId: authenticatedUser.id,
      customerName: currentCustomer?.name || authenticatedUser.name,
      items: orderComponents,
      deliveryAddress,
      requestedDeliveryDate: requestedDeliveryDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      notes: orderNotes,
      isBotOrder: false,
      createdByDevice: 'web' as const
    };

    const placed = await placeOrder(orderPayload);
    if (placed) {
      setPlacedOrderRef(placed);
      setCart([]);
      setOrderNotes('');
      setPortalOrderStep('success');
    }
  };

  return (
    <div id="portal-app-root" className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col pb-20 md:pb-0 selection:bg-rose-500 selection:text-white">
      {/* 1. Portal Elegant Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-600/10 border border-rose-500/30 flex items-center justify-center text-rose-500 font-bold text-sm">
            AF
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Ashrey FlowWorks</h1>
            <p className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">B2B Self-Service Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline-block text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 border border-slate-700/60 font-medium">
            🏢 {currentCustomer?.name || authenticatedUser.name}
          </span>
          <button 
            onClick={onLogout}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-lg transition"
            title="Log Out of Portal"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:py-8 space-y-6">
        <AnimatePresence mode="wait">
          {/* TAB: HOME / DASHBOARD */}
          {activeTab === 'home' && portalOrderStep === 'catalog' && (
            <motion.div 
              key="tab-home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Greetings Header */}
              <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 z-10">
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Welcome, {currentCustomer?.contactPerson || 'Dealer'}!
                  </h2>
                  <p className="text-xs text-slate-400 max-w-xl">
                    Place instant direct plant-orders, trace shopfloor welding/cutting stages, audit accounts balance logs, and resolve billing invoices securely without calling logistics.
                  </p>
                </div>
                <button
                  onClick={() => setPortalOrderStep('catalog')}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/10 hover:shadow-rose-600/20 transition self-start md:self-auto"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Place New Order</span>
                </button>
                {/* Visual Accent */}
                <div className="absolute right-0 top-0 bottom-0 w-32 bg-[radial-gradient(circle_at_right,rgba(225,29,72,0.08)_0,transparent_100%)]" />
              </div>

              {/* 3 KPI Widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Open Orders count</span>
                    <Clock className="w-5 h-5 text-rose-500" />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {statsLoading ? '...' : stats.openOrdersCount}
                  </div>
                  <p className="text-[10px] text-slate-500">Currently scheduled or on active shopfloor lines</p>
                </div>

                <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dispatched (Last 30d)</span>
                    <Truck className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {statsLoading ? '...' : stats.dispatchedLast30DaysCount}
                  </div>
                  <p className="text-[10px] text-slate-500">Consigned with registered LR tracking numbers</p>
                </div>

                <div className="bg-slate-900 border border-slate-850/80 p-5 rounded-xl space-y-2 ring-1 ring-rose-500/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Outstanding Balance</span>
                    <CreditCard className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold text-rose-100">
                    ₹{statsLoading ? '...' : stats.outstandingBalance.toLocaleString('en-IN')}
                  </div>
                  <p className="text-[10px] text-slate-500">Sum of all outstanding unpaid/pending invoices</p>
                </div>
              </div>

              {/* Recent Orders table */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Recent Orders Intake (Last 10)</span>
                  </h3>
                  <button 
                    onClick={() => setActiveTab('orders')}
                    className="text-xs text-rose-500 hover:text-rose-400 font-semibold flex items-center gap-0.5"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {ordersLoading ? (
                    <div className="p-8 text-center text-slate-500 text-sm">Loading recent order schedules...</div>
                  ) : orders.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">No orders made yet. Use "Place New Order" above.</div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                          <th className="p-3.5 font-semibold">Order ID</th>
                          <th className="p-3.5 font-semibold">Date</th>
                          <th className="p-3.5 font-semibold">Items Count</th>
                          <th className="p-3.5 font-semibold">Status</th>
                          <th className="p-3.5 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {orders.slice(0, 10).map((order) => {
                          const dateStr = order.createdAt ? order.createdAt.split('T')[0] : 'N/A';
                          return (
                            <tr key={order.id} className="hover:bg-slate-800/20 transition">
                              <td className="p-3.5">
                                <span className="font-mono font-semibold text-rose-400">#{order.orderNumber}</span>
                                {order.isBotOrder && (
                                  <span className="ml-1.5 text-[9px] bg-sky-950/80 text-sky-400 border border-sky-800/50 px-1 rounded">
                                    Bot
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-slate-300">{dateStr}</td>
                              <td className="p-3.5 text-slate-400">{order.items.length} items</td>
                              <td className="p-3.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                  order.status === 'confirmed' 
                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' 
                                    : order.status === 'Dispatched' || order.status === 'dispatched'
                                      ? 'bg-indigo-950/60 text-indigo-400 border-indigo-805/40'
                                      : 'bg-amber-950/60 text-amber-400 border-amber-800/40'
                                }`}>
                                  {order.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <button
                                  onClick={() => {
                                    setViewingOrderId(order.id);
                                    setActiveTab('orders');
                                  }}
                                  className="text-xs text-rose-500 hover:text-rose-400 font-semibold"
                                >
                                  Track Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* PLACE ORDER: product schema catalog */}
          {portalOrderStep === 'catalog' && activeTab === 'profile' && (
            <div className="hidden" /> // fallback alignment
          )}

          {/* ACTIVE TAB IS DRIVEN TO PLACE ORDER (If stepped catalog) */}
          {portalOrderStep === 'catalog' && activeTab !== 'home' && activeTab !== 'orders' && activeTab !== 'invoices' && activeTab !== 'profile' && (
            <motion.div 
              key="catalog-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Header Navigation */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Direct Factory-Product Catalog</h2>
                  <p className="text-xs text-slate-400">Formulate order quantities below for processing</p>
                </div>
                <button
                  onClick={() => setPortalOrderStep('catalog')}
                  className="text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1 transition"
                >
                  Cancel
                </button>
              </div>

              {/* Bento Products Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEMO_CATALOG.map((prod) => {
                  const inCartQty = cart.find(item => item.product.id === prod.id)?.qty || 0;
                  return (
                    <div key={prod.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800/40 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                            {prod.code}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">Unit: {prod.unit}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-white leading-snug">{prod.name}</h4>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                        <div className="text-slate-400 text-xs">
                          Estimated Rate: <span className="text-rose-400 font-semibold font-mono">₹ POA</span>
                        </div>

                        {inCartQty > 0 ? (
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => handleUpdateQty(prod.id, inCartQty - 1)}
                              className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center transition"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-bold text-white font-mono w-6 text-center">{inCartQty}</span>
                            <button
                              onClick={() => handleUpdateQty(prod.id, inCartQty + 1)}
                              className="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(prod)}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-1.5 px-3 rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/10 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add To Cart</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Shopping Cart Drawer */}
              {cart.length > 0 && (
                <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl ring-2 ring-rose-500/10"
                >
                  <div className="text-center md:text-left">
                    <p className="text-sm font-bold text-white leading-relaxed">
                      Shopping Cart Intake ({cart.reduce((s, c) => s + c.qty, 0)} items)
                    </p>
                    <p className="text-xs text-slate-400">Ready to configure delivery destination address logs.</p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      onClick={() => setCart([])}
                      className="flex-1 md:flex-none border border-slate-800 hover:bg-slate-800 text-slate-400 font-semibold text-xs py-2.5 px-4 rounded-xl transition"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={handleCheckout}
                      className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/15 transition"
                    >
                      <span>Proceed to Order Review</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* PLACE ORDER: Step 2: CART REVIEW & SUBMIT */}
          {portalOrderStep === 'review' && (
            <motion.div 
              key="review-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl mx-auto bg-slate-900 border border-slate-850 p-6 rounded-2xl space-y-6"
            >
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Configure Delivery & Dispatch Limits</h2>
                <p className="text-xs text-slate-400">Input instructions to complete the FlowOps order intake</p>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-1">Items Scheduled</span>
                <div className="divide-y divide-slate-800/50">
                  {cart.map((item) => (
                    <div key={item.product.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-white">{item.product.name}</p>
                        <p className="text-slate-500 text-[10px]">Reference SKU Code: {item.product.code}</p>
                      </div>
                      <span className="font-mono text-rose-400 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                        {item.qty} {item.product.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Final Configurations Form */}
              <form onSubmit={handlePlaceOrderSubmit} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold block">Delivery Shipping Address</label>
                  <textarea
                    required
                    rows={2}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter full shipping warehouse terminal address"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                  />
                  <span className="text-[10px] text-slate-500">Auto-filled from corporate dealer profile logs.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold block">Target Requested Delivery Date</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-slate-500">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <input
                      type="date"
                      required
                      value={requestedDeliveryDate}
                      onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold block">Production & Cutting Instructions (Optional)</label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Custom packing or metallurgical gauge specifics..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                  />
                </div>

                <div className="flex gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setPortalOrderStep('catalog')}
                    className="flex-1 border border-slate-850 hover:bg-slate-800/40 text-slate-300 font-semibold text-xs py-3 rounded-xl transition"
                  >
                    Back to Catalog
                  </button>
                  <button
                    type="submit"
                    disabled={orderSubmitting}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/10 transition disabled:opacity-50"
                  >
                    {orderSubmitting ? 'submitting...' : 'Confirm & Place Order'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Place Order Success Screen */}
          {portalOrderStep === 'success' && (
            <motion.div 
              key="success-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto text-center bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-6"
            >
              <div className="inline-flex items-center justify-center p-3 bg-rose-500/10 text-rose-500 rounded-full border border-rose-500/20 mb-2">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Order Placed Successfully!</h2>
                <p className="text-slate-400 text-xs">
                  We have forwarded order reference <span className="text-rose-400 font-mono font-bold">#{placedOrderRef?.orderNumber}</span> to the central Ashrey coordination desk.
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-xl text-left text-xs text-slate-500 border border-slate-800 space-y-1.5">
                <p>📍 Delivery Target: <span className="text-slate-300 font-semibold">{placedOrderRef?.deliveryAddress}</span></p>
                <p>📆 Target Delivery: <span className="text-slate-300 font-semibold">{placedOrderRef?.requestedDeliveryDate}</span></p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setViewingOrderId(placedOrderRef?.id || null);
                    setPortalOrderStep('catalog');
                    setActiveTab('orders');
                  }}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-3 rounded-xl shadow-lg transition"
                >
                  Track Order
                </button>
                <button
                  onClick={() => {
                    setPortalOrderStep('catalog');
                    setActiveTab('home');
                  }}
                  className="w-full text-xs text-slate-400 hover:text-rose-300 transition"
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          {/* TAB: ORDERS & DETAILED TRACKER */}
          {activeTab === 'orders' && portalOrderStep === 'catalog' && (
            <motion.div 
              key="tab-orders"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Purchased Orders History</h2>
                  <p className="text-xs text-slate-400">Total processed logs and interactive shipment tracing.</p>
                </div>
              </div>

              {/* Order tracker focus logic */}
              {viewingOrderId ? (
                (() => {
                  const targetOrder = orders.find(o => o.id === viewingOrderId);
                  if (!targetOrder) return <p className="text-slate-500 text-xs text-center">Referenced order not found.</p>;
                  return (
                    <div className="bg-slate-900 border border-rose-500/10 p-6 rounded-2xl space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <button
                          onClick={() => setViewingOrderId(null)}
                          className="text-xs text-rose-500 hover:text-rose-400 font-semibold flex items-center gap-1"
                        >
                          ← Back to History
                        </button>
                        <span className="text-xs text-slate-500">Order ID: #{targetOrder.orderNumber}</span>
                      </div>

                      {/* Tracker Stage diagram */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Production progress</h4>
                        <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
                          <div className={`p-2.5 rounded-lg border ${
                            targetOrder.status !== 'cancelled'
                              ? 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                              : 'bg-slate-950 text-slate-600 border-slate-800'
                          }`}>
                            Intake Received
                          </div>
                          <div className={`p-2.5 rounded-lg border ${
                            targetOrder.status === 'confirmed' || targetOrder.status === 'Dispatched' || targetOrder.status === 'dispatched'
                              ? 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                              : 'bg-slate-950 text-slate-600 border-slate-800'
                          }`}>
                            Confirmed
                          </div>
                          <div className={`p-2.5 rounded-lg border ${
                            targetOrder.status === 'confirmed' || targetOrder.status === 'Dispatched' || targetOrder.status === 'dispatched'
                              ? 'bg-amber-950/30 text-amber-500/80 border-amber-500/20'
                              : 'bg-slate-950 text-slate-600 border-slate-800'
                          }`}>
                            Active Shopfloor
                          </div>
                          <div className={`p-2.5 rounded-lg border ${
                            targetOrder.status === 'Dispatched' || targetOrder.status === 'dispatched'
                              ? 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                              : 'bg-slate-950 text-slate-600 border-slate-800'
                          }`}>
                            Loaded Outware
                          </div>
                        </div>
                      </div>

                      {/* Info logs card */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-950/80 rounded-xl space-y-2 border border-slate-800 text-xs">
                          <p className="font-bold text-white text-xs border-b border-slate-850 pb-1">Specifications</p>
                          <p>⚖️ Customer: <span className="text-slate-300 font-semibold">{targetOrder.customerName}</span></p>
                          <p>📍 Location address: <span className="text-slate-300">{targetOrder.deliveryAddress}</span></p>
                          <p>📅 Schedule calendar: <span className="text-slate-300 font-semibold">{targetOrder.requestedDeliveryDate}</span></p>
                          <p>🖊️ Note details: <span className="text-slate-400 italic">"{targetOrder.notes || 'None'}"</span></p>
                        </div>

                        <div className="p-4 bg-slate-950/80 rounded-xl space-y-2 border border-slate-800 text-xs">
                          <p className="font-bold text-white text-xs border-b border-slate-850 pb-1">Tracking Consignment</p>
                          <p>🚚 Transporter: <span className="text-slate-300 font-semibold">{(targetOrder as any).transporter || 'SafeExpress Pvt Ltd'}</span></p>
                          <p>🏷️ Tracking LR Number: <span className="text-slate-400 font-mono font-bold bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-rose-400">{(targetOrder as any).lrNumber || (targetOrder as any).LRNumber || 'N/A'}</span></p>
                          <p>🟢 Current status: <span className="text-emerald-400 font-semibold">{targetOrder.status === 'Dispatched' || targetOrder.status === 'dispatched' ? `Dispatched. Consignment is currently shipped and trackable under above credentials.` : 'Under production / scheduled for loading.'}</span></p>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="border border-slate-800 rounded-xl overflow-hidden">
                        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-805">
                          <span className="text-xs font-bold text-slate-300">Items Ordered</span>
                        </div>
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                              <th className="p-3">Reference Item</th>
                              <th className="p-3 text-right">Quantity Scheduled</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40">
                            {targetOrder.items.map((i, index) => (
                              <tr key={index} className="hover:bg-slate-800/15">
                                <td className="p-3 text-slate-200">{i.name}</td>
                                <td className="p-3 text-right font-mono text-rose-400 font-bold">{i.quantity} {i.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-950 text-slate-400 border-b border-slate-800/80 font-bold">
                          <th className="p-3.5">Order Number</th>
                          <th className="p-3.5">Intake Date</th>
                          <th className="p-3.5">Line Count</th>
                          <th className="p-3.5">Active Status</th>
                          <th className="p-3.5 text-right">Invoice Ref</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {orders.map((o) => {
                          const dateStr = o.createdAt ? o.createdAt.split('T')[0] : 'N/A';
                          return (
                            <tr 
                              key={o.id} 
                              onClick={() => setViewingOrderId(o.id)}
                              className="hover:bg-slate-800/20 transition cursor-pointer"
                            >
                              <td className="p-3.5 font-mono font-bold text-rose-400">
                                #{o.orderNumber}
                              </td>
                              <td className="p-3.5 text-slate-300">{dateStr}</td>
                              <td className="p-3.5 text-slate-400">{o.items.length} product(s)</td>
                              <td className="p-3.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  o.status === 'confirmed' 
                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/40' 
                                    : o.status === 'Dispatched' || o.status === 'dispatched'
                                      ? 'bg-indigo-950/60 text-indigo-400 border-indigo-900/40'
                                      : 'bg-amber-950/60 text-amber-400 border-amber-900/40'
                                }`}>
                                  {o.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <span className="text-rose-500 font-semibold hover:underline">Track & Tracing →</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: INVOICES & OUTSTANDING BILLS */}
          {activeTab === 'invoices' && portalOrderStep === 'catalog' && (
            <motion.div 
              key="tab-invoices"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Invoices & Outstanding Accounts Ledger</h2>
                  <p className="text-xs text-slate-400">Secure overview of outstanding limits, payments and invoice copies.</p>
                </div>
                <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs text-slate-300">Outstanding: <span className="text-rose-400 font-bold font-mono">₹{stats.outstandingBalance.toLocaleString('en-IN')}</span></span>
                </div>
              </div>

              {/* Invoices list */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <th className="p-3.5">Invoice Number</th>
                        <th className="p-3.5">Bill Date</th>
                        <th className="p-3.5">Due Date</th>
                        <th className="p-3.5">Total Amount</th>
                        <th className="p-3.5">Outstanding Balance</th>
                        <th className="p-3.5">Payment Status</th>
                        <th className="p-3.5 text-right">PDF Download</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-800/20 transition">
                          <td className="p-3.5 font-mono font-semibold text-slate-300">
                            {inv.invoiceNumber}
                          </td>
                          <td className="p-3.5 text-slate-400">{inv.invoiceDate}</td>
                          <td className="p-3.5 text-slate-400">{inv.dueDate}</td>
                          <td className="p-3.5 text-slate-200">₹{inv.total.toLocaleString('en-IN')}</td>
                          <td className="p-3.5 text-rose-300 font-mono">₹{inv.outstanding.toLocaleString('en-IN')}</td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                              inv.status === 'paid' 
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/30' 
                                : inv.status === 'partial'
                                  ? 'bg-blue-950/60 text-blue-400 border-blue-800/35'
                                  : 'bg-red-950/60 text-red-400 border-red-800/30'
                            }`}>
                              {inv.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => alert(`Beginning download of secure PDF metadata for Invoice ${inv.invoiceNumber}...`)}
                              className="text-xs text-rose-500 hover:text-rose-400 font-bold inline-flex items-center gap-1 hover:underline"
                            >
                              <Download className="w-4 h-4" />
                              <span>Download PDF</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: PROFILE & WAREHOUSE ADDRESSES */}
          {activeTab === 'profile' && portalOrderStep === 'catalog' && (
            <motion.div 
              key="tab-profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-xl mx-auto space-y-6"
            >
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Corporate Dealer Profile Details</h3>
                  <p className="text-xs text-slate-400">Detailed contact parameters, tax registrations, and logistics terminals.</p>
                </div>

                <div className="space-y-4 text-xs font-medium text-slate-300">
                  <div className="grid grid-cols-2 gap-4 border-b border-slate-850 pb-3">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Registered Entity Name</span>
                      <span className="text-white font-semibold text-[13px]">{currentCustomer?.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">GST Registration ID</span>
                      <span className="text-rose-400 font-mono font-bold text-[13px]">{currentCustomer?.gstNumber || '27AAACA1234A1Z9'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-b border-slate-850 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Coordination point</span>
                        <span className="text-white font-semibold">{currentCustomer?.contactPerson || authenticatedUser.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Phone registry</span>
                        <span className="text-white font-semibold font-mono">{currentCustomer?.phone || authenticatedUser.phone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-slate-850 pb-3">
                    <span className="text-[10px] text-slate-500 uppercase block mb-1">Logistics & Shipping terminal location</span>
                    <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-slate-300 leading-relaxed text-xs">{currentCustomer?.shippingAddress || currentCustomer?.billingAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block mb-1">Corporate billing headquarter</span>
                    <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-slate-400 leading-relaxed text-xs">{currentCustomer?.billingAddress}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Touch-Friendly Sticky Place Order CTA on mobile home */}
      {activeTab === 'home' && portalOrderStep === 'catalog' && (
        <div id="portal-mobile-sticky-cta" className="block md:hidden fixed bottom-16 left-0 right-0 p-4 z-30">
          <button
            onClick={() => setPortalOrderStep('catalog')}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-rose-600/25 transition active:scale-95"
          >
            <ShoppingBag className="w-5 h-5 animate-bounce" />
            <span>sticky bottom Place Order CTA</span>
          </button>
        </div>
      )}

      {/* 2. Responsive Mobile Bottom Navigation Bar / Tab System */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 flex justify-around items-center h-16 px-2 md:hidden">
        <button
          onClick={() => {
            setPortalOrderStep('catalog');
            setActiveTab('home');
          }}
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition ${
            activeTab === 'home' && portalOrderStep === 'catalog' ? 'text-rose-500' : 'text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold">Home</span>
        </button>

        <button
          onClick={() => {
            setPortalOrderStep('catalog');
            setActiveTab('orders');
          }}
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition ${
            activeTab === 'orders' ? 'text-rose-500' : 'text-slate-400'
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
          <span className="text-[10px] font-bold">Orders</span>
        </button>

        <button
          onClick={() => {
            setPortalOrderStep('catalog');
            setActiveTab('invoices');
          }}
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition ${
            activeTab === 'invoices' ? 'text-rose-500' : 'text-slate-400'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-bold">Invoices</span>
        </button>

        <button
          onClick={() => {
            setPortalOrderStep('catalog');
            setActiveTab('profile');
          }}
          className={`flex flex-col items-center gap-1 flex-1 py-1 transition ${
            activeTab === 'profile' ? 'text-rose-500' : 'text-slate-400'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </footer>

      {/* Desktop Horizontal Dock Navigation */}
      <div className="hidden md:flex fixed left-6 top-24 bottom-6 w-52 bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex-col justify-between z-30">
        <div className="space-y-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block px-2.5 pb-2 border-b border-slate-800">
            Dock Navigation
          </span>
          <button
            onClick={() => {
              setPortalOrderStep('catalog');
              setActiveTab('home');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'home' && portalOrderStep === 'catalog' 
                ? 'bg-rose-950/60 text-rose-400 border border-rose-800/30' 
                : 'text-slate-400 hover:bg-slate-800/40'
            }`}
          >
            <Home className="w-4 h-4 shadow" />
            <span>Home</span>
          </button>

          <button
            onClick={() => {
              setPortalOrderStep('catalog');
              setActiveTab('orders');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'orders' 
                ? 'bg-rose-950/60 text-rose-400 border border-rose-800/30' 
                : 'text-slate-400 hover:bg-slate-800/40'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Orders Intake</span>
          </button>

          <button
            onClick={() => {
              setPortalOrderStep('catalog');
              setActiveTab('invoices');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'invoices' 
                ? 'bg-rose-950/60 text-rose-400 border border-rose-800/30' 
                : 'text-slate-400 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Billing Invoices</span>
          </button>

          <button
            onClick={() => {
              setPortalOrderStep('catalog');
              setActiveTab('profile');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'profile' 
                ? 'bg-rose-950/60 text-rose-400 border border-rose-800/30' 
                : 'text-slate-400 hover:bg-slate-800/40'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Dealer Profile</span>
          </button>
        </div>

        <div className="p-2 border-t border-slate-805 text-center">
          <p className="text-[10px] text-slate-500 font-mono">Ashrey FlowOps v2.10</p>
        </div>
      </div>
    </div>
  );
};
