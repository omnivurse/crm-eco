import { describe, expect, it } from 'vitest';
import { assertCrmPendingHasStartDate } from './pending-start-date-invariant';

describe('assertCrmPendingHasStartDate', () => {
  it('allows Active without a start date', () => {
    expect(assertCrmPendingHasStartDate('Active', { data: {} }).ok).toBe(true);
  });

  it('rejects Pending without a resolvable start date', () => {
    const result = assertCrmPendingHasStartDate('Pending', { data: {} });
    expect(result.ok).toBe(false);
  });

  it('accepts Pending with original_start_date', () => {
    const result = assertCrmPendingHasStartDate('Pending', {
      original_start_date: '2026-09-01',
    });
    expect(result).toEqual({ ok: true, startDate: '2026-09-01' });
  });

  it('accepts Enrolled - Pending Start with JSONB start_date', () => {
    const result = assertCrmPendingHasStartDate('Enrolled - Pending Start', {
      data: { start_date: '2026-10-01' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.startDate).toBe('2026-10-01');
  });
});
