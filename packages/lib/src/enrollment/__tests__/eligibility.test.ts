/**
 * Unit tests for the DB-driven eligibility evaluator (pure logic).
 *
 * Locks the behavior of `evaluateEligibility` — the runtime reader that
 * activates the previously-inert `product_eligibility_rules`. Covers every
 * rule_type the admin modal writes (age / state / household / waiting_period /
 * pre_existing / custom), the block-vs-warn severity derived from `is_blocking`,
 * the advisory-by-default contract (advisory failures never flip `isEligible`),
 * and the never-throws / degrade-to-eligible safety guarantees.
 *
 * `now` is passed explicitly (the evaluator accepts it) so date-dependent
 * waiting-period assertions are deterministic without faking the system clock.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateEligibility,
  type EligibilityInput,
  type EligibilityRuleRow,
} from '../eligibility';

// A fixed evaluation date for deterministic waiting-period math.
const NOW = new Date('2026-06-24T12:00:00Z');

/** Build a rule row with sensible defaults; override per test. */
function rule(partial: Partial<EligibilityRuleRow> & Pick<EligibilityRuleRow, 'rule_type' | 'config'>): EligibilityRuleRow {
  return {
    id: partial.id ?? `rule-${partial.rule_type}`,
    rule_type: partial.rule_type,
    rule_name: partial.rule_name ?? `${partial.rule_type} rule`,
    config: partial.config,
    is_blocking: partial.is_blocking ?? true,
    error_message: partial.error_message ?? null,
    sort_order: partial.sort_order ?? 0,
    is_active: partial.is_active ?? true,
  };
}

const baseInput: EligibilityInput = {
  memberAge: 40,
  state: 'TX',
  householdSize: 2,
  coverageStart: '2026-07-01',
};

describe('evaluateEligibility — empty / inactive', () => {
  it('returns eligible with no findings for an empty rule set', () => {
    const r = evaluateEligibility([], baseInput, NOW);
    expect(r.isEligible).toBe(true);
    expect(r.findings).toHaveLength(0);
    expect(r.blocking).toHaveLength(0);
    expect(r.advisory).toHaveLength(0);
  });

  it('skips inactive rules', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'age', config: { min_age: 50, max_age: 60 }, is_active: false })],
      baseInput,
      NOW,
    );
    expect(r.isEligible).toBe(true);
    expect(r.findings).toHaveLength(0);
  });
});

describe('evaluateEligibility — age', () => {
  it('fails (blocks) when member age is below min', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'age', config: { min_age: 18, max_age: 64 } })],
      { ...baseInput, memberAge: 16 },
      NOW,
    );
    expect(r.isEligible).toBe(false);
    expect(r.blocking).toHaveLength(1);
    expect(r.blocking[0].rule_type).toBe('age');
    expect(r.blocking[0].severity).toBe('block');
  });

  it('fails when member age is above max', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'age', config: { min_age: 18, max_age: 64 } })],
      { ...baseInput, memberAge: 70 },
      NOW,
    );
    expect(r.isEligible).toBe(false);
  });

  it('passes within range', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'age', config: { min_age: 18, max_age: 64 } })],
      { ...baseInput, memberAge: 40 },
      NOW,
    );
    expect(r.isEligible).toBe(true);
    expect(r.findings).toHaveLength(0);
  });

  it('cannot evaluate without an age — skips rather than blocking', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'age', config: { min_age: 18, max_age: 64 } })],
      { ...baseInput, memberAge: null },
      NOW,
    );
    expect(r.isEligible).toBe(true);
    expect(r.findings).toHaveLength(0);
  });
});

describe('evaluateEligibility — state (include/exclude)', () => {
  it('include mode: fails when state not in list', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'state', config: { mode: 'include', states: ['FL', 'GA'] } })],
      { ...baseInput, state: 'TX' },
      NOW,
    );
    expect(r.isEligible).toBe(false);
    expect(r.blocking[0].rule_type).toBe('state');
  });

  it('include mode: passes when state is in list (case-insensitive)', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'state', config: { mode: 'include', states: ['tx', 'GA'] } })],
      { ...baseInput, state: 'TX' },
      NOW,
    );
    expect(r.isEligible).toBe(true);
  });

  it('exclude mode: fails when state IS in the list', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'state', config: { mode: 'exclude', states: ['TX'] } })],
      { ...baseInput, state: 'TX' },
      NOW,
    );
    expect(r.isEligible).toBe(false);
  });

  it('skips when member state is unknown', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'state', config: { mode: 'include', states: ['FL'] } })],
      { ...baseInput, state: null },
      NOW,
    );
    expect(r.isEligible).toBe(true);
  });
});

describe('evaluateEligibility — household', () => {
  it('fails when household exceeds max_size', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'household', config: { max_size: 3 } })],
      { ...baseInput, householdSize: 5 },
      NOW,
    );
    expect(r.isEligible).toBe(false);
  });

  it('passes at the boundary', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'household', config: { max_size: 5 } })],
      { ...baseInput, householdSize: 5 },
      NOW,
    );
    expect(r.isEligible).toBe(true);
  });
});

describe('evaluateEligibility — waiting_period (delegates to C2 date math)', () => {
  it('effective anchor: pending when coverage start + days is in the future', () => {
    // coverageStart 2026-07-01 + 30 days = 2026-07-31, which is after NOW (06-24).
    const r = evaluateEligibility(
      [rule({ rule_type: 'waiting_period', config: { days: 30, type: 'effective' } })],
      baseInput,
      NOW,
    );
    expect(r.isEligible).toBe(false);
    const f = r.blocking[0];
    expect(f.rule_type).toBe('waiting_period');
    expect(f.detail?.eligibleOn).toBe('2026-07-31');
    expect(f.detail?.anchor).toBe('effective');
  });

  it('enrollment anchor: counts from `now`', () => {
    // enrollment anchor = NOW (2026-06-24) + 10 days = 2026-07-04 -> pending.
    const r = evaluateEligibility(
      [rule({ rule_type: 'waiting_period', config: { days: 10, type: 'enrollment' } })],
      baseInput,
      NOW,
    );
    expect(r.isEligible).toBe(false);
    expect(r.blocking[0].detail?.eligibleOn).toBe('2026-07-04');
  });

  it('not pending when the waiting period has already elapsed (zero days)', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'waiting_period', config: { days: 0, type: 'effective' } })],
      baseInput,
      NOW,
    );
    expect(r.isEligible).toBe(true);
    expect(r.findings).toHaveLength(0);
  });
});

describe('evaluateEligibility — pre_existing (informational)', () => {
  it('always surfaces a finding describing the exclusion window', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'pre_existing', config: { lookback_months: 24, exclusion_months: 12 } })],
      baseInput,
      NOW,
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].message).toMatch(/24 months/);
    expect(r.findings[0].message).toMatch(/12-month/);
  });
});

describe('evaluateEligibility — custom (reuses shared operator vocabulary)', () => {
  it('key/value: fails when record[key] !== value', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'custom', config: { key: 'employment_status', value: 'employed' } })],
      { ...baseInput, record: { employment_status: 'retired' } },
      NOW,
    );
    expect(r.isEligible).toBe(false);
  });

  it('key/value: passes when record[key] === value', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'custom', config: { key: 'employment_status', value: 'employed' } })],
      { ...baseInput, record: { employment_status: 'employed' } },
      NOW,
    );
    expect(r.isEligible).toBe(true);
  });

  it('condition group: a matching (disqualifying) group fails', () => {
    const r = evaluateEligibility(
      [
        rule({
          rule_type: 'custom',
          config: {
            logic: 'AND',
            conditions: [{ field: 'risk_tier', operator: 'eq', value: 'high' }],
          },
        }),
      ],
      { ...baseInput, record: { risk_tier: 'high' } },
      NOW,
    );
    expect(r.isEligible).toBe(false);
  });
});

describe('evaluateEligibility — severity (block vs warn)', () => {
  it('a non-blocking failure is advisory and does NOT flip isEligible', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'household', config: { max_size: 1 }, is_blocking: false })],
      { ...baseInput, householdSize: 4 },
      NOW,
    );
    expect(r.isEligible).toBe(true);
    expect(r.advisory).toHaveLength(1);
    expect(r.advisory[0].severity).toBe('warn');
    expect(r.blocking).toHaveLength(0);
  });

  it('prefers the admin error_message over the generated default', () => {
    const r = evaluateEligibility(
      [
        rule({
          rule_type: 'age',
          config: { min_age: 65, max_age: 99 },
          error_message: 'Members must be 65 or older.',
        }),
      ],
      { ...baseInput, memberAge: 40 },
      NOW,
    );
    expect(r.blocking[0].message).toBe('Members must be 65 or older.');
  });
});

describe('evaluateEligibility — ordering & safety', () => {
  it('honors sort_order regardless of input order', () => {
    const r = evaluateEligibility(
      [
        rule({ id: 'b', rule_type: 'pre_existing', config: {}, sort_order: 2 }),
        rule({ id: 'a', rule_type: 'pre_existing', config: {}, sort_order: 1 }),
      ],
      baseInput,
      NOW,
    );
    expect(r.findings.map((f) => f.rule_id)).toEqual(['a', 'b']);
  });

  it('never throws on a malformed config (degrades gracefully)', () => {
    expect(() =>
      evaluateEligibility(
        [
          rule({ rule_type: 'age', config: null }),
          rule({ rule_type: 'state', config: { states: 'not-an-array' } as unknown as Record<string, unknown> }),
          rule({ rule_type: 'custom', config: { key: 123 } as unknown as Record<string, unknown> }),
        ],
        baseInput,
        NOW,
      ),
    ).not.toThrow();
  });

  it('unknown rule_type produces no finding (cannot evaluate -> no block)', () => {
    const r = evaluateEligibility(
      [rule({ rule_type: 'unsupported_future_type', config: {} })],
      baseInput,
      NOW,
    );
    expect(r.isEligible).toBe(true);
    expect(r.findings).toHaveLength(0);
  });
});
