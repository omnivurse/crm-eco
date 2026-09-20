import { describe, expect, it } from 'vitest';
import { decideEnrollmentMatch, rosterMatchKey } from '../match';
import { computeSponsorStartDate, earliestBackbillStart } from '../cutoff';
import { applyDependentCapToImport, parseRosterCsv, planRosterImport } from '../rosterImport';
import { planEligibilityEndings } from '../eligibility';
import { buildSponsorInvoiceDraft, isCoveredInPeriod } from '../invoice';
import { canAttachAnotherPlan, wouldExceedDependentCap } from '../caps';
import { filterPlansForSponsor } from '../landingPlans';
import { planKnownRosterEnroll } from '../knownRoster';
import { shouldHealSponsorshipLink, shouldLinkSponsorship } from '../linkMembership';
import { planSponsorshipDecision } from '../approvals';
import { shouldProvisionSponsorPaidEnrollment, shouldSkipMemberChargeForSponsor } from '../flags';
import { employeeInviteHtml } from '../invites';

describe('rosterMatchKey', () => {
  it('normalizes case and spaces', () => {
    expect(rosterMatchKey(' Jane  ', 'DOE', '1990-03-04')).toBe('jane|doe|1990-03-04');
  });
});

describe('decideEnrollmentMatch', () => {
  it('holds unmatched people for employer approval', () => {
    const d = decideEnrollmentMatch('sp-1', []);
    expect(d.outcome).toBe('needs_approval');
  });

  it('matches a single eligible person', () => {
    const d = decideEnrollmentMatch('sp-1', [
      { roster_id: 'r1', status: 'eligible', relationship: 'employee', member_id: null },
    ]);
    expect(d.outcome).toBe('matched');
    expect(d.roster?.roster_id).toBe('r1');
  });

  it('holds ambiguous matches', () => {
    const d = decideEnrollmentMatch('sp-1', [
      { roster_id: 'r1', status: 'eligible', relationship: 'employee', member_id: null },
      { roster_id: 'r2', status: 'eligible', relationship: 'employee', member_id: null },
    ]);
    expect(d.outcome).toBe('needs_approval');
  });
});

describe('computeSponsorStartDate', () => {
  it('uses the 1st of the requested month when day is on or before cutoff', () => {
    expect(computeSponsorStartDate('2026-05-12', 15)).toBe('2026-05-01');
  });

  it('rolls to next month after cutoff', () => {
    expect(computeSponsorStartDate('2026-05-16', 15)).toBe('2026-06-01');
  });

  it('caps backbilling', () => {
    expect(earliestBackbillStart('2025-01-01', 1, '2026-05-20')).toBe('2026-04-01');
    expect(earliestBackbillStart('2026-05-01', 6, '2026-05-20')).toBe('2026-05-01');
  });
});

describe('roster CSV import', () => {
  it('inserts new people and terminates ended rows on apply plan', () => {
    const csv = [
      'first_name,last_name,date_of_birth,status,eligible_end',
      'Ada,Lovelace,1815-12-10,eligible,',
      'Alan,Turing,1912-06-23,terminated,2026-04-30',
    ].join('\n');
    const incoming = parseRosterCsv(csv);
    const plan = planRosterImport(incoming, [
      {
        id: 'r-alan',
        match_key: 'alan|turing|1912-06-23',
        status: 'eligible',
        external_id: null,
      },
    ]);
    expect(plan.inserted_rows).toBe(1);
    expect(plan.terminated_rows).toBe(1);
    expect(plan.rows.find((r) => r.action === 'insert')?.payload.first_name).toBe('Ada');
  });
});

describe('eligibility endings', () => {
  it('ends open memberships whose eligibility has passed', () => {
    const actions = planEligibilityEndings(
      [
        {
          membership_id: 'm1',
          roster_id: 'r1',
          sponsorship_id: 's1',
          member_id: 'mem1',
          status: 'active',
          end_date: null,
          eligible_end: '2026-04-30',
        },
        {
          membership_id: 'm2',
          roster_id: 'r2',
          sponsorship_id: 's2',
          member_id: 'mem2',
          status: 'active',
          end_date: null,
          eligible_end: '2026-12-31',
        },
      ],
      '2026-05-13'
    );
    expect(actions.filter((a) => a.event_type === 'ended')).toHaveLength(1);
    expect(actions.find((a) => a.event_type === 'ended')?.end_date).toBe('2026-04-30');
  });
});

describe('sponsor invoice', () => {
  it('bills one line per covered life in the period', () => {
    const draft = buildSponsorInvoiceDraft({
      sponsor_id: 'sp1',
      organization_id: 'org1',
      sponsor_name: 'Acme',
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      rows: [
        {
          roster_id: 'r1',
          member_id: 'm1',
          membership_id: 'ms1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          role: 'employee',
          amount: 199,
          plan_id: 'p1',
          plan_name: 'MSA 2500',
          status: 'active',
          effective_date: '2026-05-01',
          end_date: null,
        },
        {
          roster_id: 'r2',
          member_id: 'm2',
          membership_id: 'ms2',
          first_name: 'Ended',
          last_name: 'Person',
          role: 'employee',
          amount: 199,
          plan_id: 'p1',
          plan_name: 'MSA 2500',
          status: 'ended',
          effective_date: '2026-01-01',
          end_date: '2026-04-30',
        },
      ],
    });
    expect(draft.headcount).toBe(1);
    expect(draft.total).toBe(199);
    expect(isCoveredInPeriod({ status: 'active', effective_date: '2026-06-01', end_date: null }, '2026-05-01', '2026-05-31')).toBe(false);
    expect(isCoveredInPeriod({ status: 'ended', effective_date: '2026-01-01', end_date: '2026-04-15' }, '2026-05-01', '2026-05-31')).toBe(false);
  });

  it('keeps the full amount with no rule and zeros a member-paid core share', () => {
    const noRule = buildSponsorInvoiceDraft({
      sponsor_id: 'sp1',
      organization_id: 'org1',
      sponsor_name: 'Acme',
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      rows: [
        {
          roster_id: 'r1',
          member_id: 'm1',
          membership_id: 'ms1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          role: 'employee',
          amount: 199,
          plan_id: 'p1',
          plan_name: 'MSA 2500',
          status: 'active',
          effective_date: '2026-05-01',
          end_date: null,
        },
      ],
    });
    expect(noRule.total).toBe(199);

    const memberPays = buildSponsorInvoiceDraft({
      sponsor_id: 'sp1',
      organization_id: 'org1',
      sponsor_name: 'Acme',
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      rows: [
        {
          roster_id: 'r1',
          member_id: 'm1',
          membership_id: 'ms1',
          first_name: 'Ada',
          last_name: 'Lovelace',
          role: 'employee',
          amount: 199,
          plan_id: 'p1',
          plan_name: 'MSA 2500',
          status: 'active',
          effective_date: '2026-05-01',
          end_date: null,
          coverage: {
            rules: [{ charge_item_code: 'core_membership', treatment: 'pass_through', who_pays: 'member' }],
          },
        },
      ],
    });
    expect(memberPays.total).toBe(0);
  });
});

describe('known roster and sponsor-paid enroll', () => {
  it('attaches existing members and creates only when email is present', () => {
    const planned = planKnownRosterEnroll(
      [
        { first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1815-12-10', email: 'ada@example.com' },
        { first_name: 'New', last_name: 'Hire', date_of_birth: '1990-01-01', email: 'new@example.com' },
        { first_name: 'No', last_name: 'Email', date_of_birth: '1991-01-01' },
      ],
      [{ id: 'm1', first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1815-12-10', email: 'ada@example.com' }],
    );
    expect(planned.attach_count).toBe(1);
    expect(planned.create_count).toBe(1);
    expect(planned.error_count).toBe(1);
  });

  it('skips employee card on any sponsor-paid slug outcome', () => {
    expect(shouldSkipMemberChargeForSponsor('matched')).toBe(true);
    expect(shouldSkipMemberChargeForSponsor('needs_approval')).toBe(true);
    expect(shouldSkipMemberChargeForSponsor('no_sponsor')).toBe(false);
    expect(shouldProvisionSponsorPaidEnrollment('matched')).toBe(true);
    expect(shouldProvisionSponsorPaidEnrollment('needs_approval')).toBe(false);
  });

  it('links only when both enrollment and membership exist', () => {
    expect(shouldLinkSponsorship({ enrollmentId: 'e1', membershipId: 'm1' })).toBe(true);
    expect(shouldLinkSponsorship({ enrollmentId: 'e1', membershipId: null })).toBe(false);
    expect(shouldHealSponsorshipLink(null, 'm1')).toBe(true);
    expect(shouldHealSponsorshipLink('m1', 'm1')).toBe(false);
    expect(shouldHealSponsorshipLink(undefined, null)).toBe(false);
  });

  it('approves needs_approval into pending and denies to ended', () => {
    expect(planSponsorshipDecision({ currentStatus: 'needs_approval', decision: 'approve' })).toEqual({
      ok: true,
      nextStatus: 'pending',
    });
    expect(planSponsorshipDecision({ currentStatus: 'active', decision: 'deny' }).ok).toBe(false);
  });

  it('renders an employee invite', () => {
    expect(employeeInviteHtml({ sponsorName: 'Acme', enrollUrl: 'https://x/enroll/acme', firstName: 'Ada' })).toContain('Acme');
    expect(employeeInviteHtml({ sponsorName: 'Acme', enrollUrl: 'https://x/enroll/acme', firstName: 'Ada', locale: 'es' })).toContain('inscribirse');
  });
});

describe('dependent cap and plan filter', () => {
  it('blocks extra dependents past cap * employees', () => {
    expect(
      wouldExceedDependentCap({ cap: 2, employeeCount: 1, dependentCountAfter: 3 })
    ).toBe(true);
    expect(
      wouldExceedDependentCap({ cap: 2, employeeCount: 1, dependentCountAfter: 2 })
    ).toBe(false);
    expect(canAttachAnotherPlan({ allowMultiplePlans: false, attachedCount: 1 })).toBe(false);
  });

  it('errors CSV children that exceed the cap', () => {
    const csv = [
      'first_name,last_name,date_of_birth,relationship',
      'Ada,Lovelace,1815-12-10,employee',
      'Ann,Lovelace,1843-01-01,child',
      'Bob,Lovelace,1844-01-01,child',
      'Cal,Lovelace,1845-01-01,child',
    ].join('\n');
    const planned = applyDependentCapToImport(planRosterImport(parseRosterCsv(csv), []), [], 2);
    expect(planned.inserted_rows).toBe(3);
    expect(planned.error_rows).toBe(1);
    expect(planned.rows.find((row) => row.action === 'error')?.payload.first_name).toBe('Cal');
  });

  it('intersects sponsor plans and collapses when only one is allowed', () => {
    const plans = [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' },
      { id: 'p3', name: 'C' },
    ];
    expect(
      filterPlansForSponsor({
        plans,
        landingPlanIds: ['p1', 'p2', 'p3'],
        sponsorPlanIds: ['p2', 'p3'],
        allowMultiplePlans: false,
        defaultPlanId: 'p3',
      }).map((plan) => plan.id)
    ).toEqual(['p3']);
  });
});
