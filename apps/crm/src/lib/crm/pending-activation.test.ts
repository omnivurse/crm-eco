import { describe, expect, it } from 'vitest';
import {
  buildActivationUpdates,
  isActivationDue,
  isEligibleForActivation,
  isPendingContactStatus,
} from './pending-activation';

describe('isPendingContactStatus / isEligibleForActivation', () => {
  it('recognizes Pending-class CRM statuses', () => {
    expect(isPendingContactStatus('Pending')).toBe(true);
    expect(isPendingContactStatus('Pending HS Member')).toBe(true);
    expect(isEligibleForActivation({ status: 'Enrolled - Pending Start' })).toBe(true);
  });

  it('rejects Active and null', () => {
    expect(isPendingContactStatus('Active')).toBe(false);
    expect(isPendingContactStatus(null)).toBe(false);
    expect(isEligibleForActivation({ status: 'active' })).toBe(false);
  });
});

describe('isActivationDue', () => {
  const base = {
    id: 'r1',
    org_id: 'o1',
    title: 'Test',
    status: 'Pending' as string | null,
    market_type: null as string | null,
    data: null as Record<string, unknown> | null,
    original_start_date: null as string | null,
    current_year_start_date: null as string | null,
  };

  it('is not due without a start date', () => {
    expect(isActivationDue(base, '2026-08-01')).toEqual({
      due: false,
      startDate: null,
      newStatus: null,
    });
  });

  it('is not due when start date is in the future', () => {
    const record = { ...base, current_year_start_date: '2026-09-01' };
    expect(isActivationDue(record, '2026-08-01')).toEqual({
      due: false,
      startDate: '2026-09-01',
      newStatus: null,
    });
  });

  it('is due when start date is today or earlier', () => {
    const record = { ...base, current_year_start_date: '2026-08-01' };
    const check = isActivationDue(record, '2026-08-01');
    expect(check.due).toBe(true);
    expect(check.startDate).toBe('2026-08-01');
    expect(check.newStatus).toBe('Active');
  });

  it('maps healthshare market to Active HS Member', () => {
    const record = {
      ...base,
      market_type: 'healthshare',
      current_year_start_date: '2026-07-01',
    };
    expect(isActivationDue(record, '2026-08-01').newStatus).toBe('Active HS Member');
  });
});

describe('buildActivationUpdates', () => {
  it('returns null when not due', () => {
    expect(
      buildActivationUpdates(
        {
          id: 'r1',
          org_id: 'o1',
          title: 'Test',
          status: 'Pending',
          data: {},
        },
        '2026-08-01',
      ),
    ).toBeNull();
  });

  it('sets status and contact_status when due', () => {
    const updates = buildActivationUpdates(
      {
        id: 'r1',
        org_id: 'o1',
        title: 'Test',
        status: 'Pending',
        data: { foo: 1 },
        original_start_date: '2026-08-01',
      },
      '2026-08-01',
    );
    expect(updates).toMatchObject({
      status: 'Active',
      data: { foo: 1, contact_status: 'Active' },
    });
    expect(updates?.updated_at).toEqual(expect.any(String));
  });
});
