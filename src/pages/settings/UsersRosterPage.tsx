// src/pages/settings/UsersRosterPage.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTenantUsers } from '../../hooks/useTenantUsers';
import { UserRole, TenantUser } from '../../types';
import { 
  UserPlus, 
  Shield, 
  Search, 
  SlidersHorizontal, 
  UserX, 
  UserCheck, 
  Mail, 
  Clock, 
  AlertTriangle, 
  Lock, 
  CheckCircle2, 
  RotateCcw,
  Sliders,
  ChevronDown,
  UserCheck2,
  Trash2
} from 'lucide-react';

export const UsersRosterPage: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const { 
    users, 
    loading, 
    error, 
    updateUserRole, 
    deactivateUser, 
    activateUser,
    isAdmin 
  } = useTenantUsers(tenant?.id);

  // Filters & Interactivity State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Feedback flags
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case 'admin': return 'Owner / Administrator';
      case 'sales': return 'Sales Engineer';
      case 'production': return 'Shopfloor Supervisor';
      case 'dispatch': return 'Dispatch & Logistics';
      case 'management': return 'Plant General Manager';
      default: return r;
    }
  };

  const getRoleBadgeStyle = (r: UserRole) => {
    switch (r) {
      case 'admin': return 'bg-amber-50 border-amber-250 text-amber-800';
      case 'sales': return 'bg-emerald-50 border-emerald-250 text-emerald-800';
      case 'production': return 'bg-indigo-50 border-indigo-250 text-indigo-800';
      case 'dispatch': return 'bg-sky-50 border-sky-250 text-sky-800';
      case 'management': return 'bg-purple-50 border-purple-250 text-purple-800';
      default: return 'bg-slate-50 border-slate-200 text-slate-850';
    }
  };

  const getStatusBadgeStyle = (status: 'Active' | 'Inactive' | 'Invited') => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Invited': return 'bg-amber-100 text-amber-800 border-amber-250';
      case 'Inactive': return 'bg-rose-100 text-rose-800 border-rose-220';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Change Role Callback
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) {
      setErrMsg('Administrative credentials required to tweak roles.');
      return;
    }
    
    setUpdatingId(userId);
    setErrMsg(null);
    setSuccessMsg(null);

    try {
      await updateUserRole(userId, newRole);
      setSuccessMsg(`User role updated successfully to "${getRoleLabel(newRole)}".`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrMsg(err.message || 'Error occurred while saving roles configurations.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Toggle user status: suspend / deactive
  const handleToggleDeactivate = async (u: TenantUser) => {
    if (!isAdmin) {
      setErrMsg('Deactivation authority is limited to administrators.');
      return;
    }

    setErrMsg(null);
    setSuccessMsg(null);
    
    if (u.status === 'Inactive') {
      // Activate
      setUpdatingId(u.id);
      try {
        await activateUser(u.id);
        setSuccessMsg(`Operator account for "${u.name}" has been enabled.`);
        setTimeout(() => setSuccessMsg(null), 3500);
      } catch (err: any) {
        setErrMsg(err.message || 'Error restoring operator.');
      } finally {
        setUpdatingId(null);
      }
    } else {
      // Deactivate
      if (!window.confirm(`Are you sure you want to deactivate and limit workspace access for "${u.name}"? They will lose write access to modules.`)) {
        return;
      }
      setUpdatingId(u.id);
      try {
        await deactivateUser(u.id);
        setSuccessMsg(`Operator credentials for "${u.name}" suspended (Soft-Deactivated).`);
        setTimeout(() => setSuccessMsg(null), 3500);
      } catch (err: any) {
        setErrMsg(err.message || 'Error deactivating operator.');
      } finally {
        setUpdatingId(null);
      }
    }
  };

  // Filter application pipeline
  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    const nameMatch = u.name.toLowerCase().includes(term);
    const emailMatch = u.email.toLowerCase().includes(term);
    const searchMatch = nameMatch || emailMatch;

    const roleMatch = roleFilter === 'all' || u.role === roleFilter;
    const statusMatch = statusFilter === 'all' || u.status === statusFilter;

    return searchMatch && roleMatch && statusMatch;
  });

  const getFriendlyTime = (timeStr?: string) => {
    if (!timeStr) return '--';
    const date = new Date(timeStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6 font-sans">
        {/* Shield Info Block */}
        <div className="pb-4 border-b border-slate-200">
          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
            Corporate Governance
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block mt-1">
            Staff Roster & Users
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Access credentials, system logs and operator shift control configurations are shielded from non-admin accounts.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-250 rounded-xl p-8 max-w-xl mx-auto text-center space-y-4">
          <div className="h-12 w-12 bg-rose-50 border border-rose-200 rounded-full flex items-center justify-center text-rose-500 mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold font-mono text-slate-800 uppercase tracking-widest">Clearance Shield Active</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Only verified <strong>Owner / Administrator</strong> roles have rights to inspect, update or invite users in this plant tenancy.
            </p>
          </div>
          
          <div className="pt-3 border-t border-slate-205/60 mt-3 text-left">
            <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase mb-1.5">💡 testing note:</span>
            <p className="text-[11px] leading-normal text-slate-600 font-sans">
              Use the <strong>"Switch Role Profile"</strong> dropdown panel inside the dark left sidebar to shift your active role to <strong>"Owner / Administrator"</strong>. This will seamlessly unlock the administration workspace immediately.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest block leading-none">
            Corporate Governance
          </span>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight block mt-1">
            Staff Roster & Credentials
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Onboard new shopfloor operators, tweak access controls, edit system permissions, or suspend active credentials securely.
          </p>
        </div>

        <button
          onClick={() => navigate('/settings/users/invite')}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider px-4 h-10 rounded flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs self-start sm:self-center transition-all duration-150"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Invite Team Operator</span>
        </button>
      </div>

      {/* Operational notifications */}
      {(error || errMsg) && (
        <div className="bg-rose-50 border border-rose-220 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-rose-800 uppercase tracking-wider font-mono">Process block</h5>
            <p className="text-xs text-rose-600 mt-0.5 leading-relaxed">{error || errMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start space-x-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-mono">Operations complete</h5>
            <p className="text-xs text-emerald-600 mt-0.5 leading-relaxed">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Roster Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:max-w-xs shrink-0">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-sky-500 focus:bg-white h-10 px-3 pl-9 rounded text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden transition-all duration-150"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3.5 w-full md:w-auto">
          {/* Role filter */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-bold text-slate-450 uppercase">Scope:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-700 text-xs h-9 px-2.5 py-0.5 rounded focus:outline-hidden focus:border-sky-500 transition-colors"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="sales">Sales Engineers</option>
              <option value="production">Shopfloor Supervisors</option>
              <option value="dispatch">Dispatch & Logistics</option>
              <option value="management">Plant Managers</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-bold text-slate-450 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-700 text-xs h-9 px-2.5 py-0.5 rounded focus:outline-hidden focus:border-sky-500 transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active only</option>
              <option value="Invited">Invited / Pending</option>
              <option value="Inactive">Suspended only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Roster Table Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-white border border-slate-202 rounded-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest leading-none">Compiling operator configurations...</p>
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-205 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Operator Details</th>
                <th className="px-5 py-3">Team Scope Role</th>
                <th className="px-5 py-3">Status Badge</th>
                <th className="px-5 py-3">Last Access Record</th>
                <th className="px-5 py-3 text-right">Operational Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.map((u) => (
                <tr 
                  key={u.id}
                  className={`hover:bg-slate-50/50 transition-colors ${
                    u.status === 'Inactive' ? 'bg-slate-50/20 opacity-80' : ''
                  }`}
                >
                  {/* Operator card block */}
                  <td className="px-5 py-4">
                    <div className="flex items-center space-x-3.5">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-extrabold border shrink-0 ${
                        u.status === 'Inactive' 
                          ? 'bg-slate-100 text-slate-400 border-slate-200' 
                          : 'bg-slate-100/80 text-sky-700 border-slate-205'
                      }`}>
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-bold text-slate-800 ${u.status === 'Inactive' ? 'line-through text-slate-450' : ''}`}>
                            {u.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-450 block flex items-center">
                          <Mail className="h-3 w-3 mr-1 text-slate-350" />
                          <span>{u.email}</span>
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Inline role editor dropdown */}
                  <td className="px-5 py-4">
                    {u.status === 'Inactive' ? (
                      <span className={`text-[10px] font-sans font-bold border px-2 py-0.5 rounded tracking-wide uppercase ${getRoleBadgeStyle(u.role)}`}>
                        {getRoleLabel(u.role)}
                      </span>
                    ) : (
                      <div className="relative inline-block w-44">
                        <select
                          value={u.role}
                          disabled={updatingId === u.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="w-full bg-slate-50 hover:bg-slate-100/85 border border-slate-300 disabled:opacity-40 text-[11px] font-sans font-medium h-8.5 px-2 py-0.5 rounded cursor-pointer focus:outline-hidden text-slate-750"
                        >
                          <option value="production">Shopfloor Supervisor</option>
                          <option value="sales">Sales Engineer</option>
                          <option value="dispatch">Dispatch Logistics Clerk</option>
                          <option value="management">Plant General Manager</option>
                          <option value="admin">Owner / Admin</option>
                        </select>
                      </div>
                    )}
                  </td>

                  {/* Status Pill */}
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-mono font-bold border px-2.5 py-0.5 rounded uppercase tracking-wider ${getStatusBadgeStyle(u.status)}`}>
                      {u.status}
                    </span>
                  </td>

                  {/* Last login timestamp */}
                  <td className="px-5 py-4 text-slate-500 font-mono text-[11px]">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-350" />
                      <span>{getFriendlyTime(u.lastLogin || u.invitedAt)}</span>
                    </div>
                  </td>

                  {/* operational actions trigger */}
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleToggleDeactivate(u)}
                        disabled={updatingId === u.id}
                        title={u.status === 'Inactive' ? 'Activate Operator Profile' : 'Suspend Operator Profile'}
                        className={`p-1.5 px-2.5 text-[10px] font-mono font-bold border rounded uppercase transition-all tracking-wider flex items-center space-x-1 cursor-pointer ${
                          u.status === 'Inactive'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/50'
                            : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100/50'
                        }`}
                      >
                        {u.status === 'Inactive' ? (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Activate</span>
                          </>
                        ) : (
                          <>
                            <UserX className="h-3.5 w-3.5" />
                            <span>Deactivate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto border border-slate-205">
            <Search className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold font-mono text-slate-705 uppercase tracking-wider">No matching operators found</h4>
            <p className="text-xs text-slate-450 leading-relaxed">
              Tweak your search query or reset the filter filters to discover the team members.
            </p>
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('all');
              setStatusFilter('all');
            }}
            className="p-1 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 font-mono text-xs font-bold uppercase tracking-wider rounded cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Rules guidelines block */}
      <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-xl space-y-1.5">
        <h5 className="text-xs font-bold text-sky-955 font-mono uppercase tracking-wider flex items-center">
          <Shield className="h-4 w-4 mr-1.5 text-sky-500" />
          <span>Operational Security Guidelines</span>
        </h5>
        <p className="text-xs text-sky-850 leading-relaxed font-sans">
          Tweaking an operator's role takes action instantly across active client nodes. Soft-deactivating a member suspends login capabilities and revokes CRUD permissions under the target Firestore collections immediately (monitored under the strict <code>firestore.rules</code> file).
        </p>
      </div>

    </div>
  );
};
