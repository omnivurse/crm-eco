import { describe, expect, it } from 'vitest';
import {
  buildPlanChangeFollowUpTask,
  localTodayIso,
  shouldCreatePlanChangeFollowUp,
} from './plan-change-follow-up';

describe('shouldCreatePlanChangeFollowUp', () => {
  it('creates for today and future dates', () => {
    expect(shouldCreatePlanChangeFollowUp('2026-09-01', '2026-07-29')).toBe(true);
    expect(shouldCreatePlanChangeFollowUp('2026-07-29', '2026-07-29')).toBe(true);
  });

  it('skips historical backfills', () => {
    expect(shouldCreatePlanChangeFollowUp('2026-01-01', '2026-07-29')).toBe(false);
  });

  it('skips when a follow-up task is already linked', () => {
    expect(
      shouldCreatePlanChangeFollowUp('2026-09-01', '2026-07-29', 'task-uuid'),
    ).toBe(false);
  });

  it('rejects malformed dates', () => {
    expect(shouldCreatePlanChangeFollowUp('Sept 1', '2026-07-29')).toBe(false);
  });
});

describe('buildPlanChangeFollowUpTask', () => {
  it('builds a high-priority follow_up due on the effective date', () => {
    const payload = buildPlanChangeFollowUpTask({
      recordId: '11111111-1111-1111-1111-111111111111',
      recordTitle: 'Jane Pietruszka',
      changeId: 'change-1',
      type: 'downgrade',
      effectiveDate: '2026-09-01',
      fromPlan: 'Secure HSA',
      toPlan: 'Care+',
      notes: 'Member requested for Sept 1',
    });

    expect(payload.activity_type).toBe('follow_up');
    expect(payload.priority).toBe('high');
    expect(payload.due_date).toBe('2026-09-01T12:00:00');
    expect(payload.record_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload.title).toContain('Secure HSA → Care+');
    expect(payload.title).toContain('Jane Pietruszka');
    expect(payload.description).toContain('Member requested for Sept 1');
    expect(payload.description).toContain('change-1');
  });
});

describe('localTodayIso', () => {
  it('formats a fixed local date as YYYY-MM-DD', () => {
    // Midday avoids DST edge cases around midnight for this assertion.
    const d = new Date(2026, 6, 29, 12, 0, 0);
    expect(localTodayIso(d)).toBe('2026-07-29');
  });
});
