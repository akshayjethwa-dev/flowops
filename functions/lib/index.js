"use strict";
/**
 * Cloud Functions for Ashrey FlowOps Manufacturing Operations CRM
 * 2nd Gen (v2) Firebase Functions + Modular Firebase Admin SDK
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserRole = exports.syncRootUserClaims = exports.syncTenantUserClaims = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_2 = require("firebase-admin/firestore");
// ---------------------------------------------------------------------------
// Global options applied to every v2 function in this codebase
// ---------------------------------------------------------------------------
(0, v2_1.setGlobalOptions)({
    region: 'asia-south1',
    maxInstances: 10,
    memory: '256MiB',
    concurrency: 80,
});
// ---------------------------------------------------------------------------
// Lazy Admin SDK initialization (never at module top-level)
// ---------------------------------------------------------------------------
let _auth = null;
let _db = null;
function ensureApp() {
    if ((0, app_1.getApps)().length === 0) {
        (0, app_1.initializeApp)({ credential: (0, app_1.applicationDefault)() });
    }
}
function getAdminAuth() {
    if (!_auth) {
        ensureApp();
        _auth = (0, auth_1.getAuth)();
    }
    return _auth;
}
function getAdminDb() {
    if (!_db) {
        ensureApp();
        _db = (0, firestore_2.getFirestore)();
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
];
function normalizeRole(role) {
    return typeof role === 'string' && VALID_ROLES.includes(role)
        ? role
        : 'viewer';
}
// ---------------------------------------------------------------------------
// Trigger 1: tenants/{tenantId}/users/{userId}
// ---------------------------------------------------------------------------
exports.syncTenantUserClaims = (0, firestore_1.onDocumentWritten)({ document: 'tenants/{tenantId}/users/{userId}' }, async (event) => {
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
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(`Could not clear claims for deleted user ${userId}: ${msg}`);
        }
        return;
    }
    const userData = (change.after.data() || {});
    const role = normalizeRole(userData.role);
    const isSuperAdmin = !!userData.isSuperAdmin;
    const assignedPlantIds = userData.assignedPlantIds || [];
    const assignedStageIds = userData.assignedStageIds || [];
    const beforeData = change.before?.exists
        ? change.before.data()
        : null;
    if (beforeData &&
        beforeData.role === role &&
        !!beforeData.isSuperAdmin === isSuperAdmin &&
        JSON.stringify(beforeData.assignedPlantIds || []) === JSON.stringify(assignedPlantIds) &&
        JSON.stringify(beforeData.assignedStageIds || []) === JSON.stringify(assignedStageIds)) {
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
        logger.info(`Successfully set custom claims for user ${userId}: role=${role}, tenant=${tenantId}`);
        const db = getAdminDb();
        await db.collection('users').doc(userId).set({
            role,
            tenantId,
            isSuperAdmin,
            assignedPlantIds,
            assignedStageIds,
            claimsUpdatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
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
            description: `Custom claims synchronized for ${userData.name || userData.email || userId}: Role [${role}].`,
            metadata: { role, tenantId, isSuperAdmin },
        });
    }
    catch (error) {
        logger.error(`Error setting custom claims for ${userId}:`, error);
    }
});
// ---------------------------------------------------------------------------
// Trigger 2: users/{userId}
// ---------------------------------------------------------------------------
exports.syncRootUserClaims = (0, firestore_1.onDocumentWritten)({ document: 'users/{userId}' }, async (event) => {
    const change = event.data;
    if (!change || !change.after.exists)
        return;
    const { userId } = event.params;
    const userData = (change.after.data() || {});
    const tenantId = userData.tenantId;
    const role = normalizeRole(userData.role);
    if (!tenantId) {
        logger.warn(`User ${userId} has no tenantId assigned yet. Skipping.`);
        return;
    }
    try {
        const auth = getAdminAuth();
        const authUser = await auth.getUser(userId);
        const existingClaims = authUser.customClaims || {};
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Root trigger failed for ${userId}: ${msg}`);
    }
});
// ---------------------------------------------------------------------------
// Callable: setUserRole
// ---------------------------------------------------------------------------
exports.setUserRole = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const callerUid = request.auth.uid;
    const callerClaims = request.auth.token;
    const callerRole = callerClaims.role;
    const isSuper = !!callerClaims.isSuperAdmin;
    if (callerRole !== 'admin' && !isSuper) {
        throw new https_1.HttpsError('permission-denied', 'Only administrators can assign user roles and custom claims.');
    }
    const { targetUserId, targetRole, tenantId } = (request.data || {});
    if (!targetUserId || !targetRole || !tenantId) {
        throw new https_1.HttpsError('invalid-argument', 'targetUserId, targetRole, and tenantId are required.');
    }
    if (!VALID_ROLES.includes(targetRole)) {
        throw new https_1.HttpsError('invalid-argument', `Invalid role: ${targetRole}. Must be one of ${VALID_ROLES.join(', ')}.`);
    }
    if (!isSuper && callerClaims.tenantId !== tenantId) {
        throw new https_1.HttpsError('permission-denied', 'Cannot modify users in another tenant.');
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
            .set({
            role: targetRole,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
            updatedBy: callerUid,
        }, { merge: true });
        await db
            .collection('users')
            .doc(targetUserId)
            .set({
            role: targetRole,
            tenantId,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
            success: true,
            message: `Role successfully updated to ${targetRole} for user ${targetUserId}`,
        };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update custom claims.';
        logger.error(`Error in setUserRole:`, err);
        throw new https_1.HttpsError('internal', msg);
    }
});
//# sourceMappingURL=index.js.map