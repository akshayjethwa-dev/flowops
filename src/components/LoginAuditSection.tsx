// src/components/LoginAuditSection.tsx

import React, { useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLoginAuditLogs } from '../hooks/useLoginAuditLogs';
import { UserRole, LoginAuditLog } from '../types';
import { getRoleTitle, getRoleBadgeColor } from '../utils/permissions';
import { convertToCsv, downloadCsvFile } from '../utils/csvExport';
import { 
  ShieldCheck, 
  Search, 
  SlidersHorizontal, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  KeyRound, 
  Lock, 
  Clock, 
  Laptop, 
  Smartphone, 
  Globe, 
  UserCheck, 
  ShieldAlert,
  RotateCw
} from 'lucide-react';

export const LoginAuditSection: React.FC = () => {
  const { tenant } = useAuth();
  const { logs, loading } = useLoginAuditLogs(tenant?.id);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [authProviderFilter, setAuthProviderFilter] = useState<string>('all');

  // KPI Calculations
  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter(l => l.status === 'SUCCESS').length;
    const failed = logs.filter(l => l.status === 'FAILED').length;
    const uniqueUsers = new Set(logs.map(l => l.userEmail)).size;
    return { total, success, failed, uniqueUsers };
  }, [logs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = 
        !searchTerm.trim() ||
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.ipAddress && log.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.errorMessage && log.errorMessage.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchRole = roleFilter === 'all' || log.role === roleFilter;
      const matchStatus = statusFilter === 'all' || log.status === statusFilter;
      const matchProvider = authProviderFilter === 'all' || log.authProvider === authProviderFilter;

      return matchSearch && matchRole && matchStatus && matchProvider;
    });
  }, [logs, searchTerm, roleFilter, statusFilter, authProviderFilter]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const exportRows = filteredLogs.map(l => ({
      Timestamp: l.loginTimestamp,
      UserName: l.userName,
      Email: l.userEmail,
      Role: l.role,
      CustomClaims: JSON.stringify(l.customClaims || {}),
      AuthProvider: l.authProvider,
      Status: l.status,
      ErrorMessage: l.errorMessage || 'N/A',
      IPAddress: l.ipAddress || 'Unknown',
      UserAgent: l.userAgent || 'Unknown'
    }));

    const csvData = convertToCsv(exportRows, {
      Timestamp: 'Timestamp',
      UserName: 'User Name',
      Email: 'Email',
      Role: 'Assigned Role',
      CustomClaims: 'Token Custom Claims',
      AuthProvider: 'Auth Provider',
      Status: 'Status',
      ErrorMessage: 'Error Message',
      IPAddress: 'IP Address',
      UserAgent: 'Client Device'
    });

    downloadCsvFile(csvData, `login-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      });
    } catch {
      return String(ts);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Audit KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
            Total Login Events
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-slate-900">{stats.total}</span>
            <Lock className="h-4 w-4 text-sky-500" />
          </div>
          <span className="text-[10px] text-slate-450">Across all shift shifts</span>
        </div>

        <div className="bg-slate-50 border border-emerald-200/80 rounded-lg p-3.5 space-y-1">
          <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider block">
            Authorized Logins
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-emerald-800">{stats.success}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <span className="text-[10px] text-emerald-600">Passed RBAC clearance</span>
        </div>

        <div className="bg-slate-50 border border-rose-200/80 rounded-lg p-3.5 space-y-1">
          <span className="text-[10px] font-mono font-bold text-rose-700 uppercase tracking-wider block">
            Access Blocks / Failed
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-rose-800">{stats.failed}</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <span className="text-[10px] text-rose-600">Password / policy rejections</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
            Unique Operators
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-slate-900">{stats.uniqueUsers}</span>
            <UserCheck className="h-4 w-4 text-purple-500" />
          </div>
          <span className="text-[10px] text-slate-450">Active credentials</span>
        </div>
      </div>

      {/* Filter and Export Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:max-w-xs shrink-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search operator, email, IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-sky-500 focus:bg-white h-9 px-3 pl-9 rounded text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-700 text-xs h-9 px-2.5 rounded focus:outline-hidden focus:border-sky-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin (Business Owner)</option>
            <option value="manager">Operations Manager</option>
            <option value="operator">Machine Operator</option>
            <option value="quality_inspector">Quality Inspector</option>
            <option value="store_keeper">Store Keeper & Inventory</option>
            <option value="viewer">Auditor & Viewer</option>
            <option value="sales">Sales Engineer</option>
            <option value="production">Production Supervisor</option>
            <option value="dispatch">Dispatch Clerk</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-700 text-xs h-9 px-2.5 rounded focus:outline-hidden focus:border-sky-500"
          >
            <option value="all">All Statuses</option>
            <option value="SUCCESS">Success Only</option>
            <option value="FAILED">Failed / Denied Only</option>
          </select>

          {/* Auth Provider Filter */}
          <select
            value={authProviderFilter}
            onChange={(e) => setAuthProviderFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-700 text-xs h-9 px-2.5 rounded focus:outline-hidden focus:border-sky-500"
          >
            <option value="all">All Providers</option>
            <option value="password">Email & Password</option>
            <option value="google">Google OAuth</option>
            <option value="sandbox">Sandbox Persona</option>
          </select>

          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider px-3.5 h-9 rounded flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white border border-slate-200 rounded-lg">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-slate-900"></div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Auditing authentication security events...
          </p>
        </div>
      ) : filteredLogs.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-180">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User & Email</th>
                <th className="px-4 py-3">Role & Custom Claim</th>
                <th className="px-4 py-3">Auth Provider</th>
                <th className="px-4 py-3">Origin & IP Address</th>
                <th className="px-4 py-3 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLogs.map((log) => {
                const isFail = log.status === 'FAILED';
                return (
                  <tr 
                    key={log.id} 
                    className={`hover:bg-slate-50/60 transition-colors ${
                      isFail ? 'bg-rose-50/25' : ''
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{formatTimestamp(log.loginTimestamp)}</span>
                      </div>
                    </td>

                    {/* User & Email */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800 block">
                          {log.userName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-450 block">
                          {log.userEmail}
                        </span>
                      </div>
                    </td>

                    {/* Role & Claim */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <span className={`inline-block text-[10px] font-sans font-bold border px-2 py-0.5 rounded tracking-wide uppercase ${getRoleBadgeColor(log.role)}`}>
                          {getRoleTitle(log.role)}
                        </span>
                        <span className="block text-[9px] font-mono text-slate-400">
                          claim: <code>role="{log.role}"</code>
                        </span>
                      </div>
                    </td>

                    {/* Auth Provider */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-1.5 font-mono text-[11px] text-slate-600">
                        {log.authProvider === 'google' ? (
                          <span className="inline-flex items-center text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[10px]">
                            Google OAuth
                          </span>
                        ) : log.authProvider === 'sandbox' ? (
                          <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                            Sandbox Switch
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                            Email/Password
                          </span>
                        )}
                      </div>
                    </td>

                    {/* IP & User Agent */}
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 max-w-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1 text-slate-700 font-semibold">
                          <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{log.ipAddress || '127.0.0.1'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 truncate block" title={log.userAgent}>
                          {log.userAgent ? log.userAgent.split(' ')[0] : 'Browser Client'}
                        </span>
                      </div>
                    </td>

                    {/* Result */}
                    <td className="px-4 py-3.5 text-right">
                      {log.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Authorized</span>
                        </span>
                      ) : (
                        <div className="inline-flex flex-col items-end space-y-0.5">
                          <span className="inline-flex items-center space-x-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
                            <AlertTriangle className="h-3 w-3 text-rose-600" />
                            <span>Denied</span>
                          </span>
                          {log.errorMessage && (
                            <span className="text-[10px] text-rose-500 font-sans max-w-44 truncate" title={log.errorMessage}>
                              {log.errorMessage}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-10 text-center space-y-3">
          <Lock className="h-8 w-8 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold font-mono text-slate-700 uppercase">No matching login events found</h4>
            <p className="text-xs text-slate-500">
              Clear your search query or reset the role/status filter to view all authentication attempts.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('all');
              setStatusFilter('all');
              setAuthProviderFilter('all');
            }}
            className="p-1 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 font-mono text-xs font-bold uppercase rounded cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Security Compliance Note */}
      <div className="p-3.5 bg-sky-50 border border-sky-100 rounded-lg text-xs text-sky-850 flex items-start space-x-2.5">
        <ShieldCheck className="h-4.5 w-4.5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-bold font-mono text-sky-900 uppercase text-[11px] block">
            Tamper-Proof Audit Compliance
          </span>
          <p>
            Every user authentication event is cryptographically recorded with assigned token claims (role, tenant identity), IP address, and timestamp. Login records provide ISO 27001 and industrial traceability for manufacturing operations.
          </p>
        </div>
      </div>
    </div>
  );
};