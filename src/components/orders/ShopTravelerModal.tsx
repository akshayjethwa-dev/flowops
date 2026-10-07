// src/components/orders/ShopTravelerModal.tsx

import React from 'react';
import { 
  X, 
  Printer, 
  Layers, 
  QrCode, 
  Barcode, 
  CheckCircle2, 
  Clock, 
  Building2,
  Boxes
} from 'lucide-react';
import { WorkOrder } from '../../types/workOrder';

interface ShopTravelerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  companyName?: string;
}

export const ShopTravelerModal: React.FC<ShopTravelerModalProps> = ({
  isOpen,
  onClose,
  workOrder,
  companyName = 'Ashrey FlowOps Precision Manufacturing'
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-scale-up font-sans print:border-none print:shadow-none print:max-w-none print:max-h-none print:rounded-none">
        
        {/* Modal Top Control Bar (Hidden on print) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center space-x-2 font-mono text-xs font-bold">
            <span className="text-indigo-400 bg-indigo-950/60 border border-indigo-800 px-2 py-0.5 rounded uppercase">
              Shop Traveler & Routing Slip
            </span>
            <span className="text-slate-400">{workOrder.orderNumber}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs uppercase font-bold tracking-wider px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Traveler Slip</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Viewport */}
        <div className="p-8 overflow-y-auto space-y-6 text-slate-900 text-xs flex-1 bg-white print:p-4">
          
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block">
                {companyName}
              </span>
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 mt-0.5">
                Shopfloor Production Traveler
              </h1>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Move with lot batch across machining, outside processing, and inspection bays.
              </p>
            </div>

            <div className="text-right flex flex-col items-end shrink-0">
              {/* Pseudo Barcode Visual */}
              <div className="border-2 border-slate-900 px-3 py-1.5 rounded font-mono text-center bg-slate-50">
                <div className="h-7 w-44 flex items-center justify-center space-x-1 overflow-hidden">
                  {/* Visual barcode stripes */}
                  <div className="w-1 h-7 bg-slate-900"></div>
                  <div className="w-0.5 h-7 bg-slate-900"></div>
                  <div className="w-2 h-7 bg-slate-900"></div>
                  <div className="w-0.5 h-7 bg-slate-900"></div>
                  <div className="w-1.5 h-7 bg-slate-900"></div>
                  <div className="w-1 h-7 bg-slate-900"></div>
                  <div className="w-3 h-7 bg-slate-900"></div>
                  <div className="w-0.5 h-7 bg-slate-900"></div>
                  <div className="w-1 h-7 bg-slate-900"></div>
                  <div className="w-2 h-7 bg-slate-900"></div>
                  <div className="w-0.5 h-7 bg-slate-900"></div>
                  <div className="w-1.5 h-7 bg-slate-900"></div>
                  <div className="w-2 h-7 bg-slate-900"></div>
                  <div className="w-0.5 h-7 bg-slate-900"></div>
                  <div className="w-1 h-7 bg-slate-900"></div>
                  <div className="w-2 h-7 bg-slate-900"></div>
                </div>
                <span className="text-xs font-black tracking-widest text-slate-900 block mt-0.5">
                  *{workOrder.orderNumber}*
                </span>
              </div>
            </div>
          </div>

          {/* Reference Meta Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs font-mono">
            <div>
              <span className="text-[9.5px] uppercase text-slate-400 block font-bold">Work Order #</span>
              <span className="font-bold text-slate-900 text-sm">{workOrder.orderNumber}</span>
            </div>
            <div>
              <span className="text-[9.5px] uppercase text-slate-400 block font-bold">Sales Order Link</span>
              <span className="font-bold text-indigo-700 text-sm">
                SO #{workOrder.salesOrderNumber || workOrder.salesOrderId}
              </span>
            </div>
            <div>
              <span className="text-[9.5px] uppercase text-slate-400 block font-bold">Customer Name</span>
              <span className="font-bold text-slate-900">{workOrder.customerName}</span>
            </div>
            <div>
              <span className="text-[9.5px] uppercase text-slate-400 block font-bold">Customer PO Ref</span>
              <span className="font-bold text-slate-800">{workOrder.customerPoNumber || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[9.5px] uppercase text-slate-400 block font-bold">Part Component</span>
              <span className="font-bold text-slate-900">{workOrder.partName}</span>
            </div>
            <div>
              <span className="text-[9.5px] uppercase text-slate-400 block font-bold">Part Code</span>
              <span className="font-bold text-slate-700">{workOrder.partCode || '—'}</span>
            </div>
            <div>
              <span className="text-[9.5px] uppercase text-slate-400 block font-bold">Batch Target Quantity</span>
              <span className="font-black text-slate-900 text-sm">{workOrder.quantity} pcs</span>
            </div>
            <div>
              <span className="text-[9.5px] uppercase text-slate-400 block font-bold">Target Due Date</span>
              <span className="font-bold text-slate-900">
                {workOrder.dueDate ? new Date(workOrder.dueDate).toLocaleDateString('en-IN') : 'Standard'}
              </span>
            </div>
          </div>

          {/* Exploded BOM Components Summary */}
          {workOrder.bomItems && workOrder.bomItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-1.5">
                <Boxes className="h-4 w-4 text-slate-600" />
                <h3 className="font-mono text-xs uppercase font-bold text-slate-900 tracking-wider">
                  Exploded Bill of Materials (BOM) Requirements
                </h3>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-[9px] font-mono uppercase font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2">Part Number</th>
                      <th className="p-2">Description / Material Grade</th>
                      <th className="p-2">Type</th>
                      <th className="p-2 text-right">Req Qty</th>
                      <th className="p-2 text-right">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[10.5px]">
                    {workOrder.bomItems.map((b) => (
                      <tr key={b.id}>
                        <td className="p-2 font-bold text-slate-800">{b.partNumber}</td>
                        <td className="p-2 font-sans text-slate-700">
                          {b.description} {b.materialGrade ? `(${b.materialGrade})` : ''}
                        </td>
                        <td className="p-2 uppercase text-[9px] text-slate-500">{b.itemType}</td>
                        <td className="p-2 text-right font-black text-slate-900">
                          {b.totalRequiredQuantity} {b.unit}
                        </td>
                        <td className="p-2 text-right">
                          <span className={`text-[9.5px] font-bold uppercase ${
                            b.allocatedStatus === 'allocated' ? 'text-emerald-700' : 'text-amber-700'
                          }`}>
                            {b.allocatedStatus || 'allocated'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Manufacturing Operations Routing Sign-Off Table */}
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 border-b border-slate-200 pb-1.5">
              <Layers className="h-4 w-4 text-slate-600" />
              <h3 className="font-mono text-xs uppercase font-bold text-slate-900 tracking-wider">
                Manufacturing Operations Sequence & Sign-Off
              </h3>
            </div>

            <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-900 text-white text-[9px] font-mono uppercase font-bold">
                  <tr>
                    <th className="p-2.5 w-12 text-center border-r border-slate-700">Seq</th>
                    <th className="p-2.5 border-r border-slate-700">Operation / Machine Cell</th>
                    <th className="p-2.5 w-24 border-r border-slate-700 text-center">Std Time</th>
                    <th className="p-2.5 w-24 border-r border-slate-700 text-center">Operator Sign</th>
                    <th className="p-2.5 w-24 border-r border-slate-700 text-center">QC Check</th>
                    <th className="p-2.5 w-24 text-center">Passed / Reject</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {workOrder.operations
                    .slice()
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((op) => {
                      const isDone = op.status === 'completed';

                      return (
                        <tr key={op.id} className="min-h-[44px]">
                          <td className="p-2.5 text-center font-black bg-slate-50 border-r border-slate-200">
                            {op.sequence}
                          </td>
                          <td className="p-2.5 border-r border-slate-200">
                            <span className="font-bold font-sans text-slate-900 block text-xs">
                              {op.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {op.workCenterName || 'Machine Cell'}
                              {op.isSubcontracted && ` • [OUTSIDE SUBCONTRACT: ${op.subcontractorName || 'Vendor'}]`}
                            </span>
                          </td>
                          <td className="p-2.5 text-center text-slate-600 border-r border-slate-200">
                            {op.standardTimeMinutes} min
                          </td>
                          <td className="p-2.5 text-center border-r border-slate-200">
                            {isDone ? (
                              <span className="text-emerald-700 font-bold text-[10px]">
                                {op.startedByName || 'Signed'}
                              </span>
                            ) : (
                              <div className="h-6 border-b border-dashed border-slate-300"></div>
                            )}
                          </td>
                          <td className="p-2.5 text-center border-r border-slate-200">
                            {isDone ? (
                              <span className="text-emerald-700 font-bold text-[10px]">PASSED</span>
                            ) : (
                              <div className="h-6 border-b border-dashed border-slate-300"></div>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {isDone ? (
                              <span className="font-black text-slate-900">{workOrder.quantityCompleted || workOrder.quantity} / 0</span>
                            ) : (
                              <div className="h-6 border-b border-dashed border-slate-300"></div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Authorization & Signatures Strip */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-slate-900 font-mono text-[10.5px]">
            <div className="space-y-1">
              <span className="text-slate-400 uppercase text-[9px] block">Production Planner</span>
              <div className="h-8 border-b border-slate-400 flex items-end font-bold text-slate-900">
                {workOrder.updatedByName || 'Authorized Planner'}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 uppercase text-[9px] block">Shopfloor Foreman</span>
              <div className="h-8 border-b border-slate-400"></div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 uppercase text-[9px] block">Final QA Inspector</span>
              <div className="h-8 border-b border-slate-400"></div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
