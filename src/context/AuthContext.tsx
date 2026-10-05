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
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  switchToSandboxRole: (role: UserRole) => void;
  initializeSandbox: (companyName: string) => void;
  updateProfileLocally: (updates: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSandboxMode, setIsSandboxMode] = useState(false);

  // Attempt to load sandbox from LocalStorage to persist reload states
  useEffect(() => {
    const sandboxUser = localStorage.getItem('flowops_sandbox_profile');
    const sandboxTenant = localStorage.getItem('flowops_sandbox_tenant');
    if (sandboxUser && sandboxTenant) {
      setProfile(JSON.parse(sandboxUser));
      setTenant(JSON.parse(sandboxTenant));
      setIsSandboxMode(true);
      localStorage.setItem('isSandboxMode', 'true');
      setLoading(false);
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
          }
        } else {
          setUser(null);
          setProfile(null);
          setTenant(null);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    localStorage.removeItem('flowops_sandbox_profile');
    localStorage.removeItem('flowops_sandbox_tenant');
    localStorage.removeItem('isSandboxMode');
    setIsSandboxMode(false);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error('Google Auth Failed: ', e);
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    localStorage.removeItem('flowops_sandbox_profile');
    localStorage.removeItem('flowops_sandbox_tenant');
    localStorage.removeItem('isSandboxMode');
    setIsSandboxMode(false);
    setUser(null);
    setProfile(null);
    setTenant(null);
    await firebaseSignOut(auth);
    setLoading(false);
  };

  // Instant sandbox trigger (so non-authentic layout runs beautifully)
  const initializeSandbox = (companyName: string) => {
    setLoading(true);
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
    setLoading(false);
  };

  // Dynamic role switching for easier review & testing on sandbox
  const switchToSandboxRole = (role: UserRole) => {
    if (!profile) return;
    const updated = { ...profile, role };
    setProfile(updated);
    if (isSandboxMode) {
      localStorage.setItem('flowops_sandbox_profile', JSON.stringify(updated));
    } else {
      // Direct Firestore update if they are logged in with real auth to let rules check roles
      const userRef = doc(db, 'users', profile.uid);
      setDoc(userRef, { role }, { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
      });
    }
  };

  const updateProfileLocally = (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...updates };
    setProfile(updated);
    if (isSandboxMode) {
      localStorage.setItem('flowops_sandbox_profile', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      tenant,
      isSandboxMode,
      signInWithGoogle, 
      signOut, 
      switchToSandboxRole, 
      initializeSandbox,
      updateProfileLocally
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
};
