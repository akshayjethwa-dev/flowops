// src/types/oee.ts

export type MachineState = 'running' | 'idle' | 'faulted' | 'setup' | 'offline';

export type ConnectivityProtocol = 'opc_ua' | 'modbus_tcp' | 'mqtt_iot';

export interface MachineTelemetryTag {
  nodeId: string;           // e.g. "ns=2;s=CNC04.MachineState"
  name: string;             // e.g. "State Register"
  dataType: 'Int32' | 'Float' | 'Boolean' | 'String';
  currentValue: any;
  lastUpdated: string;
  unit?: string;            // "RPM", "%", "°C", "pcs"
}

export interface MachineConnectionConfig {
  machineId: string;
  machineCode: string;
  machineName: string;
  protocol: ConnectivityProtocol;
  endpointUrl: string;       // e.g. "opc.tcp://192.168.1.104:4840"
  securityMode: 'None' | 'Sign' | 'SignAndEncrypt';
  securityPolicy: 'None' | 'Basic256Sha256';
  nodeIdState: string;       // e.g. "ns=2;s=MachineState"
  nodeIdPartsGood: string;   // e.g. "ns=2;s=GoodPartCount"
  nodeIdPartsScrap: string;  // e.g. "ns=2;s=RejectPartCount"
  nodeIdSpindleRpm: string;  // e.g. "ns=2;s=SpindleRPM"
  nodeIdFeedrate: string;    // e.g. "ns=2;s=FeedrateOverride"
  pollingIntervalMs: number; // e.g. 1000 ms
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastPingMs: number;        // round-trip latency
  lastConnectedAt?: string;
  errorMessage?: string;
}

export interface MachineLiveOee {
  machineId: string;
  machineCode: string;       // "WC-CNC-04"
  machineName: string;       // "Doosan Puma CNC Lathe #04"
  department: string;        // "Machine Shop"
  state: MachineState;
  stateSince: string;        // ISO timestamp
  stateDurationMinutes: number;
  activeWorkOrderNumber?: string;
  activePartName?: string;
  plannedProductionMinutes: number; // Scheduled shift time (e.g. 480 min)
  operatingMinutes: number;         // Running time producing parts
  plannedDowntimeMinutes: number;   // Scheduled breaks (e.g. 30 min)
  unplannedDowntimeMinutes: number; // Faults, breakdowns, e-stops
  idleMinutes: number;              // Standby waiting for operator/material
  setupMinutes: number;             // Tool changeover, fixture setup
  totalPieces: number;
  goodPieces: number;
  scrapPieces: number;
  idealCycleTimeSeconds: number;    // Design cycle time per unit
  availabilityPercent: number;      // Operating / Planned Available Time
  performancePercent: number;       // (Ideal Cycle Time * Total Pieces) / Operating Time
  qualityPercent: number;           // Good Pieces / Total Pieces
  oeePercent: number;               // Availability * Performance * Quality
  telemetry: {
    spindleRpm: number;
    feedratePercent: number;
    temperatureCelsius: number;
    vibrationMmS: number;
    powerKw: number;
  };
  downtimeReason?: string;
  faultCode?: string;
}

export interface HistoricalOeePoint {
  timestamp: string;
  label: string;             // "08:00", "Mon", "Week 14"
  availability: number;      // 0 - 100%
  performance: number;       // 0 - 100%
  quality: number;           // 0 - 100%
  oee: number;               // 0 - 100%
  runningHours: number;
  downtimeHours: number;
  piecesProduced: number;
}

export interface DowntimeLossCategory {
  category: string;          // "Tool Breakage & Change", "Material Shortage", "Setup & Calibration"
  hours: number;
  percentage: number;
  occurrences: number;
  color: string;
}

export interface PlantOeeSummary {
  overallOeePercent: number;
  overallAvailabilityPercent: number;
  overallPerformancePercent: number;
  overallQualityPercent: number;
  worldClassBenchmarkPercent: number; // 85%
  runningMachinesCount: number;
  idleMachinesCount: number;
  faultedMachinesCount: number;
  setupMachinesCount: number;
  totalMachinesCount: number;
  totalPiecesProducedShift: number;
  totalScrapPiecesShift: number;
  totalOperatingHoursShift: number;
  totalDowntimeHoursShift: number;
  lastUpdated: string;
}

// ── Downtime Reason Codes & Event Tracking ──────────────────────────
export type Downtime5MCategory = 'machine' | 'material' | 'manpower' | 'method' | 'measurement';

export type DowntimeCategoryType = 
  | 'machine'        // 5M: Machine (Breakdown, Tool Change, Power, Setup)
  | 'material'       // 5M: Material (Starvation, Defect, Alloy, TC)
  | 'manpower'       // 5M: Manpower (Absent, Training, Handover, Fatigue)
  | 'method'         // 5M: Method (Drawing Rev, Program G-code, Process, Jig)
  | 'measurement'    // 5M: Measurement (1st Piece Buy-off, Gage, Dimensional)
  | 'breakdown'      // Legacy mapping: Equipment Failure
  | 'changeover'     // Legacy mapping: Setup & Tooling
  | 'starvation'     // Legacy mapping: Material Wait
  | 'quality_hold'   // Legacy mapping: Defect Verification
  | 'operator_rest'  // Legacy mapping: Shift Handover / Rest
  | 'utilities'      // Legacy mapping: Power / Air
  | 'other';         // Other / Custom Reason with note

export interface DowntimeReasonCode {
  id: string;
  code: string;              // e.g. "MC-BRK", "DT-MCH-01"
  label: string;             // e.g. "Breakdown", "Tool Change"
  category: DowntimeCategoryType;
  categoryLabel: string;      // "Machine", "Material", etc.
  severity?: 'critical' | 'high' | 'medium' | 'low';
  requiresTechnician?: boolean;
  color?: string;
  iconName?: string;
  suggestedAction?: string;
  active?: boolean;          // Configurable by admin: activate/deactivate
  isDefault?: boolean;
}

export interface DowntimeEventRecord {
  id: string;
  jobId?: string;            // Linked work order / job ID
  workOrderNumber?: string;
  partName?: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  startTime: string;         // ISO timestamp (device timestamp for conflict resolution)
  endTime?: string;          // ISO timestamp when resolved/resumed
  durationMinutes: number;   // Automatically calculated
  reasonCodeId: string;
  reasonCode: string;        // e.g. "MC-TOOL"
  reasonLabel: string;
  category: DowntimeCategoryType;
  categoryLabel: string;
  userId?: string;           // Operator / supervisor user ID
  operatorId: string;
  operatorName: string;
  notes?: string;
  resolved: boolean;
  auto_closed?: boolean;     // True if auto-closed after >12h overnight threshold
  auto_closed_reason?: string;
  correctiveActionTaken?: string;
  createdAt: string;
  deviceTimestamp?: string;  // Device timestamp for offline sync
}

export interface DowntimeParetoItem {
  code: string;
  label: string;
  category: DowntimeCategoryType;
  categoryLabel: string;
  totalDurationMinutes: number;
  totalHours: number;
  occurrences: number;
  percentage: number;
  cumulativePercentage: number;
  color: string;
}
