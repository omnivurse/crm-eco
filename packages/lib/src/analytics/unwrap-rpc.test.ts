import { describe, expect, it } from 'vitest';
import { unwrapAdvisorRpcResult } from './unwrap-rpc';

describe('unwrapAdvisorRpcResult', () => {
  it('unwraps { rows, total } envelopes from live advisor RPCs', () => {
    const result = unwrapAdvisorRpcResult({
      rows: [{ advisor_id: 'a', total_enrollments: 3 }],
      total: 1,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.rows[0].total_enrollments).toBe(3);
  });

  it('does not treat the envelope object as an array', () => {
    const envelope = { rows: [{ id: 1 }, { id: 2 }], total: 2 };
    const broken = (envelope as unknown as unknown[]).length;
    expect(broken).toBeUndefined();
    expect(unwrapAdvisorRpcResult(envelope).rows).toHaveLength(2);
  });

  it('accepts a bare array for backward compatibility', () => {
    const result = unwrapAdvisorRpcResult([{ advisor_id: 'a' }]);
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('returns empty for null / unexpected shapes', () => {
    expect(unwrapAdvisorRpcResult(null).rows).toEqual([]);
    expect(unwrapAdvisorRpcResult('nope').rows).toEqual([]);
  });

  it('unwraps live churn widget envelope { advisors }', () => {
    const result = unwrapAdvisorRpcResult({
      advisors: [{ advisor_id: 'a', name: 'Ada', churn_rate: 0 }],
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Ada');
    expect(result.total).toBe(1);
  });

  it('unwraps live retention widget envelope { months }', () => {
    const result = unwrapAdvisorRpcResult({
      months: [{ month: '2026-08', retention_rate: 91.2 }],
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].month).toBe('2026-08');
  });
});
