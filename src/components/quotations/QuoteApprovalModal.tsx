// src/components/quotations/QuoteApprovalModal.tsx

import React, { useState } from 'react';
import { Quote } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { processApprovalStepAction, dispatchApprovalNotification } from '../../services/quoteApprovalService';
import { useUpdateQuotation } from '../../hooks/useQuotations';
import { useToast } from '../../context/ToastContext';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  UserCheck, 
  Layers, 
  FileText, 
  DollarSign, 
  Percent, 
  HelpCircle,
  MessageSquare,
  Building,
  ArrowRight
} from 'lucide-react';

interface QuoteApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote;
  onQuoteUpdated: (updatedQuote: Quote) => void;
}

export const QuoteApprovalModal: React.FC<QuoteApprovalModalProps> = ({
  isOpen,
  onClose,
  quote,
  onQuoteUpdated
}) => {
  const { profile, tenant } = useAuth();
  const { updateQuotation } = useUpdateQuotation();
  const { toastSuccess, toastError, toastInfo } = useToast();

  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);

  if (!isOpen) return null;

  const approvalState = quote.approvalState;
  const steps = approvalState?.steps || [];
  const currentStep = steps.find(s => s.status === 'pending');

  // Check if current user has permissions to approve this pending step
  const userRole = profile?.role || 'viewer';
  const requiredRole = currentStep?.requiredRole;

  // Admin and Management have override permissions across all tiers
  const canApprove = Boolean(profile && (
    userRole === 'admin' ||
    userRole === 'management' ||
    (requiredRole && userRole === requiredRole)
  ));

  const discountPercent = quote.subtotal > 0 && quote.discountTotal 
    ? Math.round((quote.discountTotal / (quote.subtotal + (quote.discountTotal || 0))) * 100) 
    : 0;

  // Handle Approve Action
  const handleApprove = async () => {
    if (!profile || !tenant) return;
    setProcessing(true);

    try {
      const { updatedQuote, isFullyApproved, nextStep } = processApprovalStepAction(
        quote,
        'approved',
        {
          uid: profile.uid,
          name: profile.name || profile.email || 'Approver',
          email: profile.email || '',
          role: profile.role
        },
        comments
      );

      // Persist to Firestore / localStorage
      await updateQuotation(quote.id, {
        status: updatedQuote.status,
        approvalState: updatedQuote.approvalState
      });

      // Dispatch notifications
      await dispatchApprovalNotification({
        tenantId: tenant.id,
        type: 'approved',
        quote: updatedQuote,
        actor: {
          uid: profile.uid,
          name: profile.name || 'Approver',
          email: profile.email || '',
          role: profile.role
        },
        recipientUserId: quote.createdBy,
        comments
      });

      if (isFullyApproved) {
        toastSuccess('Quote Fully Approved!', `${quote.quoteNumber} is now certified for official client dispatch.`);
      } else {
        toastSuccess('Step Approved!', `Advanced to next tier: ${nextStep?.approverTitle}.`);
      }

      onQuoteUpdated(updatedQuote);
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Failed to approve quotation');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Reject Action
  const handleReject = async () => {
    if (!profile || !tenant) return;
    if (!comments.trim()) {
      toastInfo('Feedback Required', 'Please enter comments explaining why this quote was rejected so sales can revise it.');
      return;
    }

    setProcessing(true);

    try {
      const { updatedQuote } = processApprovalStepAction(
        quote,
        'rejected',
        {
          uid: profile.uid,
          name: profile.name || profile.email || 'Approver',
          email: profile.email || '',
          role: profile.role
        },
        comments
      );

      // Persist to Firestore / localStorage
      await updateQuotation(quote.id, {
        status: 'rejected',
        approvalState: updatedQuote.approvalState
      });

      // Dispatch notifications to quote creator
      await dispatchApprovalNotification({
        tenantId: tenant.id,
        type: 'rejected',
        quote: updatedQuote,
        actor: {
          uid: profile.uid,
          name: profile.name || 'Approver',
          email: profile.email || '',
          role: profile.role
        },
        recipientUserId: quote.createdBy,
        comments
      });

      toastSuccess('Quote Rejected', 'Rejection feedback logged. The sales team has been notified to revise the draft.');
      onQuoteUpdated(updatedQuote);
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Failed to reject quotation');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-in font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900 leading-none">
                Quote Approval Workflow
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Ref: {quote.quoteNumber} • Customer: {quote.customerName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-450 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Policy Trigger Banner */}
          {approvalState?.highestTriggeredRuleName && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold uppercase font-mono text-[10px] text-amber-800 tracking-wider block">
                  Commercial Threshold Policy Triggered:
                </span>
                <p className="font-semibold leading-relaxed">
                  {approvalState.highestTriggeredRuleName}
                </p>
                <p className="text-[11px] text-amber-700/90 leading-tight pt-0.5">
                  This quotation exceeds standard sales discretion thresholds and requires multi-level authorization before official client release.
                </p>
              </div>
            </div>
          )}

          {/* Quotation Commercial Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Gross Subtotal</span>
              <span className="font-mono font-bold text-slate-700 text-sm">
                ₹{quote.subtotal.toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Discount Given</span>
              <span className={`font-mono font-bold text-sm ${discountPercent > 10 ? 'text-rose-600' : 'text-slate-700'}`}>
                ₹{(quote.discountTotal || 0).toLocaleString('en-IN')} ({discountPercent}%)
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Tax (GST)</span>
              <span className="font-mono font-bold text-slate-700 text-sm">
                ₹{quote.gstAmount.toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Final Grand Total</span>
              <span className="font-mono font-black text-sky-700 text-base">
                ₹{quote.total.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Multi-Level Approval Chain Stepper */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-150 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700 flex items-center space-x-1.5">
                <Layers className="h-4 w-4 text-sky-600" />
                <span>Approval Chain Steps ({steps.length})</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">
                Current Level: {approvalState?.currentLevel || 1} of {approvalState?.totalLevels || steps.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {steps.map((step, idx) => {
                const isCurrent = step.status === 'pending' && (!steps.slice(0, idx).some(s => s.status === 'pending'));
                const isApproved = step.status === 'approved';
                const isRejected = step.status === 'rejected';

                return (
                  <div 
                    key={step.stepId}
                    className={`p-3.5 rounded-xl border transition-all text-xs ${
                      isCurrent 
                        ? 'border-amber-300 bg-amber-50/40 shadow-xs' 
                        : isApproved 
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : isRejected
                            ? 'border-rose-200 bg-rose-50/30'
                            : 'border-slate-200 bg-slate-50/50 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                          isApproved 
                            ? 'bg-emerald-600 text-white' 
                            : isRejected 
                              ? 'bg-rose-600 text-white' 
                              : isCurrent 
                                ? 'bg-amber-500 text-white ring-2 ring-amber-200' 
                                : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isApproved ? '✓' : isRejected ? '✗' : step.level}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{step.approverTitle}</span>
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-500">
                              Requires: {step.requiredRole.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">{step.ruleName}</span>
                        </div>
                      </div>

                      <div>
                        {isApproved && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>APPROVED</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 flex items-center space-x-1">
                            <XCircle className="h-3 w-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 animate-pulse flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>AWAITING SIGN-OFF</span>
                          </span>
                        )}
                        {!isApproved && !isRejected && !isCurrent && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100">
                            QUEUED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action metadata if completed */}
                    {step.actionBy && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-1">
                        <span>
                          Actioned by: <strong className="text-slate-700">{step.actionBy.name}</strong> ({step.actionBy.role})
                        </span>
                        {step.actionAt && (
                          <span className="font-mono text-[10px] text-slate-400">
                            {new Date(step.actionAt).toLocaleString()}
                          </span>
                        )}
                        {step.comments && (
                          <div className="w-full text-slate-650 bg-white/70 p-1.5 rounded border border-slate-150 mt-1 italic">
                            "{step.comments}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Line Items Summary (Collapsible snippet) */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-450 block">
              Quotation Line Items Breakdown ({quote.items?.length || 0}):
            </span>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-150 border border-slate-200 rounded-xl bg-slate-50/30 text-xs">
              {quote.items?.map((item, idx) => (
                <div key={item.id || idx} className="p-2.5 flex items-center justify-between">
                  <div className="truncate max-w-[320px]">
                    <span className="font-semibold text-slate-800 block truncate">{item.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Qty: {item.quantity} {item.unit || 'pcs'} • Rate: ₹{item.unitPrice}
                    </span>
                  </div>
                  <div className="text-right font-mono font-bold text-slate-800">
                    ₹{item.total.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Input Section for Authorized Reviewers */}
          {quote.status === 'pending_approval' && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
                <span>Approver Notes / Revision Comments:</span>
                <span className="text-[10px] font-normal text-slate-400">
                  {rejectMode ? '(Required for rejection)' : '(Optional for approval)'}
                </span>
              </label>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  rejectMode
                    ? 'State reasons for rejection (e.g., Discount of 18% exceeds factory margin limits; maximum approved is 10%)...'
                    : 'Add optional approval notes or commercial conditions...'
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-sans leading-relaxed"
              />

              {!canApprove && (
                <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-600 flex items-center space-x-2">
                  <HelpCircle className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>
                    Your current profile role (<strong>{userRole}</strong>) does not have authorization rights for this tier. 
                    Approval requires: <strong>{currentStep?.requiredRole.toUpperCase()}</strong> ({currentStep?.approverTitle}).
                  </span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-mono font-bold hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>

          {quote.status === 'pending_approval' && canApprove && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={processing}
                onClick={() => {
                  if (!rejectMode) {
                    setRejectMode(true);
                  } else {
                    handleReject();
                  }
                }}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                <XCircle className="h-4 w-4 text-rose-600" />
                <span>{rejectMode ? 'Confirm Rejection' : 'Reject & Return'}</span>
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={handleApprove}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
              >
                {processing ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Authorize & Approve</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
