import { describe, expect, it } from 'vitest';
import { advisorSearchOrFilter } from './advisor-search';

describe('advisorSearchOrFilter', () => {
  it('searches name columns that exist on the live table', () => {
    const or = advisorSearchOrFilter('Wen');
    expect(or).toContain('advisor_name.ilike.%Wen%');
    expect(or).toContain('agency_name.ilike.%Wen%');
    expect(or).not.toContain('email');
    expect(or).not.toContain('producer_code');
  });

  it('escapes PostgREST wildcards', () => {
    expect(advisorSearchOrFilter('a%b')).toContain('a\\%b');
  });
});
