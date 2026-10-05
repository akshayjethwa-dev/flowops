/**
 * Cloud Functions for Ashrey FlowOps Manufacturing Operations CRM
 * Modern 2nd Gen (v2) Firebase Functions + Modular Firebase Admin SDK
 * Handles automatic Custom Claims synchronization, Auth triggers, and administrative role assignment.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Lazy-initialization helpers to ensure instant container startup without blocking healthchecks
function getAdminAuth() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getAuth();
}

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp();
  }
  return getFirestore();
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
  'management'
];

/**
 * Trigger 1: Firestore onDocumentWritten on `tenants/{tenantId}/users/{userId}`
 */
export const syncTenantUserClaims = onDocumentWritten(
  {
    document: 'tenants/{tenantId}/users/{userId}',
    region: 'asia-south1',
    maxInstances: 10
  },
  async (event: any) => {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const { tenantId, userId } = event.params;
    const change = event.data;

    // Handle deletion
    if (!change || !change.after.exists) {
      logger.info(`User ${userId} removed from tenant ${tenantId}. Clearing custom claims.`);
      try {
        await auth.setCustomUserClaims(userId, { role: null, tenantId: null });
      } catch (err: any) {
        logger.warn(`Could not clear claims for deleted user ${userId}:`, err.message);
      }
      return;
    }

    const userData = change.after.data() || {};
    const role = (userData.role && VALID_ROLES.includes(userData.role)) ? userData.role : 'viewer';
    const isSuperAdmin = !!userData.isSuperAdmin;
    const assignedPlantIds = userData.assignedPlantIds || [];
    const assignedStageIds = userData.assignedStageIds || [];

    // Check if claims actually changed to avoid unnecessary token revocations
    const beforeData = change.before && change.before.exists ? change.before.data() : null;
    if (
      beforeData &&
      beforeData.role === role &&
      beforeData.isSuperAdmin === isSuperAdmin &&
      JSON.stringify(beforeData.assignedPlantIds || []) === JSON.stringify(assignedPlantIds)
    ) {
      logger.info(`Claims for user ${userId} in tenant ${tenantId} unchanged.`);
      return;
    }

    try {
      // 1. Assign custom claims on Firebase Auth
      await auth.setCustomUserClaims(userId, {
        role,
        tenantId,
        isSuperAdmin,
        assignedPlantIds,
        assignedStageIds
      });

      logger.info(`Successfully set custom claims for user ${userId}: role=${role}, tenant=${tenantId}`);

      // 2. Keep the root `users/{userId}` document synchronized
      const rootUserRef = db.collection('users').doc(userId);
      await rootUserRef.set(
        {
          role,
          tenantId,
          isSuperAdmin,
          assignedPlantIds,
          assignedStageIds,
          claimsUpdatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      // 3. Write an activity record in tenant audit trail
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
          email: 'cloud-function@system'
        },
        timestamp: new Date().toISOString(),
        description: `Custom claims synchronized for ${userData.name || userData.email || userId}: Role [${role}].`,
        metadata: { role, tenantId, isSuperAdmin }
      });

    } catch (error: any) {
      logger.error(`Error setting custom claims for ${userId}:`, error);
    }
  }
);

/**
 * Trigger 2: Firestore onDocumentWritten on `users/{userId}` (Root fallback)
 */
export const syncRootUserClaims = onDocumentWritten(
  {
    document: 'users/{userId}',
    region: 'asia-south1',
    maxInstances: 10
  },
  async (event: any) => {
    const auth = getAdminAuth();
    const { userId } = event.params;
    const change = event.data;

    if (!change || !change.after.exists) return;

    const userData = change.after.data() || {};
    const tenantId = userData.tenantId;
    const role = (userData.role && VALID_ROLES.includes(userData.role)) ? userData.role : 'viewer';

    if (!tenantId) {
      logger.warn(`User ${userId} has no tenantId assigned yet.`);
      return;
    }

    try {
      const authUser = await auth.getUser(userId);
      const existingClaims = (authUser.customClaims as any) || {};

      // Only write if claims differ
      if (existingClaims.role !== role || existingClaims.tenantId !== tenantId) {
        await auth.setCustomUserClaims(userId, {
          ...existingClaims,
          role,
          tenantId,
          isSuperAdmin: !!userData.isSuperAdmin,
          assignedPlantIds: userData.assignedPlantIds || []
        });
        logger.info(`Root trigger synced claims for user ${userId}: role=${role}`);
      }
    } catch (err: any) {
      logger.error(`Root trigger failed for ${userId}:`, err);
    }
  }
);

/**
 * Callable Function: `setUserRole`
 */
export const setUserRole = onCall(
  {
    region: 'asia-south1',
    maxInstances: 10
  },
  async (request: any) => {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 1. Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const callerUid = request.auth.uid;
    const callerClaims = request.auth.token;

    // 2. Check administrative permission (must be admin or superadmin)
    const callerRole = callerClaims.role;
    const isSuper = !!callerClaims.isSuperAdmin;

    if (callerRole !== 'admin' && !isSuper) {
      throw new HttpsError(
        'permission-denied',
        'Only administrators can assign user roles and custom claims.'
      );
    }

    const { targetUserId, targetRole, tenantId } = request.data || {};

    if (!targetUserId || !targetRole || !tenantId) {
      throw new HttpsError('invalid-argument', 'targetUserId, targetRole, and tenantId are required.');
    }

    if (!VALID_ROLES.includes(targetRole)) {
      throw new HttpsError('invalid-argument', `Invalid role: ${targetRole}. Must be one of ${VALID_ROLES.join(', ')}.`);
    }

    // Cross-tenant protection
    if (!isSuper && callerClaims.tenantId !== tenantId) {
      throw new HttpsError('permission-denied', 'Cannot modify users in another tenant.');
    }

    try {
      // Set custom claims
      await auth.setCustomUserClaims(targetUserId, {
        role: targetRole,
        tenantId
      });

      // Update tenant user doc
      await db.collection('tenants').doc(tenantId).collection('users').doc(targetUserId).set(
        {
          role: targetRole,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: callerUid
        },
        { merge: true }
      );

      // Update root user doc
      await db.collection('users').doc(targetUserId).set(
        {
          role: targetRole,
          tenantId,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return {
        success: true,
        message: `Role successfully updated to ${targetRole} for user ${targetUserId}`
      };
    } catch (err: any) {
      logger.error(`Error in setUserRole:`, err);
      throw new HttpsError('internal', err.message || 'Failed to update custom claims.');
    }
  }
);