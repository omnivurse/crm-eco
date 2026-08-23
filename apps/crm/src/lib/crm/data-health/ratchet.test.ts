/**
 * Data Health ratchet — the one-way score.
 *
 * Compares the latest committed sweep report (`report.latest.json`, written by
 * `node scripts/audit-crm-data-health.mjs`) against the approved baseline
 * (`ratchet.baseline.json`) and holds the line in BOTH directions, same
 * discipline as the toast ratchet (toast-raw-ratchet.test.ts):
 *
 *   - any error/warn rule count RISING above baseline fails — data quality
 *     cannot silently get worse;
 *   - any rule count DROPPING below baseline also fails until the baseline is
 *     refreshed — wins get locked in on purpose:
 *
 *       npm run data-health:ratchet:update
 *
 * Also guards the formula itself: the report's stored score must equal
 * `computeScore` over its counts, so the formula cannot drift without a
 * FORMULA_VERSION bump and a deliberate baseline refresh.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RULE_CATALOG,
  FORMULA_VERSION,
  HALF_PENALTY_COUNT,
  TIER_BUDGET,
  computeScore,
} from './score';

const REPORT_PATH = path.join(__dirname, 'report.latest.json');
const BASELINE_PATH = path.join(__dirname, 'ratchet.baseline.json');
const UPDATING = process.env.DATA_HEALTH_RATCHET_UPDATE === '1';

interface SweepReport {
  formulaVersion: number;
  asOf: string;
  score: number;
  rules: { key: string; severity: string; count: number; sampleIds: string[] }[];
}

interface Baseline {
  formulaVersion: number;
  asOf: string;
  score: number;
  counts: Record<string, number>;
}

const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;

function countsOf(report: SweepReport): Record<string, number> {
  return Object.fromEntries(report.rules.map((r) => [r.key, r.count]));
}

const severityOf = new Map(RULE_CATALOG.map((r) => [r.key, r.severity]));

describe('score formula (the ONE pure function)', () => {
  it('scores a clean book 100', () => {
    expect(computeScore({})).toBe(100);
    expect(computeScore(Object.fromEntries(RULE_CATALOG.map((r) => [r.key, 0])))).toBe(100);
  });

  it('goes down when any count goes up (monotonic)', () => {
    for (const rule of RULE_CATALOG) {
      const one = computeScore({ [rule.key]: 1 });
      const many = computeScore({ [rule.key]: 100 });
      expect(one).toBeLessThan(100);
      expect(many).toBeLessThan(one);
    }
  });

  it('saturates: a rule can never spend more than its tier share', () => {
    const errorRules = RULE_CATALOG.filter((r) => r.severity === 'error');
    const share = TIER_BUDGET.error / errorRules.length;
    const flooded = computeScore({ [errorRules[0].key]: 10_000_000 });
    expect(flooded).toBeGreaterThanOrEqual(Math.round((100 - share) * 10) / 10 - 0.1);
  });

  it('half the share is spent at exactly HALF_PENALTY_COUNT', () => {
    const rule = RULE_CATALOG.find((r) => r.severity === 'warn');
    if (!rule) throw new Error('catalog has no warn rule');
    const warnRules = RULE_CATALOG.filter((r) => r.severity === 'warn').length;
    const share = TIER_BUDGET.warn / warnRules;
    expect(computeScore({ [rule.key]: HALF_PENALTY_COUNT })).toBe(
      Math.round((100 - share / 2) * 10) / 10,
    );
  });

  it('ignores unknown keys and treats junk as zero', () => {
    expect(computeScore({ 'not.a.rule': 500 })).toBe(100);
    expect(computeScore({ 'vocabulary.status': Number.NaN })).toBe(100);
    expect(computeScore({ 'vocabulary.status': -3 })).toBe(100);
  });
});

describe('data health ratchet', () => {
  const report = readJson<SweepReport>(REPORT_PATH);
  const currentCounts = countsOf(report);

  it('report covers exactly the catalog, with a truthful score', () => {
    expect(report.rules.map((r) => r.key)).toEqual(RULE_CATALOG.map((r) => r.key));
    expect(report.formulaVersion).toBe(FORMULA_VERSION);
    expect(report.score).toBe(computeScore(currentCounts));
  });

  it('report is PII-free: ids and counts only', () => {
    const raw = fs.readFileSync(REPORT_PATH, 'utf8');
    expect(raw.includes('@'), 'report must not contain email addresses').toBe(false);
    // Strip UUIDs (hex can legitimately run 10+ digits), then look for
    // phone-length digit runs.
    const withoutUuids = raw.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
    expect(
      /\d{10}/.test(withoutUuids),
      'report must not contain 10-digit sequences (phone numbers)',
    ).toBe(false);
    for (const rule of report.rules) expect(rule.sampleIds.length).toBeLessThanOrEqual(20);
  });

  it('no error/warn rule got worse, and every win is locked into the baseline', () => {
    if (UPDATING) {
      const baseline: Baseline = {
        formulaVersion: FORMULA_VERSION,
        asOf: report.asOf,
        score: report.score,
        counts: currentCounts,
      };
      fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
      return;
    }
    const baseline = readJson<Baseline>(BASELINE_PATH);

    const worse = report.rules
      .filter((r) => (severityOf.get(r.key) ?? 'info') !== 'info')
      .filter((r) => r.count > (baseline.counts[r.key] ?? 0))
      .map((r) => `${r.key}: ${baseline.counts[r.key] ?? 0} → ${r.count}`);
    expect(
      worse,
      `Data quality got WORSE than the committed baseline. Fix the records (or, only with an explicit owner decision, run "npm run data-health:ratchet:update").\n${worse.join('\n')}`,
    ).toEqual([]);

    const wins = report.rules
      .filter((r) => r.count < (baseline.counts[r.key] ?? 0))
      .map((r) => `${r.key}: ${baseline.counts[r.key]} → ${r.count}`);
    expect(
      wins,
      `Counts went DOWN — lock the win in with "npm run data-health:ratchet:update" so it can never regress.\n${wins.join('\n')}`,
    ).toEqual([]);
  });

  it('baseline is internally consistent with the formula', () => {
    if (UPDATING) return;
    const baseline = readJson<Baseline>(BASELINE_PATH);
    expect(baseline.formulaVersion).toBe(FORMULA_VERSION);
    expect(baseline.score).toBe(computeScore(baseline.counts));
    expect(Object.keys(baseline.counts).sort()).toEqual(
      RULE_CATALOG.map((r) => r.key).sort(),
    );
  });
});
