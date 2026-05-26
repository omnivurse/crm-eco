#!/usr/bin/env node
/**
 * Compares the latest `.audit/reports/findings.json` against the locked-in
 * `.audit/baseline.json` snapshot. Used by CI + pre-push hooks to fail only
 * on NEW issues, while letting the team chip away at the backlog over time.
 *
 * A finding is identified by the tuple (severity, category, title). Detail
 * strings are excluded because they often embed counts that legitimately
 * fluctuate (e.g. "344 migration file(s)" vs "345 migration file(s)").
 *
 * Exit code:
 *   0  → no new findings at the configured fail-threshold or above
 *   1  → at least one new finding meeting the fail-threshold
 *
 * Env vars:
 *   AUDIT_FAIL_AT      = severity threshold (default "HIGH"; one of
 *                        BLOCKER | HIGH | MEDIUM | LOW | INFO)
 *   AUDIT_BASELINE     = baseline file path (default `.audit/baseline.json`)
 *   AUDIT_FINDINGS     = findings file path (default `.audit/reports/findings.json`)
 *   AUDIT_UPDATE_BASE  = if "1", rewrites the baseline with the current
 *                        findings and exits 0. Use for intentional snapshots.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SEVERITY_RANK = {
  BLOCKER: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

const FAIL_AT = (process.env.AUDIT_FAIL_AT || 'HIGH').toUpperCase();
const BASELINE_PATH = resolve(process.env.AUDIT_BASELINE || '.audit/baseline.json');
const FINDINGS_PATH = resolve(
  process.env.AUDIT_FINDINGS || '.audit/reports/findings.json',
);

if (!(FAIL_AT in SEVERITY_RANK)) {
  console.error(
    `[audit] ❌ AUDIT_FAIL_AT must be one of ${Object.keys(SEVERITY_RANK).join(', ')} (got ${FAIL_AT})`,
  );
  process.exit(2);
}
const FAIL_THRESHOLD = SEVERITY_RANK[FAIL_AT];

if (!existsSync(FINDINGS_PATH)) {
  console.error(
    `[audit] ❌ no findings file at ${FINDINGS_PATH} — run \`node .audit/scripts/crossref.mjs\` first.`,
  );
  process.exit(2);
}

const findings = JSON.parse(readFileSync(FINDINGS_PATH, 'utf8')).findings ?? [];

/** Stable identity for diffing across runs. */
function keyFor(f) {
  return `${f.severity}|${f.category}|${f.title}`;
}

/* Refresh-the-baseline mode. */
if (process.env.AUDIT_UPDATE_BASE === '1') {
  const snapshot = {
    schema_version: 1,
    frozen_at: new Date().toISOString(),
    fail_threshold: FAIL_AT,
    findings: findings.map((f) => ({
      key: keyFor(f),
      severity: f.severity,
      category: f.category,
      title: f.title,
    })),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(
    `[audit] ✅ baseline updated → ${BASELINE_PATH} (${snapshot.findings.length} findings).`,
  );
  process.exit(0);
}

/* Normal compare-mode. */
if (!existsSync(BASELINE_PATH)) {
  console.error(
    `[audit] ❌ no baseline at ${BASELINE_PATH}. Create one with:\n` +
      `        AUDIT_UPDATE_BASE=1 node .audit/scripts/check-baseline.mjs`,
  );
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const baselineKeys = new Set(baseline.findings.map((f) => f.key));

const newFindings = findings.filter((f) => !baselineKeys.has(keyFor(f)));
const blocking = newFindings.filter(
  (f) => SEVERITY_RANK[f.severity] >= FAIL_THRESHOLD,
);

const resolvedKeys = [...baselineKeys].filter(
  (k) => !findings.some((f) => keyFor(f) === k),
);

console.log(`[audit] baseline: ${BASELINE_PATH}`);
console.log(`[audit] frozen at: ${baseline.frozen_at}`);
console.log(`[audit] fail threshold: ${FAIL_AT} (rank ${FAIL_THRESHOLD})`);
console.log(`[audit] findings now: ${findings.length}`);
console.log(`[audit] new findings: ${newFindings.length} (blocking: ${blocking.length})`);
console.log(`[audit] resolved findings: ${resolvedKeys.length}`);

if (newFindings.length > 0) {
  console.log('\n[audit] new findings detail:');
  for (const f of newFindings) {
    const marker = SEVERITY_RANK[f.severity] >= FAIL_THRESHOLD ? '❌' : '⚠️ ';
    console.log(`  ${marker} [${f.severity}] ${f.category} — ${f.title}`);
  }
}
if (resolvedKeys.length > 0) {
  console.log('\n[audit] resolved findings (consider refreshing the baseline):');
  for (const k of resolvedKeys) console.log(`  ✅ ${k}`);
}

if (blocking.length > 0) {
  console.log(
    `\n[audit] ❌ ${blocking.length} NEW finding(s) at or above ${FAIL_AT} — failing.`,
  );
  console.log(
    '       If these are intentional, refresh the baseline with:\n' +
      '         AUDIT_UPDATE_BASE=1 node .audit/scripts/check-baseline.mjs',
  );
  process.exit(1);
}

console.log('\n[audit] ✅ no new findings at fail threshold.');
process.exit(0);
