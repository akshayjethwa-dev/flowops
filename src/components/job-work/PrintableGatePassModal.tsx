// src/components/job-work/PrintableGatePassModal.tsx

import React, { useRef, useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Building2, 
  Truck, 
  FileCheck, 
  ShieldCheck, 
  Barcode, 
  Copy, 
  Calendar,
  Check
} from 'lucide-react';
import { JobWorkGatePass } from '../../types/jobWork';
import { useAuth } from '../../hooks/useAuth';

interface PrintableGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  gatePass: JobWorkGatePass | null;
}

export const PrintableGatePassModal: React.FC<PrintableGatePassModalProps> = ({
  isOpen,
  onClose,
  gatePass
}) => {
  const { tenant } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [copyType, setCopyType] = useState<'Original for Consignee' | 'Duplicate for Transporter' | 'Triplicate for Consignor (Factory)'>('Original for Consignee');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !gatePass) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const companyName = tenant?.companyName || 'Ashrey FlowWorks Pvt Ltd';
  const companyGst = tenant?.gstin || '27AAACA9921B1Z2';
  const companyAddress = tenant?.address || 'Plot E-14, Chakan Industrial Area Phase 2, Pune, Maharashtra 410501';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Modal Controls Bar (Hidden during print) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-lg text-indigo-300">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Print Gate Pass (Challan)</span>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-mono">
                  {gatePass.gatePassNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Formal Job Work Delivery Challan as per Rule 45 CGST</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Copy Selector */}
            <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
              {(['Original for Consignee', 'Duplicate for Transporter', 'Triplicate for Consignor (Factory)'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCopyType(type)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    copyType === type ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type.split(' ')[0]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Challan
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE BODY */}
        <div ref={printRef} className="p-8 max-h-[85vh] overflow-y-auto bg-white print:p-0 print:max-h-none print:overflow-visible text-slate-900">
          
          {/* Header Card */}
          <div className="border-2 border-slate-900 p-6 rounded-lg space-y-6">
            
            {/* Top Bar: Challan Copy & Title */}
            <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 border border-slate-400 px-2 py-0.5 rounded">
                  {copyType}
                </span>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1 uppercase">
                  DELIVERY CHALLAN FOR JOB WORK
                </h1>
                <p className="text-xs font-medium text-slate-600">
                  (Issued under Section 143 of CGST Act, 2017 & Rule 45 of CGST Rules, 2017)
                </p>
              </div>

              <div className="text-right sm:text-right">
                <div className="text-xs font-semibold text-slate-500 uppercase">Challan / Gate Pass No.</div>
                <div className="text-xl font-mono font-black text-indigo-900 tracking-wider">
                  {gatePass.gatePassNumber}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Status: <span className="font-bold uppercase">{gatePass.status}</span>
                </div>
              </div>
            </div>

            {/* Consignor and Consignee 2-Column Matrix */}
            <div className="grid grid-cols-2 gap-6 border-b border-slate-300 pb-4 text-xs">
              
              {/* Consignor (Sender Factory) */}
              <div className="space-y-1">
                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  Consignor (Principal Manufacturer)
                </div>
                <div className="font-bold text-sm text-slate-900">{companyName}</div>
                <div className="text-slate-700">{companyAddress}</div>
                <div className="pt-1">
                  <span className="font-semibold text-slate-900">GSTIN: </span>
                  <span className="font-mono">{companyGst}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">State / Code: </span>
                  <span>Maharashtra (27)</span>
                </div>
              </div>

              {/* Consignee (Job Worker / Vendor) */}
              <div className="space-y-1 border-l border-slate-200 pl-6">
                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  Consignee (Job Worker / Processor)
                </div>
                <div className="font-bold text-sm text-slate-900">{gatePass.jobWorkerName}</div>
                <div className="text-slate-700">{gatePass.jobWorkerAddress || 'Works at Vendor Facility'}</div>
                <div className="pt-1">
                  <span className="font-semibold text-slate-900">GSTIN: </span>
                  <span className="font-mono">{gatePass.jobWorkerGst || 'Unregistered / Exempt'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Contact Person: </span>
                  <span>{gatePass.jobWorkerContactPerson || 'Production Head'} {gatePass.jobWorkerPhone ? `(${gatePass.jobWorkerPhone})` : ''}</span>
                </div>
              </div>
            </div>

            {/* Gate Pass Dispatch Details Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Dispatch Date</span>
                <span className="font-semibold text-slate-900">{gatePass.dispatchedDate}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Expected Return Date</span>
                <span className="font-bold text-indigo-900">{gatePass.expectedReturnDate}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Job Work Order Ref</span>
                <span className="font-semibold text-slate-900">{gatePass.linkedJobWorkOrderNumber || 'Standalone Job Work'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Work Order / Job</span>
                <span className="font-semibold text-slate-900">{gatePass.linkedWorkOrderNumber || 'N/A'}</span>
              </div>
            </div>

            {/* Nature of Processing */}
            <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-lg text-xs flex items-center justify-between">
              <div>
                <span className="font-bold uppercase tracking-wider text-[10px] text-indigo-700 block">
                  Nature of Job Work / Processing to be Done:
                </span>
                <span className="font-extrabold text-sm text-indigo-950">
                  {gatePass.natureOfWork}
                </span>
              </div>
              <span className="px-2.5 py-1 bg-white border border-indigo-300 rounded font-semibold text-[11px] text-indigo-900">
                Outward for Processing
              </span>
            </div>

            {/* Transport & Vehicle Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-slate-200 p-3 rounded-lg">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Transport Mode</span>
                <span className="font-semibold capitalize">{gatePass.vehicleDetails.modeOfTransport}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Transporter Name</span>
                <span className="font-semibold">{gatePass.vehicleDetails.transporterName || 'Direct Factory Pickup'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Vehicle Number</span>
                <span className="font-mono font-bold text-slate-900">{gatePass.vehicleDetails.vehicleNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Driver Name & Phone</span>
                <span className="font-medium">
                  {gatePass.vehicleDetails.driverName || 'N/A'} {gatePass.vehicleDetails.driverPhone ? `(${gatePass.vehicleDetails.driverPhone})` : ''}
                </span>
              </div>
              {gatePass.vehicleDetails.lrNumber && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">LR / Bilty No</span>
                  <span className="font-mono font-semibold">{gatePass.vehicleDetails.lrNumber}</span>
                </div>
              )}
              {gatePass.vehicleDetails.ewayBillNumber && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">E-Way Bill Number</span>
                  <span className="font-mono font-bold text-indigo-900">{gatePass.vehicleDetails.ewayBillNumber}</span>
                </div>
              )}
            </div>

            {/* Material Items Table */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Particulars of Goods Dispatched
              </div>
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 px-3 py-2 text-center w-12">S.No</th>
                    <th className="border border-slate-300 px-3 py-2 text-left">Item Code / SKU</th>
                    <th className="border border-slate-300 px-3 py-2 text-left">Description of Goods</th>
                    <th className="border border-slate-300 px-3 py-2 text-left">Batch / Heat No</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Quantity</th>
                    <th className="border border-slate-300 px-3 py-2 text-center w-16">UOM</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Rate (₹)</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Indicative Value (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {gatePass.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 px-3 py-2 text-center font-medium">{idx + 1}</td>
                      <td className="border border-slate-300 px-3 py-2 font-mono font-semibold text-slate-900">{item.materialCode}</td>
                      <td className="border border-slate-300 px-3 py-2 font-medium">
                        <div>{item.materialName}</div>
                        {item.remarks && <div className="text-[11px] text-slate-500 italic mt-0.5">{item.remarks}</div>}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700">{item.batchHeatNo || '—'}</td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-bold text-slate-950">{item.quantity}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700 uppercase">{item.uom}</td>
                      <td className="border border-slate-300 px-3 py-2 text-right text-slate-700 font-mono">
                        {item.ratePerUnit ? `₹${item.ratePerUnit.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-semibold text-slate-900 font-mono">
                        {item.totalValue ? `₹${item.totalValue.toLocaleString('en-IN')}` : '—'}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Totals Row */}
                  <tr className="bg-slate-100 font-bold text-slate-950">
                    <td colSpan={4} className="border border-slate-300 px-3 py-2 text-right uppercase">
                      Total Dispatched Quantity & Value:
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-black text-sm">
                      {gatePass.totalDispatchedQty}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center">
                      {gatePass.items[0]?.uom || ''}
                    </td>
                    <td className="border border-slate-300 px-3 py-2"></td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono font-black text-sm">
                      {gatePass.totalEstimatedValue > 0 ? `₹${gatePass.totalEstimatedValue.toLocaleString('en-IN')}` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Statutory Terms & Declaration */}
            <div className="border border-slate-300 p-3 rounded bg-slate-50 text-[11px] text-slate-700 space-y-1">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                Statutory Declaration under Rule 45 of CGST Rules, 2017:
              </div>
              <p>
                1. We hereby certify that the above goods are sent for Job Work / treatment only and NOT FOR SALE.
              </p>
              <p>
                2. The Job Worker is required to return the goods after processing within 1 year (or 3 years for Capital Goods) as prescribed under Section 143 of the CGST Act, 2017.
              </p>
              <p>
                3. Any process loss, scrap, or waste generated during processing must be accounted for and returned or invoiced as per agreed terms.
              </p>
              {gatePass.internalRemarks && (
                <p className="font-semibold text-indigo-900 pt-1">
                  Notes: {gatePass.internalRemarks}
                </p>
              )}
            </div>

            {/* 4 Signatures Columns */}
            <div className="grid grid-cols-4 gap-4 pt-8 text-center text-xs">
              <div className="border-t border-slate-400 pt-2">
                <div className="font-bold text-slate-900">Prepared By (Stores)</div>
                <div className="text-[11px] text-slate-500 mt-1">{gatePass.createdByName}</div>
                <div className="text-[10px] text-slate-400">{gatePass.dispatchedDate}</div>
              </div>

              <div className="border-t border-slate-400 pt-2">
                <div className="font-bold text-slate-900">Authorized Signatory</div>
                <div className="text-[11px] text-slate-500 mt-1">For {companyName}</div>
                <div className="text-[10px] text-slate-400">Sign & Stamp</div>
              </div>

              <div className="border-t border-slate-400 pt-2">
                <div className="font-bold text-slate-900">Transporter / Driver</div>
                <div className="text-[11px] text-slate-500 mt-1">Materials Loaded & Checked</div>
                <div className="text-[10px] text-slate-400">Signature</div>
              </div>

              <div className="border-t border-slate-400 pt-2">
                <div className="font-bold text-slate-900">Received By (Job Worker)</div>
                <div className="text-[11px] text-slate-500 mt-1">{gatePass.jobWorkerName}</div>
                <div className="text-[10px] text-slate-400">Signature & Official Seal</div>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between no-print">
          <div className="text-xs text-slate-500">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Ctrl + P</kbd> to print immediately or click Print Challan.
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Challan Now
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
