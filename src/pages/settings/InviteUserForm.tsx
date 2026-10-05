// src/pages/settings/InviteUserForm.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTenantUsers } from '../../hooks/useTenantUsers';
import { TextField } from '../../components/ui/TextField';
import { UserRole } from '../../types';
import { 
  ArrowLeft, 
  Send, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Briefcase,
  Users,
  Search,
  Key,
  Layers,
  Truck,
  FolderSync
} from 'lucide-react';

export const InviteUserForm: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const { inviteUser, isAdmin, loading: hookLoading } = useTenantUsers(tenant?.id);

  // Form states
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('production');

  // Status indicators
  const [inviting, setInviting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUserRole(e.target.value as UserRole);
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'sales': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'production': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'dispatch': return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'management': return 'bg-purple-50 text-purple-800 border-purple-200';
      default: return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  const getRoleScopeDescription = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          title: 'Owner & System Administrator',
          capabilities: [
            'Global parameter profile & Tenant settings controls',
            'Full User Onboarding, Deactivation & Role editing authority',
            'Manufacturing process milestones, checkpoints & WhatsApp config',
            'Full pipeline data read/write & Audit logs visibility'
          ]
        };
      case 'sales':
        return {
          title: 'Sales Engineer',
          capabilities: [
            'Full management of Customers roster and CRM details',
            'Direct creation & capture of RFQs & costing parameters',
            'Draft, customize & download PDF commercial Quotations',
            'View Production Board and dispatch statuses'
          ]
        };
      case 'production':
        return {
          title: 'Shopfloor Supervisor',
          capabilities: [
            'Complete control of Active Kanban Production line',
            'Perform structural checkpoint advancements & routing steps',
            'Annotate and add custom shopfloor notes to jobs',
            'View orders & design specifications'
          ]
        };
      case 'dispatch':
        return {
          title: 'Dispatch & Logistics Clerk',
          capabilities: [
            'Compilation and issuing of Lorry Outward dispatch records',
            'Update dispatch statuses (Pending, Dispatched, Received)',
            'Generate official Challans and cargo loading specifications',
            'View shopfloor production statuses'
          ]
        };
      case 'management':
        return {
          title: 'Plant General Manager',
          capabilities: [
            'Plant-wide efficiency & analytics dashboard access',
            'Read-only inspect access across RFQs, Orders, and Dispatch modules',
            'Audit activity trail logs but cannot write profile data'
          ]
        };
    }
  };

  const currentScope = getRoleScopeDescription(userRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFeedback({
        type: 'error',
        message: 'A administrative rank is necessary to authorize new corporate credentials.'
      });
      return;
    }

    if (!userName.trim() || !userEmail.trim()) {
      setFeedback({
        type: 'error',
        message: 'Name and email are required fields to trigger the invitación.'
      });
      return;
    }

    setInviting(true);
    setFeedback(null);

    try {
      const success = await inviteUser(userName.trim(), userEmail.trim().toLowerCase(), userRole);
      if (success) {
        setFeedback({
          type: 'success',
          message: `Success! Invited ${userName} [${userRole.toUpperCase()}] and logged out-of-band mock notification to developer console.`
        });
        setUserName('');
        setUserEmail('');
        setUserRole('production');
        // Redirect back to user roster with a slight delay so they can read the success state
        setTimeout(() => {
          navigate('/settings/users');
        }, 3000);
      } else {
        setFeedback({
          type: 'error',
          message: 'An unknown Firestore database exception occurred.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Firestore rules permission denied or schema validation failed.'
      });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      
      {/* Header breadcrumb */}
      <div className="flex items-center space-x-3 pb-3 border-b border-slate-200">
        <button
          onClick={() => navigate('/settings/users')}
          className="p-1 px-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded flex items-center space-x-1.5 cursor-pointer text-xs font-mono font-bold uppercase"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Roster</span>
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <span className="text-xs font-mono text-slate-450 uppercase font-semibold">Invite Operator</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        
        {/* Main invitation form column */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <Briefcase className="h-4.5 w-4.5 text-sky-600" />
                <span>Invite Corporate User</span>
              </h2>
              <p className="text-xs text-slate-450 mt-1">
                Authorize new credentials. The platform will dynamically assign the scope checklist to their account node based on the selected role below.
              </p>
            </div>

            {feedback && (
              <div className={`p-4 rounded-lg border text-xs leading-relaxed flex items-start space-x-3 ${
                feedback.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <h5 className="font-bold uppercase tracking-wider font-mono">
                    {feedback.type === 'success' ? 'Invitation Drafted' : 'Action Denied'}
                  </h5>
                  <p className="mt-1 font-sans">{feedback.message}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                id="invite-name"
                label="Full Industrial Name *"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                placeholder="e.g. Ananya Sharma"
                disabled={inviting}
              />

              <TextField
                id="invite-email"
                label="Corporate Email Address *"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
                placeholder="e.g. ananya@company.com"
                disabled={inviting}
              />

              <div className="space-y-1.5">
                <label htmlFor="invite-role" className="block text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                  Assigned Team Scope Role *
                </label>
                <select
                  id="invite-role"
                  value={userRole}
                  onChange={handleRoleChange}
                  disabled={inviting}
                  className="w-full bg-slate-50 border border-slate-350 hover:border-slate-400 focus:border-sky-500 focus:bg-white h-10 px-3 py-1 text-xs rounded transition-all duration-150 text-slate-800 font-sans"
                >
                  <option value="production">Shopfloor Supervisor (Production / Routing)</option>
                  <option value="sales">Sales Engineer (RFQs / Quotation creation)</option>
                  <option value="dispatch">Dispatch Logistics Clerk (Laying Lorry Receipts)</option>
                  <option value="management">Plant General Manager (Analytics & Dashboard)</option>
                  <option value="admin">Plant Owner / System Admin (Global profile & config)</option>
                </select>
              </div>

              {!isAdmin && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 leading-relaxed font-sans">
                  ⚠️ <strong>Administrator required</strong>: You are logged in with role <strong>{userRole}</strong>. Only users possessing administrative Clearance can onboard operator credentials. Use the role switcher first to change role to "Owner / Administrator".
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  disabled={inviting}
                  onClick={() => navigate('/settings/users')}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !isAdmin}
                  className="bg-slate-900 border border-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded flex items-center space-x-2 transition-all cursor-pointer h-10"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{inviting ? 'Onboarding...' : 'Onboard & Send Invite'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Live dynamic roles capabilities visualization column */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-slate-50 border border-slate-250 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
              <ShieldCheck className="h-4.5 w-4.5 text-sky-600" />
              <h4 className="text-xs font-bold font-mono text-slate-750 uppercase tracking-widest">Team Role Scopes</h4>
            </div>

            <div className="space-y-1">
              <span className={`text-[9px] font-mono border px-2 py-0.5 rounded-full uppercase font-bold tracking-wider float-right ${getRoleBadgeColor(userRole)}`}>
                {userRole.toUpperCase()}
              </span>
              <h3 className="text-sm font-bold text-slate-800 leading-snug">{currentScope?.title}</h3>
              <p className="text-[10px] font-mono text-teal-650 font-bold uppercase clear-both pt-1">Authorized Capabilities Checklist</p>
            </div>

            <ul className="space-y-2.5 pt-1.5">
              {currentScope?.capabilities.map((cap, index) => (
                <li key={index} className="flex items-start space-x-2.5 text-xs text-slate-600 leading-normal">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>

            <div className="p-3.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-500 leading-relaxed font-mono">
              ⚡ <strong>Out-of-band communication:</strong> For safety in this environment, invited users are instant mock entities with active credential credentials initialized immediately for role trials.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
