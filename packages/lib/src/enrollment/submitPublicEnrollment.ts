/**
 * Shared public enrollment submit helpers.
 *
 * Admin and member-portal each expose POST /api/enroll/submit (~500 lines).
 * Full extraction into one orchestrator is Phase 5 of the architecture plan —
 * do not fork new submit logic; extend finalizeEnrollment + create_enrollment_tx.
 *
 * Divergence today:
 * - Admin may call finalizeEnrollment when ENROLLMENT_COMPLETION_ENABLED
 * - Portal public submit stops at status=submitted
 * - Portal authenticated actions.ts still inserts memberships inline (legacy)
 */

export const ENROLLMENT_COMPLETION_FLAG = 'ENROLLMENT_COMPLETION_ENABLED';

export function isEnrollmentCompletionEnabled(): boolean {
  return process.env.ENROLLMENT_COMPLETION_ENABLED === 'true';
}
