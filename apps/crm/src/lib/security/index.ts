/**
 * Security Module Index
 * 
 * Central export for all HIPAA security utilities
 */

// PHI Encryption
export {
    encryptPHI,
    decryptPHI,
    hashValue,
    maskSSN,
    maskDOB,
    maskPhone,
    maskEmail,
    PHI_FIELDS,
    isPHIField,
    identifyPHIFields,
    type PHIFieldType,
} from './encryption';

// Audit Logging
export {
    logPHIAccess,
    logAuthEvent,
    withPHILogging,
    getUserPHIAccessLogs,
    getOrganizationPHIAccessSummary,
    getRecentAuthEvents,
    type PHIAction,
    type ResourceType,
    type AuthEventType,
    type PHIAccessLogEntry,
    type AuthEventEntry,
} from './audit';

// Session Security
export {
    SESSION_TIMEOUT_MS,
    SESSION_ABSOLUTE_TIMEOUT_MS,
    getSessionToken,
    setSessionToken,
    clearSessionToken,
    createSession,
    validateSession,
    markSessionMFAVerified,
    invalidateSession,
    invalidateAllUserSessions,
    getUserActiveSessions,
    sessionNeedsMFA,
    getSessionTimeRemaining,
    type SessionInfo,
} from './session';
