import { describe, it, expect } from 'vitest';
import { resolveEnrollmentContribution } from '../enrollmentContribution';

describe('resolveEnrollmentContribution', () => {
  const base = {
    amount: 800,
    foundingWaiver: 650,
    foundingCap: 250,
    foundingEnabled: true,
    foundingCount: 0,
  };

  it('applies founding waiver when under cap', () => {
    const r = resolveEnrollmentContribution(base);
    expect(r).toEqual({
      listAmount: 800,
      waiverAmount: 650,
      netAmount: 150,
      foundingWaiverApplied: true,
    });
  });

  it('honors applyFoundingWaiver=false', () => {
    const r = resolveEnrollmentContribution({ ...base, applyFoundingWaiver: false });
    expect(r.netAmount).toBe(800);
    expect(r.foundingWaiverApplied).toBe(false);
  });

  it('honors applyFoundingWaiver=true even over cap', () => {
    const r = resolveEnrollmentContribution({
      ...base,
      foundingCount: 999,
      applyFoundingWaiver: true,
    });
    expect(r.netAmount).toBe(150);
  });

  it('never waives more than list amount', () => {
    const r = resolveEnrollmentContribution({
      ...base,
      foundingWaiver: 900,
    });
    expect(r.waiverAmount).toBe(800);
    expect(r.netAmount).toBe(0);
  });

  it('passes splits through', () => {
    const r = resolveEnrollmentContribution({
      ...base,
      splits: { referringMember: 100, adminOps: 50, partnerMarketing: 25, pifh: 25 },
    });
    expect(r.splits?.referringMember).toBe(100);
    expect(r.splits?.partnerMarketing).toBe(25);
  });
});
