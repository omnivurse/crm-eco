/**
 * Tenant and ownership relationships the service-role sequence processor must
 * re-establish before it follows user-writable foreign keys.
 */
export interface EnrollmentScope {
  sequenceId: string;
  sequenceOrganizationId: string | null | undefined;
  recordOrganizationId: string | null | undefined;
  currentStepSequenceId: string | null | undefined;
}

/**
 * RLS on sequence enrollments validates only the sequence tenant. It does not
 * prove that record_id or current_step_id belongs to that same sequence/org.
 * The background processor bypasses RLS, so it must fail closed before reading
 * record merge fields or executing a step.
 */
export function hasValidEnrollmentScope({
  sequenceId,
  sequenceOrganizationId,
  recordOrganizationId,
  currentStepSequenceId,
}: EnrollmentScope): boolean {
  if (!sequenceOrganizationId || recordOrganizationId !== sequenceOrganizationId) {
    return false;
  }

  return currentStepSequenceId == null || currentStepSequenceId === sequenceId;
}
