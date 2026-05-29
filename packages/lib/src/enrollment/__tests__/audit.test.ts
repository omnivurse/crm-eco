/**
 * Characterization tests for enrollment audit helpers.
 *
 * Supabase is mocked. These lock two contracts that matter for the hardening
 * pass: (1) the audit-row field mapping, and (2) that audit failures are
 * SWALLOWED — a failed audit insert must never throw / break the main flow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logEnrollmentAudit,
  generateStatusChangeMessage,
  EnrollmentAuditEvents,
  logEnrollmentStatusChange,
  logEnrollmentStepCompleted,
} from '../audit';

function makeAuditSupabase(insertError: unknown = null) {
  const inserted: { table: string; entry: Record<string, unknown> }[] = [];
  const supabase = {
    from: (table: string) => ({
      insert: (entry: Record<string, unknown>) => {
        inserted.push({ table, entry });
        return Promise.resolve({ error: insertError });
      },
    }),
  };
  return { supabase, inserted };
}

describe('generateStatusChangeMessage', () => {
  it('phrases an initial status (no prior status)', () => {
    expect(generateStatusChangeMessage(null, 'submitted')).toBe(
      'Enrollment status set to "submitted"'
    );
  });

  it('phrases a transition between two statuses', () => {
    expect(generateStatusChangeMessage('draft', 'submitted')).toBe(
      'Enrollment status changed from "draft" to "submitted"'
    );
  });
});

describe('EnrollmentAuditEvents', () => {
  it('exposes the stable event-type vocabulary', () => {
    expect(EnrollmentAuditEvents.CREATED).toBe('created');
    expect(EnrollmentAuditEvents.STATUS_CHANGED).toBe('status_changed');
    expect(EnrollmentAuditEvents.STEP_COMPLETED).toBe('step_completed');
    expect(EnrollmentAuditEvents.CANCELLED).toBe('cancelled');
  });
});

describe('logEnrollmentAudit', () => {
  it('maps params to an enrollment_audit_log row, null-coalescing optionals', async () => {
    const { supabase, inserted } = makeAuditSupabase();
    await logEnrollmentAudit({
      supabase: supabase as never,
      organizationId: 'o1',
      enrollmentId: 'e1',
      eventType: 'created',
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe('enrollment_audit_log');
    expect(inserted[0].entry).toEqual({
      organization_id: 'o1',
      enrollment_id: 'e1',
      actor_profile_id: null,
      event_type: 'created',
      old_status: null,
      new_status: null,
      message: null,
      data_before: null,
      data_after: null,
    });
  });

  it('passes through provided optional fields', async () => {
    const { supabase, inserted } = makeAuditSupabase();
    await logEnrollmentAudit({
      supabase: supabase as never,
      organizationId: 'o1',
      enrollmentId: 'e1',
      actorProfileId: 'p1',
      eventType: 'status_changed',
      oldStatus: 'draft',
      newStatus: 'submitted',
      message: 'hi',
      dataBefore: { a: 1 },
      dataAfter: { a: 2 },
    });

    expect(inserted[0].entry).toMatchObject({
      actor_profile_id: 'p1',
      old_status: 'draft',
      new_status: 'submitted',
      message: 'hi',
      data_before: { a: 1 },
      data_after: { a: 2 },
    });
  });

  it('SWALLOWS insert errors (never throws) and logs to console.error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { supabase } = makeAuditSupabase({ message: 'insert boom' });

    await expect(
      logEnrollmentAudit({
        supabase: supabase as never,
        organizationId: 'o1',
        enrollmentId: 'e1',
        eventType: 'created',
      })
    ).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalled();
  });
});

describe('audit convenience wrappers', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('logEnrollmentStatusChange writes a status_changed row with a generated message', async () => {
    const { supabase, inserted } = makeAuditSupabase();
    await logEnrollmentStatusChange(supabase as never, {
      organizationId: 'o1',
      enrollmentId: 'e1',
      oldStatus: 'draft',
      newStatus: 'submitted',
    });

    expect(inserted[0].entry).toMatchObject({
      event_type: 'status_changed',
      old_status: 'draft',
      new_status: 'submitted',
      message: 'Enrollment status changed from "draft" to "submitted"',
    });
  });

  it('logEnrollmentStepCompleted writes a step_completed row naming the step', async () => {
    const { supabase, inserted } = makeAuditSupabase();
    await logEnrollmentStepCompleted(supabase as never, {
      organizationId: 'o1',
      enrollmentId: 'e1',
      stepKey: 'payment',
    });

    expect(inserted[0].entry).toMatchObject({
      event_type: 'step_completed',
      message: 'Step "payment" completed',
    });
  });
});
