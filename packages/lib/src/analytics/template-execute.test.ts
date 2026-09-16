import { describe, expect, it } from 'vitest';
import { getTemplateExecutePath, normalizeGrouping } from './template-execute';
import { computeNextScheduledRun } from './schedule';

describe('getTemplateExecutePath', () => {
  it('routes advisor and healthcare templates to specialty APIs', () => {
    expect(getTemplateExecutePath({ id: 'advisor-enrollments', category: 'advisors' }).kind).toBe('advisor');
    expect(getTemplateExecutePath({ id: 'network-coverage-report' }).kind).toBe('healthcare');
    expect(getTemplateExecutePath({ id: 'sales-pipeline', category: 'sales' }).kind).toBe('generic');
  });
});

describe('normalizeGrouping', () => {
  it('maps template { column, aggregation } to execute { field }', () => {
    expect(normalizeGrouping([{ column: 'advisor_id', aggregation: 'count' }])).toEqual([
      { field: 'advisor_id', order: 'asc' },
    ]);
  });
});

describe('computeNextScheduledRun', () => {
  it('advances daily by one day', () => {
    const from = new Date('2026-09-15T12:00:00Z');
    expect(computeNextScheduledRun(from, 'daily').toISOString().slice(0, 10)).toBe('2026-09-16');
  });
});
