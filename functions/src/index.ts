/**
 * Cloud Functions for Ashrey FlowOps Manufacturing Operations CRM
 * 2nd Gen (v2) Firebase Functions + Modular Firebase Admin SDK
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as logger from 'firebase-functions/logger';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// Global options applied to every v2 function in this codebase
// ---------------------------------------------------------------------------
setGlobalOptions({
  region: 'asia-south1',
  maxInstances: 10,
  memory: '256MiB',
  concurrency: 80,
});

// ---------------------------------------------------------------------------
// Lazy Admin SDK initialization (never at module top-level)
// ---------------------------------------------------------------------------
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function ensureApp(): void {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
}

function getAdminAuth(): Auth {
  if (!_auth) {
    ensureApp();
    _auth = getAuth();
  }
  return _auth;
}

function getAdminDb(): Firestore {
  if (!_db) {
    ensureApp();
    _db = getFirestore();
  }
  return _db;
}

const VALID_ROLES = [
  'admin',
  'manager',
  'operator',
  'quality_inspector',
  'store_keeper',
  'viewer',
  'sales',
  'production',
  'dispatch',
  'management',
] as const;

type ValidRole = (typeof VALID_ROLES)[number];

function normalizeRole(role: unknown): ValidRole {
  return typeof role === 'string' && (VALID_ROLES as readonly string[]).includes(role)
    ? (role as ValidRole)
    : 'viewer';
}

// ---------------------------------------------------------------------------
// Trigger 1: tenants/{tenantId}/users/{userId}
// ---------------------------------------------------------------------------
export const syncTenantUserClaims = onDocumentWritten(
  { document: 'tenants/{tenantId}/users/{userId}' },
  async (event) => {
    const { tenantId, userId } = event.params;
    const change = event.data;

    if (!change) {
      logger.info(`No change payload for ${userId} in tenant ${tenantId}. Skipping.`);
      return;
    }

    if (!change.after.exists) {
      logger.info(`User ${userId} removed from tenant ${tenantId}. Clearing custom claims.`);
      try {
        await getAdminAuth().setCustomUserClaims(userId, {
          role: null,
          tenantId: null,
          isSuperAdmin: false,
          assignedPlantIds: [],
          assignedStageIds: [],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Could not clear claims for deleted user ${userId}: ${msg}`);
      }
      return;
    }

    const userData = (change.after.data() || {}) as Record<string, any>;
    const role = normalizeRole(userData.role);
    const isSuperAdmin = !!userData.isSuperAdmin;
    const assignedPlantIds: string[] = userData.assignedPlantIds || [];
    const assignedStageIds: string[] = userData.assignedStageIds || [];

    const beforeData = change.before?.exists
      ? (change.before.data() as Record<string, any>)
      : null;

    if (
      beforeData &&
      beforeData.role === role &&
      !!beforeData.isSuperAdmin === isSuperAdmin &&
      JSON.stringify(beforeData.assignedPlantIds || []) === JSON.stringify(assignedPlantIds) &&
      JSON.stringify(beforeData.assignedStageIds || []) === JSON.stringify(assignedStageIds)
    ) {
      logger.info(`Claims for user ${userId} in tenant ${tenantId} unchanged. Skipping.`);
      return;
    }

    try {
      await getAdminAuth().setCustomUserClaims(userId, {
        role,
        tenantId,
        isSuperAdmin,
        assignedPlantIds,
        assignedStageIds,
      });

      logger.info(
        `Successfully set custom claims for user ${userId}: role=${role}, tenant=${tenantId}`
      );

      const db = getAdminDb();
      await db.collection('users').doc(userId).set(
        {
          role,
          tenantId,
          isSuperAdmin,
          assignedPlantIds,
          assignedStageIds,
          claimsUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const activityId = `act_${Date.now()}_claims_${Math.random().toString(36).substring(2, 7)}`;
      await db.collection('tenants').doc(tenantId).collection('activity').doc(activityId).set({
        id: activityId,
        actionType: 'claims_synced',
        entityType: 'user',
        entityId: userId,
        tenantId,
        actor: {
          userId: 'system',
          displayName: 'Firebase Cloud Functions',
          email: 'cloud-function@system',
        },
        timestamp: new Date().toISOString(),
        description: `Custom claims synchronized for ${
          userData.name || userData.email || userId
        }: Role [${role}].`,
        metadata: { role, tenantId, isSuperAdmin },
      });
    } catch (error) {
      logger.error(`Error setting custom claims for ${userId}:`, error);
    }
  }
);

// ---------------------------------------------------------------------------
// Trigger 2: users/{userId}
// ---------------------------------------------------------------------------
export const syncRootUserClaims = onDocumentWritten(
  { document: 'users/{userId}' },
  async (event) => {
    const change = event.data;
    if (!change || !change.after.exists) return;

    const { userId } = event.params;
    const userData = (change.after.data() || {}) as Record<string, any>;
    const tenantId: string | undefined = userData.tenantId;
    const role = normalizeRole(userData.role);

    if (!tenantId) {
      logger.warn(`User ${userId} has no tenantId assigned yet. Skipping.`);
      return;
    }

    try {
      const auth = getAdminAuth();
      const authUser = await auth.getUser(userId);
      const existingClaims = (authUser.customClaims as Record<string, any>) || {};

      if (existingClaims.role !== role || existingClaims.tenantId !== tenantId) {
        await auth.setCustomUserClaims(userId, {
          ...existingClaims,
          role,
          tenantId,
          isSuperAdmin: !!userData.isSuperAdmin,
          assignedPlantIds: userData.assignedPlantIds || [],
        });
        logger.info(`Root trigger synced claims for user ${userId}: role=${role}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Root trigger failed for ${userId}: ${msg}`);
    }
  }
);

// ---------------------------------------------------------------------------
// Callable: setUserRole
// ---------------------------------------------------------------------------
export const setUserRole = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerUid = request.auth.uid;
  const callerClaims = request.auth.token as Record<string, any>;

  const callerRole = callerClaims.role;
  const isSuper = !!callerClaims.isSuperAdmin;

  if (callerRole !== 'admin' && !isSuper) {
    throw new HttpsError(
      'permission-denied',
      'Only administrators can assign user roles and custom claims.'
    );
  }

  const { targetUserId, targetRole, tenantId } = (request.data || {}) as {
    targetUserId?: string;
    targetRole?: string;
    tenantId?: string;
  };

  if (!targetUserId || !targetRole || !tenantId) {
    throw new HttpsError(
      'invalid-argument',
      'targetUserId, targetRole, and tenantId are required.'
    );
  }

  if (!(VALID_ROLES as readonly string[]).includes(targetRole)) {
    throw new HttpsError(
      'invalid-argument',
      `Invalid role: ${targetRole}. Must be one of ${VALID_ROLES.join(', ')}.`
    );
  }

  if (!isSuper && callerClaims.tenantId !== tenantId) {
    throw new HttpsError('permission-denied', 'Cannot modify users in another tenant.');
  }

  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    await auth.setCustomUserClaims(targetUserId, {
      role: targetRole,
      tenantId,
    });

    await db
      .collection('tenants')
      .doc(tenantId)
      .collection('users')
      .doc(targetUserId)
      .set(
        {
          role: targetRole,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: callerUid,
        },
        { merge: true }
      );

    await db
      .collection('users')
      .doc(targetUserId)
      .set(
        {
          role: targetRole,
          tenantId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return {
      success: true,
      message: `Role successfully updated to ${targetRole} for user ${targetUserId}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update custom claims.';
    logger.error(`Error in setUserRole:`, err);
    throw new HttpsError('internal', msg);
  }
});