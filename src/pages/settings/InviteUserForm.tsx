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
  KeyRound,
  UserCheck2,
  Lock
} from 'lucide-react';
import { 
  getRoleTitle, 
  getRoleBadgeColor, 
  getRoleCapabilities 
} from '../../utils/permissions';

export const InviteUserForm: React.FC = () => {
  const navigate = useNavigate();
  
  // Capture robust auth fallbacks
  const authContext = useAuth() as any;
  const activeTenantId = authContext?.tenant?.id || 
                         (typeof authContext?.tenant === 'string' ? authContext.tenant : null) || 
                         authContext?.profile?.tenantId;

  const { inviteUser, createUserAccount, isAdmin } = useTenantUsers(activeTenantId);

  // Form states
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('operator');
  const [creationMode, setCreationMode] = useState<'create_account' | 'invite'>('create_account');
  const [tempPassword, setTempPassword] = useState('FlowOps@2026');

  // Status indicators
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUserRole(e.target.value as UserRole);
  };

  const currentScope = getRoleCapabilities(userRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFeedback({
        type: 'error',
        message: 'An administrative or manager rank is necessary to authorize new corporate credentials.'
      });
      return;
    }

    if (!userName.trim() || !userEmail.trim()) {
      setFeedback({
        type: 'error',
        message: 'Full name and email are required to configure the user account.'
      });
      return;
    }

    if (creationMode === 'create_account' && (!tempPassword || tempPassword.length < 6)) {
      setFeedback({
        type: 'error',
        message: 'Temporary password must be at least 6 characters.'
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      if (creationMode === 'create_account') {
        await createUserAccount({
          name: userName.trim(),
          email: userEmail.trim().toLowerCase(),
          role: userRole,
          temporaryPassword: tempPassword
        });

        setFeedback({
          type: 'success',
          message: `User account created successfully for "${userName}" with role "${getRoleTitle(userRole)}". Custom claims and credentials have been provisioned!`
        });
      } else {
        await inviteUser(userName.trim(), userEmail.trim().toLowerCase(), userRole);
        
        setFeedback({
          type: 'success',
          message: `Invitation generated successfully for ${userName} as [${getRoleTitle(userRole)}]. Invitation record logged.`
        });
      }
      
      setUserName('');
      setUserEmail('');
      setTempPassword('FlowOps@2026');
      
      // Redirect back to user roster with a slight delay
      setTimeout(() => {
        navigate('/settings/users');
      }, 2500);
      
    } catch (err: any) {
      let errorMessage = err.message || 'Firestore rules permission denied or schema validation failed.';
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        // Fallback to initial message
      }

      setFeedback({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setSubmitting(false);
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
        <span className="text-xs font-mono text-slate-450 uppercase font-semibold">User Account Management</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        
        {/* Main invitation form column */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <Briefcase className="h-4.5 w-4.5 text-sky-600" />
                <span>Create User Account & Role</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure role-based access control (RBAC) with Firebase Auth and custom claims. Each persona will view and access only authorized manufacturing modules.
              </p>
            </div>

            {/* Mode Selector Tab */}
            <div className="flex p-1 bg-slate-100 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setCreationMode('create_account')}
                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  creationMode === 'create_account' 
                    ? 'bg-white text-slate-900 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5 text-sky-600" />
                <span>Direct Account Creation</span>
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('invite')}
                className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  creationMode === 'invite' 
                    ? 'bg-white text-slate-900 shadow-xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Send className="h-3.5 w-3.5 text-sky-600" />
                <span>Send Invitation</span>
              </button>
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
                    {feedback.type === 'success' ? 'Account Provisioned' : 'Action Denied'}
                  </h5>
                  <p className="mt-1 font-sans">{feedback.message}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                id="invite-name"
                label="Full Employee / Operator Name *"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                placeholder="e.g. Vikram Malhotra"
                disabled={submitting}
              />

              <TextField
                id="invite-email"
                label="User Login Email *"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
                placeholder="e.g. vikram.qc@company.com"
                disabled={submitting}
              />

              {creationMode === 'create_account' && (
                <TextField
                  id="invite-temp-password"
                  label="Temporary Password *"
                  type="text"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  disabled={submitting}
                />
              )}

              <div className="space-y-1.5">
                <label htmlFor="invite-role" className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider">
                  Select Role & Clearance Level *
                </label>
                <select
                  id="invite-role"
                  value={userRole}
                  onChange={handleRoleChange}
                  disabled={submitting}
                  className="w-full bg-slate-50 border border-slate-350 hover:border-slate-400 focus:border-sky-500 focus:bg-white h-10 px-3 py-1 text-xs rounded transition-all duration-150 text-slate-800 font-sans"
                >
                  <optgroup label="Target Manufacturing Roles">
                    <option value="admin">Admin (Business Owner) — Global controls, user management & all modules</option>
                    <option value="manager">Manager — Operations oversight, RFQs, production, dispatch, staff roster</option>
                    <option value="operator">Operator — Shopfloor machine lines, active stages advancement & notes</option>
                    <option value="quality_inspector">Quality Inspector — NDT, QC checkpoints, tolerance checks & certificates</option>
                    <option value="store_keeper">Store Keeper — Raw material receipts, inventory adjustments & dispatch</option>
                    <option value="viewer">Viewer — Read-only observation of dashboard, jobs, reports & stock</option>
                  </optgroup>
                  <optgroup label="Pipeline Specialist Roles">
                    <option value="sales">Sales Engineer — RFQs, costing, quotes & customer CRM</option>
                    <option value="production">Production Supervisor — Shopfloor Kanban & routing</option>
                    <option value="dispatch">Dispatch Clerk — Lorry receipts & delivery challans</option>
                  </optgroup>
                </select>
              </div>

              {!isAdmin && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 leading-relaxed font-sans">
                  ⚠️ <strong>Administrator or Manager required</strong>: You are currently logged in with role <strong>{userRole}</strong>. Use the role switcher in the sidebar to test as Admin/Manager.
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => navigate('/settings/users')}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !isAdmin}
                  className="bg-slate-900 border border-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded flex items-center space-x-2 transition-all cursor-pointer h-10"
                >
                  {creationMode === 'create_account' ? (
                    <>
                      <UserCheck2 className="h-3.5 w-3.5" />
                      <span>{submitting ? 'Provisioning...' : 'Provision User Account'}</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>{submitting ? 'Sending...' : 'Send Invitation'}</span>
                    </>
                  )}
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
              <h4 className="text-xs font-bold font-mono text-slate-750 uppercase tracking-widest">Role Clearance Map</h4>
            </div>

            <div className="space-y-1">
              <span className={`text-[10px] font-mono border px-2 py-0.5 rounded-full uppercase font-bold tracking-wider float-right ${getRoleBadgeColor(userRole)}`}>
                {userRole.replace('_', ' ').toUpperCase()}
              </span>
              <h3 className="text-sm font-bold text-slate-800 leading-snug">{currentScope?.title}</h3>
              <p className="text-[10px] font-mono text-teal-650 font-bold uppercase clear-both pt-1">Authorized Capabilities</p>
            </div>

            <ul className="space-y-2.5 pt-1.5">
              {currentScope?.capabilities.map((cap, index) => (
                <li key={index} className="flex items-start space-x-2.5 text-xs text-slate-600 leading-normal">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <span>{cap}</span>
                </li>
              ))}
            </ul>

            <div className="p-3 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-600 leading-relaxed font-mono space-y-1">
              <div className="font-bold text-slate-800 flex items-center space-x-1">
                <Lock className="h-3 w-3 text-sky-500" />
                <span>Custom Claims Security:</span>
              </div>
              <p>
                Token Claim: <code>{`{ role: "${userRole}", tenantId: "${activeTenantId || 'tenant'}" }`}</code>
              </p>
              <p className="text-slate-500">
                Firestore rules evaluate custom token claims to guarantee zero privilege leakage.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};