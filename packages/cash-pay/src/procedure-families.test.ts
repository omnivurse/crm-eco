import { describe, expect, it } from 'vitest';
import { familyForCode, searchProcedureFamilies } from './procedure-families';

describe('searchProcedureFamilies', () => {
  it('finds total knee from a human phrase or the CPT', () => {
    expect(searchProcedureFamilies('knee surgery').some((f) => f.code === '27447')).toBe(true);
    expect(searchProcedureFamilies('27447')[0]?.label).toBe('Total knee arthroplasty');
    expect(familyForCode('27447')?.companions.map((c) => c.code)).toContain('01402');
    expect(searchProcedureFamilies('gallbladder').some((f) => f.code === '47562')).toBe(true);
    expect(searchProcedureFamilies('c-section').some((f) => f.code === '59510')).toBe(true);
  });
});
