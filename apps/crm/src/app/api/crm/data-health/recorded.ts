/**
 * The last RECORDED sweep — the honest fallback when no live sweep connection
 * is configured for this deployment.
 *
 * `scripts/audit-crm-data-health.mjs` writes `report.latest.json` from a real
 * read-only pass over the book; it is committed, ratcheted, and produced by the
 * same catalog and the same `computeScore` as the live path. When the route
 * cannot open a sweep connection it serves THAT, tagged `source: 'recorded'`
 * with the sweep's own `asOf` date, so the page can say plainly which it is
 * showing. It is never presented as live, and it is only ever served to the org
 * it was recorded for — another tenant gets nothing.
 *
 * PII: the file carries rule keys, counts and record ids only, exactly like the
 * live payload.
 */

import recordedReport from '@/lib/crm/data-health/report.latest.json';
import { DATA_HEALTH_RULES } from '@/lib/crm/data-health';
import type { RuleSeverity, RuleSweepResult } from '@/lib/crm/data-health';

interface RecordedRule {
  key: string;
  label: string;
  severity: string;
  count: number;
  sampleIds?: string[];
}

const SEVERITIES: readonly string[] = ['error', 'warn', 'info'];

/** `describe` lives on the executable catalog, not in the recorded file. */
const DESCRIBE_BY_KEY = new Map(DATA_HEALTH_RULES.map((rule) => [rule.key, rule.describe]));

export interface RecordedSweep {
  formulaVersion: number;
  generatedAt: string;
  asOf: string;
  orgId: string;
  bookSize: number;
  score: number;
  rules: RuleSweepResult[];
}

/**
 * The recorded sweep for `orgId`, or `null` when the committed report belongs
 * to a different org (tenant isolation: never show one tenant another's book).
 */
export function recordedSweepForOrg(orgId: string): RecordedSweep | null {
  const report = recordedReport as unknown as {
    formulaVersion?: number;
    generatedAt?: string;
    asOf?: string;
    org?: string;
    score?: number;
    context?: { liveRecords?: number };
    rules?: RecordedRule[];
  };

  if (!report.org || report.org.toLowerCase() !== orgId.toLowerCase()) return null;
  if (typeof report.score !== 'number' || !Array.isArray(report.rules)) return null;

  return {
    formulaVersion: report.formulaVersion ?? 0,
    generatedAt: report.generatedAt ?? `${report.asOf ?? ''}T00:00:00.000Z`,
    asOf: report.asOf ?? (report.generatedAt ?? '').slice(0, 10),
    orgId: report.org,
    bookSize: report.context?.liveRecords ?? 0,
    score: report.score,
    rules: report.rules.map((rule) => ({
      key: rule.key,
      label: rule.label,
      severity: (SEVERITIES.includes(rule.severity) ? rule.severity : 'info') as RuleSeverity,
      describe: DESCRIBE_BY_KEY.get(rule.key) ?? '',
      count: typeof rule.count === 'number' && rule.count > 0 ? rule.count : 0,
      sampleIds: Array.isArray(rule.sampleIds) ? rule.sampleIds.filter((id) => typeof id === 'string') : [],
    })),
  };
}
