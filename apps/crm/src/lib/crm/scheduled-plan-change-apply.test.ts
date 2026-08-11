/**
 * Applying a due scheduled plan change must flip the flat plan fields, keep
 * start/original dates untouched, backfill + mark the audit entry applied,
 * consume the scheduled key, and never touch member-synced records.
 */
import { describe, it, expect } from 'vitest';

import {
  buildScheduledPlanChangeUpdates,
  isRecordSyncedToMember,
  parseScheduledPlanChange,
  type RecordForScheduledPlanChange,
} from './scheduled-plan-change-apply';

const TODAY = '2026-09-01';

function record(over: Partial<RecordForScheduledPlanChange> = {}): RecordForScheduledPlanChange {
  return {
    id: 'rec-1',
    org_id: 'org-1',
    title: 'Adam Davis',
    system: null,
    data: {
      product: 'Care+',
      monthly_contribution: '250',
      iua_amount: '1000',
      start_date: '2024-01-01',
      original_start_date: '2024-01-01',
      membership_changes: [
        {
          id: 'chg-1',
          date: TODAY,
          type: 'upgrade',
          to_plan: 'Premium Care',
          to_monthly: '350',
          to_iua: '500',
          change_status: 'scheduled',
          follow_up_task_id: 'task-1',
          created_at: '2026-08-09T00:00:00Z',
        },
      ],
      scheduled_plan_change: {
        change_id: 'chg-1',
        effective_date: TODAY,
        to_plan: 'Premium Care',
        to_monthly: '350',
        to_iua: '500',
      },
    },
    ...over,
  };
}

describe('parseScheduledPlanChange', () => {
  it('rejects null / malformed / missing effective_date values', () => {
    expect(parseScheduledPlanChange(null)).toBeNull();
    expect(parseScheduledPlanChange({ scheduled_plan_change: null })).toBeNull();
    expect(parseScheduledPlanChange({ scheduled_plan_change: 'x' })).toBeNull();
    expect(parseScheduledPlanChange({ scheduled_plan_change: { to_plan: 'A' } })).toBeNull();
    expect(
      parseScheduledPlanChange({ scheduled_plan_change: { effective_date: 'not-a-date' } }),
    ).toBeNull();
  });
});

describe('buildScheduledPlanChangeUpdates', () => {
  it('returns null before the effective date', () => {
    expect(buildScheduledPlanChangeUpdates(record(), '2026-08-31')).toBeNull();
  });

  it('never applies to a member-synced record', () => {
    const synced = record({ system: { synced: true } });
    expect(isRecordSyncedToMember(synced)).toBe(true);
    expect(buildScheduledPlanChangeUpdates(synced, TODAY)).toBeNull();
  });

  it('never applies to a twin record bridged to a members row (linked_member_id)', () => {
    const twin = record();
    twin.data = { ...twin.data, linked_member_id: 'member-1' };
    expect(isRecordSyncedToMember(twin)).toBe(true);
    expect(buildScheduledPlanChangeUpdates(twin, TODAY)).toBeNull();
  });

  it('flips plan fields, preserves start dates, marks the entry applied, consumes the key', () => {
    const built = buildScheduledPlanChangeUpdates(record(), TODAY);
    expect(built).not.toBeNull();

    const data = built!.updates.data as Record<string, unknown>;
    expect(data.product).toBe('Premium Care');
    expect(data.previous_product).toBe('Care+');
    expect(data.monthly_contribution).toBe('350');
    expect(data.iua_amount).toBe('500');
    expect(data.sharing_effective_date).toBe(TODAY);
    // Tenure fields untouched — the cancel cron must not see a termination.
    expect(data.start_date).toBe('2024-01-01');
    expect(data.original_start_date).toBe('2024-01-01');
    expect(data.sharing_end_date).toBeUndefined();
    expect(data.scheduled_plan_change).toBeUndefined();

    const entry = (data.membership_changes as Record<string, unknown>[])[0];
    expect(entry.change_status).toBe('applied');
    expect(entry.applied_at).toBeTruthy();
    // from_* backfilled from the pre-flip values.
    expect(entry.from_plan).toBe('Care+');
    expect(entry.from_monthly).toBe('250');
    expect(entry.from_iua).toBe('1000');

    expect(built!.followUpTaskId).toBe('task-1');
  });

  it('updates every monthly key present on the record', () => {
    const rec = record();
    rec.data = { ...rec.data, monthly_premium: '250', monthly_amount: '250' };
    const data = buildScheduledPlanChangeUpdates(rec, TODAY)!.updates.data as Record<string, unknown>;
    expect(data.monthly_contribution).toBe('350');
    expect(data.monthly_premium).toBe('350');
    expect(data.monthly_amount).toBe('350');
  });

  it('applies past-due changes (missed cron day) rather than dropping them', () => {
    const built = buildScheduledPlanChangeUpdates(record(), '2026-09-03');
    expect(built).not.toBeNull();
    expect((built!.updates.data as Record<string, unknown>).product).toBe('Premium Care');
  });
});
