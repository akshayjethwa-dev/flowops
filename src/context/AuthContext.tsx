// src/context/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
<<<<<<< HEAD
  serverTimestamp 
} from 'firebase/firestore';
import { UserProfile, UserRole, Tenant } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  tenant: Tenant | null;
  isSandboxMode: boolean;
=======
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
  writeBatch,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { UserProfile, UserRole, Tenant, Plant, ProductionStageConfig } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

export type AuthStatus = 'loading' | 'unauthenticated' | 'needs_onboarding' | 'active' | 'suspended';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  tenant: Tenant | null;
  authStatus: AuthStatus;
  isSandboxMode: boolean;
  activePlantId: string | null;
  setActivePlantId: (plantId: string | null) => void;
  plants: Plant[];
  loadingPlants: boolean;
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  switchToSandboxRole: (role: UserRole) => void;
  initializeSandbox: (companyName: string) => void;
  updateProfileLocally: (updates: Partial<UserProfile>) => void;
<<<<<<< HEAD
=======
  setAuthStatus: (status: AuthStatus) => void;
  refreshPlants: () => void;
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

<<<<<<< HEAD
=======
const DEFAULT_PUNE_STAGES: ProductionStageConfig[] = [
  { id: 'pune_material_cutting', name: 'Material Cutting', color: 'indigo', isFinalStage: false, order: 0 },
  { id: 'pune_heating_welding', name: 'Pre-Heating & Welding', color: 'blue', isFinalStage: false, order: 1 },
  { id: 'pune_cnc_machining', name: 'Precision CNC Machining', color: 'amber', isFinalStage: false, order: 2 },
  { id: 'pune_assembly', name: 'Shopfloor Assembly', color: 'purple', isFinalStage: false, order: 3 },
  { id: 'pune_quality_check', name: 'NDT & Quality Check', color: 'pink', isFinalStage: false, order: 4 },
  { id: 'pune_ready_dispatch', name: 'Ready for Dispatch', color: 'green', isFinalStage: true, order: 5 }
];

const DEFAULT_VADODARA_STAGES: ProductionStageConfig[] = [
  { id: 'vadodara_raw_material', name: 'Raw Material Intake', color: 'indigo', isFinalStage: false, order: 0 },
  { id: 'vadodara_casting', name: 'Casting & Molding', color: 'blue', isFinalStage: false, order: 1 },
  { id: 'vadodara_fettling', name: 'Fettling & Grinding', color: 'amber', isFinalStage: false, order: 2 },
  { id: 'vadodara_heat_treatment', name: 'Heat Treatment', color: 'purple', isFinalStage: false, order: 3 },
  { id: 'vadodara_ndt_testing', name: 'NDT Testing', color: 'pink', isFinalStage: false, order: 4 },
  { id: 'vadodara_packaging_ready', name: 'Packaging & Ready', color: 'green', isFinalStage: true, order: 5 }
];

>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
<<<<<<< HEAD
  const [loading, setLoading] = useState(true);
  const [isSandboxMode, setIsSandboxMode] = useState(false);

=======
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [isSandboxMode, setIsSandboxMode] = useState(false);

  const [activePlantId, setActivePlantIdState] = useState<string | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loadingPlants, setLoadingPlants] = useState(false);

  const setActivePlantId = (id: string | null) => {
    setActivePlantIdState(id);
    if (id) {
      localStorage.setItem('flowops_active_plant_id', id);
    } else {
      localStorage.removeItem('flowops_active_plant_id');
    }
  };

  // Reactively sync plants and active plant selection
  useEffect(() => {
    if (!tenant?.id) {
      setPlants([]);
      setLoadingPlants(false);
      return;
    }

    setLoadingPlants(true);
    const isSandbox = isSandboxMode || localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      try {
        const cached = localStorage.getItem(`flowops_plants_${tenant.id}`);
        let plantList: Plant[] = [];
        if (cached) {
          plantList = JSON.parse(cached);
        } else {
          plantList = [
            {
              id: 'plant-pune',
              tenantId: tenant.id,
              name: 'Pune Heavy Forge Facility',
              location: 'Plot 104, MIDC Phase II, Chikhli, Pune, MH',
              gstin: '27AAACB1234F1Z1',
              processStages: DEFAULT_PUNE_STAGES,
              createdAt: new Date().toISOString()
            },
            {
              id: 'plant-vadodara',
              tenantId: tenant.id,
              name: 'Vadodara Foundry Plant',
              location: 'Plot 42, GIDC Industrial Estate, Sector 3, Vadodara, Gujarat',
              gstin: '24AAACB1234F1Z2',
              processStages: DEFAULT_VADODARA_STAGES,
              createdAt: new Date().toISOString()
            }
          ];
          localStorage.setItem(`flowops_plants_${tenant.id}`, JSON.stringify(plantList));
        }
        setPlants(plantList);

        // Retrieve active plant from localStorage
        const savedPlantId = localStorage.getItem('flowops_active_plant_id');
        if (savedPlantId && (savedPlantId === 'all' || plantList.some(p => p.id === savedPlantId))) {
          if (profile?.assignedPlantIds && profile.assignedPlantIds.length > 0 && !profile.assignedPlantIds.includes(savedPlantId) && savedPlantId !== 'all') {
            setActivePlantIdState(profile.assignedPlantIds[0]);
          } else {
            setActivePlantIdState(savedPlantId);
          }
        } else {
          if (profile?.assignedPlantIds && profile.assignedPlantIds.length > 0) {
            setActivePlantIdState(profile.assignedPlantIds[0]);
          } else {
            setActivePlantIdState('all');
          }
        }
        setLoadingPlants(false);
      } catch (e) {
        console.error('Error loading sandbox plants:', e);
        setLoadingPlants(false);
      }
    } else {
      // Production Firebase
      const colRef = collection(db, 'tenants', tenant.id, 'plants');
      const unsubscribe = onSnapshot(colRef, async (snap) => {
        let list: Plant[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as Plant);
        });

        if (list.length === 0) {
          try {
            const batch = writeBatch(db);
            const initialPlants: Plant[] = [
              {
                id: 'plant-pune',
                tenantId: tenant.id,
                name: 'Pune Heavy Forge Facility',
                location: 'Plot 104, MIDC Phase II, Chikhli, Pune, MH',
                gstin: '27AAACB1234F1Z1',
                processStages: DEFAULT_PUNE_STAGES,
                createdAt: new Date().toISOString()
              },
              {
                id: 'plant-vadodara',
                tenantId: tenant.id,
                name: 'Vadodara Foundry Plant',
                location: 'Plot 42, GIDC Industrial Estate, Sector 3, Vadodara, Gujarat',
                gstin: '24AAACB1234F1Z2',
                processStages: DEFAULT_VADODARA_STAGES,
                createdAt: new Date().toISOString()
              }
            ];

            initialPlants.forEach(p => {
              const dRef = doc(db, 'tenants', tenant.id, 'plants', p.id);
              batch.set(dRef, {
                tenantId: p.tenantId,
                name: p.name,
                location: p.location,
                gstin: p.gstin || '',
                processStages: p.processStages,
                createdAt: p.createdAt
              });
            });

            await batch.commit();
            list = initialPlants;
          } catch (err) {
            console.error('Error seeding default plants in Firestore', err);
          }
        }

        list.sort((a, b) => a.name.localeCompare(b.name));
        setPlants(list);

        // Determine active plant
        const savedPlantId = localStorage.getItem('flowops_active_plant_id');
        if (savedPlantId && (savedPlantId === 'all' || list.some(p => p.id === savedPlantId))) {
          if (profile?.assignedPlantIds && profile.assignedPlantIds.length > 0 && !profile.assignedPlantIds.includes(savedPlantId) && savedPlantId !== 'all') {
            setActivePlantIdState(profile.assignedPlantIds[0]);
          } else {
            setActivePlantIdState(savedPlantId);
          }
        } else {
          if (profile?.assignedPlantIds && profile.assignedPlantIds.length > 0) {
            setActivePlantIdState(profile.assignedPlantIds[0]);
          } else {
            setActivePlantIdState('all');
          }
        }
        setLoadingPlants(false);
      }, (err) => {
        console.error('Error loading plants:', err);
        setLoadingPlants(false);
      });

      return () => unsubscribe();
    }
  }, [tenant?.id, isSandboxMode, profile?.assignedPlantIds]);

>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
  // Attempt to load sandbox from LocalStorage to persist reload states
  useEffect(() => {
    const sandboxUser = localStorage.getItem('flowops_sandbox_profile');
    const sandboxTenant = localStorage.getItem('flowops_sandbox_tenant');
    if (sandboxUser && sandboxTenant) {
      setProfile(JSON.parse(sandboxUser));
      setTenant(JSON.parse(sandboxTenant));
      setIsSandboxMode(true);
      localStorage.setItem('isSandboxMode', 'true');
<<<<<<< HEAD
      setLoading(false);
=======
      setAuthStatus('active');
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    } else {
      // Connect to authentic firebase stream
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          try {
            // Check if profile exists in users collection
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
              const uData = userSnap.data() as UserProfile;
              setProfile(uData);

<<<<<<< HEAD
              // Get tenant config
              const tenantRef = doc(db, 'tenants', uData.tenantId);
              const tenantSnap = await getDoc(tenantRef);
              if (tenantSnap.exists()) {
                setTenant(tenantSnap.data() as Tenant);
              }
            } else {
              // Sign-up flow: Auto-create tenant & user document for fresh Google Accounts
              const newTenantId = `tenant_${firebaseUser.uid.substring(0, 8)}`;
              const newTenant: Tenant = {
                id: newTenantId,
                companyName: `${firebaseUser.displayName || 'Industrial'}'s Forge`,
                currency: '₹',
                createdAt: new Date().toISOString()
              };

              // Create tenant
              await setDoc(doc(db, 'tenants', newTenantId), newTenant);
              
              // Create user
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'Operator',
                tenantId: newTenantId,
                role: 'admin', // First user is the Owner/Admin
                createdAt: new Date().toISOString()
              };

              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              
              setProfile(newProfile);
              setTenant(newTenant);
            }
          } catch (e) {
            console.error('Error in Auth profile retrieval: ', e);
=======
              // 1. Check Tenant User Status for Suspensions
              let isActive = true;
              const tenantUserRef = doc(db, 'tenants', uData.tenantId, 'users', firebaseUser.uid);
              const tenantUserSnap = await getDoc(tenantUserRef);
              
              if (tenantUserSnap.exists()) {
                const tData = tenantUserSnap.data();
                if (tData.status === 'Inactive' || tData.status === 'Suspended') {
                  isActive = false;
                }
              }

              // 2. Get tenant config strictly
              const tenantRef = doc(db, 'tenants', uData.tenantId);
              const tenantSnap = await getDoc(tenantRef);
              
              if (tenantSnap.exists()) {
                setTenant(tenantSnap.data() as Tenant);
                // 3. Lockout or Allow ONLY if tenant exists
                setAuthStatus(isActive ? 'active' : 'suspended');
              } else {
                console.error("CRITICAL: User profile exists, but associated tenant is missing.");
                setAuthStatus('unauthenticated');
              }
              
            } else {
              // 1. Check if an invite exists for this email
              const inviteQuery = query(
                collection(db, 'invites'),
                where('email', '==', firebaseUser.email),
                where('status', '==', 'pending'),
                limit(1)
              );
              const inviteSnap = await getDocs(inviteQuery);

              if (!inviteSnap.empty) {
                // 2a. INVITE PATH: Profile pre-created by admin, just activate it
                const inviteDoc = inviteSnap.docs[0];
                const inviteData = inviteDoc.data();
                
                const userProfile: UserProfile = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  name: inviteData.name || firebaseUser.displayName || 'Operator',
                  tenantId: inviteData.tenantId,
                  role: inviteData.role,
                  createdAt: new Date().toISOString()
                };

                // Create the global user doc
                await setDoc(doc(db, 'users', firebaseUser.uid), userProfile);
                
                // Create the tenant-specific user doc
                await setDoc(doc(db, 'tenants', inviteData.tenantId, 'users', firebaseUser.uid), {
                  name: userProfile.name,
                  email: userProfile.email,
                  role: userProfile.role,
                  status: 'Active',
                  invitedAt: inviteData.createdAt,
                  createdAt: serverTimestamp()
                });

                // Mark invite as accepted
                await updateDoc(inviteDoc.ref, { 
                  status: 'accepted', 
                  acceptedAt: serverTimestamp(),
                  acceptedByUid: firebaseUser.uid
                });

                setProfile(userProfile);
                
                // Get tenant config strictly
                const tenantRef = doc(db, 'tenants', inviteData.tenantId);
                const tenantSnap = await getDoc(tenantRef);
                if (tenantSnap.exists()) {
                  setTenant(tenantSnap.data() as Tenant);
                  setAuthStatus('active');
                } else {
                  console.error("CRITICAL: Accepted invite points to a missing tenant.");
                  setAuthStatus('unauthenticated');
                }
                
              } else {
                // 2b. OWNER BOOTSTRAP PATH: No profile, no invite → create empty tenant and show onboarding
                const newTenantId = `tnt_${Date.now()}_${firebaseUser.uid.substring(0, 6)}`;
                
                const userProfile: UserProfile = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  name: firebaseUser.displayName || 'Workspace Owner',
                  tenantId: newTenantId,
                  role: 'admin', 
                  createdAt: new Date().toISOString()
                };

                const newTenant: Tenant = {
                  id: newTenantId,
                  companyName: '', 
                  gstin: '',
                  address: '',
                  currency: 'INR (₹)',
                  createdAt: new Date().toISOString()
                };

                try {
                  const batch = writeBatch(db);

                  batch.set(doc(db, 'users', firebaseUser.uid), userProfile);
                  
                  batch.set(doc(db, 'tenants', newTenantId), {
                    id: newTenantId, 
                    companyName: 'New Company',
                    createdAt: serverTimestamp(),
                    onboardingCompleted: false
                  });

                  batch.set(doc(db, 'tenants', newTenantId, 'users', firebaseUser.uid), {
                    name: userProfile.name,
                    email: userProfile.email,
                    role: 'admin',
                    status: 'Active',
                    createdAt: serverTimestamp()
                  });

                  await batch.commit();

                  setProfile(userProfile);
                  setTenant(newTenant);
                  setAuthStatus('needs_onboarding');
                } catch (bootstrapErr) {
                  console.error('Failed to provision workspace shell:', bootstrapErr);
                  setAuthStatus('unauthenticated');
                }
              }
            }
          } catch (e: any) {
            console.error('Error in Auth profile retrieval: ', e);
            if (e.code === 'permission-denied') {
              console.warn("Permission denied while fetching user. Re-evaluating Firestore rules.");
            }
            setAuthStatus('unauthenticated');
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
          }
        } else {
          setUser(null);
          setProfile(null);
          setTenant(null);
<<<<<<< HEAD
        }
        setLoading(false);
=======
          setAuthStatus('unauthenticated');
        }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      });

      return () => unsubscribe();
    }
  }, []);

  const signInWithGoogle = async () => {
<<<<<<< HEAD
    setLoading(true);
=======
    setAuthStatus('loading');
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    localStorage.removeItem('flowops_sandbox_profile');
    localStorage.removeItem('flowops_sandbox_tenant');
    localStorage.removeItem('isSandboxMode');
    setIsSandboxMode(false);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error('Google Auth Failed: ', e);
<<<<<<< HEAD
      setLoading(false);
=======
      setAuthStatus('unauthenticated');
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    }
  };

  const signOut = async () => {
<<<<<<< HEAD
    setLoading(true);
=======
    setAuthStatus('loading');
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    localStorage.removeItem('flowops_sandbox_profile');
    localStorage.removeItem('flowops_sandbox_tenant');
    localStorage.removeItem('isSandboxMode');
    setIsSandboxMode(false);
    setUser(null);
    setProfile(null);
    setTenant(null);
    await firebaseSignOut(auth);
<<<<<<< HEAD
    setLoading(false);
  };

  // Instant sandbox trigger (so non-authentic layout runs beautifully)
  const initializeSandbox = (companyName: string) => {
    setLoading(true);
=======
    setAuthStatus('unauthenticated');
  };

  const initializeSandbox = (companyName: string) => {
    setAuthStatus('loading');
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    const mockTenantId = `tenant_demo_${Math.random().toString(36).substring(2, 7)}`;
    const mockTenant: Tenant = {
      id: mockTenantId,
      companyName: companyName || 'Bharat Gearworks Ltd.',
      gstin: '27AAACB1234F1Z1',
      address: 'Plot 42, GIDC Industrial Estate, Sector 3, Vadodara, Gujarat',
      currency: '₹',
      createdAt: new Date().toISOString()
    };

    const mockProfile: UserProfile = {
      uid: `user_demo_${Math.random().toString(36).substring(2, 7)}`,
      email: 'demo@bharatgears.co.in',
      name: 'Rajesh Patel',
      tenantId: mockTenantId,
      role: 'admin',
      phone: '+919876543210',
      createdAt: new Date().toISOString()
    };

    localStorage.setItem('flowops_sandbox_profile', JSON.stringify(mockProfile));
    localStorage.setItem('flowops_sandbox_tenant', JSON.stringify(mockTenant));
    localStorage.setItem('isSandboxMode', 'true');
    
    setProfile(mockProfile);
    setTenant(mockTenant);
    setIsSandboxMode(true);
<<<<<<< HEAD
    setLoading(false);
  };

  // Dynamic role switching for easier review & testing on sandbox
  const switchToSandboxRole = (role: UserRole) => {
    if (!profile) return;
=======
    setAuthStatus('active');
  };

  const switchToSandboxRole = (role: UserRole) => {
    if (!profile) return;
    
    // SECURITY FIX: Strictly prevent non-admins from switching roles
    if (profile.role !== 'admin') {
      console.warn('Action blocked: Only Owner/Admin roles can switch user profiles.');
      return;
    }

>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    const updated = { ...profile, role };
    setProfile(updated);
    if (isSandboxMode) {
      localStorage.setItem('flowops_sandbox_profile', JSON.stringify(updated));
    } else {
<<<<<<< HEAD
      // Direct Firestore update if they are logged in with real auth to let rules check roles
      const userRef = doc(db, 'users', profile.uid);
      setDoc(userRef, { role }, { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
      });
=======
      console.warn('Action blocked: Role updates in production must be managed exclusively by an admin via the Roster interface.');
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    }
  };

  const updateProfileLocally = (updates: Partial<UserProfile>) => {
    if (!profile) return;
<<<<<<< HEAD
=======

    // SECURITY FIX: Prevent non-admins from escalating to Super Admin
    if (updates.isSuperAdmin !== undefined && profile.role !== 'admin') {
      console.warn('Action blocked: Only Owner/Admin roles can toggle Super Admin mode.');
      return;
    }

>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    const updated = { ...profile, ...updates };
    setProfile(updated);
    if (isSandboxMode) {
      localStorage.setItem('flowops_sandbox_profile', JSON.stringify(updated));
    }
  };

<<<<<<< HEAD
=======
  const refreshPlants = () => {
    if (!tenant?.id) return;
    const isSandbox = isSandboxMode || localStorage.getItem('isSandboxMode') === 'true' || !db;
    if (isSandbox) {
      try {
        const cached = localStorage.getItem(`flowops_plants_${tenant.id}`);
        if (cached) {
          setPlants(JSON.parse(cached));
        }
      } catch (e) {
        console.error('Error reloading sandbox plants:', e);
      }
    }
    // Production uses onSnapshot, meaning real-time updates happen automatically without forced manual refreshes
  };

>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
<<<<<<< HEAD
      loading, 
      tenant,
      isSandboxMode,
=======
      tenant,
      authStatus,
      isSandboxMode,
      activePlantId,
      setActivePlantId,
      plants,
      loadingPlants,
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      signInWithGoogle, 
      signOut, 
      switchToSandboxRole, 
      initializeSandbox,
<<<<<<< HEAD
      updateProfileLocally
=======
      updateProfileLocally,
      setAuthStatus,
      refreshPlants
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    }}>
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
<<<<<<< HEAD
};
=======
};
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
