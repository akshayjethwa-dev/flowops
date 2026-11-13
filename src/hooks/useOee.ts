// src/hooks/useOee.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MachineLiveOee,
  MachineConnectionConfig,
  PlantOeeSummary,
  MachineState,
  HistoricalOeePoint,
  DowntimeLossCategory,
  DowntimeReasonCode,
  DowntimeEventRecord,
  DowntimeParetoItem
} from '../types/oee';
import { oeeService } from '../services/oeeService';

export function useOee() {
  const [machines, setMachines] = useState<MachineLiveOee[]>(() => oeeService.getMachines());
  const [configs, setConfigs] = useState<MachineConnectionConfig[]>(() => oeeService.getConnectionConfigs());
  const [summary, setSummary] = useState<PlantOeeSummary>(() => oeeService.getPlantOeeSummary());
  const [downtimeReasons, setDowntimeReasons] = useState<DowntimeReasonCode[]>(() => oeeService.getDowntimeReasons());
  const [downtimeEvents, setDowntimeEvents] = useState<DowntimeEventRecord[]>(() => oeeService.getDowntimeEvents());

  useEffect(() => {
    const unsub = oeeService.subscribe(() => {
      setMachines(oeeService.getMachines());
      setConfigs(oeeService.getConnectionConfigs());
      setSummary(oeeService.getPlantOeeSummary());
      setDowntimeReasons(oeeService.getDowntimeReasons());
      setDowntimeEvents(oeeService.getDowntimeEvents());
    });
    return unsub;
  }, []);

  const setMachineState = useCallback((machineId: string, state: MachineState, reason?: string) => {
    return oeeService.setMachineState(machineId, state, reason);
  }, []);

  const updateConnectionConfig = useCallback((config: MachineConnectionConfig) => {
    return oeeService.updateConnectionConfig(config);
  }, []);

  const testOpcuaPing = useCallback((machineId: string) => {
    return oeeService.testOpcuaPing(machineId);
  }, []);

  const getHistoricalTrends = useCallback((timeframe: 'today' | 'last_7_days' | 'last_30_days'): HistoricalOeePoint[] => {
    return oeeService.getHistoricalOeeTrends(timeframe);
  }, []);

  const downtimeLosses = useMemo(() => {
    return oeeService.getDowntimeLossCategories();
  }, []);

  const logDowntimeEvent = useCallback((params: {
    machineId: string;
    reasonCodeId: string;
    operatorId: string;
    operatorName: string;
    jobId?: string;
    workOrderNumber?: string;
    partName?: string;
    userId?: string;
    notes?: string;
    deviceTimestamp?: string;
    startTime?: string;
  }) => {
    return oeeService.logDowntimeEvent(params);
  }, []);

  const resolveDowntimeEvent = useCallback((eventId: string, correctiveAction?: string) => {
    return oeeService.resolveDowntimeEvent(eventId, correctiveAction);
  }, []);

  const resolveDowntimeEventForJob = useCallback((jobIdOrOrderNumber: string, correctiveAction?: string) => {
    return oeeService.resolveDowntimeEventForJob(jobIdOrOrderNumber, correctiveAction);
  }, []);

  const getActiveDowntimeEventForJob = useCallback((jobIdOrOrderNumber: string) => {
    return oeeService.getActiveDowntimeEventForJob(jobIdOrOrderNumber);
  }, []);

  const getDowntimeSummaryToday = useCallback((filterMachineOrCell?: string) => {
    return oeeService.getDowntimeSummaryToday(filterMachineOrCell);
  }, []);

  const autoCloseOverdueDowntimeEvents = useCallback(() => {
    return oeeService.autoCloseOverdueDowntimeEvents();
  }, []);

  const addDowntimeReason = useCallback((code: Omit<DowntimeReasonCode, 'id'>) => {
    return oeeService.addDowntimeReason(code);
  }, []);

  const updateDowntimeReason = useCallback((id: string, updates: Partial<DowntimeReasonCode>) => {
    return oeeService.updateDowntimeReason(id, updates);
  }, []);

  const toggleDowntimeReasonActive = useCallback((id: string) => {
    return oeeService.toggleDowntimeReasonActive(id);
  }, []);

  const deleteDowntimeReason = useCallback((id: string) => {
    return oeeService.deleteDowntimeReason(id);
  }, []);

  const getParetoAnalysis = useCallback(() => {
    return oeeService.getDowntimeParetoAnalysis();
  }, []);

  return {
    machines,
    configs,
    summary,
    downtimeLosses,
    downtimeReasons,
    downtimeEvents,
    setMachineState,
    updateConnectionConfig,
    testOpcuaPing,
    getHistoricalTrends,
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
    getParetoAnalysis
  };
}
