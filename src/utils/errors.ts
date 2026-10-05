// src/utils/errors.ts

export interface BackendError {
  code: string;
  message: string;
}

/**
 * Maps standard backend / database error codes to friendly, human-readable instructions.
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected operational failure occurred.';

  // Support both standard Firebase objects and custom JSON error objects
  const code = error.code || error.status || '';
  const originalMessage = error.message || '';

  // Check common code maps
  const errorMap: Record<string, string> = {
    // Firebase Auth Codes
    'auth/user-not-found': 'No registered account found matching that email address.',
    'auth/wrong-password': 'The credentials provided do not match our identity registers.',
    'auth/invalid-email': 'Please enter a valid format email address to authenticate.',
    'auth/email-already-in-use': 'This email is already linked to another operational registration. Try logging in.',
    'auth/weak-password': 'Our safety policies require your pass-key string to be at least 6 characters long.',
    'auth/too-many-requests': 'Lockout triggered due to speed-limit iterations. Rest a minute or reset.',
    
    // Firestore / REST Codes
    'permission-denied': 'Access Restricted. You lack sufficient permissions to query or modify this database partition.',
    'not-found': 'The requested record is invalid or could not be found inside the system registries.',
    'already-exists': 'Resource Duplication. This unique registry entry or code already exists in your enterprise shard.',
    'resource-exhausted': 'Rate Limit Exceeded. High-volume traffic detected. Wait momentarily before retry.',
    'unauthenticated': 'Session Invalidated. Please log into your Ashrey Systems console account again.',
    'unavailable': 'Our cloud engines appear offline or are suffering temporary network latency. Please check connection.',
    'cancelled': 'The submission execution request was aborted before completing.',
    'deadline-exceeded': 'The service took too long to respond. The operation has timed out.',
    'failed-precondition': 'Precondition evaluation failed. The resource is not configured correctly in this mode.',
    'invalid-argument': 'Validation Mismatch. Supplied form variables have formatting issues.',
  };

  // Check matching code
  if (code && errorMap[code]) {
    return errorMap[code];
  }

  // Fallback checks on messages for flexible APIs
  const lowerMsg = originalMessage.toLowerCase();
  if (lowerMsg.includes('permission') || lowerMsg.includes('insufficient')) {
    return 'Permission Denied: Your staff profile possesses insufficient authorization level for this action.';
  }
  if (lowerMsg.includes('not-found') || lowerMsg.includes('found')) {
    return 'Not Found: The active document search target has passed out of index scope.';
  }
  if (lowerMsg.includes('network') || lowerMsg.includes('offline')) {
    return 'Connection Lost: Check your local network gateway and retry the transaction.';
  }

  return originalMessage || 'Execution exception encountered. Resolve conflicts and resubmit.';
};

/**
 * Parses generic exception events to normalized BackendError format.
 */
export const normalizeBackendError = (err: any): BackendError => {
  return {
    code: err?.code || 'unknown-failure',
    message: getFriendlyErrorMessage(err)
  };
};
