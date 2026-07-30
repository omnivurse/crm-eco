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

// Device recognition
export {
    computeDeviceHash,
    deviceSignalsFromHeaders,
    recordDeviceSighting,
    type DeviceSighting,
} from './device';

// MFA step-up evaluation
export {
    MFA_STEP_UP_PATH,
    hasVerifiedTotpFactor,
    isMfaEnforcementEnabled,
    isMfaStepUpRequired,
    readAalFromAccessToken,
    type AssuranceLevel,
} from './mfa';

// NOTE: a bespoke `session.ts` module used to live here, exporting a parallel
// session store (`user_sessions` + a `session_token` cookie) with a 24-hour
// inactivity timeout and an absolute expiry. It was never imported by any route,
// page, or component — so none of it ran, while still reading as though the
// product enforced idle timeouts. It was removed rather than wired up:
//   * Supabase already owns session lifecycle; a second store would have been a
//     duplicate system to keep in sync.
//   * Idle/time-based sign-out is deliberately NOT part of this product. The
//     only session lock (SecurityProvider) stays opt-in behind
//     NEXT_PUBLIC_ENABLE_SESSION_LOCK and is off by default.
// Session revocation is event-driven only — an admin changing a role or
// deactivating an account. Never elapsed time.
