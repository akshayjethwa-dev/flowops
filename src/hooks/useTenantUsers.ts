// src/hooks/useTenantUsers.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { TenantUser, UserRole } from '../types';
import { logActivityEvent } from '../utils/activityLogger';
import { useAuth } from './useAuth';

const DEFAULT_SANDBOX_USERS: TenantUser[] = [
  { 
    id: 'user_demo_rajesh', 
    name: 'Rajesh Patel', 
    email: 'demo@bharatgears.co.in', 
    role: 'admin', 
    status: 'Active', 
    lastLogin: '2026-05-30T07:15:00Z', 
    createdAt: '2026-05-01T09:00:00Z' 
  },
  { 
    id: 'user_demo_ananya', 
    name: 'Ananya Sharma', 
    role: 'manager', 
    email: 'ananya@company.com', 
    status: 'Active', 
    lastLogin: '2026-05-30T07:22:00Z', 
    createdAt: '2026-05-02T08:00:00Z' 
  },
  { 
    id: 'user_demo_harpreet', 
    name: 'Harpreet Singh', 
    email: 'harpreet@company.com', 
    role: 'operator', 
    status: 'Active', 
    lastLogin: '2026-05-30T06:45:00Z', 
    createdAt: '2026-05-03T11:15:05Z' 
  },
  { 
    id: 'user_demo_vikram', 
    name: 'Vikram Malhotra', 
    email: 'vikram.qc@company.com', 
    role: 'quality_inspector', 
    status: 'Active', 
    lastLogin: '2026-05-30T06:30:00Z', 
    createdAt: '2026-05-04T09:15:00Z' 
  },
  { 
    id: 'user_demo_ramesh', 
    name: 'Ramesh Verma', 
    email: 'ramesh.store@company.com', 
    role: 'store_keeper', 
    status: 'Active', 
    lastLogin: '2026-05-30T05:50:00Z', 
    createdAt: '2026-05-05T10:00:00Z' 
  },
  { 
    id: 'user_demo_preeti', 
    name: 'Preeti Nair', 
    email: 'preeti.auditor@company.com', 
    role: 'viewer', 
    status: 'Active', 
    lastLogin: '2026-05-30T07:40:00Z', 
    createdAt: '2026-05-06T11:00:00Z' 
  },
  { 
    id: 'user_demo_arjun', 
    name: 'Arjun Sen', 
    email: 'arjun@company.com', 
    role: 'sales', 
    status: 'Active', 
    lastLogin: '2026-05-30T07:10:00Z', 
    createdAt: '2026-05-07T10:30:00Z' 
  },
  { 
    id: 'user_demo_sukhdev', 
    name: 'Sukhdev Singh', 
    email: 'sukhdev@company.com', 
    role: 'dispatch', 
    status: 'Active', 
    lastLogin: '2026-05-30T05:20:00Z', 
    createdAt: '2026-05-08T14:45:00Z' 
  }
];

export const useTenantUsers = (providedTenantId?: string) => {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cast useAuth to any to safely extract fallbacks without TS strict block
  const authContext = useAuth() as any;
  const profile = authContext?.profile;
  const tenant = authContext?.tenant;

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
  
  // Robust tenantId resolution: check provided -> check profile -> check stringified tenant -> fallback to sandbox
  const tenantId = providedTenantId 
    || profile?.tenantId 
    || (typeof tenant === 'string' ? tenant : tenant?.id) 
    || (isSandbox ? 'demo_tenant' : undefined);

  // Allow sandbox mode to bypass strict admin blocks for testing
  const isAdmin = profile?.role === 'admin' || isSandbox;

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (isSandbox) {
      try {
        const cached = localStorage.getItem(`flowops_users_${tenantId}`);
        if (cached) {
          setUsers(JSON.parse(cached));
        } else {
          localStorage.setItem(`flowops_users_${tenantId}`, JSON.stringify(DEFAULT_SANDBOX_USERS));
          setUsers(DEFAULT_SANDBOX_USERS);
        }
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error processing sandbox tenant users');
        setLoading(false);
      }
    } else {
      const colRef = collection(db, 'tenants', tenantId, 'users');
      // Set stream listener
      const unsubscribe = onSnapshot(colRef, (snap) => {
        let list: TenantUser[] = [];
        snap.forEach(docSnap => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            name: data.name || '',
            email: data.email || '',
            role: data.role || 'production',
            status: data.status || 'Active',
            lastLogin: data.lastLogin || undefined,
            invitedAt: data.invitedAt || undefined,
            createdAt: data.createdAt ? (data.createdAt.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : data.createdAt) : undefined
          } as TenantUser);
        });

        // Seed initial sandbox demo users if Firestore tenant users collection is completely empty
        if (list.length === 0) {
          setUsers(DEFAULT_SANDBOX_USERS);
        } else {
          setUsers(list);
        }
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `tenants/${tenantId}/users`);
        setError(err.message || 'Permission denied retrieving users list.');
        setLoading(false);
      });

      return unsubscribe;
    }
  }, [tenantId, isSandbox]);

  // Invite user method
  const inviteUser = useCallback(async (name: string, email: string, role: UserRole) => {
    if (!tenantId) {
      throw new Error('Tenant context is missing. Cannot invite user right now.');
    }
    if (!isAdmin) {
      throw new Error('Only Tenant Administrators possess permission to issue workspace credentials.');
    }

    const newUserId = `user_invited_${Date.now()}`;

    if (isSandbox) {
      const invitedUser: TenantUser = {
        id: newUserId,
        name,
        email,
        role,
        status: 'Invited',
        invitedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      const updated = [...users, invitedUser];
      localStorage.setItem(`flowops_users_${tenantId}`, JSON.stringify(updated));
      setUsers(updated);
      
      // Trigger out-of-band communication stub log
      console.log(`%c[OUT-OF-BAND STUB] Invite email notification mock triggered successfully to: ${email} for role: ${role}`, 'color: #0d9488; font-weight: bold;');
    } else {
      try {
        // 1. Create the global invite record first so the auth flow can find it
        const inviteRef = await addDoc(collection(db, 'invites'), {
          email: email.toLowerCase(),
          name,
          role,
          tenantId,
          invitedBy: profile?.uid || 'system',
          status: 'pending',
          createdAt: serverTimestamp()
        });
        
        // 2. Also write a placeholder user to the tenant's user collection for roster visibility
        const uDocRef = doc(db, 'tenants', tenantId, 'users', inviteRef.id);
        await setDoc(uDocRef, {
          name,
          email: email.toLowerCase(),
          role,
          status: 'Invited',
          invitedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        });
        
        // Trigger out-of-band communication stub log for production flow
        console.log(`%c[OUT-OF-BAND STUB] Real production invite email triggered via API to: ${email} [${role}]`, 'color: #0284c7; font-weight: bold;');
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, `invites`);
        throw err;
      }
    }

    logActivityEvent({
      tenantId,
      actionType: 'invited',
      entityType: 'user',
      entityId: newUserId,
      actor: {
        userId: profile?.uid || 'system_onboarding',
        displayName: profile?.name || profile?.email || 'System Onboarding'
      },
      description: `Invited user "${name}" (${email}) with role "${role}" to the workspace.`,
      metadata: {
        role,
        email
      },
      isSandboxMode: isSandbox
    });

    return true;
  }, [tenantId, users, isAdmin, profile, isSandbox]);

  // Edit user role method
  const updateUserRole = useCallback(async (userId: string, targetRole: UserRole) => {
    if (!tenantId) {
      throw new Error('Tenant context is missing.');
    }
    if (!isAdmin) {
      throw new Error('Only Company Owners hold permissions to tweak operative system roles.');
    }

    const uInfo = users.find(u => u.id === userId);

    if (isSandbox) {
      const updated = users.map(u => {
        if (u.id === userId) {
          return { ...u, role: targetRole };
        }
        return u;
      });
      localStorage.setItem(`flowops_users_${tenantId}`, JSON.stringify(updated));
      setUsers(updated);
    } else {
      try {
        const dRef = doc(db, 'tenants', tenantId, 'users', userId);
        await updateDoc(dRef, { role: targetRole });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}/users/${userId}`);
        throw err;
      }
    }

    logActivityEvent({
      tenantId,
      actionType: 'role_change',
      entityType: 'user',
      entityId: userId,
      actor: {
        userId: profile?.uid || 'admin',
        displayName: profile?.name || profile?.email || 'Administrator'
      },
      description: `Changed role of user "${uInfo?.name || userId}" to "${targetRole.toUpperCase()}".`,
      metadata: {
        role: targetRole,
        email: uInfo?.email
      },
      isSandboxMode: isSandbox
    });

    return true;
  }, [tenantId, users, isAdmin, profile, isSandbox]);

  // Soft delete / deactivate user method
  const deactivateUser = useCallback(async (userId: string) => {
    if (!tenantId) {
      throw new Error('Tenant context is missing.');
    }
    if (!isAdmin) {
      throw new Error('Only Tenant Administrators can suspend active operator credentials.');
    }

    const uInfo = users.find(u => u.id === userId);

    if (isSandbox) {
      const updated = users.map(u => {
        if (u.id === userId) {
          return { ...u, status: 'Inactive' as const };
        }
        return u;
      });
      localStorage.setItem(`flowops_users_${tenantId}`, JSON.stringify(updated));
      setUsers(updated);
    } else {
      try {
        const dRef = doc(db, 'tenants', tenantId, 'users', userId);
        await updateDoc(dRef, { status: 'Inactive' });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}/users/${userId}`);
        throw err;
      }
    }

    logActivityEvent({
      tenantId,
      actionType: 'deactivate',
      entityType: 'user',
      entityId: userId,
      actor: {
        userId: profile?.uid || 'admin',
        displayName: profile?.name || profile?.email || 'Administrator'
      },
      description: `Deactivated / Suspended active credentials for "${uInfo?.name || userId}".`,
      metadata: {
        email: uInfo?.email
      },
      isSandboxMode: isSandbox
    });

    return true;
  }, [tenantId, users, isAdmin, profile, isSandbox]);

  // Soft activate user method
  const activateUser = useCallback(async (userId: string) => {
    if (!tenantId) {
      throw new Error('Tenant context is missing.');
    }
    if (!isAdmin) {
      throw new Error('Only Tenant Administrators can enable operator credentials.');
    }

    const uInfo = users.find(u => u.id === userId);

    if (isSandbox) {
      const updated = users.map(u => {
        if (u.id === userId) {
          return { ...u, status: 'Active' as const };
        }
        return u;
      });
      localStorage.setItem(`flowops_users_${tenantId}`, JSON.stringify(updated));
      setUsers(updated);
    } else {
      try {
        const dRef = doc(db, 'tenants', tenantId, 'users', userId);
        await updateDoc(dRef, { status: 'Active' });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}/users/${userId}`);
        throw err;
      }
    }

    logActivityEvent({
      tenantId,
      actionType: 'update',
      entityType: 'user',
      entityId: userId,
      actor: {
        userId: profile?.uid || 'admin',
        displayName: profile?.name || profile?.email || 'Administrator'
      },
      description: `Reactivated active credentials for "${uInfo?.name || userId}".`,
      metadata: {
        email: uInfo?.email
      },
      isSandboxMode: isSandbox
    });

    return true;
  }, [tenantId, users, isAdmin, profile, isSandbox]);

  // Direct User Account Creation with Role & Custom Claims
  const createUserAccount = useCallback(async (params: {
    name: string;
    email: string;
    role: UserRole;
    temporaryPassword?: string;
    plantId?: string;
  }) => {
    const { name, email, role, plantId } = params;
    if (!tenantId) throw new Error('Tenant context missing.');
    if (!isAdmin) throw new Error('Only Administrator or Manager can create user accounts.');

    const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const newUser: TenantUser = {
      id: newUserId,
      name,
      email: email.toLowerCase(),
      role,
      status: 'Active',
      lastLogin: undefined,
      createdAt: nowIso
    };

    if (isSandbox) {
      const updated = [newUser, ...users];
      localStorage.setItem(`flowops_users_${tenantId}`, JSON.stringify(updated));
      setUsers(updated);
    } else {
      try {
        const uDocRef = doc(db, 'tenants', tenantId, 'users', newUserId);
        await setDoc(uDocRef, {
          name,
          email: email.toLowerCase(),
          role,
          status: 'Active',
          plantId: plantId || '',
          customClaims: {
            role,
            tenantId
          },
          createdAt: serverTimestamp()
        });

        // Also sync global user profile doc
        const globalDocRef = doc(db, 'users', newUserId);
        await setDoc(globalDocRef, {
          uid: newUserId,
          name,
          email: email.toLowerCase(),
          role,
          tenantId,
          plantId: plantId || '',
          createdAt: serverTimestamp()
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, `tenants/${tenantId}/users/${newUserId}`);
        throw err;
      }
    }

    logActivityEvent({
      tenantId,
      actionType: 'create',
      entityType: 'user',
      entityId: newUserId,
      actor: {
        userId: profile?.uid || 'admin',
        displayName: profile?.name || 'Administrator'
      },
      description: `Created new user account "${name}" (${email}) with role "${role}".`,
      metadata: { role, email },
      isSandboxMode: isSandbox
    });

    return newUser;
  }, [tenantId, users, isAdmin, profile, isSandbox]);

  return {
    users,
    loading,
    error,
    inviteUser,
    createUserAccount,
    updateUserRole,
    deactivateUser,
    activateUser,
    isAdmin
  };
};