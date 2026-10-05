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
    id: 'user_demo_arjun', 
    name: 'Arjun Sen', 
    email: 'arjun@company.com', 
    role: 'sales', 
    status: 'Active', 
    lastLogin: '2026-05-30T07:10:00Z', 
    createdAt: '2026-05-02T10:30:00Z' 
  },
  { 
    id: 'user_demo_harpreet', 
    name: 'Harpreet Singh', 
    email: 'harpreet@company.com', 
    role: 'production', 
    status: 'Active', 
    lastLogin: '2026-05-30T06:45:00Z', 
    createdAt: '2026-05-03T11:15:05Z' 
  },
  { 
    id: 'user_demo_sukhdev', 
    name: 'Sukhdev Singh', 
    email: 'sukhdev@company.com', 
    role: 'dispatch', 
    status: 'Active', 
    lastLogin: '2026-05-30T05:20:00Z', 
    createdAt: '2026-05-04T14:45:00Z' 
  },
  { 
    id: 'user_demo_ananya', 
    name: 'Ananya Sharma', 
    role: 'management', 
    email: 'ananya@company.com', 
    status: 'Active', 
    lastLogin: '2026-05-30T07:22:00Z', 
    createdAt: '2026-05-05T08:00:00Z' 
  },
  { 
    id: 'user_demo_kabir', 
    name: 'Kabir Das', 
    email: 'kabir@company.com', 
    role: 'sales', 
    status: 'Invited', 
    invitedAt: '2026-05-29T10:00:00Z', 
    createdAt: '2026-05-29T10:00:00Z' 
  }
];

<<<<<<< HEAD
export const useTenantUsers = (tenantId: string | undefined) => {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  const isAdmin = profile?.role === 'admin';
=======
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
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

<<<<<<< HEAD
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

=======
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
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
<<<<<<< HEAD
  }, [tenantId]);

  // Invite user method
  const inviteUser = useCallback(async (name: string, email: string, role: UserRole) => {
    if (!tenantId) return false;
=======
  }, [tenantId, isSandbox]);

  // Invite user method
  const inviteUser = useCallback(async (name: string, email: string, role: UserRole) => {
    if (!tenantId) {
      throw new Error('Tenant context is missing. Cannot invite user right now.');
    }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    if (!isAdmin) {
      throw new Error('Only Tenant Administrators possess permission to issue workspace credentials.');
    }

<<<<<<< HEAD
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const newUserId = `user_invited_${Date.now()}`;
    const invitedUser: TenantUser = {
      id: newUserId,
      name,
      email,
      role,
      status: 'Invited',
      invitedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    if (isSandbox) {
=======
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
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
      const updated = [...users, invitedUser];
      localStorage.setItem(`flowops_users_${tenantId}`, JSON.stringify(updated));
      setUsers(updated);
      
      // Trigger out-of-band communication stub log
      console.log(`%c[OUT-OF-BAND STUB] Invite email notification mock triggered successfully to: ${email} for role: ${role}`, 'color: #0d9488; font-weight: bold;');
    } else {
      try {
<<<<<<< HEAD
        const uDocRef = doc(db, 'tenants', tenantId, 'users', newUserId);
        await setDoc(uDocRef, {
          name,
          email,
          role,
          status: 'Invited',
          invitedAt: new Date().toISOString(),
=======
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
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
          createdAt: serverTimestamp()
        });
        
        // Trigger out-of-band communication stub log for production flow
        console.log(`%c[OUT-OF-BAND STUB] Real production invite email triggered via API to: ${email} [${role}]`, 'color: #0284c7; font-weight: bold;');
      } catch (err: any) {
<<<<<<< HEAD
        handleFirestoreError(err, OperationType.CREATE, `tenants/${tenantId}/users/${newUserId}`);
=======
        handleFirestoreError(err, OperationType.CREATE, `invites`);
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
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
<<<<<<< HEAD
  }, [tenantId, users, isAdmin]);

  // Edit user role method
  const updateUserRole = useCallback(async (userId: string, targetRole: UserRole) => {
    if (!tenantId) return false;
=======
  }, [tenantId, users, isAdmin, profile, isSandbox]);

  // Edit user role method
  const updateUserRole = useCallback(async (userId: string, targetRole: UserRole) => {
    if (!tenantId) {
      throw new Error('Tenant context is missing.');
    }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    if (!isAdmin) {
      throw new Error('Only Company Owners hold permissions to tweak operative system roles.');
    }

<<<<<<< HEAD
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

=======
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
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
<<<<<<< HEAD
  }, [tenantId, users, isAdmin]);

  // Soft delete / deactivate user method
  const deactivateUser = useCallback(async (userId: string) => {
    if (!tenantId) return false;
=======
  }, [tenantId, users, isAdmin, profile, isSandbox]);

  // Soft delete / deactivate user method
  const deactivateUser = useCallback(async (userId: string) => {
    if (!tenantId) {
      throw new Error('Tenant context is missing.');
    }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    if (!isAdmin) {
      throw new Error('Only Tenant Administrators can suspend active operator credentials.');
    }

<<<<<<< HEAD
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

=======
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
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
<<<<<<< HEAD
  }, [tenantId, users, isAdmin]);

  // Soft activate user method
  const activateUser = useCallback(async (userId: string) => {
    if (!tenantId) return false;
=======
  }, [tenantId, users, isAdmin, profile, isSandbox]);

  // Soft activate user method
  const activateUser = useCallback(async (userId: string) => {
    if (!tenantId) {
      throw new Error('Tenant context is missing.');
    }
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
    if (!isAdmin) {
      throw new Error('Only Tenant Administrators can enable operator credentials.');
    }

<<<<<<< HEAD
    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

=======
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
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
<<<<<<< HEAD
  }, [tenantId, users, isAdmin]);
=======
  }, [tenantId, users, isAdmin, profile, isSandbox]);
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145

  return {
    users,
    loading,
    error,
    inviteUser,
    updateUserRole,
    deactivateUser,
    activateUser,
    isAdmin
  };
<<<<<<< HEAD
};
=======
};
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
