/**
 * Complements ratchet.test.ts (which proves monotonicity, saturation, and the
 * half-penalty point): these tests pin the published constants and the score's
 * outer behaviour so the formula cannot drift without failing loudly.
 */
import { describe, expect, it } from 'vitest';
import {
  FORMULA_VERSION,
  HALF_PENALTY_COUNT,
  RULE_CATALOG,
  TIER_BUDGET,
  computeScore,
} from './score';

describe('data-health score contract', () => {
  it('constants are the published contract — the ratchet baseline depends on them', () => {
    // Changing any of these redefines the client-facing number: bump
    // FORMULA_VERSION and refresh the ratchet baseline on purpose, never drive-by.
    // v2 = the 2026-08-23 field-correctness pass. Rule MEANINGS changed (six
    // rules were reading the wrong column), so a v1 count and a v2 count are
    // not comparable and must never be charted as one series.
    expect(FORMULA_VERSION).toBe(2);
    expect(TIER_BUDGET).toEqual({ error: 60, warn: 30, info: 10 });
    expect(HALF_PENALTY_COUNT).toBe(25);
    // The three tier budgets are the whole 100-point scale.
    expect(TIER_BUDGET.error + TIER_BUDGET.warn + TIER_BUDGET.info).toBe(100);
  });

  it('a clean book scores exactly 100', () => {
    expect(computeScore({})).toBe(100);
    expect(computeScore(Object.fromEntries(RULE_CATALOG.map((r) => [r.key, 0])))).toBe(100);
  });

  it('an error rule costs more than a warn rule at the same count', () => {
    const errorRule = RULE_CATALOG.find((r) => r.severity === 'error');
    const warnRule = RULE_CATALOG.find((r) => r.severity === 'warn');
    if (!errorRule || !warnRule) throw new Error('catalog must have error and warn rules');
    const errorScore = computeScore({ [errorRule.key]: HALF_PENALTY_COUNT });
    const warnScore = computeScore({ [warnRule.key]: HALF_PENALTY_COUNT });
    expect(errorScore).toBeLessThan(warnScore);
  });

  it('is bounded [0, 100] and rounded to one decimal even fully flooded', () => {
    const flooded = computeScore(
      Object.fromEntries(RULE_CATALOG.map((r) => [r.key, 10_000_000])),
    );
    expect(flooded).toBeGreaterThanOrEqual(0);
    expect(flooded).toBeLessThan(100);
    expect(flooded).toBe(Math.round(flooded * 10) / 10);
    // Saturation means the total penalty approaches (but never exceeds) 100.
    expect(flooded).toBeLessThan(1);
  });

  it('every fixed record is a visible win (strictly monotonic in each count)', () => {
    const rule = RULE_CATALOG.find((r) => r.severity === 'error');
    if (!rule) throw new Error('catalog must have an error rule');
    const at10 = computeScore({ [rule.key]: 10 });
    const at9 = computeScore({ [rule.key]: 9 });
    expect(at9).toBeGreaterThan(at10);
  });

  it('is deterministic: same counts in, same score out', () => {
    const counts = { 'refs.orphan-notes': 3, 'dupes.open-pairs': 78, 'completeness.member-core': 995 };
    expect(computeScore(counts)).toBe(computeScore({ ...counts }));
  });
});
