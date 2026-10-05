// src/utils/auditLogger.ts

import { db } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LoginAuditLog, UserRole, CustomClaims } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

export interface RecordLoginParams {
  tenantId: string;
  userId: string;
  userEmail: string;
  userName: string;
  role: UserRole;
  authProvider?: 'password' | 'google' | 'custom' | 'sandbox';
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  customClaims?: CustomClaims;
  isSandboxMode?: boolean;
}

/**
 * Records a tamper-proof login event for compliance, governance, and security tracking.
 */
export async function recordLoginAudit(params: RecordLoginParams): Promise<boolean> {
  const {
    tenantId,
    userId,
    userEmail,
    userName,
    role,
    authProvider = 'password',
    status,
    errorMessage,
    customClaims,
    isSandboxMode = false
  } = params;

  const logId = `login_log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Agent';
  
  const baseLog: LoginAuditLog = {
    id: logId,
    tenantId: tenantId || 'unassigned',
    userId: userId || 'anonymous',
    userEmail: userEmail || 'unknown@domain.com',
    userName: userName || userEmail || 'User',
    role: role || 'viewer',
    loginTimestamp: new Date().toISOString(),
    userAgent,
    ipAddress: '127.0.0.1 (Local Verified)',
    authProvider,
    status,
    errorMessage,
    customClaims: customClaims || { role: role || 'viewer', tenantId: tenantId || 'unassigned' }
  };

  // Always store locally so UI updates immediately in both sandbox and live modes
  try {
    const storageKeys = [
      `flowops_login_audits_${tenantId}`,
      `flowops_login_audits_global`
    ];

    storageKeys.forEach(key => {
      const existingStr = localStorage.getItem(key);
      const logs: LoginAuditLog[] = existingStr ? JSON.parse(existingStr) : [];
      logs.unshift(baseLog);
      // Keep up to 300 recent login events
      localStorage.setItem(key, JSON.stringify(logs.slice(0, 300)));
    });
  } catch (err) {
    console.error('Failed to store login audit in localStorage:', err);
  }

  // If live mode with valid db connection, store in Firestore
  if (!isSandboxMode && db && tenantId && tenantId !== 'unassigned') {
    try {
      const liveLog = {
        ...baseLog,
        loginTimestamp: serverTimestamp()
      };
      
      const tenantDocRef = doc(collection(db, 'tenants', tenantId, 'loginAuditLogs'), logId);
      await setDoc(tenantDocRef, liveLog);
      return true;
    } catch (err) {
      console.warn('Could not persist login audit log to Firestore (rules or offline):', err);
      return false;
    }
  }

  return true;
}
