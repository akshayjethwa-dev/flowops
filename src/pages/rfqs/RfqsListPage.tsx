// src/pages/rfqs/RfqsListPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePaginatedCollectionQuery } from '../../hooks/usePaginatedCollectionQuery';
import { FilterBar } from '../../components/FilterBar';
import { ExportButton } from '../../components/ExportButton';
import { db } from '../../firebase';
import { 
  Plus, 
  ChevronRight, 
  AlertCircle,
  Calendar,
  Inbox
} from 'lucide-react';

export const RfqsListPage: React.FC = () => {
  const { tenant } = useAuth();
  const navigate = useNavigate();

  // Filters setup matching query builder specs
  const [filters, setFilters] = useState<Record<string, any>>({
    search: '',
    status: 'open',
    assignedTo: 'all',
    startDate: '',
    endDate: ''
  });

  // Keep tenantId synced inside filters
  useEffect(() => {
    if (tenant?.id) {
      setFilters(prev => ({ ...prev, tenantId: tenant.id }));
    }
  }, [tenant?.id]);

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  // Use the progressive cursor-restricted pagination hook
  const { 
    data: rfqs, 
    loading, 
    loadingMore, 
    hasMore, 
    error, 
    loadMore 
  } = usePaginatedCollectionQuery<any>('rfqs', {
    filters,
    pageSize: 8,
    sortField: 'createdAt',
    sortDirection: 'desc',
    isSandbox,
    localBackupKey: `rfqs_${tenant?.id}`
  });

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-3">
        <div>
          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
            Corporate Sales Desk
          </span>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mt-1 leading-none">
            Inquiries & RFQ Pool
          </h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Track customer custom design demands, configure metalwork fabrication specs, and assign leads to estimator units.
          </p>
        </div>
        
        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-center">
          <ExportButton
            data={rfqs}
            filenamePrefix="rfqs_master"
            headersMap={{
              rfqNumber: 'RFQ Reference',
              customerName: 'Customer',
              contactName: 'Contact Person',
              phone: 'Phone',
              email: 'Email',
              priority: 'Priority',
              source: 'Origin Source',
              dateReceived: 'Received Date',
              status: 'Workflow Status',
              assignedTo: 'Assigned Handler'
            }}
            label="Export CSV"
          />
          <button
            onClick={() => navigate('/rfqs/new')}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4 text-sky-200 shrink-0" />
            <span>New Inquiry / RFQ</span>
          </button>
        </div>
      </div>

      {/* Dynamic FilterBar component */}
      <FilterBar
        entityType="rfqs"
        tenantId={tenant?.id || 'demo'}
        filters={filters}
        onFilterChange={(updated) => setFilters(updated)}
        onClearFilters={() => setFilters({
          tenantId: tenant?.id || '',
          search: '',
          status: 'open',
          assignedTo: 'all',
          startDate: '',
          endDate: ''
        })}
        searchPlaceholder="Search RFQs by Ref Number, customer company, liaison name..."
        statusOptions={[
          { label: 'Open RFQs', value: 'open' },
          { label: 'All Statuses', value: 'all' },
          { label: 'New', value: 'new' },
          { label: 'In Progress', value: 'in progress' },
          { label: 'Quoted', value: 'quoted' },
          { label: 'Won', value: 'won' }
        ]}
        assigneeOptions={['Anand K.', 'Rajesh S.', 'Vikram M.', 'Sales Admin', 'demo_user']}
      />

      {/* RFQ Database list display */}
      {loading ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl space-y-4">
          <div className="animate-spin h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs text-slate-405 font-mono uppercase tracking-wider">Syncing Inquiry Master Pool...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50/50 border border-red-200 rounded-xl p-8 text-center max-w-lg mx-auto">
          <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-3" />
          <h4 className="font-bold text-slate-900 text-sm">Synchronization Failed</h4>
          <p className="text-[11px] text-slate-500 mt-1">{error}</p>
        </div>
      ) : rfqs.length > 0 ? (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-150 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    <th className="py-3.5 px-5">RFQ Ref</th>
                    <th className="py-3.5 px-5">Customer Entity</th>
                    <th className="py-3.5 px-5">Priority & Channel</th>
                    <th className="py-3.5 px-5">Created/Received</th>
                    <th className="py-3.5 px-5">Status Badge</th>
                    <th className="py-3.5 px-5 text-right pr-6">Command Hub</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rfqs.map((item: any) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/rfqs/${item.id}`)}
                      className="hover:bg-slate-50/25 transition-colors cursor-pointer group"
                    >
                      {/* RFQ Code */}
                      <td className="py-4 px-5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200 group-hover:bg-sky-50 group-hover:text-sky-800 transition">
                          {item.rfqNumber || item.id}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-805 leading-none">{item.customerName}</div>
                        <div className="text-[10px] text-slate-450 mt-1.5 font-mono flex items-center space-x-1">
                          <span>Liaison: {item.contactName || 'Trade Contact'}</span>
                          {item.phone && (
                            <>
                              <span>•</span>
                              <span>{item.phone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Priority & Channel */}
                      <td className="py-4 px-5 align-middle">
                        <div className="flex items-center space-x-2">
                          {/* Priority Badge */}
                          <span className={`inline-flex items-center px-1.5 py-0.2 rounded font-mono font-bold text-[8px] uppercase tracking-wide border ${
                            item.priority === 'High' 
                              ? 'bg-red-50 text-red-755 border-red-100' 
                              : item.priority === 'Medium' 
                              ? 'bg-amber-50 text-amber-705 border-amber-100' 
                              : 'bg-slate-50 text-slate-650 border-slate-150'
                          }`}>
                            {item.priority || 'Low'}
                          </span>

                          {/* Source channel */}
                          <span className="text-[10px] text-slate-455 font-mono">
                            via {item.source || 'Direct Email'}
                          </span>
                        </div>
                      </td>

                      {/* Date received */}
                      <td className="py-4 px-5 align-middle">
                        <div className="flex items-center space-x-1.5 text-slate-600 font-mono text-[10px]">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{item.dateReceived || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A')}</span>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="py-4 px-5 align-middle">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono font-bold text-[8px] uppercase tracking-wider ${
                          item.status === 'New' || item.status === 'pending'
                            ? 'bg-cyan-50 text-cyan-705 border border-cyan-100'
                            : item.status === 'In Progress'
                            ? 'bg-indigo-50 text-indigo-755 border border-indigo-100'
                            : item.status === 'Quoted' || item.status === 'quoted'
                            ? 'bg-emerald-50 text-emerald-705 border border-emerald-100'
                            : item.status === 'Won'
                            ? 'bg-teal-50 text-teal-705 border border-teal-150'
                            : 'bg-slate-100 text-slate-500 border border-slate-205'
                        }`}>
                          {item.status === 'pending' ? 'New' : item.status === 'quoted' ? 'Quoted' : item.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-6 text-right whitespace-nowrap align-middle">
                        <span className="text-[10px] font-mono font-bold text-sky-600 inline-flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Details</span>
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Load More Pagination controller */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-mono text-[10.5px] uppercase font-bold tracking-wider rounded-xl transition-all shadow-xs shrink-0 flex items-center space-x-2 disabled:cursor-not-allowed cursor-pointer"
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Syncing Next segment...</span>
                  </>
                ) : (
                  <span>Load More RFQs</span>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl max-w-2xl mx-auto space-y-4">
          <div className="h-12 w-12 bg-sky-50 text-sky-650 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <Inbox className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto p-4">
            <h4 className="font-bold text-slate-900 text-sm">No RFQ Records Match</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              No matching business inquiry, RFP costing sheets, or technical parameters found under the current filters.
            </p>
          </div>
          <button
            onClick={() => navigate('/rfqs/new')}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] font-mono uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition shadow-sm inline-flex items-center space-x-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Onboard RFQ Prospect</span>
          </button>
        </div>
      )}

    </div>
  );
};
