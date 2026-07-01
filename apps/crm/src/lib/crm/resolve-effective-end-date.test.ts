import { describe, expect, it } from 'vitest';
import {
  firstDayOfCancellationMonth,
  isEligibleForScheduledCancellation,
  isScheduledCancellationDue,
  resolveEffectiveEndDate,
} from './resolve-effective-end-date';

describe('resolveEffectiveEndDate', () => {
  it('prefers indexed cancellation_date', () => {
    expect(
      resolveEffectiveEndDate({
        cancellation_date: '2026-04-15',
        data: { end_date: '2026-05-01' },
      }),
    ).toBe('2026-04-15');
  });

  it('falls back to JSONB end_date keys', () => {
    expect(
      resolveEffectiveEndDate({
        data: { termination_date: '2026-07-20' },
      }),
    ).toBe('2026-07-20');
  });

  it('returns the earliest date when multiple product end dates are set', () => {
    expect(
      resolveEffectiveEndDate({
        data: {
          sharing_end_date: '2026-06-01',
          health_insurance_end_date: '2026-01-31',
        },
      }),
    ).toBe('2026-01-31');
  });
});

describe('firstDayOfCancellationMonth', () => {
  it('normalizes to the first of the month', () => {
    expect(firstDayOfCancellationMonth('2026-04-15')).toBe('2026-04-01');
    expect(firstDayOfCancellationMonth('2026-12-31')).toBe('2026-12-01');
  });
});

describe('isEligibleForScheduledCancellation', () => {
  it('includes year-specific Enrolled statuses', () => {
    expect(isEligibleForScheduledCancellation('Enrolled - 2026')).toBe(true);
    expect(isEligibleForScheduledCancellation('Enrolled Member')).toBe(true);
  });

  it('excludes terminal statuses', () => {
    expect(isEligibleForScheduledCancellation('Cancelled')).toBe(false);
  });
});

describe('isScheduledCancellationDue', () => {
  it('cancels active records when the 1st of the end month has arrived', () => {
    const result = isScheduledCancellationDue(
      {
        status: 'Active HS Member',
        data: { end_date: '2026-04-15' },
      },
      '2026-04-01',
    );
    expect(result.due).toBe(true);
    expect(result.effectiveDate).toBe('2026-04-01');
  });

  it('cancels Enrolled - YYYY records when the end month has arrived', () => {
    const result = isScheduledCancellationDue(
      {
        status: 'Enrolled - 2026',
        data: { health_insurance_end_date: '2026-01-31' },
      },
      '2026-06-30',
    );
    expect(result.due).toBe(true);
    expect(result.endDate).toBe('2026-01-31');
    expect(result.effectiveDate).toBe('2026-02-01');
  });

  it('keeps active records until the cancellation month begins', () => {
    const result = isScheduledCancellationDue(
      {
        status: 'Active',
        data: { cancellation_date: '2026-07-15' },
      },
      '2026-06-30',
    );
    expect(result.due).toBe(false);
    expect(result.effectiveDate).toBe('2026-07-01');
  });

  it('skips already cancelled records', () => {
    const result = isScheduledCancellationDue(
      {
        status: 'Cancelled',
        data: { end_date: '2026-01-15' },
      },
      '2026-06-01',
    );
    expect(result.due).toBe(false);
  });
});
