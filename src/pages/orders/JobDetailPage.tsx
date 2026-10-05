// src/pages/orders/JobDetailPage.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useJobDetail } from '../../hooks/useProduction';
import { sendWhatsAppNotification } from '../../utils/whatsapp';
import { 
  ArrowLeft, 
  Layers, 
  Calendar, 
  User, 
  Briefcase, 
  MessageSquare, 
  Plus, 
  Clock, 
  CheckCircle,
  Building,
  FileText,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { FileUploader } from '../../components/FileUploader';
import { AttachmentsList } from '../../components/AttachmentsList';
import { FileSymlink } from 'lucide-react';

const defaultStages = [
  { value: 'cutting', label: 'Material Cutting' },
  { value: 'welding', label: 'Pre-Heating & Welding' },
  { value: 'machining', label: 'Precision Machining' },
  { value: 'assembly', label: 'Shopfloor Assembly' },
  { value: 'quality_check', label: 'NDT & Quality Check' },
  { value: 'ready', label: 'Ready for Dispatch' }
];

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { job, order, loading, error, addJobComment, updateJobStage } = useJobDetail(tenant?.id, jobId);

  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [selectedStage, setSelectedStage] = useState('cutting');
  const [stageChangeNotes, setStageChangeNotes] = useState('');
  const [updatingStage, setUpdatingStage] = useState(false);
  const [stageFeedback, setStageFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (job?.currentStage) {
      setSelectedStage(job.currentStage);
    }
  }, [job?.currentStage]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !profile) return;

    setAddingComment(true);
    setFeedback(null);
    try {
      await addJobComment(commentText.trim(), profile.name || 'Operations Lead', profile.uid);
      setCommentText('');
      setFeedback('Comment uploaded to the job timeline.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback(`Error: ${err.message || 'Submission failed'}`);
    } finally {
      setAddingComment(false);
    }
  };

  const handleStageChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !tenant || !job || !updateJobStage) return;

    setUpdatingStage(true);
    setStageFeedback(null);
    try {
      const displayNotes = stageChangeNotes.trim() || `Advanced stage of production to ${selectedStage.toUpperCase()}.`;
      await updateJobStage(
        selectedStage,
        displayNotes,
        profile.uid,
        profile.name || 'Operations Lead'
      );

      // Trigger automatic WhatsApp update alert if contact details exit on parent Order card
      if (order?.phone) {
        const displayLabel = defaultStages.find(s => s.value === selectedStage)?.label || selectedStage;
        await sendWhatsAppNotification({
          recipientName: order.customerName,
          recipientPhone: order.phone,
          templateName: 'production_update',
          tenantId: tenant.id,
          orderId: order.id,
          customerId: (order as any).customerId || '',
          parameters: {
            itemName: job.itemName,
            quantity: job.quantity.toString(),
            orderNumber: order.orderNumber,
            stage: displayLabel
          }
        });
      }

      setStageChangeNotes('');
      setStageFeedback(`Production stage successfully moved to: ${selectedStage.toUpperCase()}`);
      setTimeout(() => setStageFeedback(null), 4000);
    } catch (err: any) {
      setStageFeedback(`Error: ${err.message || 'Stage movement execution failed'}`);
    } finally {
      setUpdatingStage(false);
    }
  };

  const getStageStyle = (st: string) => {
    switch (st) {
      case 'cutting': return 'bg-indigo-50 border-indigo-200 text-indigo-700';
      case 'welding': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'machining': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'assembly': return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'quality_check': return 'bg-pink-50 border-pink-200 text-pink-700';
      case 'ready': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="animate-spin h-8 w-8 border-3 border-indigo-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-slate-450 font-mono uppercase tracking-wider">Syncing workshop node...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="bg-red-50/40 border border-red-200 rounded-xl p-8 max-w-lg mx-auto text-center mt-12 space-y-4">
        <AlertCircle className="h-10 w-10 text-red-600 mx-auto" />
        <h3 className="font-bold text-slate-900">Job Record Unreachable</h3>
        <p className="text-xs text-slate-500">{error || 'Requested job code could not be mapped to this active workspace context'}</p>
        <button
          onClick={() => navigate('/orders')}
          className="px-4 py-2 bg-slate-905 hover:bg-slate-800 text-white font-mono text-[10px] uppercase font-bold tracking-wider rounded-lg transition"
        >
          Return to Board
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/orders')}
          className="inline-flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-450 hover:text-slate-800 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Exit to production list</span>
        </button>

        <span className="font-mono text-[10px] text-slate-400">
          Job context key: {job.id}
        </span>
      </div>

      {/* Main Grid Header info */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">
              Production WIP • Job Item
            </span>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-2">
              {job.itemName}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Confirmed associated with Order Number: <span className="font-mono font-bold text-slate-700">{order?.orderNumber || 'Auto-generated'}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Current Station:</span>
            <span className={`px-3 py-1 font-mono font-extrabold uppercase rounded-full text-[10px] border tracking-wider shadow-2xs ${getStageStyle(job.currentStage)}`}>
              {job.currentStage}
            </span>
          </div>
        </div>

        {/* Essential Job Parameters block */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 font-mono text-xs">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase block">Yield Amount</span>
            <span className="font-bold text-slate-800 text-base">{job.quantity} units</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase block">Allocated Target</span>
            <span className="font-bold text-slate-800">{order?.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Immediate dispatch'}</span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase block">Created On</span>
            <span className="font-medium text-slate-700"> {new Date(job.updatedAt).toLocaleDateString()} </span>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase block">Assigned Handler</span>
            <span className="font-bold text-indigo-600 flex items-center space-x-1">
              <User className="h-3.5 w-3.5" />
              <span>{job.updatedBy === 'system' ? 'A.I. Estimator' : 'Shopfloor Crew'}</span>
            </span>
          </div>
        </div>

      </div>

      {/* Primary Detail Split columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: History log and active shop floor comments (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Timeline Stages progress */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <h3 className="text-xs font-mono font-bold text-slate-450 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="h-4.5 w-4.5 text-indigo-500" />
              <span>Chronological shopfloor work history logs</span>
            </h3>

            {job.stagesHistory && job.stagesHistory.length > 0 ? (
              <div className="relative border-l-2 border-slate-105 pl-5 ml-2.5 space-y-6 pt-1">
                {job.stagesHistory.map((elem, idx) => (
                  <div key={idx} className="relative group">
                    {/* Ring Indicator */}
                    <div className="absolute -left-[27px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-slate-900 group-hover:bg-indigo-600 transition" />
                    
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold tracking-wider text-slate-450 uppercase">
                          STAGE: {elem.stage}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ({elem.updatedAt ? new Date(elem.updatedAt).toLocaleString() : 'System Base'})
                        </span>
                      </div>
                      
                      {elem.notes && (
                        <p className="text-xs text-slate-800 font-mono bg-slate-50 border border-slate-101 p-2.5 rounded-lg">
                          {elem.notes}
                        </p>
                      )}

                      <div className="text-[10px] font-mono text-slate-500 font-bold">
                        Logged by: <span className="text-slate-700">{elem.updatedByName || elem.updatedBy}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 font-mono border border-dashed rounded-xl">
                No stages movement historical notes logged.
              </div>
            )}
          </div>

          {/* New Shopfloor remark annotation trigger */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-450 uppercase tracking-wider flex items-center space-x-1.5">
              <MessageSquare className="h-4.5 w-4.5 text-sky-500" />
              <span>Record bespoke telemetry / foreman update</span>
            </h3>

            <form onSubmit={handlePostComment} className="space-y-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Include custom measurement telemetry specifications, caliper readings, temperature logs, or structural exceptions..."
                rows={3}
                required
                className="w-full text-xs font-mono bg-slate-50 hover:bg-white rounded-lg p-3 border border-slate-200 focus:bg-white focus:outline-hidden leading-relaxed"
              />

              {feedback && (
                <div className="p-2.5 bg-sky-50 border border-sky-150 text-[11px] text-sky-850 rounded font-mono">
                  {feedback}
                </div>
              )}

              <div className="flex justify-end select-none">
                <button
                  type="submit"
                  disabled={addingComment}
                  className="bg-slate-900 border border-slate-950 hover:bg-slate-850 text-white font-mono text-[10px] font-extrabold uppercase tracking-widest px-4 py-2.5 rounded-lg cursor-pointer transition flex items-center space-x-1.5"
                >
                  <Plus className="h-3.5 w-3.5 text-slate-300" />
                  <span>{addingComment ? 'Submitting notes...' : 'Append Operator Log'}</span>
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: Action parameters + context links to quotes & rfqs (1/3 width) */}
        <div className="space-y-6">

          {/* Workshop Control Card: Change production stage */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <Layers className="h-4 w-4 text-indigo-500" />
              <span>Supervisor Stage Control</span>
            </h4>

            <form onSubmit={handleStageChange} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono font-bold text-slate-500 block mb-1.5">Action Stage</label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 hover:bg-white p-2.5 border rounded-lg focus:bg-white focus:outline-hidden"
                >
                  {defaultStages.map(st => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-bold text-slate-500 block mb-1.5">Process Note / Reason</label>
                <textarea
                  value={stageChangeNotes}
                  onChange={(e) => setStageChangeNotes(e.target.value)}
                  placeholder="Notes explaining calipers/QA/inspection outcomes..."
                  rows={2}
                  className="w-full text-xs font-mono bg-slate-50 hover:bg-white p-2.5 border rounded-lg focus:bg-white focus:outline-hidden"
                />
              </div>

              {stageFeedback && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-150 text-[10px] text-indigo-850 rounded font-mono">
                  {stageFeedback}
                </div>
              )}

              <button
                type="submit"
                disabled={updatingStage || selectedStage === job.currentStage}
                className="w-full text-white font-mono text-[10px] font-extrabold uppercase tracking-widest py-2.5 rounded-lg cursor-pointer transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                style={{ 
                  backgroundColor: selectedStage === job.currentStage ? '#e2e8f0' : '#4f46e5', 
                  color: selectedStage === job.currentStage ? '#94a3b8' : '#ffffff' 
                }}
              >
                <span>{updatingStage ? 'Updating Segment...' : 'Update Production Stage'}</span>
              </button>
            </form>
          </div>
          
          {/* Context connections card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <Briefcase className="h-4 w-4 text-indigo-500" />
              <span>Integrations Directory</span>
            </h4>

            <div className="space-y-3.5 text-xs font-mono">
              
              {/* Linked Client B2B customer record */}
              <div className="p-3 bg-slate-50 border border-slate-105 rounded-lg space-y-1">
                <span className="text-[9px] text-slate-400 uppercase block">Associated Customer Liaison</span>
                <span className="font-bold text-slate-900 block font-sans">{order?.customerName || 'B2B Client'}</span>
                {order?.phone && (
                  <span className="text-[10px] text-slate-500 block">📞 {order.phone}</span>
                )}
              </div>

              {/* RFQ reference link */}
              {order?.quoteId && (
                <div className="p-3 bg-slate-50 border border-slate-105 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block">Commercial quote</span>
                    <span className="font-bold text-slate-900 text-[11px]">{order.orderNumber || order.quoteId}</span>
                  </div>
                  <button
                    onClick={() => navigate(`/rfqs/` + order.quoteId)}
                    className="p-1.5 bg-white border rounded hover:text-indigo-650 cursor-pointer"
                    title="View Commercial worksheet parent"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Estimated Invoice Pricing element */}
              <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-lg space-y-1">
                <span className="text-[9px] text-slate-450 uppercase block">Earmarked Contract Valuation</span>
                <div className="text-indigo-950 font-black text-base tracking-tight">
                  ₹{order?.totalAmount?.toLocaleString('en-IN') || ' Bespoke Estimate '}
                </div>
                <span className="text-[9px] text-slate-500 block leading-tight">GST components and handling levies fully verified.</span>
              </div>

            </div>
          </div>

          {/* Card: Job documents & engineering drafts */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-400 tracking-wider flex items-center space-x-1.5">
              <FileSymlink className="h-4 w-4 text-sky-500" />
              <span>Job drawings & specifications</span>
            </h4>
            
            {tenant?.id && (
              <>
                <AttachmentsList 
                  entityType="job" 
                  entityId={jobId!} 
                  tenantId={tenant.id} 
                  userProfile={profile} 
                  userRole={profile?.role} 
                />
                <div className="pt-2">
                  <FileUploader 
                    entityType="job" 
                    entityId={jobId!} 
                    tenantId={tenant.id} 
                    userProfile={profile} 
                  />
                </div>
              </>
            )}
          </div>

          {/* Quick status progress guidelines */}
          <div className="bg-slate-900 text-slate-300 rounded-xl p-5 border border-slate-800 text-xs leading-relaxed space-y-3 font-mono">
            <span className="text-[9px] font-bold text-sky-450 uppercase block tracking-widest">
              Standard operations procedure
            </span>
            <p>
              Please log digital caliper deviations inside structural notes.
              Transitioning complete counts to <span className="text-emerald-450 font-bold font-mono">Ready</span> triggers shipping alerts instantly.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
