// src/types/plant.ts

export interface ShiftPattern {
  id: string;
  name: string;                    // e.g., "Morning", "Night"
  startTime: string;               // "06:00"
  endTime: string;                 // "14:00"
  daysOfWeek: number[];            // [1,2,3,4,5] — 0=Sunday
  breakDurationMinutes: number;
}

export interface WorkCenter {
  id: string;
  plantId: string;
  tenantId: string;
  name: string;                    // "CNC Lathe #3"
  code: string;                    // "WC-CNC-003"
  type: 'machine' | 'assembly' | 'inspection' | 'storage';
  capacityPerHour: number;         // units/hour
  costPerHour: number;             // ₹/hour
  assignedOperatorIds: string[];
  status: 'active' | 'maintenance' | 'idle';
  createdAt: string;
  updatedAt: string;
}

export interface PlantExtended {
  id: string;
  tenantId: string;
  name: string;
  location: string;
  gstin: string;
  timezone: string;                // "Asia/Kolkata"
  processStages: any[];            // from existing ProductionStageConfig
  shiftPatterns: ShiftPattern[];
  createdAt: string;
}

export interface Organization {
  id: string;                      // = tenantId
  companyName: string;
  gstin: string;
  sandboxMode: boolean;
  createdAt: string;
}