import { describe, expect, it } from 'vitest';
import {
  ADVISOR_METRICS,
  expandEnrollmentStatusFilter,
  isPendingReviewStatus,
  reconcileCount,
  sumAdvisorMetric,
} from './metrics';

describe('expandEnrollmentStatusFilter', () => {
  it('maps legacy pending/terminated aliases to live statuses', () => {
    expect(expandEnrollmentStatusFilter(['pending'])).toEqual(
      expect.arrayContaining(['submitted', 'pending_review', 'more_info']),
    );
    expect(expandEnrollmentStatusFilter(['terminated'])).toEqual(['cancelled']);
    expect(expandEnrollmentStatusFilter(['active'])).toEqual(
      expect.arrayContaining(['approved', 'active']),
    );
  });

  it('passes through live statuses', () => {
    expect(expandEnrollmentStatusFilter(['submitted', 'approved'])).toEqual(
      expect.arrayContaining(['submitted', 'approved']),
    );
  });
});

describe('advisor metric reconciliation helpers', () => {
  it('sums per-advisor enrollment totals for the catalog definition', () => {
    const rows = [
      { advisor_id: 'a', total_enrollments: 10 },
      { advisor_id: 'b', total_enrollments: 5 },
    ];
    expect(sumAdvisorMetric(rows, 'total_enrollments')).toBe(15);
    expect(reconcileCount(15, 15).ok).toBe(true);
    expect(ADVISOR_METRICS.enrollments.sourceTables).toContain('enrollments');
  });

  it('treats submitted as pending review', () => {
    expect(isPendingReviewStatus('submitted')).toBe(true);
    expect(isPendingReviewStatus('pending')).toBe(false);
    expect(isPendingReviewStatus('approved')).toBe(false);
  });
});
