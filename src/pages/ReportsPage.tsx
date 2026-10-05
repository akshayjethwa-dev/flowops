// src/pages/ReportsPage.tsx

import React, { useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRfqsList } from '../hooks/useRfqsList';
import { useProductionBoard } from '../hooks/useProduction';
import { useDispatchList } from '../hooks/useDispatch';
import { useInvoices } from '../hooks/useInvoices';
import { useStockItems } from '../hooks/useStockInventory';
import { useCustomersList } from '../hooks/useCustomersList';
import { exportToCSV, exportReportToPDF } from '../utils/exportUtils';
import {
  BarChart3,
  Calendar,
  Download,
  Filter,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Package,
  FolderSync,
  Layers,
  Truck,
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  HelpCircle,
} from 'lucide-react';

type ReportType = 'rfq' | 'order' | 'dispatch' | 'payment' | 'inventory';

export const ReportsPage: React.FC = () => {
  const { tenant } = useAuth();
  const tenantId = tenant?.id;

  const [activeTab, setActiveTab] = useState<ReportType>('rfq');

  // Unified Filtering State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTransporter, setSelectedTransporter] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Load SaaS Database collections securely synced per Active tenantId
  const { rfqs, loading: loadingRfqs } = useRfqsList(tenantId);
  const { orders, loading: loadingOrders } = useProductionBoard(tenantId);
  const { dispatches, loading: loadingDispatches } = useDispatchList(tenantId);
  const { invoices, loading: loadingInvoices } = useInvoices(tenantId);
  const { items: stockItems, loading: loadingStock } = useStockItems(tenantId);
  const { rawCustomers: customers } = useCustomersList(tenantId);

  // Active Company name & plant fallbacks for branding on reports
  const companyName = tenant?.companyName || 'SME Forge Pvt. Ltd.';
  const activePlant = tenant?.address?.split(',')[0] || 'Main Manufacturing Unit';

  const isLoading =
    loadingRfqs || loadingOrders || loadingDispatches || loadingInvoices || loadingStock;

  // Custom Category standard buy-unit costs maps for valuation estimates (Report 5)
  const categoryCostMap: Record<string, number> = {
    raw_material: 42500, // per Tonne approx
    finished_goods: 8900,  // per unit
    consumable: 240,     // per L
    spare: 450          // per Unit
  };

  const getStockItemUnitCost = (category: string) => {
    return categoryCostMap[category] || 1500;
  };

  // Helper to parse dates safely
  const isWithinDateRange = (dateStr: string | undefined): boolean => {
    if (!dateStr) return true;
    const itemDate = new Date(dateStr.split('T')[0]);
    
    if (startDate) {
      const start = new Date(startDate);
      if (itemDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      if (itemDate > end) return false;
    }
    return true;
  };

  // ==========================================
  // Memoized Report Data Filtering & Construction
  // ==========================================

  // Report 1: RFQ Pipeline Report
  const filteredRfqData = useMemo(() => {
    return rfqs.filter(rfq => {
      if (!isWithinDateRange(rfq.dateReceived || rfq.createdAt)) return false;
      if (selectedCustomerId !== 'all' && rfq.customerId !== selectedCustomerId && rfq.customerName !== selectedCustomerId) return false;
      if (selectedStatus !== 'all' && rfq.status.toLowerCase() !== selectedStatus.toLowerCase()) return false;
      return true;
    });
  }, [rfqs, startDate, endDate, selectedCustomerId, selectedStatus]);

  // Report 2: Order Status Report
  const filteredOrderData = useMemo(() => {
    return orders.filter(order => {
      // Created Date is serialized as Firebase timestamp or ISO string
      const dateStr = order.createdAt?.seconds 
        ? new Date(order.createdAt.seconds * 1000).toISOString() 
        : order.createdAt;
      
      if (!isWithinDateRange(dateStr)) return false;
      if (selectedCustomerId !== 'all' && order.customerName !== selectedCustomerId) return false;
      if (selectedStatus !== 'all' && order.status.toLowerCase() !== selectedStatus.toLowerCase()) return false;
      return true;
    });
  }, [orders, startDate, endDate, selectedCustomerId, selectedStatus]);

  // Report 3: Dispatch Summary
  const filteredDispatchData = useMemo(() => {
    return dispatches.filter(d => {
      const dateStr = d.dispatchDate || d.dispatchedAt;
      if (!isWithinDateRange(dateStr)) return false;
      if (selectedCustomerId !== 'all' && d.customerName !== selectedCustomerId) return false;
      if (selectedTransporter !== 'all' && d.transporter !== selectedTransporter) return false;
      return true;
    });
  }, [dispatches, startDate, endDate, selectedCustomerId, selectedTransporter]);

  // Report 4: Outstanding & Payments Summary
  const filteredPaymentData = useMemo(() => {
    return invoices.filter(inv => {
      if (!isWithinDateRange(inv.invoiceDate)) return false;
      if (selectedCustomerId !== 'all' && inv.customerName !== selectedCustomerId) return false;
      if (selectedStatus !== 'all' && inv.status.toLowerCase() !== selectedStatus.toLowerCase()) return false;
      return true;
    });
  }, [invoices, startDate, endDate, selectedCustomerId, selectedStatus]);

  // Report 5: Inventory Valuation Report
  const filteredInventoryData = useMemo(() => {
    return stockItems.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedStatus === 'reorder') {
        return item.currentQty <= item.reorderLevel;
      }
      return true;
    });
  }, [stockItems, selectedCategory, selectedStatus]);


  // ==========================================
  // Trigger Handlers for Export Operations (CSV / PDF)
  // ==========================================

  const handleCSVExport = () => {
    switch (activeTab) {
      case 'rfq': {
        const headers = ['RFQ#', 'Customer', 'Product', 'Estimated Value', 'Status', 'Created Date', 'Last Updated'];
        const rows = filteredRfqData.map(r => {
          const val = r.items?.reduce((s, i) => s + (i.quantity * 15000), 0) || 75000;
          return [
            r.rfqNumber || r.id,
            r.customerName,
            r.items?.map(i => `${i.name} (x${i.quantity})`).join(', ') || 'Custom Gear Assemblies',
            `INR ${val}`,
            r.status,
            r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'N/A',
            r.dateReceived || 'N/A'
          ];
        });
        exportToCSV(headers, rows, `RFQ_Pipeline_Report_${Date.now()}`);
        break;
      }
      case 'order': {
        const headers = ['Order#', 'Customer', 'Product', 'Quantity', 'Current Stage', 'Created', 'Expected Delivery', 'Days in Stage', 'Delayed'];
        const rows = filteredOrderData.map(o => {
          const daysInStage = Math.floor((Date.now() - new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt).getTime()) / (1000 * 3600 * 24)) || 1;
          const isDelayed = o.status !== 'completed' && o.status !== 'dispatched' && o.deliveryDate && new Date(o.deliveryDate) < new Date();
          return [
            o.orderNumber,
            o.customerName,
            o.items?.map(i => i.name).join(', ') || 'Manufactured Parts',
            o.items?.reduce((s, i) => s + i.quantity, 0) || 0,
            o.status,
            o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : String(o.createdAt).split('T')[0],
            o.deliveryDate || 'N/A',
            daysInStage,
            isDelayed ? 'YES' : 'NO'
          ];
        });
        exportToCSV(headers, rows, `Order_Status_Report_${Date.now()}`);
        break;
      }
      case 'dispatch': {
        const headers = ['Dispatch#', 'Order#', 'Customer', 'Transporter', 'LR No', 'Dispatched Date', 'Expected Delivery', 'Status'];
        const rows = filteredDispatchData.map(d => {
          const dispatchDate = d.dispatchDate || d.dispatchedAt?.split('T')[0] || 'N/A';
          const expectedDelivery = d.dispatchDate 
            ? new Date(new Date(d.dispatchDate).getTime() + 4 * 24 * 3600 * 1000).toISOString().split('T')[0] 
            : 'N/A';
          return [
            d.dispatchNumber || d.id,
            d.orderId,
            d.customerName || 'N/A',
            d.transporter || 'Direct Truck',
            d.lrNumber || d.LRNumber || 'N/A',
            dispatchDate,
            expectedDelivery,
            d.status
          ];
        });
        exportToCSV(headers, rows, `Dispatch_Summary_Report_${Date.now()}`);
        break;
      }
      case 'payment': {
        const headers = ['Invoice#', 'Customer', 'Total Amount', 'Paid Amount', 'Outstanding', 'Due Date', 'Status', 'Overdue Days'];
        const rows = filteredPaymentData.map(inv => {
          const overdueDays = (inv.outstanding > 0 && new Date(inv.dueDate) < new Date())
            ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24))
            : 0;
          return [
            inv.invoiceNumber,
            inv.customerName,
            inv.total,
            inv.totalPaid,
            inv.outstanding,
            inv.dueDate,
            inv.status,
            overdueDays
          ];
        });
        exportToCSV(headers, rows, `Outstanding_Payments_Report_${Date.now()}`);
        break;
      }
      case 'inventory': {
        const headers = ['Item Code', 'Name', 'Category', 'Stock Level', 'Unit', 'Unit Cost', 'Valuation', 'Reorder Status'];
        const rows = filteredInventoryData.map(item => {
          const unitCost = getStockItemUnitCost(item.category);
          const valuation = item.currentQty * unitCost;
          const reorderStatus = item.currentQty <= item.reorderLevel ? 'REORDER' : 'OK';
          return [
            item.code,
            item.name,
            item.category.toUpperCase().replace('_', ' '),
            item.currentQty,
            item.unit,
            unitCost,
            valuation,
            reorderStatus
          ];
        });
        exportToCSV(headers, rows, `Inventory_Valuation_Report_${Date.now()}`);
        break;
      }
    }
  };

  const handlePDFExport = () => {
    switch (activeTab) {
      case 'rfq': {
        const headers = ['RFQ#', 'Customer', 'Product', 'Value (INR)', 'Status', 'Created Date'];
        const rows = filteredRfqData.map(r => {
          const val = r.items?.reduce((s, i) => s + (i.quantity * 15000), 0) || 75000;
          return [
            r.rfqNumber || r.id,
            r.customerName,
            r.items?.map(i => `${i.name} (x${i.quantity})`).join(', ') || 'Custom Gears',
            `INR ${val.toLocaleString('en-IN')}`,
            r.status,
            r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'N/A'
          ];
        });
        exportReportToPDF('RFQ Pipeline Summary', headers, rows, companyName, activePlant, `RFQ_Pipeline_${Date.now()}`);
        break;
      }
      case 'order': {
        const headers = ['Order#', 'Customer', 'Product', 'Qty', 'Stage', 'Expected Delivery', 'Days in Stage', 'Delayed'];
        const rows = filteredOrderData.map(o => {
          const daysInStage = Math.floor((Date.now() - new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt).getTime()) / (1000 * 3600 * 24)) || 1;
          const isDelayed = o.status !== 'completed' && o.status !== 'dispatched' && o.deliveryDate && new Date(o.deliveryDate) < new Date();
          return [
            o.orderNumber,
            o.customerName,
            o.items?.map(i => i.name).join(', ') || 'SS castings',
            o.items?.reduce((s, i) => s + i.quantity, 0) || 0,
            o.status.toUpperCase(),
            o.deliveryDate || 'N/A',
            String(daysInStage),
            isDelayed ? 'DELAYED' : 'NO'
          ];
        });
        exportReportToPDF('Order Status Report', headers, rows, companyName, activePlant, `Order_Status_${Date.now()}`);
        break;
      }
      case 'dispatch': {
        const headers = ['Dispatch#', 'Order#', 'Customer', 'Transporter', 'LR No', 'Dispatched Date', 'Status'];
        const rows = filteredDispatchData.map(d => {
          const dispatchDate = d.dispatchDate || d.dispatchedAt?.split('T')[0] || 'N/A';
          return [
            d.dispatchNumber || d.id,
            d.orderId,
            d.customerName || 'N/A',
            d.transporter || 'Direct Logistics',
            d.lrNumber || d.LRNumber || 'N/A',
            dispatchDate,
            d.status.toUpperCase()
          ];
        });
        exportReportToPDF('Dispatch Summary Report', headers, rows, companyName, activePlant, `Dispatch_Summary_${Date.now()}`);
        break;
      }
      case 'payment': {
        const headers = ['Invoice#', 'Customer', 'Total', 'Paid', 'Outstanding', 'Due Date', 'Status', 'Overdue Days'];
        const rows = filteredPaymentData.map(inv => {
          const overdueDays = (inv.outstanding > 0 && new Date(inv.dueDate) < new Date())
            ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24))
            : 0;
          return [
            inv.invoiceNumber,
            inv.customerName,
            `INR ${inv.total.toLocaleString('en-IN')}`,
            `INR ${inv.totalPaid.toLocaleString('en-IN')}`,
            `INR ${inv.outstanding.toLocaleString('en-IN')}`,
            inv.dueDate,
            inv.status.toUpperCase(),
            String(overdueDays)
          ];
        });
        exportReportToPDF('Payment Outstanding Summary', headers, rows, companyName, activePlant, `Payment_Outstanding_${Date.now()}`);
        break;
      }
      case 'inventory': {
        const headers = ['Item Code', 'Name', 'Category', 'Level', 'Unit', 'Cost', 'Valuation', 'Reorder Status'];
        const rows = filteredInventoryData.map(item => {
          const unitCost = getStockItemUnitCost(item.category);
          const valuation = item.currentQty * unitCost;
          const reorderStatus = item.currentQty <= item.reorderLevel ? 'REORDER' : 'OK';
          return [
            item.code,
            item.name,
            item.category.toUpperCase().replace('_', ' '),
            String(item.currentQty),
            item.unit,
            `INR ${unitCost.toLocaleString('en-IN')}`,
            `INR ${valuation.toLocaleString('en-IN')}`,
            reorderStatus
          ];
        });
        exportReportToPDF('Inventory Valuation Audit', headers, rows, companyName, activePlant, `Inventory_Valuation_${Date.now()}`);
        break;
      }
    }
  };


  // ==========================================
  // Render Filters Bar dynamically
  // ==========================================

  const renderFilters = () => {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-xs select-none">
        <div className="flex items-center space-x-2 text-slate-900 border-b border-slate-100 pb-3 mb-4">
          <Filter className="h-4 w-4 text-sky-600" />
          <h4 className="text-xs font-mono uppercase tracking-wider font-bold">Configure Report Options</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Start Date */}
          {activeTab !== 'inventory' && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5 flex items-center space-x-1">
                <Calendar className="h-3 w-3 shrink-0 text-slate-450" />
                <span>Start Date</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100/50 text-[11px] font-mono rounded px-3 py-1.5 focus:outline-hidden focus:border-sky-500 transition-all text-slate-800"
              />
            </div>
          )}

          {/* End Date */}
          {activeTab !== 'inventory' && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5 flex items-center space-x-1">
                <Calendar className="h-3 w-3 shrink-0 text-slate-450" />
                <span>End Date</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100/50 text-[11px] font-mono rounded px-3 py-1.5 focus:outline-hidden focus:border-sky-500 transition-all text-slate-800"
              />
            </div>
          )}

          {/* Customer filter */}
          {activeTab !== 'inventory' && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5">
                Customer Organization
              </label>
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100/50 text-[11px] font-mono rounded px-3 py-1.5 focus:outline-hidden focus:border-sky-500 transition-all text-slate-805 cursor-pointer"
              >
                <option value="all">ALL CUSTOMERS</option>
                {customers.map(c => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status filter (RFQ Specific) */}
          {activeTab === 'rfq' && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5">
                RFQ pipeline status
              </label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100/50 text-[11px] font-mono rounded px-3 py-1.5 focus:outline-hidden focus:border-sky-500 transition-all text-slate-805 cursor-pointer"
              >
                <option value="all">ALL STATUSES</option>
                <option value="new">NEW</option>
                <option value="in progress">IN PROGRESS</option>
                <option value="quoted">QUOTED</option>
                <option value="won">WON</option>
                <option value="lost">LOST</option>
              </select>
            </div>
          )}

          {/* Stage filter (Order status) */}
          {activeTab === 'order' && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5">
                Current manufacturing stage
              </label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100/50 text-[11px] font-mono rounded px-3 py-1.5 focus:outline-hidden focus:border-sky-500 transition-all text-slate-805 cursor-pointer"
              >
                <option value="all">ALL STAGES</option>
                <option value="pending">PENDING</option>
                <option value="in-production">IN-PRODUCTION</option>
                <option value="produced">PRODUCED</option>
                <option value="dispatched">DISPATCHED</option>
                <option value="completed">COMPLETED</option>
                <option value="cancelled">CANCELLED</option>
              </select>
            </div>
          )}

          {/* Transporter filter (Dispatch Specific) */}
          {activeTab === 'dispatch' && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5">
                Transporter carrier
              </label>
              <select
                value={selectedTransporter}
                onChange={e => setSelectedTransporter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100/50 text-[11px] font-mono rounded px-3 py-1.5 focus:outline-hidden focus:border-sky-500 transition-all text-slate-805 cursor-pointer"
              >
                <option value="all">ALL CARRIERS</option>
                <option value="SafeExpress Ltd.">SafeExpress Ltd.</option>
                <option value="TCI Freight">TCI Freight</option>
                <option value="V-Trans India">V-Trans India</option>
                <option value="Direct Truck">Direct Truck</option>
                <option value="Customer Pick-Up">Customer Pick-Up</option>
              </select>
            </div>
          )}

          {/* Payment Status (Payment Specific) */}
          {activeTab === 'payment' && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5">
                Invoiced Status
              </label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100/50 text-[11px] font-mono rounded px-3 py-1.5 focus:outline-hidden focus:border-sky-500 transition-all text-slate-805 cursor-pointer"
              >
                <option value="all">ALL STATUSES</option>
                <option value="sent">SENT</option>
                <option value="partial">PARTIAL</option>
                <option value="paid">PAID</option>
                <option value="overdue">OVERDUE</option>
              </select>
            </div>
          )}

          {/* Category Dropdown (Inventory tab only) */}
          {activeTab === 'inventory' && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5">
                Product Category
              </label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100/50 text-[11px] font-mono rounded px-3 py-1.5 focus:outline-hidden focus:border-sky-500 transition-all text-slate-805 cursor-pointer"
              >
                <option value="all">ALL CATEGORIES</option>
                <option value="raw_material">RAW MATERIAL</option>
                <option value="finished_goods">FINISHED GOODS</option>
                <option value="consumable">CONSUMABLES</option>
                <option value="spare">SPARE PARTS</option>
              </select>
            </div>
          )}

          {/* Stock Alerts Filter (Inventory tab only) */}
          {activeTab === 'inventory' && (
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1.5">
                Stocking Status Link
              </label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-205 hover:bg-slate-100/50 text-[11px] font-mono rounded px-3 py-1.5 focus:outline-hidden focus:border-sky-500 transition-all text-slate-805 cursor-pointer"
              >
                <option value="all">ALL ITEMS</option>
                <option value="reorder">REORDER HIGHLIGHTS</option>
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };


  // ==========================================
  // Render Dynamic Report tables
  // ==========================================

  const renderActiveReportTable = () => {
    if (isLoading) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center shadow-xs">
          <div className="animate-spin h-6 w-6 border-2 border-sky-600 border-t-transparent rounded-full" />
          <p className="mt-3 text-xs font-mono text-slate-400 uppercase tracking-widest animate-pulse">
            Processing dynamic factory datasets...
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'rfq': {
        const hasData = filteredRfqData.length > 0;
        return (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-100 font-mono text-[10px] uppercase tracking-wide border-b border-slate-800">
                    <th className="py-3.5 px-4 font-semibold">RFQ #</th>
                    <th className="py-3.5 px-4 font-semibold">Customer</th>
                    <th className="py-3.5 px-4 font-semibold">Product Description</th>
                    <th className="py-3.5 px-4 font-semibold">Value Estimation</th>
                    <th className="py-3.5 px-4 font-semibold">Stage Link</th>
                    <th className="py-3.5 px-4 font-semibold">Submission Date</th>
                    <th className="py-3.5 px-4 font-semibold">Last Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasData ? (
                    filteredRfqData.map((rfq, idx) => {
                      const estVal = rfq.items?.reduce((s, i) => s + (i.quantity * 15000), 0) || 75000;
                      return (
                        <tr key={rfq.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-sky-600 truncate">{rfq.rfqNumber || rfq.id}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{rfq.customerName}</td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {rfq.items?.map(i => `${i.name} (x${i.quantity})`).join(', ') || rfq.description || 'Custom gears assembly'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">₹{estVal.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              rfq.status.toLowerCase() === 'won' ? 'bg-green-100 text-green-700' :
                              rfq.status.toLowerCase() === 'lost' ? 'bg-rose-100 text-rose-700' :
                              rfq.status.toLowerCase() === 'quoted' ? 'bg-amber-105 bg-amber-100 text-amber-700' :
                              'bg-sky-50 text-sky-700'
                            }`}>
                              {rfq.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-550">
                            {rfq.dateReceived || 'N/A'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center font-mono text-xs text-slate-400 grayscale">
                        NO DYNAMIC MATCHING RFQS DETECTED IN ACTIVE SCOPE
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 select-none text-[11px] font-mono text-slate-500">
              Pipeline Total Capacity Match: <span className="font-bold text-slate-700">{filteredRfqData.length} records</span> in standard list focus.
            </div>
          </div>
        );
      }

      case 'order': {
        const hasData = filteredOrderData.length > 0;
        return (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-100 font-mono text-[10px] uppercase tracking-wide border-b border-slate-800">
                    <th className="py-3.5 px-4 font-semibold">Order #</th>
                    <th className="py-3.5 px-4 font-semibold">Customer Name</th>
                    <th className="py-3.5 px-4 font-semibold">Product Description</th>
                    <th className="py-3.5 px-4 font-semibold">Qty</th>
                    <th className="py-3.5 px-4 font-semibold">Current Stage</th>
                    <th className="py-3.5 px-4 font-semibold">Expected Delivery</th>
                    <th className="py-3.5 px-4 font-semibold">Age in Stage</th>
                    <th className="py-3.5 px-4 font-semibold">Status Delay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasData ? (
                    filteredOrderData.map((o, idx) => {
                      const daysInStage = Math.floor((Date.now() - new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt).getTime()) / (1000 * 3600 * 24)) || 1;
                      const isDelayed = o.status !== 'completed' && o.status !== 'dispatched' && o.deliveryDate && new Date(o.deliveryDate) < new Date();
                      const highlightAlert = daysInStage > 7;

                      return (
                        <tr 
                          key={o.id || idx} 
                          className={`transition-colors duration-150 ${
                            highlightAlert 
                              ? 'bg-rose-50/60 hover:bg-rose-50/80 border-r-4 border-rose-500' 
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-slate-850 truncate">{o.orderNumber}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{o.customerName}</td>
                          <td className="py-3 px-4 text-slate-650 max-w-xs truncate">
                            {o.items?.map(i => i.name).join(', ') || 'Cast Machine Assembly'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {o.items?.reduce((s, i) => s + i.quantity, 0) || 0}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                              o.status === 'completed' ? 'bg-green-150 text-green-700 border-green-200' :
                              o.status === 'in-production' ? 'bg-pink-100 text-pink-700 border-pink-200' :
                              'bg-amber-100 text-amber-700 border-amber-205'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">{o.deliveryDate || 'N/A'}</td>
                          <td className="py-3 px-4 font-mono">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              highlightAlert 
                                ? 'bg-rose-100 text-rose-700 font-bold animate-pulse' 
                                : 'text-slate-600 bg-slate-100'
                            }`}>
                              {daysInStage} Days
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {isDelayed ? (
                              <span className="text-rose-600 font-bold flex items-center space-x-1">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                <span>DELAYED</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">ON SCHEDULE</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center font-mono text-xs text-slate-400 grayscale">
                        NO DYNAMIC MATCHING PRODUCTION ORDERS IN FOCUS
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 select-none text-[11px] font-mono text-slate-500 flex justify-between items-center">
              <span>Orders tracked: <span className="font-bold text-slate-700">{filteredOrderData.length} active</span></span>
              <span className="text-rose-600 font-semibold flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>Overdue Flag Highlights (&gt;7 Days in status)</span>
              </span>
            </div>
          </div>
        );
      }

      case 'dispatch': {
        const hasData = filteredDispatchData.length > 0;
        return (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-100 font-mono text-[10px] uppercase tracking-wide border-b border-slate-800">
                    <th className="py-3.5 px-4 font-semibold">Dispatch #</th>
                    <th className="py-3.5 px-4 font-semibold">Order ID Reference</th>
                    <th className="py-3.5 px-4 font-semibold">Customer Client</th>
                    <th className="py-3.5 px-4 font-semibold">Logistic Partner</th>
                    <th className="py-3.5 px-4 font-semibold">LR Number</th>
                    <th className="py-3.5 px-4 font-semibold">Dispatched At</th>
                    <th className="py-3.5 px-4 font-semibold">Expected Arrival</th>
                    <th className="py-3.5 px-4 font-semibold">Track Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasData ? (
                    filteredDispatchData.map((d, idx) => {
                      const dispatchDate = d.dispatchDate || d.dispatchedAt?.split('T')[0] || 'N/A';
                      const expectedDelivery = d.dispatchDate 
                        ? new Date(new Date(d.dispatchDate).getTime() + 4 * 24 * 3600 * 1000).toISOString().split('T')[0] 
                        : 'N/A';
                      return (
                        <tr key={d.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-teal-600 truncate">{d.dispatchNumber || d.id}</td>
                          <td className="py-3 px-4 font-mono text-slate-500 truncate">{d.orderId}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{d.customerName || 'N/A'}</td>
                          <td className="py-3 px-4 text-slate-705 font-medium">{d.transporter || 'Direct Trucking'}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{d.lrNumber || d.LRNumber || 'N/A'}</td>
                          <td className="py-3 px-4 font-mono text-slate-600">{dispatchDate}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{expectedDelivery}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              ['delivered', 'Delivered'].includes(d.status) ? 'bg-green-105 bg-green-100 text-green-700' : 'bg-sky-100 text-sky-700'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center font-mono text-xs text-slate-400 grayscale">
                        NO LOGISTICS DISPATCH RECORDS FOUND IN SELECTED SCOPE
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 select-none text-[11px] font-mono text-slate-500">
              Total Shipped: <span className="font-bold text-slate-700">{filteredDispatchData.length} shipments</span> processed over active time frame.
            </div>
          </div>
        );
      }

      case 'payment': {
        const hasData = filteredPaymentData.length > 0;
        return (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-100 font-mono text-[10px] uppercase tracking-wide border-b border-slate-800">
                    <th className="py-3.5 px-4 font-semibold">Invoice #</th>
                    <th className="py-3.5 px-4 font-semibold">Customer</th>
                    <th className="py-3.5 px-4 font-semibold">Total Net Amount</th>
                    <th className="py-3.5 px-4 font-semibold">Total Paid Amount</th>
                    <th className="py-3.5 px-4 font-semibold">Outstanding Balance</th>
                    <th className="py-3.5 px-4 font-semibold">Due Date</th>
                    <th className="py-3.5 px-4 font-semibold">Status</th>
                    <th className="py-3.5 px-4 font-semibold">Overdue Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasData ? (
                    filteredPaymentData.map((inv, idx) => {
                      const overdueDays = (inv.outstanding > 0 && new Date(inv.dueDate) < new Date())
                        ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24))
                        : 0;
                      return (
                        <tr key={inv.id || idx} className={`transition-colors duration-100 ${
                          overdueDays > 0 ? 'bg-amber-50/50 hover:bg-amber-100/30' : 'hover:bg-slate-50/50'
                        }`}>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                          <td className="py-3 px-4 font-semibold text-slate-805">{inv.customerName}</td>
                          <td className="py-3 px-4 font-mono text-slate-750">₹{inv.total.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 font-mono text-green-600">₹{inv.totalPaid.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 font-mono text-rose-600 font-semibold">₹{inv.outstanding.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{inv.dueDate}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                              inv.status === 'overdue' ? 'bg-rose-100 text-rose-700 animate-pulse' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 font-bold">
                            {overdueDays > 0 ? (
                              <span className="text-rose-500 font-bold">{overdueDays} Days Past Due</span>
                            ) : (
                              <span className="text-slate-400 font-normal">On-Track</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center font-mono text-xs text-slate-400 grayscale">
                        NO PAYMENT OUTSTANDING ENTRIES RECORDED IN INVOICING SCOPE
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 select-none text-[11px] font-mono text-slate-500 flex justify-between">
              <span>Outstanding lines: <span className="font-bold text-slate-700">{filteredPaymentData.length} records</span></span>
              <span className="font-semibold text-rose-600">
                Sum Outstanding: ₹{filteredPaymentData.reduce((s, i) => s + i.outstanding, 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        );
      }

      case 'inventory': {
        const hasData = filteredInventoryData.length > 0;
        return (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-100 font-mono text-[10px] uppercase tracking-wide border-b border-slate-800">
                    <th className="py-3.5 px-4 font-semibold">Item Code</th>
                    <th className="py-3.5 px-4 font-semibold">Material Designation Name</th>
                    <th className="py-3.5 px-4 font-semibold">Category</th>
                    <th className="py-3.5 px-4 font-semibold">Current Level</th>
                    <th className="py-3.5 px-4 font-semibold">Unit</th>
                    <th className="py-3.5 px-4 font-semibold">Standard Unit Cost</th>
                    <th className="py-3.5 px-4 font-semibold">Total Valuation</th>
                    <th className="py-3.5 px-4 font-semibold">Reorder Threshold Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hasData ? (
                    filteredInventoryData.map((item, idx) => {
                      const unitCost = getStockItemUnitCost(item.category);
                      const valuation = item.currentQty * unitCost;
                      const isLowStock = item.currentQty <= item.reorderLevel;

                      return (
                        <tr 
                          key={item.id || idx} 
                          className={`transition-colors duration-100 ${
                            isLowStock 
                              ? 'bg-amber-50/70 hover:bg-amber-50/90 border-r-4 border-amber-500' 
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-slate-450">{item.code || 'N/A'}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{item.name}</td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-150 uppercase tracking-widest">
                              {item.category.toUpperCase().replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{item.currentQty}</td>
                          <td className="py-3 px-4 text-slate-500 font-medium font-mono uppercase">{item.unit}</td>
                          <td className="py-3 px-4 font-mono text-slate-650">₹{unitCost.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 font-mono text-teal-700 font-bold">₹{valuation.toLocaleString('en-IN')}</td>
                          <td className="py-3 px-4 font-mono">
                            {isLowStock ? (
                              <span className="bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded text-[10px] animate-pulse">
                                REORDER REQUESTED
                              </span>
                            ) : (
                              <span className="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                                STOCKED OK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center font-mono text-xs text-slate-400 grayscale">
                        NO DYNAMIC INVENTORY STOCK ITEMS MATCH SELECTION
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 select-none text-[11px] font-mono text-slate-500 flex justify-between items-center">
              <span>Catalog size: <span className="font-bold text-slate-705">{filteredInventoryData.length} items</span></span>
              <span className="font-bold text-teal-700">
                Total Portfolio Asset Value: ₹{filteredInventoryData.reduce((s, i) => s + (i.currentQty * getStockItemUnitCost(i.category)), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        );
      }
    }
  };


  // ==========================================
  // Layout Composition
  // ==========================================

  return (
    <div className="flex flex-col space-y-6">
      {/* Brand Page Title header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-205 pb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display flex items-center space-x-2.5">
            <BarChart3 className="h-7 w-7 text-sky-600" />
            <span>Plant Audit & Execution Reports</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase font-mono tracking-wider">
            SME Governance Console • Real-time Production Summary Ledger
          </p>
        </div>

        {/* Global Export actions */}
        <div className="flex space-x-3">
          <button
            onClick={handleCSVExport}
            className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-205 py-2 px-3.5 rounded-lg text-xs font-mono font-bold uppercase flex items-center space-x-2 cursor-pointer transition-all active:scale-97 select-none"
            title="Download formatted corporate CSV sheet"
          >
            <FileSpreadsheet className="h-4.5 w-4.5 text-green-605" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePDFExport}
            className="bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xs py-2 px-3.5 rounded-lg text-xs font-mono font-bold uppercase flex items-center space-x-2 cursor-pointer transition-all active:scale-97 select-none"
            title="Compile premium plant PDF document"
          >
            <FileText className="h-4.5 w-4.5 text-sky-400" />
            <span>Generate PDF</span>
          </button>
        </div>
      </div>

      {/* Corporate Tab Selectors */}
      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap -mb-px space-x-2 select-none">
          {([
            { id: 'rfq', label: 'RFQ Pipeline Summary', icon: FolderSync },
            { id: 'order', label: 'Order Status Log', icon: Layers },
            { id: 'dispatch', label: 'Logistics summary', icon: Truck },
            { id: 'payment', label: 'Payment Outstanding', icon: Receipt },
            { id: 'inventory', label: 'Stock Valuation Audit', icon: Package },
          ] as const).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Reset filters securely on tab switch
                  setStartDate('');
                  setEndDate('');
                  setSelectedCustomerId('all');
                  setSelectedStatus('all');
                  setSelectedTransporter('all');
                  setSelectedCategory('all');
                }}
                className={`py-3 px-4.5 border-b-2 font-mono text-[11px] uppercase tracking-wider font-bold inline-flex items-center space-x-2 cursor-pointer transition-all ${
                  isActive
                    ? 'border-sky-500 text-sky-600 bg-sky-50/30'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-sky-505' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filter and Option controls */}
      {renderFilters()}

      {/* Responsive Report Frame Table */}
      {renderActiveReportTable()}
    </div>
  );
};
