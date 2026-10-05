// src/hooks/useLoginAuditLogs.ts

import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { LoginAuditLog, UserRole } from '../types';

export const SEED_LOGIN_LOGS: LoginAuditLog[] = [
  {
    id: 'seed_login_001',
    tenantId: 'demo-tenant-001',
    userId: 'user_demo_rajesh',
    userEmail: 'rajesh.patel@bharatgears.co.in',
    userName: 'Rajesh Patel (Owner)',
    role: 'admin',
    loginTimestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    authProvider: 'password',
    status: 'SUCCESS',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124.0.0.0',
    ipAddress: '115.240.180.42 (Vadodara, IN)',
    customClaims: { role: 'admin', tenantId: 'demo-tenant-001' }
  },
  {
    id: 'seed_login_002',
    tenantId: 'demo-tenant-001',
    userId: 'user_demo_ananya',
    userEmail: 'ananya.sharma@bharatgears.co.in',
    userName: 'Ananya Sharma (Plant GM)',
    role: 'manager',
    loginTimestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    authProvider: 'google',
    status: 'SUCCESS',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/124.0.0.0',
    ipAddress: '115.240.180.45 (Vadodara, IN)',
    customClaims: { role: 'manager', tenantId: 'demo-tenant-001' }
  },
  {
    id: 'seed_login_003',
    tenantId: 'demo-tenant-001',
    userId: 'user_demo_vikram',
    userEmail: 'vikram.qc@bharatgears.co.in',
    userName: 'Vikram Malhotra',
    role: 'quality_inspector',
    loginTimestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    authProvider: 'password',
    status: 'SUCCESS',
    userAgent: 'Mozilla/5.0 (Android 14; Mobile; Tablet) Chrome/123.0',
    ipAddress: '103.212.144.18 (Pune, IN)',
    customClaims: { role: 'quality_inspector', tenantId: 'demo-tenant-001' }
  },
  {
    id: 'seed_login_004',
    tenantId: 'demo-tenant-001',
    userId: 'user_demo_harpreet',
    userEmail: 'harpreet.operator@bharatgears.co.in',
    userName: 'Harpreet Singh',
    role: 'operator',
    loginTimestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    authProvider: 'password',
    status: 'SUCCESS',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Kiosk-Tablet-01)',
    ipAddress: '192.168.1.104 (Shopfloor Terminal 3)',
    customClaims: { role: 'operator', tenantId: 'demo-tenant-001' }
  },
  {
    id: 'seed_login_005',
    tenantId: 'demo-tenant-001',
    userId: 'user_demo_ramesh',
    userEmail: 'ramesh.store@bharatgears.co.in',
    userName: 'Ramesh Verma',
    role: 'store_keeper',
    loginTimestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    authProvider: 'password',
    status: 'SUCCESS',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0',
    ipAddress: '192.168.1.112 (Store Room PC)',
    customClaims: { role: 'store_keeper', tenantId: 'demo-tenant-001' }
  },
  {
    id: 'seed_login_006',
    tenantId: 'demo-tenant-001',
    userId: 'unknown',
    userEmail: 'attacker_attempt@unknown.com',
    userName: 'Unauthorized Intrusion Attempt',
    role: 'viewer',
    loginTimestamp: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    authProvider: 'password',
    status: 'FAILED',
    errorMessage: 'Invalid credentials. Password verification failed.',
    userAgent: 'Python-requests/2.31.0 (Automated Scan)',
    ipAddress: '45.134.22.90 (External)',
    customClaims: { role: 'viewer', tenantId: 'demo-tenant-001' }
  },
  {
    id: 'seed_login_007',
    tenantId: 'demo-tenant-001',
    userId: 'user_demo_preeti',
    userEmail: 'preeti.auditor@externalaudit.com',
    userName: 'Preeti Nair (Statutory Auditor)',
    role: 'viewer',
    loginTimestamp: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    authProvider: 'google',
    status: 'SUCCESS',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) Safari/605.1.15',
    ipAddress: '49.36.128.5 (Mumbai, IN)',
    customClaims: { role: 'viewer', tenantId: 'demo-tenant-001' }
  }
];

export function useLoginAuditLogs(tenantId?: string) {
  const [logs, setLogs] = useState<LoginAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLogs(SEED_LOGIN_LOGS);
      setLoading(false);
      return;
    }

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    // Load cached/sandbox logs
    const cacheKey = `flowops_login_audits_${tenantId}`;
    const cachedStr = localStorage.getItem(cacheKey);
    let initialLogs: LoginAuditLog[] = cachedStr ? JSON.parse(cachedStr) : [];

    if (initialLogs.length === 0) {
      initialLogs = SEED_LOGIN_LOGS.map(l => ({ ...l, tenantId }));
      localStorage.setItem(cacheKey, JSON.stringify(initialLogs));
    }

    setLogs(initialLogs);

    if (isSandbox) {
      setLoading(false);
      return;
    }

    try {
      const logsRef = collection(db, 'tenants', tenantId, 'loginAuditLogs');
      const q = query(logsRef, orderBy('loginTimestamp', 'desc'), limit(100));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const dbLogs: LoginAuditLog[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              dbLogs.push({
                id: doc.id,
                ...data,
                loginTimestamp: data.loginTimestamp?.toDate?.() 
                  ? data.loginTimestamp.toDate().toISOString() 
                  : (typeof data.loginTimestamp === 'string' ? data.loginTimestamp : new Date().toISOString())
              } as LoginAuditLog);
            });
            setLogs(dbLogs);
            localStorage.setItem(cacheKey, JSON.stringify(dbLogs));
          }
          setLoading(false);
        },
        (err) => {
          console.warn('Could not listen to Firestore login audit logs:', err);
          // Fall back gracefully to cached/seed logs
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.warn('Error setting up login audit logs listener:', err);
      setLoading(false);
    }
  }, [tenantId]);

  return { logs, loading, error };
}
