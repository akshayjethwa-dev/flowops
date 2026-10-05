// src/services/plantService.ts
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, serverTimestamp,
  onSnapshot, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { PlantExtended, WorkCenter, ShiftPattern } from '../types/plant';
import { syncEngine } from './syncEngine';

const DEFAULT_SHIFTS: ShiftPattern[] = [
  { id: 'shift-morning', name: 'Morning', startTime: '06:00', endTime: '14:00', daysOfWeek: [1,2,3,4,5,6], breakDurationMinutes: 30 },
  { id: 'shift-afternoon', name: 'Afternoon', startTime: '14:00', endTime: '22:00', daysOfWeek: [1,2,3,4,5,6], breakDurationMinutes: 30 },
  { id: 'shift-night', name: 'Night', startTime: '22:00', endTime: '06:00', daysOfWeek: [1,2,3,4,5,6], breakDurationMinutes: 30 },
];

// ─── Plant CRUD ────────────────────────────────────────────────

export async function createPlant(
  tenantId: string,
  data: Omit<PlantExtended, 'id' | 'tenantId' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'tenants', tenantId, 'plants'),
    { ...data, tenantId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
  );
  return ref.id;
}

export async function createPlantOffline(
  tenantId: string,
  data: Omit<PlantExtended, 'id' | 'tenantId' | 'createdAt'>
): Promise<string> {
  const plantId = `plant_${crypto.randomUUID().slice(0, 8)}`;
  await syncEngine.create(`tenants/${tenantId}/plants`, plantId, {
    ...data, tenantId, _offlineCreated: true,
  });
  return plantId;
}

export async function updateWorkCenterOffline(
  tenantId: string, plantId: string, wcId: string, updates: Partial<WorkCenter>
) {
  await syncEngine.write(`tenants/${tenantId}/plants/${plantId}/workCenters`, wcId, updates);
}

export async function getPlants(tenantId: string): Promise<PlantExtended[]> {
  const snap = await getDocs(collection(db, 'tenants', tenantId, 'plants'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PlantExtended));
}

export function subscribeToPlants(
  tenantId: string,
  callback: (plants: PlantExtended[]) => void
) {
  return onSnapshot(
    collection(db, 'tenants', tenantId, 'plants'),
    (snap) => {
      const plants = snap.docs.map(d => ({ id: d.id, ...d.data() } as PlantExtended));
      callback(plants);
    }
  );
}

export async function updatePlant(
  tenantId: string,
  plantId: string,
  updates: Partial<PlantExtended>
) {
  await updateDoc(
    doc(db, 'tenants', tenantId, 'plants', plantId),
    { ...updates, updatedAt: serverTimestamp() }
  );
}

// ─── Work Center CRUD ──────────────────────────────────────────

export async function createWorkCenter(
  tenantId: string,
  plantId: string,
  data: Omit<WorkCenter, 'id' | 'plantId' | 'tenantId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'tenants', tenantId, 'plants', plantId, 'workCenters'),
    { ...data, plantId, tenantId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
  );
  return ref.id;
}

export async function getWorkCenters(
  tenantId: string,
  plantId: string
): Promise<WorkCenter[]> {
  const snap = await getDocs(
    collection(db, 'tenants', tenantId, 'plants', plantId, 'workCenters')
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkCenter));
}

export function subscribeToWorkCenters(
  tenantId: string,
  plantId: string,
  callback: (wcs: WorkCenter[]) => void
) {
  return onSnapshot(
    collection(db, 'tenants', tenantId, 'plants', plantId, 'workCenters'),
    (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkCenter)));
    }
  );
}

// ─── Default Data Seeder ───────────────────────────────────────

export async function seedDefaultPlant(
  tenantId: string,
  plantName: string,
  location: string
): Promise<string> {
  const plantId = await createPlant(tenantId, {
    name: plantName,
    location,
    gstin: '',
    timezone: 'Asia/Kolkata',
    processStages: [],
    shiftPatterns: DEFAULT_SHIFTS,
  });

  // Seed default work centers
  const defaults = [
    { name: 'Raw Material Store', code: 'WC-STORE-001', type: 'storage' as const, capacityPerHour: 0, costPerHour: 0 },
    { name: 'Cutting Station', code: 'WC-CUT-001', type: 'machine' as const, capacityPerHour: 20, costPerHour: 450 },
    { name: 'CNC Machining Center', code: 'WC-CNC-001', type: 'machine' as const, capacityPerHour: 8, costPerHour: 1200 },
    { name: 'Assembly Bay', code: 'WC-ASM-001', type: 'assembly' as const, capacityPerHour: 5, costPerHour: 600 },
    { name: 'Quality Inspection', code: 'WC-QC-001', type: 'inspection' as const, capacityPerHour: 15, costPerHour: 350 },
    { name: 'Finished Goods Store', code: 'WC-FG-001', type: 'storage' as const, capacityPerHour: 0, costPerHour: 0 },
  ];

  const batch = writeBatch(db);
  for (const wc of defaults) {
    const ref = doc(collection(db, 'tenants', tenantId, 'plants', plantId, 'workCenters'));
    batch.set(ref, { ...wc, assignedOperatorIds: [], status: 'active', plantId, tenantId, createdAt: serverTimestamp() });
  }
  await batch.commit();

  return plantId;
}