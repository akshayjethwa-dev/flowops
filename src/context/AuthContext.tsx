// src/context/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { auth, db } from '../firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  writeBatch,
  limit,
} from 'firebase/firestore';

import {
  UserProfile,
  UserRole,
  Tenant,
  PlantExtended,
  ShiftPattern,
  ProductionStageConfig,
  CustomClaims,
} from '../types';
import { subscribeToPlants } from '../services/plantService';
import { recordLoginAudit } from '../utils/auditLogger';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'needs_onboarding'
  | 'active'
  | 'suspended';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  tenant: Tenant | null;
  authStatus: AuthStatus;
  isSandboxMode: boolean;

  // ── Plant state (STEP 2 additions) ────────────────────────────
  activePlantId: string | null;
  /** Derived object for the currently active plant, or null for "all". */
  activePlant: PlantExtended | null;
  setActivePlantId: (plantId: string | null) => void;
  plants: PlantExtended[];
  loadingPlants: boolean;

  // ── Auth actions ──────────────────────────────────────────────
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  switchToSandboxRole: (role: UserRole) => void;
  initializeSandbox: (companyName: string, initialRole?: UserRole) => void;

  // ── Profile helpers (STEP 2 addition: refreshProfile) ─────────
  updateProfileLocally: (updates: Partial<UserProfile>) => void;
  refreshProfile: () => Promise<void>;

  setAuthStatus: (status: AuthStatus) => void;
  refreshPlants: () => void;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_PLANT_KEY = 'flowops_active_plant_id';
const ALL_PLANTS = 'all';
const DEFAULT_PLANT_TIMEZONE = 'Asia/Kolkata';

// ─── Default data for sandbox mode / first-run seeding ─────────
const DEFAULT_SHIFTS: ShiftPattern[] = [
  { id: 'shift-morning',   name: 'Morning',   startTime: '06:00', endTime: '14:00', daysOfWeek: [1,2,3,4,5,6], breakDurationMinutes: 30 },
  { id: 'shift-afternoon', name: 'Afternoon', startTime: '14:00', endTime: '22:00', daysOfWeek: [1,2,3,4,5,6], breakDurationMinutes: 30 },
  { id: 'shift-night',     name: 'Night',     startTime: '22:00', endTime: '06:00', daysOfWeek: [1,2,3,4,5,6], breakDurationMinutes: 30 },
];

const DEFAULT_PUNE_STAGES: ProductionStageConfig[] = [
  { id: 'pune_material_cutting', name: 'Material Cutting', color: 'indigo', isFinalStage: false, order: 0 },
  { id: 'pune_heating_welding', name: 'Pre-Heating & Welding', color: 'blue', isFinalStage: false, order: 1 },
  { id: 'pune_cnc_machining', name: 'Precision CNC Machining', color: 'amber', isFinalStage: false, order: 2 },
  { id: 'pune_assembly', name: 'Shopfloor Assembly', color: 'purple', isFinalStage: false, order: 3 },
  { id: 'pune_quality_check', name: 'NDT & Quality Check', color: 'pink', isFinalStage: false, order: 4 },
  { id: 'pune_ready_dispatch', name: 'Ready for Dispatch', color: 'green', isFinalStage: true, order: 5 },
];

const DEFAULT_VADODARA_STAGES: ProductionStageConfig[] = [
  { id: 'vadodara_raw_material', name: 'Raw Material Intake', color: 'indigo', isFinalStage: false, order: 0 },
  { id: 'vadodara_casting', name: 'Casting & Molding', color: 'blue', isFinalStage: false, order: 1 },
  { id: 'vadodara_fettling', name: 'Fettling & Grinding', color: 'amber', isFinalStage: false, order: 2 },
  { id: 'vadodara_heat_treatment', name: 'Heat Treatment', color: 'purple', isFinalStage: false, order: 3 },
  { id: 'vadodara_ndt_testing', name: 'NDT Testing', color: 'pink', isFinalStage: false, order: 4 },
  { id: 'vadodara_packaging_ready', name: 'Packaging & Ready', color: 'green', isFinalStage: true, order: 5 },
];

function buildDefaultPlants(tenantId: string): PlantExtended[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'plant-pune',
      tenantId,
      name: 'Pune Heavy Forge Facility',
      location: 'Plot 104, MIDC Phase II, Chikhli, Pune, MH',
      gstin: '27AAACB1234F1Z1',
      timezone: DEFAULT_PLANT_TIMEZONE,
      processStages: DEFAULT_PUNE_STAGES,
      shiftPatterns: DEFAULT_SHIFTS,
      createdAt: now,
    },
    {
      id: 'plant-vadodara',
      tenantId,
      name: 'Vadodara Foundry Plant',
      location: 'Plot 42, GIDC Industrial Estate, Sector 3, Vadodara, Gujarat',
      gstin: '24AAACB1234F1Z2',
      timezone: DEFAULT_PLANT_TIMEZONE,
      processStages: DEFAULT_VADODARA_STAGES,
      shiftPatterns: DEFAULT_SHIFTS,
      createdAt: now,
    },
  ];
}

// ─── Helper: backfill new fields on legacy profiles ────────────
function normalizeProfile(raw: any, fallbackUid: string): UserProfile {
  return {
    uid: raw.uid ?? fallbackUid,
    email: raw.email ?? '',
    name: raw.name ?? 'User',
    tenantId: raw.tenantId ?? '',
    role: (raw.role as UserRole) ?? 'viewer',
    phone: raw.phone,
    createdAt: raw.createdAt,
    isSuperAdmin: raw.isSuperAdmin,
    plantId: raw.plantId,
    assignedPlantIds: Array.isArray(raw.assignedPlantIds) ? raw.assignedPlantIds : [],
    defaultPlantId: typeof raw.defaultPlantId === 'string' ? raw.defaultPlantId : '',
    assignedStageIds: raw.assignedStageIds,
    customClaims: raw.customClaims,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [isSandboxMode, setIsSandboxMode] = useState(false);

  const [activePlantId, setActivePlantIdState] = useState<string | null>(null);
  const [plants, setPlants] = useState<PlantExtended[]>([]);
  const [loadingPlants, setLoadingPlants] = useState(false);

  // Track the current plant subscription so we can clean it up
  const plantsUnsubRef = useRef<(() => void) | null>(null);

  // ─── Setter with validation + persistence ─────────────────────
  const setActivePlantId = useCallback(
    (id: string | null) => {
      if (!profile) {
        setActivePlantIdState(id);
        if (id) localStorage.setItem(ACTIVE_PLANT_KEY, id);
        else localStorage.removeItem(ACTIVE_PLANT_KEY);
        return;
      }

      const assigned = profile.assignedPlantIds ?? [];

      // Block switching to a plant the user isn't assigned to
      if (id && id !== ALL_PLANTS && assigned.length > 0 && !assigned.includes(id)) {
        console.warn(`[Auth] Access denied to plant ${id}. Not in assignedPlantIds.`);
        return;
      }

      // Block switching to "all" if the user is restricted
      if (id === ALL_PLANTS && assigned.length > 0) {
        console.warn('[Auth] Access denied to "all" plants. User has restricted plant access.');
        return;
      }

      setActivePlantIdState(id);
      if (id) localStorage.setItem(ACTIVE_PLANT_KEY, id);
      else localStorage.removeItem(ACTIVE_PLANT_KEY);
    },
    [profile]
  );

  // ═════════════════════════════════════════════════════════════
  // STEP 2 — Plant subscription (replaces the old inline logic)
  // ═════════════════════════════════════════════════════════════
  useEffect(() => {
    // Tear down any previous subscription first
    if (plantsUnsubRef.current) {
      plantsUnsubRef.current();
      plantsUnsubRef.current = null;
    }

    if (!tenant?.id) {
      setPlants([]);
      setLoadingPlants(false);
      return;
    }

    const isSandbox =
      isSandboxMode ||
      localStorage.getItem('isSandboxMode') === 'true' ||
      !db;

    // ─── SANDBOX PATH (unchanged behaviour) ────────────────────
    if (isSandbox) {
      try {
        const cacheKey = `flowops_plants_${tenant.id}`;
        const cached = localStorage.getItem(cacheKey);
        let list: PlantExtended[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          list = buildDefaultPlants(tenant.id);
          localStorage.setItem(cacheKey, JSON.stringify(list));
        }

        setPlants(list);
        setLoadingPlants(false);
      } catch (e) {
        console.error('[Auth] Error loading sandbox plants:', e);
        setLoadingPlants(false);
      }
      return;
    }

    // ─── PRODUCTION PATH — subscribeToPlants ───────────────────
    setLoadingPlants(true);

    const unsub = subscribeToPlants(tenant.id, async (list) => {
      // First-run seeding: if the tenant has zero plants, seed the defaults
      if (list.length === 0) {
        try {
          const batch = writeBatch(db);
          const defaults = buildDefaultPlants(tenant.id);
          defaults.forEach((p) => {
            const ref = doc(db, 'tenants', tenant.id, 'plants', p.id);
            batch.set(ref, {
              tenantId: p.tenantId,
              name: p.name,
              location: p.location,
              gstin: p.gstin,
              timezone: p.timezone,
              processStages: p.processStages,
              shiftPatterns: p.shiftPatterns,
              createdAt: p.createdAt,
            });
          });
          await batch.commit();
          // onSnapshot will fire again with the seeded docs
          return;
        } catch (err) {
          console.error('[Auth] Error seeding default plants:', err);
          setLoadingPlants(false);
          return;
        }
      }

      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
      setPlants(sorted);
      setLoadingPlants(false);
    });

    plantsUnsubRef.current = unsub;

    return () => {
      unsub();
      plantsUnsubRef.current = null;
    };
  }, [tenant?.id, isSandboxMode]);

  // ═════════════════════════════════════════════════════════════
  // STEP 2 — Plant assignment enforcement (§1.2.4)
  // ═════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!profile) return;

    const assigned = profile.assignedPlantIds ?? [];
    const saved = localStorage.getItem(ACTIVE_PLANT_KEY);

    const isSelectable = (id: string): boolean => {
      if (id === ALL_PLANTS) return assigned.length === 0;
      if (plants.length > 0 && !plants.some((p) => p.id === id)) return false;
      if (assigned.length === 0) return true;
      return assigned.includes(id);
    };

    // 1. Honour saved preference if still valid
    if (saved && isSelectable(saved)) {
      setActivePlantIdState(saved);
      return;
    }

    // 2. Fall back to profile default if valid
    if (profile.defaultPlantId && isSelectable(profile.defaultPlantId)) {
      setActivePlantIdState(profile.defaultPlantId);
      localStorage.setItem(ACTIVE_PLANT_KEY, profile.defaultPlantId);
      return;
    }

    // 3. First assigned plant (only once plants have loaded)
    if (assigned.length > 0 && plants.length > 0) {
      const firstValid = plants.find((p) => assigned.includes(p.id))?.id;
      if (firstValid) {
        setActivePlantIdState(firstValid);
        localStorage.setItem(ACTIVE_PLANT_KEY, firstValid);
        return;
      }
    }

    // 4. Unrestricted user → "all"
    if (assigned.length === 0) {
      setActivePlantIdState(ALL_PLANTS);
      localStorage.setItem(ACTIVE_PLANT_KEY, ALL_PLANTS);
    }
  }, [profile, plants]);

  // ─── Sandbox restore / Firebase auth listener ─────────────────
  useEffect(() => {
    // Attempt to load sandbox from LocalStorage to persist reload states
    const sandboxUser = localStorage.getItem('flowops_sandbox_profile');
    const sandboxTenant = localStorage.getItem('flowops_sandbox_tenant');

    if (sandboxUser && sandboxTenant) {
      const parsedProfile = normalizeProfile(JSON.parse(sandboxUser), 'sandbox-user');
      setProfile(parsedProfile);
      setTenant(JSON.parse(sandboxTenant));
      setIsSandboxMode(true);
      localStorage.setItem('isSandboxMode', 'true');
      setAuthStatus('active');
      return;
    }

    // Otherwise connect to the authentic Firebase stream
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setTenant(null);
        setAuthStatus('unauthenticated');
        return;
      }

      setUser(firebaseUser);

      try {
        // ── 1. Load existing profile ───────────────────────────
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const normalized = normalizeProfile(userSnap.data(), firebaseUser.uid);

          // Inspect Firebase Auth Custom Claims (unchanged)
          let effectiveRole: UserRole = normalized.role;
          let effectiveTenantId: string = normalized.tenantId;
          let customClaimsSnapshot: CustomClaims | undefined = undefined;

          try {
            const idTokenResult = await firebaseUser.getIdTokenResult();
            if (idTokenResult.claims) {
              // ✅ FIX: spread FIRST, then force required fields so that
              //    `tenantId` is guaranteed to be a `string`, not `string | undefined`.
              customClaimsSnapshot = {
                ...(idTokenResult.claims as any),
                role: (idTokenResult.claims.role as UserRole) || normalized.role,
                tenantId:
                  (idTokenResult.claims.tenantId as string | undefined) ||
                  normalized.tenantId,
                isSuperAdmin: !!idTokenResult.claims.isSuperAdmin,
              };

              if (idTokenResult.claims.role) {
                effectiveRole = idTokenResult.claims.role as UserRole;
              }
              if (idTokenResult.claims.tenantId) {
                effectiveTenantId = idTokenResult.claims.tenantId as string;
              }
            }
          } catch (claimsErr) {
            console.warn('Could not inspect Firebase token claims:', claimsErr);
          }

          const mergedProfile: UserProfile = {
            ...normalized,
            role: effectiveRole,
            tenantId: effectiveTenantId,
            customClaims:
              customClaimsSnapshot || { role: effectiveRole, tenantId: effectiveTenantId },
          };

          setProfile(mergedProfile);

          // ── 2. Suspension check ─────────────────────────────
          let isActive = true;
          const tenantUserRef = doc(
            db,
            'tenants',
            effectiveTenantId,
            'users',
            firebaseUser.uid
          );
          const tenantUserSnap = await getDoc(tenantUserRef);

          if (tenantUserSnap.exists()) {
            const tData = tenantUserSnap.data();
            if (tData.status === 'Inactive' || tData.status === 'Suspended') {
              isActive = false;
            }
          }

          // ── 3. Tenant config ────────────────────────────────
          const tenantRef = doc(db, 'tenants', effectiveTenantId);
          const tenantSnap = await getDoc(tenantRef);

          if (tenantSnap.exists()) {
            setTenant(tenantSnap.data() as Tenant);
            const finalStatus = isActive ? 'active' : 'suspended';
            setAuthStatus(finalStatus);

            if (isActive) {
              recordLoginAudit({
                tenantId: effectiveTenantId,
                userId: firebaseUser.uid,
                userEmail: firebaseUser.email || '',
                userName:
                  mergedProfile.name || firebaseUser.displayName || 'Operator',
                role: effectiveRole,
                authProvider:
                  firebaseUser.providerData[0]?.providerId === 'google.com'
                    ? 'google'
                    : 'password',
                status: 'SUCCESS',
                customClaims: mergedProfile.customClaims,
                isSandboxMode: false,
              });
            }
          } else {
            console.error(
              'CRITICAL: User profile exists, but associated tenant is missing.'
            );
            setAuthStatus('unauthenticated');
          }

          return;
        }

        // ── 4. Invite acceptance path ───────────────────────────
        const inviteQuery = query(
          collection(db, 'invites'),
          where('email', '==', firebaseUser.email),
          where('status', '==', 'pending'),
          limit(1)
        );
        const inviteSnap = await getDocs(inviteQuery);

        if (!inviteSnap.empty) {
          const inviteDoc = inviteSnap.docs[0];
          const inviteData = inviteDoc.data();

          const userProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: inviteData.name || firebaseUser.displayName || 'Operator',
            tenantId: inviteData.tenantId,
            role: inviteData.role,
            createdAt: new Date().toISOString(),
            // STEP 2 — copy plant assignments from invite if present
            assignedPlantIds: Array.isArray(inviteData.assignedPlantIds)
              ? inviteData.assignedPlantIds
              : [],
            defaultPlantId:
              typeof inviteData.defaultPlantId === 'string'
                ? inviteData.defaultPlantId
                : '',
          };

          await setDoc(doc(db, 'users', firebaseUser.uid), userProfile);

          await setDoc(
            doc(db, 'tenants', inviteData.tenantId, 'users', firebaseUser.uid),
            {
              name: userProfile.name,
              email: userProfile.email,
              role: userProfile.role,
              status: 'Active',
              invitedAt: inviteData.createdAt,
              createdAt: serverTimestamp(),
              assignedPlantIds: userProfile.assignedPlantIds,
              defaultPlantId: userProfile.defaultPlantId,
            }
          );

          await updateDoc(inviteDoc.ref, {
            status: 'accepted',
            acceptedAt: serverTimestamp(),
            acceptedByUid: firebaseUser.uid,
          });

          setProfile(userProfile);

          const tenantRef = doc(db, 'tenants', inviteData.tenantId);
          const tenantSnap = await getDoc(tenantRef);
          if (tenantSnap.exists()) {
            setTenant(tenantSnap.data() as Tenant);
            setAuthStatus('active');
          } else {
            console.error(
              'CRITICAL: Accepted invite points to a missing tenant.'
            );
            setAuthStatus('unauthenticated');
          }

          return;
        }

        // ── 5. Owner bootstrap path ─────────────────────────────
        const newTenantId = `tnt_${Date.now()}_${firebaseUser.uid.substring(0, 6)}`;

        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Workspace Owner',
          tenantId: newTenantId,
          role: 'admin',
          createdAt: new Date().toISOString(),
          // STEP 2 — owner starts unrestricted
          assignedPlantIds: [],
          defaultPlantId: '',
        };

        const newTenant: Tenant = {
          id: newTenantId,
          companyName: '',
          gstin: '',
          address: '',
          currency: 'INR (₹)',
          createdAt: new Date().toISOString(),
        };

        try {
          const batch = writeBatch(db);

          batch.set(doc(db, 'users', firebaseUser.uid), userProfile);

          batch.set(doc(db, 'tenants', newTenantId), {
            id: newTenantId,
            companyName: 'New Company',
            createdAt: serverTimestamp(),
            onboardingCompleted: false,
          });

          batch.set(
            doc(db, 'tenants', newTenantId, 'users', firebaseUser.uid),
            {
              name: userProfile.name,
              email: userProfile.email,
              role: 'admin',
              status: 'Active',
              createdAt: serverTimestamp(),
              assignedPlantIds: [],
              defaultPlantId: '',
            }
          );

          await batch.commit();

          setProfile(userProfile);
          setTenant(newTenant);
          setAuthStatus('needs_onboarding');
        } catch (bootstrapErr) {
          console.error('Failed to provision workspace shell:', bootstrapErr);
          setAuthStatus('unauthenticated');
        }
      } catch (e: any) {
        console.error('Error in Auth profile retrieval: ', e);
        if (e.code === 'permission-denied') {
          console.warn(
            'Permission denied while fetching user. Re-evaluating Firestore rules.'
          );
        }
        setAuthStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, []);

  // ═════════════════════════════════════════════════════════════
  // STEP 2 — Derived activePlant object
  // ═════════════════════════════════════════════════════════════
  const activePlant = useMemo<PlantExtended | null>(() => {
    if (!activePlantId || activePlantId === ALL_PLANTS) return null;
    return plants.find((p) => p.id === activePlantId) ?? null;
  }, [plants, activePlantId]);

  // ─── Sign-in / Sign-out ───────────────────────────────────────
  const signInWithGoogle = async () => {
    setAuthStatus('loading');
    localStorage.removeItem('flowops_sandbox_profile');
    localStorage.removeItem('flowops_sandbox_tenant');
    localStorage.removeItem('isSandboxMode');
    setIsSandboxMode(false);

    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error('Google Auth Failed: ', e);
      setAuthStatus('unauthenticated');
    }
  };

  const signOut = async () => {
    setAuthStatus('loading');

    // Clean up plant subscription
    if (plantsUnsubRef.current) {
      plantsUnsubRef.current();
      plantsUnsubRef.current = null;
    }

    localStorage.removeItem('flowops_sandbox_profile');
    localStorage.removeItem('flowops_sandbox_tenant');
    localStorage.removeItem('isSandboxMode');
    localStorage.removeItem(ACTIVE_PLANT_KEY);

    setIsSandboxMode(false);
    setUser(null);
    setProfile(null);
    setTenant(null);
    setPlants([]);
    setActivePlantIdState(null);

    await firebaseSignOut(auth);
    setAuthStatus('unauthenticated');
  };

  // ─── Sandbox init / role switch (unchanged) ───────────────────
  const initializeSandbox = (
    companyName: string,
    initialRole: UserRole = 'admin'
  ) => {
    setAuthStatus('loading');
    const mockTenantId = `tenant_demo_${Math.random().toString(36).substring(2, 7)}`;

    const mockTenant: Tenant = {
      id: mockTenantId,
      companyName: companyName || 'Bharat Gearworks Ltd.',
      gstin: '27AAACB1234F1Z1',
      address: 'Plot 42, GIDC Industrial Estate, Sector 3, Vadodara, Gujarat',
      currency: '₹',
      createdAt: new Date().toISOString(),
    };

    const personaNames: Record<UserRole, string> = {
      admin: 'Rajesh Patel (Business Owner)',
      manager: 'Ananya Sharma (Operations Manager)',
      operator: 'Harpreet Singh (Shopfloor Operator)',
      quality_inspector: 'Vikram Malhotra (Quality Inspector)',
      store_keeper: 'Ramesh Verma (Store Keeper)',
      viewer: 'Preeti Nair (Management Viewer)',
      sales: 'Siddharth Rao (Sales Engineer)',
      production: 'Manoj Tiwari (Production Supervisor)',
      dispatch: 'Amitabh Joshi (Dispatch Clerk)',
      management: 'Sunita Aggarwal (Executive)',
    };

    const mockProfile: UserProfile = {
      uid: `user_demo_${Math.random().toString(36).substring(2, 7)}`,
      email: `${initialRole}.demo@bharatgears.co.in`,
      name: personaNames[initialRole] || 'Rajesh Patel',
      tenantId: mockTenantId,
      role: initialRole,
      phone: '+919876543210',
      createdAt: new Date().toISOString(),
      // STEP 2 — sandbox owner is unrestricted
      assignedPlantIds: [],
      defaultPlantId: '',
      customClaims: {
        role: initialRole,
        tenantId: mockTenantId,
      },
    };

    localStorage.setItem('flowops_sandbox_profile', JSON.stringify(mockProfile));
    localStorage.setItem('flowops_sandbox_tenant', JSON.stringify(mockTenant));
    localStorage.setItem('isSandboxMode', 'true');

    setProfile(mockProfile);
    setTenant(mockTenant);
    setIsSandboxMode(true);
    setAuthStatus('active');

    recordLoginAudit({
      tenantId: mockTenantId,
      userId: mockProfile.uid,
      userEmail: mockProfile.email,
      userName: mockProfile.name,
      role: initialRole,
      authProvider: 'sandbox',
      status: 'SUCCESS',
      customClaims: { role: initialRole, tenantId: mockTenantId },
      isSandboxMode: true,
    });
  };

  const switchToSandboxRole = (role: UserRole) => {
    if (!profile) return;

    const updated: UserProfile = {
      ...profile,
      role,
      customClaims: {
        ...(profile.customClaims || {}),
        role,
        tenantId: profile.tenantId,
      },
    };
    setProfile(updated);

    if (isSandboxMode) {
      localStorage.setItem('flowops_sandbox_profile', JSON.stringify(updated));
      recordLoginAudit({
        tenantId: profile.tenantId,
        userId: profile.uid,
        userEmail: profile.email,
        userName: `${profile.name} (Assumed ${role})`,
        role,
        authProvider: 'sandbox',
        status: 'SUCCESS',
        customClaims: { role, tenantId: profile.tenantId },
        isSandboxMode: true,
      });
    } else {
      console.warn(
        'Action blocked: Role updates in production must be managed exclusively by an admin via the Roster interface.'
      );
    }
  };

  // ─── Profile helpers ──────────────────────────────────────────
  const updateProfileLocally = (updates: Partial<UserProfile>) => {
    if (!profile) return;

    // SECURITY: Prevent non-admins from escalating to Super Admin
    if (updates.isSuperAdmin !== undefined && profile.role !== 'admin') {
      console.warn(
        'Action blocked: Only Owner/Admin roles can toggle Super Admin mode.'
      );
      return;
    }

    const updated = { ...profile, ...updates };
    setProfile(updated);

    if (isSandboxMode) {
      localStorage.setItem('flowops_sandbox_profile', JSON.stringify(updated));
    }
  };

  // ═════════════════════════════════════════════════════════════
  // STEP 2 — refreshProfile (re-fetches from Firestore)
  // ═════════════════════════════════════════════════════════════
  const refreshProfile = useCallback(async () => {
    if (!user || !db) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const normalized = normalizeProfile(snap.data(), user.uid);
        // Preserve the current custom claims merge
        setProfile((prev) =>
          prev
            ? { ...normalized, customClaims: prev.customClaims ?? normalized.customClaims }
            : normalized
        );
      }
    } catch (e) {
      console.error('[Auth] refreshProfile failed:', e);
    }
  }, [user]);

  // ─── Plant helpers ────────────────────────────────────────────
  const refreshPlants = () => {
    if (!tenant?.id) return;
    const isSandbox =
      isSandboxMode || localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      try {
        const cached = localStorage.getItem(`flowops_plants_${tenant.id}`);
        if (cached) setPlants(JSON.parse(cached));
      } catch (e) {
        console.error('Error reloading sandbox plants:', e);
      }
    }
    // Production uses onSnapshot (via subscribeToPlants) — no-op needed
  };

  // ─── Claims refresh ───────────────────────────────────────────
  const refreshClaims = async () => {
    if (user) {
      try {
        const tokenResult = await user.getIdTokenResult(true);
        if (tokenResult.claims && profile) {
          const newRole = (tokenResult.claims.role as UserRole) || profile.role;
          const newClaims: CustomClaims = {
            ...(profile.customClaims || { role: newRole, tenantId: profile.tenantId }),
            ...(tokenResult.claims as any),
            role: newRole,
            tenantId:
              (tokenResult.claims.tenantId as string | undefined) ||
              profile.tenantId,
          };
          setProfile({
            ...profile,
            role: newRole,
            customClaims: newClaims,
          });
        }
      } catch (e) {
        console.error('Failed to force refresh token claims:', e);
      }
    }
  };

  // ─── Context value ────────────────────────────────────────────
  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        tenant,
        authStatus,
        isSandboxMode,

        // Plant state
        activePlantId,
        activePlant,
        setActivePlantId,
        plants,
        loadingPlants,

        // Actions
        signInWithGoogle,
        signOut,
        switchToSandboxRole,
        initializeSandbox,

        // Profile helpers
        updateProfileLocally,
        refreshProfile,
        setAuthStatus,

        // Plant/claim helpers
        refreshPlants,
        refreshClaims,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};