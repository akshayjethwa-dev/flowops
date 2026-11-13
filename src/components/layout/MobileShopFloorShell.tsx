import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useWorkOrders, WorkOrder, WorkOrderStatus } from '../../hooks/useWorkOrders';
import { useOee } from '../../hooks/useOee';
import { DowntimeEventRecord } from '../../types/oee';
import { useShiftHandover } from '../../hooks/useShiftHandover';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { qualityHoldService } from '../../services/qualityHoldService';
import {
  ClipboardList,
  PlayCircle,
  AlertOctagon,
  ShieldCheck,
  RotateCw,
  Clock,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Download,
  Share2,
  X,
  Plus,
  Minus,
  Laptop,
  LogOut,
  ChevronDown,
  Wrench,
  Flame,
  Zap,
  Activity,
  CheckSquare,
  Square,
  Check,
  ArrowRight,
  Forward,
  ShieldAlert,
  Search,
  Users,
  Boxes,
  FileText,
  Ruler,
  Settings,
  Edit2,
  Trash2,
  PlusCircle,
  CheckCircle2,
  Tag,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export interface MobileShopFloorShellProps {
  onSwitchToDesktop?: () => void;
}

type ShopFloorTab = 'queue' | 'advance' | 'downtime' | 'signoff';

export const MobileShopFloorShell: React.FC<MobileShopFloorShellProps> = ({
  onSwitchToDesktop
}) => {
  const { profile, tenant, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<ShopFloorTab>('queue');

  // Work Orders & Production hook
  const {
    workOrders,
    loading: woLoading,
    updateOperation,
    updateWorkOrder
  } = useWorkOrders(tenant?.id);

  // OEE & Downtime hook
  const {
    machines,
    downtimeReasons,
    downtimeEvents,
    logDowntimeEvent,
    resolveDowntimeEvent,
    resolveDowntimeEventForJob,
    getActiveDowntimeEventForJob,
    getDowntimeSummaryToday,
    autoCloseOverdueDowntimeEvents,
    addDowntimeReason,
    updateDowntimeReason,
    toggleDowntimeReasonActive,
    deleteDowntimeReason,
    setMachineState
  } = useOee();

  // Shift Handover hook
  const { createHandover, getAutoDraft } = useShiftHandover();

  // Network & Offline Queue hook (EC 2)
  const {
    isOnline,
    isSyncing,
    queuedActionsCount,
    queueAction,
    flushQueue
  } = useOnlineStatus();

  // PWA Installability hook
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Selected workstation filter
  const [selectedWorkstation, setSelectedWorkstation] = useState<string>('all');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Auto-dismiss notification banner
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Current Shift calculation
  const currentShiftInfo = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 6 && hour < 14) {
      return { code: 'shift_a', label: 'Shift A (Morning)', window: '06:00 - 14:00' };
    } else if (hour >= 14 && hour < 22) {
      return { code: 'shift_b', label: 'Shift B (Afternoon)', window: '14:00 - 22:00' };
    } else {
      return { code: 'shift_c', label: 'Shift C (Night)', window: '22:00 - 06:00' };
    }
  }, []);

  // Distinct Workstations list from work orders and machines
  const availableWorkstations = useMemo(() => {
    const set = new Set<string>();
    workOrders.forEach(wo => {
      wo.operations?.forEach(op => {
        if (op.workCenterName) set.add(op.workCenterName);
      });
    });
    machines.forEach(m => {
      if (m.machineName) set.add(m.machineName);
    });
    return Array.from(set);
  }, [workOrders, machines]);

  // Priority sort weights
  const priorityWeight: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  // Filter and sort jobs for "My Queue"
  const queueJobs = useMemo(() => {
    return workOrders
      .filter(wo => {
        if (wo.status === 'completed' || wo.status === 'cancelled') return false;
        if (selectedWorkstation !== 'all') {
          const hasOp = wo.operations?.some(
            op => op.workCenterName?.toLowerCase() === selectedWorkstation.toLowerCase()
          );
          return hasOp;
        }
        return true;
      })
      .sort((a, b) => {
        // In-progress first, then priority, then due date
        if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
        if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;

        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) return weightB - weightA;

        return (a.dueDate || '').localeCompare(b.dueDate || '');
      });
  }, [workOrders, selectedWorkstation]);

  // Selected job for Advance tab
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const activeJob = useMemo(() => {
    if (selectedJobId) {
      return workOrders.find(w => w.id === selectedJobId) || queueJobs[0] || null;
    }
    return queueJobs.find(w => w.status === 'in_progress') || queueJobs[0] || null;
  }, [selectedJobId, workOrders, queueJobs]);

  // Quantity counter state for Advance tab
  const [advancePieces, setAdvancePieces] = useState<number>(10);
  const [scrapPieces, setScrapPieces] = useState<number>(0);
  const [scrapReason, setScrapReason] = useState<string>('Dimensional Non-Conformance');

  // One-Tap Stage Advance Debounce & State (EC 3)
  const lastAdvanceTapRef = useRef<number>(0);
  const [isAdvancingStage, setIsAdvancingStage] = useState(false);

  // Hold reason selection modal state (US-8.3)
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReasonSelection, setHoldReasonSelection] = useState<string>('Tool Wear / Broken Insert');
  const [holdNotesInput, setHoldNotesInput] = useState<string>('');

  // Simulated QC Block state (to allow easy toggling/testing in UI)
  const [testQcBlockActive, setTestQcBlockActive] = useState<boolean>(false);

  // Stage resolution for active job (AC 1 & Flow)
  const currentOpIndex = useMemo(() => {
    if (!activeJob || !activeJob.operations?.length) return 0;
    const inProgIdx = activeJob.operations.findIndex(o => o.status === 'in_progress');
    if (inProgIdx >= 0) return inProgIdx;
    const pendingIdx = activeJob.operations.findIndex(o => o.status === 'pending' || o.status === 'ready');
    return pendingIdx >= 0 ? pendingIdx : activeJob.operations.length - 1;
  }, [activeJob]);

  const currentOp = activeJob?.operations[currentOpIndex] || null;
  const nextOp = activeJob?.operations[currentOpIndex + 1] || null;

  const currentStageName = currentOp?.name || 'Molding';
  const nextStageName = nextOp ? nextOp.name : 'Finished Goods QC / Dispatch Stage';
  const currentWorkstation = currentOp?.workCenterName || 'Primary Cell';
  const nextWorkstation = nextOp?.workCenterName || 'Secondary Cell';

  // EC 5: Next stage requires different workstation check
  const isDifferentWorkstation = Boolean(
    nextOp &&
    nextOp.workCenterName &&
    currentOp?.workCenterName &&
    nextOp.workCenterName.toLowerCase().trim() !== currentOp.workCenterName.toLowerCase().trim()
  );

  // Button label per AC and EC 5: "Send to [Stage]" vs "Advance to [Stage]"
  const advanceButtonLabel = nextOp
    ? (isDifferentWorkstation ? `Send to ${nextStageName}` : `Advance to ${nextStageName}`)
    : 'Advance to Final Sign-Off';

  // EC 2: Check for active QC block / hold
  const activeQcHold = useMemo(() => {
    if (!activeJob) return undefined;
    return (
      qualityHoldService.getActiveHoldForTarget(activeJob.orderNumber) ||
      qualityHoldService.getActiveHoldForTarget(activeJob.id) ||
      qualityHoldService.getActiveHoldForTarget(activeJob.salesOrderNumber || '')
    );
  }, [activeJob]);

  const isQcBlocked = Boolean(activeQcHold || testQcBlockActive);

  // ── LIVE RUNNING TIMER TICK (1-sec interval for AC 2) ───────
  const [nowTick, setNowTick] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = useCallback((startTimeIso: string) => {
    if (!startTimeIso) return '00:00';
    const start = new Date(startTimeIso).getTime();
    const elapsedSec = Math.max(0, Math.floor((nowTick - start) / 1000));
    const hours = Math.floor(elapsedSec / 3600);
    const mins = Math.floor((elapsedSec % 3600) / 60);
    const secs = elapsedSec % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [nowTick]);

  // ── Auto-Closed Events (>12h) Alert (EC 1) ─────────────────
  const autoClosedEvents = useMemo(() => {
    return downtimeEvents.filter(e => e.auto_closed);
  }, [downtimeEvents]);
  const [dismissedOvernightAlert, setDismissedOvernightAlert] = useState<boolean>(false);

  // ── Downtime 5M Category & Search State (AC 1 & AC 6) ─────────
  const [selectedMachineId, setSelectedMachineId] = useState<string>(() => {
    return machines[0]?.machineId || 'MC-CNC-01';
  });
  const [selectedDowntimeJobId, setSelectedDowntimeJobId] = useState<string>('');
  const [downtimeCategory, setDowntimeCategory] = useState<'machine' | 'material' | 'manpower' | 'method' | 'measurement' | 'all'>('machine');
  const [downtimeSearchQuery, setDowntimeSearchQuery] = useState<string>('');
  const [selectedReasonCode, setSelectedReasonCode] = useState<string>('MC-TOOL');
  const [downtimeNotes, setDowntimeNotes] = useState<string>('');

  // Admin Reason Code Configurator State (AC 4)
  const [showAdminConfigModal, setShowAdminConfigModal] = useState<boolean>(false);
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [editingReasonLabel, setEditingReasonLabel] = useState<string>('');
  const [adminNewReasonForm, setAdminNewReasonForm] = useState<{
    code: string;
    label: string;
    category: 'machine' | 'material' | 'manpower' | 'method' | 'measurement';
    severity: 'critical' | 'high' | 'medium' | 'low';
    suggestedAction: string;
  }>({
    code: '',
    label: '',
    category: 'machine',
    severity: 'medium',
    suggestedAction: ''
  });

  // Filtered reason codes by 5M category & search query
  const filteredReasons = useMemo(() => {
    return downtimeReasons.filter(r => {
      // Must be active unless admin config modal is open
      const isVisible = r.active !== false || showAdminConfigModal;
      if (!isVisible) return false;

      const matchesCat = downtimeCategory === 'all' || 
        r.category === downtimeCategory || 
        (downtimeCategory === 'machine' && ['breakdown', 'changeover', 'utilities'].includes(r.category)) ||
        (downtimeCategory === 'material' && r.category === 'starvation') ||
        (downtimeCategory === 'manpower' && r.category === 'operator_rest') ||
        (downtimeCategory === 'measurement' && r.category === 'quality_hold');

      const q = downtimeSearchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        r.label.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.categoryLabel.toLowerCase().includes(q) ||
        (r.suggestedAction && r.suggestedAction.toLowerCase().includes(q));

      return matchesCat && matchesSearch;
    });
  }, [downtimeReasons, downtimeCategory, downtimeSearchQuery, showAdminConfigModal]);

  // Today's Downtime Summary for supervisor's workstation (AC 5)
  const todaySummary = useMemo(() => {
    return getDowntimeSummaryToday(selectedWorkstation);
  }, [getDowntimeSummaryToday, selectedWorkstation, downtimeEvents, nowTick]);

  // Sign-Off checklist state
  const [checklist, setChecklist] = useState({
    swarfCleaned: false,
    gagesVerified: false,
    scrapLogged: false,
    wipHandedOver: false
  });
  const [handoverNotes, setHandoverNotes] = useState<string>('');

  // -------------------------------------------------------------
  // PRIMARY ACTION: START / RESUME JOB (AC 3)
  // -------------------------------------------------------------
  const handleStartJob = async (job: WorkOrder) => {
    try {
      const opToStart = job.operations.find(o => o.status === 'in_progress' || o.status === 'pending' || o.status === 'ready') || job.operations[0];
      
      // Close downtime event if this job was stopped (AC 3)
      const activeEvent = downtimeEvents.find(e => !e.resolved && (e.jobId === job.id || e.workOrderNumber === job.orderNumber));
      const durationMin = activeEvent ? Math.max(1, Math.round((Date.now() - new Date(activeEvent.startTime).getTime()) / 60000)) : 0;
      resolveDowntimeEventForJob(job.id, 'Resumed via Mobile Supervisor Shell');

      if (!isOnline) {
        // Queue action for offline sync (EC 2)
        queueAction({
          type: 'start_job',
          payload: { woId: job.id, opId: opToStart?.id },
          description: `Resumed Job #${job.orderNumber}: ${job.partName}`
        });
      }

      if (opToStart) {
        await updateOperation(
          job.id,
          opToStart.id,
          {
            status: 'in_progress',
            actorId: profile?.uid || 'supervisor',
            actorName: profile?.name || 'Shop-Floor Supervisor'
          }
        );
      }
      await updateWorkOrder(job.id, {
        status: 'in_progress',
        updatedByName: profile?.name || 'Shop-Floor Supervisor'
      });

      // Also set active machine state to running
      const matchedMachine = machines.find(m => 
        job.operations.some(op => op.workCenterName?.includes(m.machineCode) || op.workCenterName?.includes(m.machineName))
      );
      if (matchedMachine) {
        setMachineState(matchedMachine.machineId, 'running');
      }

      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.([40, 30, 40]);
        }
      } catch {}

      const msg = durationMin > 0
        ? `Job #${job.orderNumber} resumed! Downtime closed: ${durationMin} min logged.`
        : `Job #${job.orderNumber} resumed successfully! Machine in production.`;
      setActionFeedback(msg);
    } catch (err: any) {
      setActionFeedback(`Error starting job: ${err?.message || 'Please retry.'}`);
    }
  };

  // -------------------------------------------------------------
  // PRIMARY ACTION: COMPLETE OPERATION / ADVANCE
  // -------------------------------------------------------------
  const handleCompleteCurrentOp = async (job: WorkOrder) => {
    try {
      const activeOp = job.operations.find(o => o.status === 'in_progress') || job.operations[0];
      if (!activeOp) return;

      // Close any open downtime event for this job (AC 3)
      resolveDowntimeEventForJob(job.id, 'Operation completed');

      if (!isOnline) {
        queueAction({
          type: 'advance_job',
          payload: { woId: job.id, opId: activeOp.id },
          description: `Completed Operation on Job #${job.orderNumber}`
        });
      }

      await updateOperation(
        job.id,
        activeOp.id,
        {
          status: 'completed',
          actorId: profile?.uid || 'supervisor',
          actorName: profile?.name || 'Shop-Floor Supervisor'
        }
      );

      // Check if next operation exists and activate it
      const nextOp = job.operations.find(o => o.sequence > activeOp.sequence && o.status !== 'completed');
      if (nextOp) {
        await updateOperation(
          job.id,
          nextOp.id,
          {
            status: 'in_progress',
            actorId: profile?.uid || 'supervisor',
            actorName: profile?.name || 'Shop-Floor Supervisor'
          }
        );
        setActionFeedback(`Operation "${activeOp.name}" completed! Advanced to "${nextOp.name}".`);
      } else {
        await updateWorkOrder(job.id, {
          status: 'completed',
          quantityCompleted: job.quantity,
          updatedByName: profile?.name || 'Shop-Floor Supervisor'
        });
        setActionFeedback(`All operations completed! Job #${job.orderNumber} is fully produced.`);
      }
    } catch (err: any) {
      setActionFeedback(`Error advancing operation: ${err?.message || 'Please retry.'}`);
    }
  };

  // -------------------------------------------------------------
  // ACTION: HOLD / PAUSE JOB
  // -------------------------------------------------------------
  const handleHoldJob = async (job: WorkOrder) => {
    try {
      if (!isOnline) {
        queueAction({
          type: 'hold_job',
          payload: { woId: job.id },
          description: `Placed Job #${job.orderNumber} on Hold`
        });
      }

      const activeOp = job.operations.find(o => o.status === 'in_progress');
      if (activeOp) {
        await updateOperation(
          job.id,
          activeOp.id,
          {
            status: 'pending',
            actorId: profile?.uid || 'supervisor',
            actorName: profile?.name || 'Shop-Floor Supervisor'
          }
        );
      }

      await updateWorkOrder(job.id, {
        status: 'paused',
        updatedByName: profile?.name || 'Shop-Floor Supervisor'
      });

      setActionFeedback(`Job #${job.orderNumber} placed on HOLD. Line paused.`);
    } catch (err: any) {
      setActionFeedback(`Error pausing job: ${err?.message || 'Please retry.'}`);
    }
  };

  // -------------------------------------------------------------
  // PRIMARY ACTION: ONE-TAP STAGE ADVANCE (AC 1-3 & EC 1-5)
  // -------------------------------------------------------------
  const handleOneTapStageAdvance = async () => {
    if (!activeJob || !currentOp) return;

    // 1. EC 3: Debounce rapid double-taps (ignore if tapped within 1200ms or already advancing)
    const now = Date.now();
    if (now - lastAdvanceTapRef.current < 1200 || isAdvancingStage) {
      console.log('[MobileShopFloorShell] Rapid double-tap debounced; second tap ignored.');
      return;
    }
    lastAdvanceTapRef.current = now;

    // 2. EC 2: Open QC block verification
    if (isQcBlocked) {
      setActionFeedback('QC first-piece approval pending. Cannot advance.');
      return;
    }

    // 3. EC 4: Stale State Error Check (if job was already advanced by another supervisor)
    if (
      activeJob.updatedBy &&
      activeJob.updatedBy !== (profile?.uid || 'supervisor') &&
      currentOp.status === 'completed'
    ) {
      setActionFeedback(`Job already advanced by ${activeJob.updatedByName || 'another supervisor'}. Refreshing…`);
      window.dispatchEvent(new Event('flowops:workorders_updated'));
      return;
    }

    // 4. Haptic feedback on supported mobile devices
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([40, 30, 40]);
      }
    } catch {
      // ignore if unpermitted
    }

    setIsAdvancingStage(true);

    // 5. Compute formatted timestamp (e.g. "14:32")
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const successToast = isDifferentWorkstation
      ? `Sent to ${nextStageName} at ${timeStr} · Handoff alert sent to ${nextWorkstation}`
      : `Advanced to ${nextStageName} at ${timeStr}`;

    // 6. Optimistic UI update (<2s on 3G)
    setActionFeedback(successToast);

    try {
      if (!isOnline) {
        // EC 1: Network offline during advance -> Queue in offline outbox
        queueAction({
          type: 'advance_job',
          payload: {
            woId: activeJob.id,
            completedOpId: currentOp.id,
            nextOpId: nextOp?.id,
            isDifferentWorkstation
          },
          description: `Advanced to ${nextStageName} at ${timeStr}`
        });
      }

      // Close any open downtime event for this job (AC 3)
      resolveDowntimeEventForJob(activeJob.id, 'Advanced stage');

      // Mark current stage completed
      await updateOperation(
        activeJob.id,
        currentOp.id,
        {
          status: 'completed',
          actorId: profile?.uid || 'supervisor',
          actorName: profile?.name || 'Shop-Floor Supervisor'
        }
      );

      // If next stage exists, advance it to in_progress
      if (nextOp) {
        await updateOperation(
          activeJob.id,
          nextOp.id,
          {
            status: 'in_progress',
            actorId: profile?.uid || 'supervisor',
            actorName: profile?.name || 'Shop-Floor Supervisor'
          }
        );
      } else {
        // Final stage complete: mark whole work order completed
        await updateWorkOrder(activeJob.id, {
          status: 'completed',
          quantityCompleted: activeJob.quantity,
          updatedByName: profile?.name || 'Shop-Floor Supervisor'
        });
      }
    } catch (err: any) {
      console.warn('[handleOneTapStageAdvance] Background sync issue; saved locally:', err);
      queueAction({
        type: 'advance_job',
        payload: {
          woId: activeJob.id,
          completedOpId: currentOp.id,
          nextOpId: nextOp?.id,
          isDifferentWorkstation
        },
        description: `Advanced to ${nextStageName} at ${timeStr}`
      });
      setActionFeedback(`Advanced to ${nextStageName} at ${timeStr} (Saved locally, syncing in background)`);
    } finally {
      setIsAdvancingStage(false);
    }
  };

  // -------------------------------------------------------------
  // SECONDARY ACTION: HOLD JOB WITH REASON CODE (US-8.3 & AC 4)
  // -------------------------------------------------------------
  const handleConfirmHoldModal = async () => {
    if (!activeJob) return;
    try {
      if (!isOnline) {
        queueAction({
          type: 'hold_job',
          payload: { woId: activeJob.id, reason: holdReasonSelection, notes: holdNotesInput },
          description: `Placed Job #${activeJob.orderNumber} on Hold: ${holdReasonSelection}`
        });
      }

      if (currentOp && currentOp.status === 'in_progress') {
        await updateOperation(
          activeJob.id,
          currentOp.id,
          {
            status: 'pending',
            actorId: profile?.uid || 'supervisor',
            actorName: profile?.name || 'Shop-Floor Supervisor'
          }
        );
      }

      // Start downtime event with running timer (AC 2)
      const matchedReason = downtimeReasons.find(r => r.label === holdReasonSelection) || downtimeReasons[0];
      const targetMachine = machines.find(m => m.machineId === selectedMachineId) || machines[0];
      try {
        logDowntimeEvent({
          machineId: targetMachine.machineId,
          jobId: activeJob.id,
          workOrderNumber: activeJob.orderNumber,
          partName: activeJob.partName,
          reasonCodeId: matchedReason.id,
          operatorId: profile?.uid || 'sup-01',
          operatorName: profile?.name || 'Shop-Floor Supervisor',
          userId: profile?.uid || 'sup-01',
          notes: holdNotesInput || holdReasonSelection
        });
      } catch (e: any) {
        console.warn('Downtime event logged or already active:', e);
      }

      setActionFeedback(`Job #${activeJob.orderNumber} placed on HOLD: ${holdReasonSelection}. Running timer active.`);
      setShowHoldModal(false);
      setHoldNotesInput('');
    } catch (err: any) {
      setActionFeedback(`Failed to place on hold: ${err?.message || 'Please retry'}`);
    }
  };

  // -------------------------------------------------------------
  // ADVANCE TAB: CONFIRM PIECES
  // -------------------------------------------------------------
  const handleConfirmAdvancePieces = async () => {
    if (!activeJob) return;
    try {
      const newCompleted = Math.min(activeJob.quantity, (activeJob.quantityCompleted || 0) + advancePieces);
      const newScrapped = (activeJob.quantityScrapped || 0) + scrapPieces;

      if (!isOnline) {
        queueAction({
          type: 'advance_job',
          payload: { woId: activeJob.id, addedCompleted: advancePieces, addedScrap: scrapPieces },
          description: `Logged +${advancePieces} pcs completed, +${scrapPieces} scrap on Job #${activeJob.orderNumber}`
        });
      }

      const isAllDone = newCompleted >= activeJob.quantity;

      await updateWorkOrder(activeJob.id, {
        quantityCompleted: newCompleted,
        quantityScrapped: newScrapped,
        status: isAllDone ? 'completed' : 'in_progress',
        updatedByName: profile?.name || 'Shop-Floor Supervisor'
      });

      setActionFeedback(`Logged +${advancePieces} good parts & ${scrapPieces} scrap on Job #${activeJob.orderNumber}! Total: ${newCompleted}/${activeJob.quantity} pcs.`);
      setAdvancePieces(10);
      setScrapPieces(0);
    } catch (err: any) {
      setActionFeedback(`Failed to log pieces: ${err?.message || 'Retry'}`);
    }
  };

  // -------------------------------------------------------------
  // DOWNTIME TAB: LOG DOWNTIME (AC 1-2 & EC 2-4)
  // -------------------------------------------------------------
  const handleLogDowntime = (explicitReasonCode?: string) => {
    // 1. Identify target job
    const targetJob = (selectedDowntimeJobId && workOrders.find(w => w.id === selectedDowntimeJobId))
      || activeJob
      || queueJobs.find(j => j.status === 'in_progress' || j.status === 'paused')
      || queueJobs[0];

    const rCode = explicitReasonCode || selectedReasonCode;
    const reasonObj = downtimeReasons.find(r => r.code === rCode)
      || downtimeReasons.find(r => r.id === rCode)
      || downtimeReasons[0];

    // 2. EC 2: Check if multiple downtime events overlap for the same job -> System blocks with exact message: "Job already stopped. Resume first."
    if (targetJob) {
      const activeForJob = downtimeEvents.find(
        e => !e.resolved && (e.jobId === targetJob.id || e.workOrderNumber === targetJob.orderNumber)
      );
      if (activeForJob) {
        setActionFeedback('Job already stopped. Resume first.');
        return;
      }
    }

    const targetMachine = machines.find(m => m.machineId === selectedMachineId) || machines[0];
    const deviceTime = new Date().toISOString();

    if (!isOnline) {
      queueAction({
        type: 'log_downtime',
        payload: {
          jobId: targetJob?.id,
          workOrderNumber: targetJob?.orderNumber,
          machineId: targetMachine?.machineId,
          reasonCode: reasonObj?.code,
          reasonLabel: reasonObj?.label,
          deviceTimestamp: deviceTime
        },
        description: `Logged downtime on Job #${targetJob?.orderNumber || targetMachine?.machineCode}: ${reasonObj?.label || 'Machine Stop'}`
      });
    }

    try {
      logDowntimeEvent({
        machineId: targetMachine.machineId,
        jobId: targetJob?.id,
        workOrderNumber: targetJob?.orderNumber,
        partName: targetJob?.partName,
        reasonCodeId: reasonObj?.id || 'dt-oth-1',
        operatorId: profile?.uid || 'sup-01',
        operatorName: profile?.name || 'Shop-Floor Supervisor',
        userId: profile?.uid || 'sup-01',
        deviceTimestamp: deviceTime,
        startTime: deviceTime,
        notes: downtimeNotes || `${downtimeCategory.toUpperCase()}: ${reasonObj?.label || 'Stop recorded'}`
      });

      if (targetJob) {
        updateWorkOrder(targetJob.id, {
          status: 'paused',
          updatedByName: profile?.name || 'Shop-Floor Supervisor'
        });
      }

      setMachineState(targetMachine.machineId, 'faulted', reasonObj?.label);

      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.([40, 30, 40]);
        }
      } catch {}

      setActionFeedback(`Downtime event started: [${reasonObj?.code}] ${reasonObj?.label}. Running timer visible on job card.`);
      setDowntimeNotes('');
    } catch (err: any) {
      setActionFeedback(err?.message || 'Failed to log downtime.');
    }
  };

  // -------------------------------------------------------------
  // DOWNTIME TAB: RESUME MACHINE / JOB (AC 3)
  // -------------------------------------------------------------
  const handleResumeMachine = (eventId: string, machineId: string) => {
    const event = downtimeEvents.find(e => e.id === eventId);
    if (!isOnline) {
      queueAction({
        type: 'resolve_downtime',
        payload: { eventId, machineId, jobId: event?.jobId },
        description: `Resumed machine ${machineId}`
      });
    }

    resolveDowntimeEvent(eventId, 'Resolved via Mobile Shop-Floor Shell by Supervisor');
    setMachineState(machineId, 'running');

    if (event?.jobId) {
      updateWorkOrder(event.jobId, {
        status: 'in_progress',
        updatedByName: profile?.name || 'Shop-Floor Supervisor'
      });
    }

    const durationMin = event ? Math.max(1, Math.round((Date.now() - new Date(event.startTime).getTime()) / 60000)) : 0;
    setActionFeedback(`Downtime closed. Machine resumed production! Duration ${durationMin} min logged.`);
  };

  const handleResumeDowntimeEvent = async (event: DowntimeEventRecord) => {
    handleResumeMachine(event.id, event.machineId);
  };

  // -------------------------------------------------------------
  // SIGN-OFF TAB: SUBMIT SHIFT HANDOVER
  // -------------------------------------------------------------
  const handleSubmitSignOff = async () => {
    try {
      const allChecked = Object.values(checklist).every(Boolean);
      if (!allChecked) {
        setActionFeedback('Please verify and check all 4 inspection checklist items before signing off.');
        return;
      }

      if (!isOnline) {
        queueAction({
          type: 'sign_off_shift',
          payload: { shift: currentShiftInfo.code, checklist, notes: handoverNotes },
          description: `Digitally signed off ${currentShiftInfo.label}`
        });
      }

      await createHandover({
        outgoingShift: currentShiftInfo.code as any,
        outgoingShiftLabel: currentShiftInfo.label,
        outgoingSupervisorName: profile?.name || 'Shop-Floor Supervisor',
        generalSummaryNotes: handoverNotes || 'Shift completed smoothly. All workstation 5S and job queues verified.',
        status: 'submitted_pending_ack'
      });

      setActionFeedback(`${currentShiftInfo.label} successfully signed off! Handover package transferred to next shift lead.`);
      setChecklist({
        swarfCleaned: true,
        gagesVerified: true,
        scrapLogged: true,
        wipHandedOver: true
      });
    } catch (err: any) {
      setActionFeedback(`Sign-off error: ${err?.message || 'Please check entries'}`);
    }
  };

  // Active un-resolved downtime events
  const activeDowntimeEvents = useMemo(() => {
    return downtimeEvents.filter(e => !e.resolved);
  }, [downtimeEvents]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans select-none pb-24">
      {/* ── TOP BAR: Minimal Shop-Floor Header ──────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-3">
          {/* User & Shift */}
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-white">
                {profile?.name || 'Supervisor'}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-600 text-white uppercase tracking-wider">
                {currentShiftInfo.label.split(' ')[0]} {currentShiftInfo.label.split(' ')[1]}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Shift Window: {currentShiftInfo.window}
            </div>
          </div>
        </div>

        {/* Sync Status Indicator (🟢 Online / 🟡 Syncing / 🔴 Offline) */}
        <div className="flex items-center space-x-2.5">
          {isOnline ? (
            isSyncing ? (
              <span 
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold font-mono uppercase tracking-wider"
                title="Syncing pending actions to cloud"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Syncing</span>
              </span>
            ) : (
              <span 
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold font-mono uppercase tracking-wider"
                title="Connected to cloud server"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Online</span>
              </span>
            )
          ) : (
            <span 
              className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-xs font-bold font-mono uppercase tracking-wider"
              title="Device offline - actions are queued locally"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>Offline {queuedActionsCount > 0 ? `(${queuedActionsCount})` : ''}</span>
            </span>
          )}

          {/* In-App PWA Install Button */}
          {isInstallable && (
            <button
              onClick={install}
              className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold rounded-lg flex items-center space-x-1 uppercase cursor-pointer"
              title="Install Shop Floor app on Home Screen"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install</span>
            </button>
          )}

          {isIOS && !isInstalled && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold rounded-lg flex items-center space-x-1 border border-slate-700"
              title="Install on iOS"
            >
              <Share2 className="w-3 h-3" />
              <span className="hidden sm:inline">iOS App</span>
            </button>
          )}

          {/* Desktop Mode Toggle */}
          <button
            onClick={() => {
              localStorage.setItem('preferred_shell_mode', 'desktop');
              if (onSwitchToDesktop) {
                onSwitchToDesktop();
              } else {
                window.location.reload();
              }
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
            title="Switch to full desktop workspace"
          >
            <Laptop className="w-4 h-4" />
          </button>

          {/* Logout */}
          <button
            onClick={() => signOut()}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 rounded-lg transition"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── ACTION FEEDBACK NOTIFICATION BANNER ────────────────────── */}
      {actionFeedback && (
        <div className="sticky top-[58px] z-30 bg-indigo-600 text-white px-4 py-3 shadow-lg flex items-center justify-between border-b border-indigo-700 animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center space-x-2 text-sm sm:text-base font-bold">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="p-1 hover:bg-indigo-700 rounded-lg text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── OFFLINE QUEUE NOTICE (EC 2) ────────────────────────────── */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 font-bold text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Working in Offline Mode. Actions save locally and sync automatically when internet returns.</span>
          </div>
          {queuedActionsCount > 0 && (
            <span className="bg-slate-950 text-white px-2 py-0.5 rounded text-[11px] font-mono font-bold">
              {queuedActionsCount} queued
            </span>
          )}
        </div>
      )}

      {/* ── MAIN CONTENT VIEWPORT ──────────────────────────────────── */}
      <main className="flex-1 p-3 sm:p-5 max-w-5xl mx-auto w-full">
        {/* ========================================================= */}
        {/* TAB 1: MY QUEUE (Card-based, min 18px font, 56x56 action) */}
        {/* ========================================================= */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {/* Workstation filter bar with large glove-friendly chips */}
            <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
              <span className="text-xs uppercase font-black text-slate-400 tracking-wider shrink-0 pl-1">
                Cell:
              </span>
              <div className="flex items-center space-x-2 overflow-x-auto py-1">
                <button
                  type="button"
                  onClick={() => setSelectedWorkstation('all')}
                  className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer transition ${
                    selectedWorkstation === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Workstations ({workOrders.length})
                </button>
                {availableWorkstations.map(ws => (
                  <button
                    key={ws}
                    type="button"
                    onClick={() => setSelectedWorkstation(ws)}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer transition ${
                      selectedWorkstation === ws
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {ws}
                  </button>
                ))}
              </div>
            </div>

            {/* Jobs List (EC 3: landscape expands full width; EC 4: tablet 768-1024px renders 2-column grid) */}
            {queueJobs.length === 0 ? (
              /* EC 1: Supervisor has no jobs assigned -> Empty State */
              <div className="bg-white border-2 border-slate-300 rounded-3xl p-8 sm:p-12 text-center space-y-4 my-8 shadow-xs">
                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  No jobs in your queue. Check with your line lead.
                </h3>
                <p className="text-base text-slate-500 max-w-md mx-auto">
                  All work orders for this cell have either been completed, scheduled for a later shift, or are waiting for material staging.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorkstation('all');
                      setActionFeedback('Queue refreshed.');
                    }}
                    className="min-h-[56px] px-8 bg-slate-900 hover:bg-slate-800 text-white font-black text-base uppercase rounded-xl transition shadow-md flex items-center justify-center space-x-2 mx-auto cursor-pointer"
                  >
                    <RotateCw className="w-5 h-5" />
                    <span>Refresh Queue</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {queueJobs.map(job => {
                  const currentOp = job.operations.find(o => o.status === 'in_progress') || 
                                    job.operations.find(o => o.status === 'pending' || o.status === 'ready') ||
                                    job.operations[0];

                  const isJobInProgress = job.status === 'in_progress';
                  const isJobPaused = job.status === 'paused';
                  const completedPercent = Math.round(((job.quantityCompleted || 0) / job.quantity) * 100);

                  return (
                    <div
                      key={job.id}
                      className={`bg-white rounded-3xl border-2 p-5 sm:p-6 space-y-4 transition-all shadow-sm ${
                        isJobInProgress 
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20' 
                          : isJobPaused 
                          ? 'border-amber-500' 
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {/* Card Header: Job ID & Priority Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-mono font-bold text-slate-500 uppercase">
                              Work Order #{job.orderNumber}
                            </span>
                            {job.salesOrderNumber && (
                              <span className="text-xs font-mono text-slate-400">
                                ({job.salesOrderNumber})
                              </span>
                            )}
                          </div>
                          {/* Part Name: Min 18px font (text-xl/text-2xl) */}
                          <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-tight mt-0.5">
                            {job.partName}
                          </h2>
                          <div className="text-sm font-bold text-slate-600 mt-0.5">
                            Customer: {job.customerName || 'OEM Client'}
                          </div>
                        </div>

                        {/* Priority Badge - High Contrast */}
                        <div className="shrink-0">
                          {job.priority === 'urgent' && (
                            <span className="px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-sm uppercase tracking-wider shadow-xs animate-pulse">
                              URGENT
                            </span>
                          )}
                          {job.priority === 'high' && (
                            <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider">
                              HIGH
                            </span>
                          )}
                          {job.priority === 'medium' && (
                            <span className="px-3 py-1 rounded-xl bg-sky-100 text-sky-850 border border-sky-300 font-bold text-xs uppercase">
                              MEDIUM
                            </span>
                          )}
                          {job.priority === 'low' && (
                            <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs uppercase">
                              LOW
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Operation details & Cell */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-500">
                          <span>Current Operation</span>
                          <span>Seq {currentOp?.sequence || 10}</span>
                        </div>
                        {/* Operation Name: Large Font (min 18px) */}
                        <div className="text-lg font-black text-slate-900 leading-snug">
                          {currentOp?.name || 'Production Step'}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-slate-700 flex items-center space-x-1">
                          <Wrench className="w-3.5 h-3.5 text-slate-500" />
                          <span>{currentOp?.workCenterName || 'Assigned Workstation'}</span>
                        </div>
                      </div>

                      {/* ── LIVE RUNNING DOWNTIME TIMER (AC 2) ────────────────── */}
                      {(() => {
                        const activeDowntime = downtimeEvents.find(
                          e => !e.resolved && (e.jobId === job.id || e.workOrderNumber === job.orderNumber)
                        );
                        if (!activeDowntime) return null;
                        return (
                          <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-3.5 flex items-center justify-between text-rose-950 animate-pulse shadow-xs">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-5 h-5 text-rose-600 shrink-0" />
                              <span className="text-sm font-bold">
                                Stopped:{' '}
                                <strong className="text-base sm:text-lg font-black font-mono text-rose-700">
                                  {formatElapsed(activeDowntime.startTime)}
                                </strong>
                              </span>
                            </div>
                            <span className="px-2.5 py-1 rounded-xl bg-rose-200/90 text-rose-950 text-xs font-mono font-bold tracking-tight">
                              [{activeDowntime.reasonCode}] {activeDowntime.reasonLabel}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Progress Metrics & Due Date */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-base font-bold text-slate-800">
                          <span>
                            Progress: <span className="font-mono text-slate-950">{job.quantityCompleted || 0}</span> / {job.quantity} pcs
                          </span>
                          <span className="font-mono text-indigo-700 font-black">
                            {completedPercent}%
                          </span>
                        </div>
                        {/* High Contrast Progress Bar */}
                        <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${isJobInProgress ? 'bg-emerald-600' : 'bg-indigo-600'}`}
                            style={{ width: `${Math.min(100, completedPercent)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-1">
                          <span>Due: {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : 'Immediate'}</span>
                          {job.quantityScrapped ? (
                            <span className="text-rose-600 font-bold">
                              Scrapped: {job.quantityScrapped} pcs
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* ── PRIMARY ACTION BUTTON (MINIMUM 56×56px WCAG Touch Target) ── */}
                      <div className="pt-2">
                        {!isJobInProgress && !isJobPaused && (
                          <button
                            type="button"
                            onClick={() => handleStartJob(job)}
                            className="w-full min-h-[56px] h-14 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-lg sm:text-xl uppercase tracking-wider rounded-2xl flex items-center justify-center space-x-3 shadow-md active:scale-98 transition cursor-pointer"
                          >
                            <Play className="w-6 h-6 fill-white" />
                            <span>START JOB</span>
                          </button>
                        )}

                        {isJobInProgress && (
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => handleCompleteCurrentOp(job)}
                              className="col-span-2 min-h-[56px] h-14 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-base sm:text-lg uppercase tracking-wider rounded-2xl flex items-center justify-center space-x-2 shadow-md active:scale-98 transition cursor-pointer"
                            >
                              <CheckCircle className="w-6 h-6" />
                              <span>COMPLETE OP</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHoldJob(job)}
                              className="col-span-1 min-h-[56px] h-14 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border-2 border-amber-400 text-amber-950 font-black text-sm uppercase rounded-2xl flex items-center justify-center space-x-1 shadow-xs cursor-pointer"
                            >
                              <Pause className="w-5 h-5" />
                              <span>HOLD</span>
                            </button>
                          </div>
                        )}

                        {isJobPaused && (
                          <button
                            type="button"
                            onClick={() => handleStartJob(job)}
                            className="w-full min-h-[56px] h-14 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-lg uppercase tracking-wider rounded-2xl flex items-center justify-center space-x-3 shadow-md active:scale-98 transition cursor-pointer"
                          >
                            <Play className="w-6 h-6 fill-white" />
                            <span>RESUME JOB</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ONE-TAP STAGE ADVANCE (AC 1-6 & EC 1-5)             */}
        {/* ========================================================= */}
        {activeTab === 'advance' && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {/* Active Job Selector Card */}
            <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 space-y-3 shadow-xs">
              <label className="text-xs font-mono font-bold uppercase text-slate-500 block">
                Selected Work Order to Advance:
              </label>
              <select
                value={activeJob?.id || ''}
                onChange={e => setSelectedJobId(e.target.value)}
                className="w-full min-h-[56px] h-14 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-base font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                {workOrders
                  .filter(wo => wo.status !== 'completed' && wo.status !== 'cancelled')
                  .map(wo => (
                    <option key={wo.id} value={wo.id}>
                      #{wo.orderNumber}: {wo.partName} ({wo.quantityCompleted || 0}/{wo.quantity} pcs) — {wo.status.toUpperCase()}
                    </option>
                  ))}
              </select>

              {activeJob && (
                <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-1">
                  <span>Customer: <strong className="text-slate-800">{activeJob.customerName || 'B2B Client'}</strong></span>
                  <span>Batch Qty: <strong className="text-slate-800">{activeJob.quantity} pcs</strong></span>
                </div>
              )}
            </div>

            {/* ── PROMINENT CURRENT STAGE & NEXT STAGE DISPLAY (AC 1) ── */}
            {activeJob ? (
              <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between text-xs font-mono font-bold uppercase text-slate-500">
                  <span>Production Stage Transition</span>
                  <span className="text-indigo-650 font-bold">
                    Op {currentOp?.sequence || 10} of {activeJob.operations[activeJob.operations.length - 1]?.sequence || 50}
                  </span>
                </div>

                {/* Stage Comparison Flow Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                  {/* Current Stage */}
                  <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-4 space-y-1.5 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-mono uppercase text-slate-500 font-bold flex items-center justify-between">
                        <span>Current Stage</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          IN PROGRESS
                        </span>
                      </div>
                      {/* Prominent Current Stage: Min 18px (text-xl/text-2xl) */}
                      <div className="text-xl sm:text-2xl font-black text-slate-950 leading-tight mt-1">
                        {currentStageName}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-slate-600 flex items-center space-x-1 pt-1">
                      <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{currentWorkstation}</span>
                    </div>
                  </div>

                  {/* Next Stage */}
                  <div className={`border-2 rounded-2xl p-4 space-y-1.5 flex flex-col justify-between ${nextOp ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <div className="text-[11px] font-mono uppercase text-indigo-700 font-bold flex items-center justify-between">
                        <span>Next Stage</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                          {nextOp ? 'UP NEXT' : 'FINAL DESTINATION'}
                        </span>
                      </div>
                      {/* Prominent Next Stage: Min 18px (text-xl/text-2xl) */}
                      <div className="text-xl sm:text-2xl font-black text-indigo-950 leading-tight mt-1">
                        {nextStageName}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-indigo-700 flex items-center space-x-1 pt-1">
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{nextWorkstation}</span>
                    </div>
                  </div>
                </div>

                {/* ── RUNNING DOWNTIME TIMER IN ADVANCE TAB (AC 2) ── */}
                {(() => {
                  const activeDowntime = activeJob && downtimeEvents.find(
                    e => !e.resolved && (e.jobId === activeJob.id || e.workOrderNumber === activeJob.orderNumber)
                  );
                  if (!activeDowntime) return null;
                  return (
                    <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-4 flex items-center justify-between text-rose-950 animate-pulse shadow-sm">
                      <div className="flex items-center space-x-3">
                        <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0" />
                        <div>
                          <div className="text-xs uppercase font-mono font-bold text-rose-700">
                            Production Stoppage Active
                          </div>
                          <div className="text-sm font-bold text-slate-900">
                            [{activeDowntime.reasonCode}] {activeDowntime.reasonLabel}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-mono text-rose-600 font-bold uppercase">Stopped Timer</div>
                        <div className="text-xl sm:text-2xl font-black font-mono text-rose-700">
                          {formatElapsed(activeDowntime.startTime)}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Next stage requires different workstation notice (EC 5) */}
                {isDifferentWorkstation && (
                  <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex items-center space-x-3 text-xs sm:text-sm font-bold text-sky-900">
                    <ArrowRight className="w-5 h-5 text-sky-600 shrink-0" />
                    <span>Next stage requires different workstation ({nextWorkstation}). Tapping button will trigger a workstation handoff alert.</span>
                  </div>
                )}

                {/* ── QC BLOCK BANNER (AC 5 & EC 2) ── */}
                {isQcBlocked && (
                  <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 text-amber-950 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center space-x-2 font-black text-base sm:text-lg text-amber-900">
                      <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                      <span>QC first-piece approval pending. Cannot advance.</span>
                    </div>
                    <p className="text-xs sm:text-sm text-amber-800 leading-relaxed pl-8">
                      {activeQcHold
                        ? `Quality Hold #${activeQcHold.id}: ${activeQcHold.holdReason} (Placed by ${activeQcHold.placedBy})`
                        : 'First-article CMM coordinate verification and hardness validation must be approved in Quality module before production line can progress.'}
                    </p>
                  </div>
                )}

                {/* ── SINGLE LARGE PRIMARY ACTION BUTTON (MIN 64PX HEIGHT, FULL WIDTH - AC 2) ── */}
                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    disabled={isQcBlocked || isAdvancingStage}
                    onClick={handleOneTapStageAdvance}
                    className={`w-full min-h-[64px] h-16 rounded-2xl flex items-center justify-center space-x-3 text-white font-black text-lg sm:text-2xl uppercase tracking-wider shadow-xl transition-all cursor-pointer ${
                      isQcBlocked
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : isAdvancingStage
                        ? 'bg-emerald-700 opacity-90 cursor-wait'
                        : isDifferentWorkstation
                        ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-98'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-98'
                    }`}
                  >
                    <Play className="w-7 h-7 fill-white shrink-0" />
                    <span>{advanceButtonLabel}</span>
                  </button>

                  {/* ── SECONDARY "HOLD" BUTTON (MIN 56PX HEIGHT - AC 4) ── */}
                  <button
                    type="button"
                    onClick={() => setShowHoldModal(true)}
                    className="w-full min-h-[56px] h-14 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border-2 border-amber-400 text-amber-950 font-black text-base sm:text-lg uppercase rounded-2xl flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
                  >
                    <Pause className="w-5 h-5 text-amber-700" />
                    <span>PLACE JOB ON HOLD (PAUSE)</span>
                  </button>
                </div>

                {/* QC Block Simulation / Testing Toggle */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono text-slate-500">
                  <span>Test QC Block Behavior (EC 2):</span>
                  <button
                    type="button"
                    onClick={() => setTestQcBlockActive(prev => !prev)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                      testQcBlockActive
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {testQcBlockActive ? '🔴 QC Block ACTIVE (Simulated)' : '⚪ QC Pass / Normal'}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Supplementary Glove-Friendly Quantity Logger */}
            <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-slate-900">Incremental Pieces Counter</h4>
                  <p className="text-xs text-slate-500">Log partial unit completion without advancing stage</p>
                </div>
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
                  +{advancePieces} pcs
                </span>
              </div>

              {/* Min 56x56px touch target buttons for glove taps */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[1, 5, 10, 25, 50].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAdvancePieces(prev => prev + amt)}
                    className="min-h-[56px] h-14 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-2 border-slate-300 rounded-2xl text-lg font-black text-slate-900 flex items-center justify-center cursor-pointer active:scale-95 transition"
                  >
                    +{amt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAdvancePieces(0)}
                  className="min-h-[56px] h-14 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 rounded-2xl text-base font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  Reset
                </button>
              </div>

              <button
                type="button"
                disabled={!activeJob || advancePieces <= 0}
                onClick={handleConfirmAdvancePieces}
                className="w-full min-h-[56px] h-14 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-base sm:text-lg uppercase tracking-wider rounded-2xl flex items-center justify-center space-x-2 shadow-md active:scale-98 transition cursor-pointer disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-5 h-5" />
                <span>LOG +{advancePieces} PIECES TO CURRENT STAGE</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DOWNTIME (5M Categories, Live Timers & Summary)    */}
        {/* ========================================================= */}
        {activeTab === 'downtime' && (
          <div className="space-y-5 max-w-2xl mx-auto">
            {/* ── OVERNIGHT AUTO-CLOSED EVENT ALERT (EC 1) ── */}
            {autoClosedEvents.length > 0 && !dismissedOvernightAlert && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-3xl p-4 sm:p-5 space-y-2 text-amber-950 shadow-sm animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 font-black text-base text-amber-900">
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                    <span>⚠️ {autoClosedEvents.length} downtime event(s) auto-closed overnight (&gt;12h)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissedOvernightAlert(true)}
                    className="p-1 hover:bg-amber-200/60 rounded-lg text-amber-800 text-xs font-bold cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
                  Events running beyond 12 hours without a resume action were automatically closed with the 12-hour threshold flag (<code className="font-mono bg-amber-100 px-1 rounded">auto_closed: true</code>). Please review and adjust the shift log.
                </p>
                <div className="pt-1 flex flex-wrap gap-2">
                  {autoClosedEvents.map(evt => (
                    <span key={evt.id} className="text-xs font-mono font-bold bg-amber-200/80 text-amber-950 px-2.5 py-1 rounded-xl">
                      {evt.machineCode} ({evt.reasonLabel}) — 720 min
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── TODAY'S DOWNTIME SUMMARY FOR WORKSTATION CELL (AC 5) ── */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
                    Today&apos;s Downtime Summary
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {selectedWorkstation === 'all' ? 'All Workstations' : selectedWorkstation}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-slate-400 block uppercase">Total Stoppage</span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-rose-400">
                    {todaySummary.totalMinutes} <span className="text-sm font-normal text-slate-300">min</span>
                  </span>
                </div>
              </div>

              {/* 5M Breakdown Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800">
                {[
                  { key: 'machine', label: 'Machine', mins: todaySummary.byCategory.machine, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
                  { key: 'material', label: 'Material', mins: todaySummary.byCategory.material, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
                  { key: 'manpower', label: 'Manpower', mins: todaySummary.byCategory.manpower, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
                  { key: 'method', label: 'Method', mins: todaySummary.byCategory.method, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/30' },
                  { key: 'measurement', label: 'Measurement', mins: todaySummary.byCategory.measurement, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' }
                ].map(c => (
                  <div key={c.key} className={`p-2.5 rounded-2xl border text-center ${c.bg}`}>
                    <div className={`text-lg font-black font-mono ${c.color}`}>{c.mins}m</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Visual Distribution Bar */}
              {todaySummary.totalMinutes > 0 && (
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                  {todaySummary.byCategory.machine > 0 && (
                    <div style={{ width: `${(todaySummary.byCategory.machine / todaySummary.totalMinutes) * 100}%` }} className="bg-rose-500 h-full" title="Machine" />
                  )}
                  {todaySummary.byCategory.material > 0 && (
                    <div style={{ width: `${(todaySummary.byCategory.material / todaySummary.totalMinutes) * 100}%` }} className="bg-amber-500 h-full" title="Material" />
                  )}
                  {todaySummary.byCategory.manpower > 0 && (
                    <div style={{ width: `${(todaySummary.byCategory.manpower / todaySummary.totalMinutes) * 100}%` }} className="bg-indigo-500 h-full" title="Manpower" />
                  )}
                  {todaySummary.byCategory.method > 0 && (
                    <div style={{ width: `${(todaySummary.byCategory.method / todaySummary.totalMinutes) * 100}%` }} className="bg-teal-500 h-full" title="Method" />
                  )}
                  {todaySummary.byCategory.measurement > 0 && (
                    <div style={{ width: `${(todaySummary.byCategory.measurement / todaySummary.totalMinutes) * 100}%` }} className="bg-orange-500 h-full" title="Measurement" />
                  )}
                </div>
              )}
            </div>

            {/* ── ACTIVE STOPPAGES LIST & LIVE RUNNING TIMERS (AC 2) ── */}
            {activeDowntimeEvents.length > 0 && (
              <div className="bg-rose-50 border-2 border-rose-400 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-rose-800 font-black text-base uppercase">
                    <AlertOctagon className="w-6 h-6 text-rose-600 animate-pulse" />
                    <span>Active Production Stoppages ({activeDowntimeEvents.length})</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-600">LIVE TIMERS</span>
                </div>

                <div className="space-y-3">
                  {activeDowntimeEvents.map(evt => (
                    <div
                      key={evt.id}
                      className="bg-white border-2 border-rose-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-black text-slate-900">
                            {evt.workOrderNumber ? `WO #${evt.workOrderNumber}: ` : ''}{evt.partName || evt.machineName}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-mono text-xs font-bold">
                            [{evt.reasonCode}]
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-700">
                          {evt.reasonLabel} <span className="text-slate-400 font-normal">({evt.categoryLabel || evt.category})</span>
                        </div>
                        <div className="flex items-center space-x-3 text-xs font-mono text-slate-500 pt-0.5">
                          <span>Machine: <strong className="text-slate-800">{evt.machineCode}</strong></span>
                          <span>•</span>
                          <span className="text-rose-700 font-bold">
                            Stopped: <strong className="font-black text-sm text-rose-700 font-mono">{formatElapsed(evt.startTime)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Primary Resume Button (Min 56px WCAG Touch Target - AC 3) */}
                      <button
                        type="button"
                        onClick={() => handleResumeDowntimeEvent(evt)}
                        className="min-h-[56px] h-14 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-base uppercase rounded-xl flex items-center justify-center space-x-2 shadow-md shrink-0 cursor-pointer active:scale-98 transition"
                      >
                        <Play className="w-5 h-5 fill-white" />
                        <span>RESUME JOB</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── LOG REASON CODE CAPTURE FORM (5M GRID - AC 1) ── */}
            <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-slate-950 flex items-center space-x-2">
                  <AlertOctagon className="w-6 h-6 text-rose-600" />
                  <span>Log Downtime Reason</span>
                </h2>
                {/* Admin configuration trigger button (AC 4) */}
                <button
                  type="button"
                  onClick={() => setShowAdminConfigModal(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold font-mono flex items-center space-x-1 border border-slate-300 cursor-pointer"
                  title="Configure reason codes (Add/Edit/Deactivate)"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Manage Codes (Admin)</span>
                </button>
              </div>

              {/* Work Order / Machine Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono font-bold uppercase text-slate-500 block mb-1">
                    Select Work Order (Job):
                  </label>
                  <select
                    value={selectedDowntimeJobId || activeJob?.id || ''}
                    onChange={e => setSelectedDowntimeJobId(e.target.value)}
                    className="w-full min-h-[56px] h-14 px-3.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-rose-600"
                  >
                    {workOrders
                      .filter(wo => wo.status !== 'completed' && wo.status !== 'cancelled')
                      .map(wo => {
                        const isStopped = downtimeEvents.some(e => !e.resolved && (e.jobId === wo.id || e.workOrderNumber === wo.orderNumber));
                        return (
                          <option key={wo.id} value={wo.id}>
                            #{wo.orderNumber}: {wo.partName} {isStopped ? '🛑 [ALREADY STOPPED]' : ''}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono font-bold uppercase text-slate-500 block mb-1">
                    Affected Cell Machine:
                  </label>
                  <select
                    value={selectedMachineId}
                    onChange={e => setSelectedMachineId(e.target.value)}
                    className="w-full min-h-[56px] h-14 px-3.5 bg-slate-50 border-2 border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-rose-600"
                  >
                    {machines.map(m => (
                      <option key={m.machineId} value={m.machineId}>
                        {m.machineCode} — {m.machineName} ({m.state.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── 5M CATEGORY TABS (Min 56px Touch Target - AC 1) ── */}
              <div>
                <label className="text-xs font-mono font-bold uppercase text-slate-500 block mb-2">
                  1. Select 5M Stoppage Category:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { key: 'machine', label: 'Machine', icon: Wrench, color: 'border-rose-500' },
                    { key: 'material', label: 'Material', icon: Boxes, color: 'border-amber-500' },
                    { key: 'manpower', label: 'Manpower', icon: Users, color: 'border-indigo-500' },
                    { key: 'method', label: 'Method', icon: FileText, color: 'border-teal-500' },
                    { key: 'measurement', label: 'Measurement', icon: Ruler, color: 'border-orange-500' }
                  ].map(cat => {
                    const Icon = cat.icon;
                    const isSelected = downtimeCategory === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => {
                          setDowntimeCategory(cat.key as any);
                          const firstMatching = downtimeReasons.find(r => r.category === cat.key && r.active !== false);
                          if (firstMatching) setSelectedReasonCode(firstMatching.code);
                        }}
                        className={`min-h-[56px] h-14 p-2 rounded-2xl border-2 flex items-center space-x-2.5 px-3.5 text-left font-black text-sm cursor-pointer transition ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-500/30'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="leading-tight">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── SEARCH INPUT FOR RARE REASON CODES (AC 6) ── */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono font-bold uppercase text-slate-500">
                    2. Choose Reason Code:
                  </label>
                  {downtimeSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDowntimeSearchQuery('')}
                      className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={downtimeSearchQuery}
                    onChange={e => setDowntimeSearchQuery(e.target.value)}
                    placeholder="Search codes (e.g. breakdown, tool, porosity, g-code, buy-off)..."
                    className="w-full min-h-[48px] pl-10 pr-4 bg-slate-50 border-2 border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-rose-600"
                  />
                </div>
              </div>

              {/* ── GRID OF LARGE REASON-CODE BUTTONS (MIN 56PX - AC 1 & FLOW) ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                {filteredReasons.map(r => {
                  const isSelected = selectedReasonCode === r.code;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReasonCode(r.code)}
                      className={`min-h-[56px] p-3 rounded-2xl border-2 flex items-center justify-between text-left transition cursor-pointer active:scale-98 ${
                        isSelected
                          ? 'bg-rose-50 border-rose-500 text-rose-950 shadow-sm ring-2 ring-rose-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-rose-700">
                            [{r.code}]
                          </span>
                          <span className="text-sm font-black text-slate-900 leading-tight">
                            {r.label}
                          </span>
                        </div>
                        {r.suggestedAction && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {r.suggestedAction}
                          </div>
                        )}
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ml-2 ${isSelected ? 'bg-rose-600 text-white' : 'border border-slate-300'}`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}

                {/* "Other" Option button (EC: Reason code not in the list) */}
                <button
                  type="button"
                  onClick={() => setSelectedReasonCode('DT-OTHER')}
                  className={`min-h-[56px] p-3 rounded-2xl border-2 flex items-center justify-between text-left transition cursor-pointer active:scale-98 ${
                    selectedReasonCode === 'DT-OTHER'
                      ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-sm ring-2 ring-amber-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-amber-700 block">[DT-OTHER]</span>
                    <span className="text-sm font-black text-slate-900">Other (Free-Text Note)</span>
                  </div>
                  <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </div>

              {/* Free-text Observation Note input (EC 3) */}
              <div>
                <label className="text-xs font-mono font-bold uppercase text-slate-500 block mb-1">
                  Supervisor Observation Notes {selectedReasonCode === 'DT-OTHER' ? '(Mandatory for Other)' : '(Optional)'}:
                </label>
                <input
                  type="text"
                  placeholder={selectedReasonCode === 'DT-OTHER' ? 'Describe root cause of stoppage...' : 'e.g. Spindle chatter at 2400 RPM, tool insert broken in pocket #3.'}
                  value={downtimeNotes}
                  onChange={e => setDowntimeNotes(e.target.value)}
                  className="w-full min-h-[56px] h-14 px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-base font-medium text-slate-900 focus:outline-none focus:border-rose-600"
                />
              </div>

              {/* Primary Action Button (Min 64px height - AC 1-2 & EC 2) */}
              {(() => {
                const targetJob = (selectedDowntimeJobId && workOrders.find(w => w.id === selectedDowntimeJobId))
                  || activeJob
                  || queueJobs.find(j => j.status === 'in_progress' || j.status === 'paused')
                  || queueJobs[0];

                const isAlreadyStopped = targetJob && downtimeEvents.some(
                  e => !e.resolved && (e.jobId === targetJob.id || e.workOrderNumber === targetJob.orderNumber)
                );

                if (isAlreadyStopped) {
                  return (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setActionFeedback('Job already stopped. Resume first.')}
                        className="w-full min-h-[64px] h-16 bg-slate-300 text-slate-700 font-black text-base sm:text-lg uppercase tracking-wider rounded-2xl flex items-center justify-center space-x-2 shadow-inner cursor-not-allowed"
                      >
                        <AlertOctagon className="w-6 h-6 text-slate-500" />
                        <span>Job already stopped. Resume first.</span>
                      </button>
                      <p className="text-xs text-rose-600 text-center font-bold">
                        Work Order #{targetJob.orderNumber} is currently halted. Resume or close the active stoppage above before logging another event.
                      </p>
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
                    onClick={() => handleLogDowntime()}
                    className="w-full min-h-[64px] h-16 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black text-lg sm:text-xl uppercase tracking-wider rounded-2xl flex items-center justify-center space-x-3 shadow-lg active:scale-98 transition cursor-pointer"
                  >
                    <AlertOctagon className="w-6 h-6" />
                    <span>LOG STOPPAGE & START TIMER</span>
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: SIGN-OFF (Shift Handover & End-of-Shift Sign-Off)   */}
        {/* ========================================================= */}
        {activeTab === 'signoff' && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {/* Shift Performance Summary */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                    Current Shift Performance
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {currentShiftInfo.label}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-bold uppercase">
                  ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
                <div className="bg-slate-800/80 p-3 rounded-2xl text-center">
                  <div className="text-2xl font-black font-mono text-emerald-400">142</div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Pieces Produced</div>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-2xl text-center">
                  <div className="text-2xl font-black font-mono text-rose-400">2</div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Scrap Units</div>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-2xl text-center">
                  <div className="text-2xl font-black font-mono text-amber-400">35m</div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Downtime</div>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-2xl text-center">
                  <div className="text-2xl font-black font-mono text-sky-400">84.6%</div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Shift OEE</div>
                </div>
              </div>
            </div>

            {/* Handover Checklist with Min 56px touch rows */}
            <div className="bg-white border-2 border-slate-300 rounded-3xl p-5 sm:p-6 space-y-3">
              <h3 className="text-lg font-black text-slate-900">
                Supervisor End-of-Shift Verification
              </h3>
              <p className="text-xs text-slate-500">
                Tap each row to verify standard shop-floor 5S and safety compliance.
              </p>

              <div className="space-y-2 pt-1">
                {[
                  { key: 'swarfCleaned', label: 'Workstations cleaned, chips & swarf removed' },
                  { key: 'gagesVerified', label: 'Inspection gages calibrated & returned to tool crib' },
                  { key: 'scrapLogged', label: 'Scrap & reject parts weighed, tagged, and logged' },
                  { key: 'wipHandedOver', label: 'Critical WIP count reviewed with incoming supervisor' }
                ].map(item => {
                  const isChecked = (checklist as any)[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setChecklist(prev => ({ ...prev, [item.key]: !isChecked }))}
                      className={`w-full min-h-[56px] p-3.5 rounded-2xl border-2 flex items-center space-x-3 text-left transition cursor-pointer ${
                        isChecked 
                          ? 'bg-emerald-50 border-emerald-500 text-slate-950 font-bold' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 font-medium hover:bg-slate-100'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isChecked ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        {isChecked ? <Check className="w-5 h-5 stroke-[3]" /> : <Square className="w-5 h-5" />}
                      </div>
                      <span className="text-sm sm:text-base leading-snug">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Handover Notes */}
              <div className="pt-2">
                <label className="text-xs font-mono font-bold uppercase text-slate-500 block mb-1">
                  Notes for Incoming Line Lead:
                </label>
                <textarea
                  rows={2}
                  value={handoverNotes}
                  onChange={e => setHandoverNotes(e.target.value)}
                  placeholder="e.g. Focus on finishing batch on WO-0001. Tooling running low in Crib 1."
                  className="w-full p-3 bg-slate-50 border-2 border-slate-300 rounded-2xl text-base font-medium text-slate-900 focus:outline-none"
                />
              </div>

              {/* Primary Sign-Off Action Button (Min 56px) */}
              <button
                type="button"
                onClick={handleSubmitSignOff}
                className="w-full min-h-[56px] h-14 bg-slate-950 hover:bg-slate-900 text-white font-black text-lg sm:text-xl uppercase tracking-wider rounded-2xl flex items-center justify-center space-x-3 shadow-lg active:scale-98 transition cursor-pointer"
              >
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <span>SIGN & COMPLETE SHIFT HANDOVER</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── BOTTOM TAB BAR: Fixed with 4 tabs, Min 56px, Safe Area ───── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-slate-300 shadow-2xl pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-4 h-16 sm:h-20">
          {[
            { key: 'queue', label: 'My Queue', icon: ClipboardList },
            { key: 'advance', label: 'Advance', icon: PlayCircle },
            { key: 'downtime', label: 'Downtime', icon: AlertOctagon },
            { key: 'signoff', label: 'Sign-Off', icon: ShieldCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as ShopFloorTab)}
                className={`flex flex-col items-center justify-center space-y-1 transition cursor-pointer min-h-[56px] ${
                  isActive
                    ? 'text-indigo-650 bg-indigo-50/60 font-black border-t-4 border-indigo-600'
                    : 'text-slate-500 hover:text-slate-900 font-bold border-t-4 border-transparent'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'text-indigo-600 stroke-[2.5]' : 'stroke-2'}`} />
                <span className="text-[11px] sm:text-xs uppercase tracking-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── HOLD REASON CAPTURE MODAL (US-8.3 & AC 4) ──────────────── */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border-2 border-slate-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-700 font-black text-lg">
                <Pause className="w-5 h-5" />
                <span>Place Job on Hold</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Work Order #{activeJob?.orderNumber} ({activeJob?.partName}). Select stoppage reason code:
            </p>
            <div className="space-y-2">
              {[
                'Tool Wear / Broken Insert',
                'Raw Material Shortage / Starvation',
                'First Piece Dimensional QC Check',
                'Machine Thermal Stability / Hydraulic Alarm',
                'Drawing Revision / Engineering Clarification',
                'Operator Fatigue / Scheduled Break'
              ].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setHoldReasonSelection(r)}
                  className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border-2 text-left text-xs sm:text-sm font-bold transition cursor-pointer ${
                    holdReasonSelection === r
                      ? 'bg-amber-100 border-amber-500 text-amber-950 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div>
              <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block mb-1">
                Additional Notes (Optional):
              </label>
              <input
                type="text"
                value={holdNotesInput}
                onChange={e => setHoldNotesInput(e.target.value)}
                placeholder="e.g. Awaiting replacement insert from crib"
                className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                className="min-h-[56px] h-14 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmHoldModal}
                className="min-h-[56px] h-14 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black uppercase text-sm rounded-xl shadow-md cursor-pointer"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN REASON CODE CONFIGURATION MODAL (AC 4) ──────────── */}
      {showAdminConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border-2 border-slate-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-900 font-black text-lg">
                <Settings className="w-5 h-5 text-indigo-600" />
                <span>Manage Downtime Reason Codes (Admin)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminConfigModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Configure standard 5M reason codes. Deactivated codes are hidden from shop-floor supervisor buttons.
            </p>

            {/* Add New Code Form */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-3">
              <h4 className="text-sm font-black text-slate-900 flex items-center space-x-1.5">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <span>Add New Reason Code</span>
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-0.5">Code:</label>
                  <input
                    type="text"
                    placeholder="e.g. MC-OIL"
                    value={adminNewReasonForm.code}
                    onChange={e => setAdminNewReasonForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-0.5">Category (5M):</label>
                  <select
                    value={adminNewReasonForm.category}
                    onChange={e => setAdminNewReasonForm(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="machine">Machine</option>
                    <option value="material">Material</option>
                    <option value="manpower">Manpower</option>
                    <option value="method">Method</option>
                    <option value="measurement">Measurement</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block mb-0.5">Label / Description:</label>
                <input
                  type="text"
                  placeholder="e.g. Spindle Lubrication Pressure Drop"
                  value={adminNewReasonForm.label}
                  onChange={e => setAdminNewReasonForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                />
              </div>
              <button
                type="button"
                disabled={!adminNewReasonForm.code.trim() || !adminNewReasonForm.label.trim()}
                onClick={() => {
                  addDowntimeReason({
                    code: adminNewReasonForm.code.trim(),
                    label: adminNewReasonForm.label.trim(),
                    category: adminNewReasonForm.category,
                    categoryLabel: adminNewReasonForm.category.charAt(0).toUpperCase() + adminNewReasonForm.category.slice(1),
                    severity: adminNewReasonForm.severity,
                    suggestedAction: adminNewReasonForm.suggestedAction || 'Remediate and record root cause'
                  });
                  setActionFeedback(`Added new reason code [${adminNewReasonForm.code}]!`);
                  setAdminNewReasonForm({ code: '', label: '', category: 'machine', severity: 'medium', suggestedAction: '' });
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-xs uppercase rounded-xl transition cursor-pointer"
              >
                + Add Code to Plant Registry
              </button>
            </div>

            {/* Existing Codes with Toggle Active/Inactive */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <label className="text-[11px] font-mono uppercase font-bold text-slate-500 block">
                Existing Reason Codes ({downtimeReasons.length}):
              </label>
              {downtimeReasons.map(r => {
                const isActive = r.active !== false;
                const isEditing = editingReasonId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition ${
                      isActive ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex-1 mr-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900">[{r.code}]</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600 uppercase">
                          {r.categoryLabel || r.category}
                        </span>
                        {!isActive && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                            DEACTIVATED
                          </span>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="flex items-center space-x-1 mt-1">
                          <input
                            type="text"
                            value={editingReasonLabel}
                            onChange={e => setEditingReasonLabel(e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-300 rounded text-xs w-full"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              updateDowntimeReason(r.id, { label: editingReasonLabel });
                              setEditingReasonId(null);
                            }}
                            className="px-2 py-1 bg-emerald-600 text-white font-bold rounded cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="font-medium text-slate-800 mt-0.5">{r.label}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingReasonId(null);
                          } else {
                            setEditingReasonId(r.id);
                            setEditingReasonLabel(r.label);
                          }
                        }}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer"
                        title="Edit label"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDowntimeReasonActive(r.id)}
                        className={`p-1.5 rounded-lg font-bold flex items-center space-x-1 cursor-pointer ${
                          isActive ? 'text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-200'
                        }`}
                        title={isActive ? 'Deactivate code' : 'Activate code'}
                      >
                        {isActive ? <ToggleRight className="w-6 h-6 text-emerald-600" /> : <ToggleLeft className="w-6 h-6 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowAdminConfigModal(false)}
              className="w-full min-h-[48px] bg-slate-900 hover:bg-black text-white font-black text-sm uppercase rounded-xl cursor-pointer"
            >
              Done Managing Codes
            </button>
          </div>
        </div>
      )}

      {/* ── iOS PWA Installation Guide Modal ───────────────────────── */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">
                Install on iPhone / iPad
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <span>Tap the <strong>Share button</strong> in your Safari bottom toolbar.</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <span>Tap <strong>Add</strong> in the top-right corner to open in full screen without browser bars.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[48px] bg-slate-900 text-white font-black text-sm uppercase rounded-xl"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
