import { NextResponse } from 'next/server';
import { getAuthProfile } from '@/lib/supabase-server';
import { FORMULA_VERSION, RULE_CATALOG, runRules } from '@/lib/crm/data-health';
import type { DataHealthReport } from '@/lib/crm/data-health';
import { resolveSweepDbUrl, withSweepExecutor } from './executor';
import { recordedSweepForOrg } from './recorded';

/**
 * GET /api/crm/data-health
 *
 * Runs the deterministic Data Health catalog over the caller's org and returns
 * the scored report that drives /crm/data-health. Nothing is written and
 * nothing is persisted: v1 computes live and keeps no server-side history.
 *
 * Contract
 *   200 { score, formulaVersion, asOf, generatedAt, bookSize, source,
 *         rules: [{ key, label, severity, describe, count, sampleIds, context? }],
 *         errors: [{ key, label, message }] }
 *   401 not signed in · 403 not crm_admin/crm_manager
 *   500 no sweep available at all (fails closed — never an empty "all clean")
 *
 * Guarantees
 *   - ROLE GATE: crm_admin | crm_manager only, checked here, exactly like
 *     /api/crm/duplicates and the page's own redirect.
 *   - ORG PIN: every rule's SQL is built from `profile.organization_id`
 *     (validated as a literal UUID inside `rules.ts`), never from a query
 *     param. A recorded fallback is only served to the org it was recorded for.
 *   - PII: rule keys, labels, counts and record IDS only. No names, phones,
 *     emails or dates of birth cross this boundary; the page resolves ids to
 *     titles through the normal RLS-gated record APIs when an admin clicks.
 *   - PARTIAL RESULTS ARE HONEST: a rule that throws lands in `errors` and the
 *     sweep continues (`runRules`), because a blanket 500 would hide sixteen
 *     working checks behind one broken one — and the page says out loud that a
 *     score which skipped checks may read better than reality.
 *   - CACHE: `private, max-age=60`. A refresh-happy admin re-reading the page
 *     is served by their own browser; the explicit Refresh button bypasses it.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Browser-side cache window for one admin's own repeated reads. */
// NOT exported: a Next.js route module may only export its handlers and a
// fixed set of config fields (runtime, dynamic, revalidate, …). Exporting
// anything else — even a plain constant — fails the production build with
// "is not a valid Route export field", which `tsc --noEmit` does not catch.
const CACHE_SECONDS = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The human name of a rule, for the "could not run" list. A failed rule has no
 * sweep result to carry its label, and `dupes.open-pairs` is a developer
 * identifier — the person reading this page needs "Possible duplicate pairs
 * awaiting review". The key rides along only as a support handle.
 */
const LABEL_BY_KEY = new Map(RULE_CATALOG.map((rule) => [rule.key, rule.label]));

/** Error text is admin-only and useful, but never an unbounded SQL dump. */
function briefly(message: string): string {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  return oneLine.length > 200 ? `${oneLine.slice(0, 199)}…` : oneLine;
}

function payloadFrom(
  report: Pick<DataHealthReport, 'score' | 'formulaVersion' | 'generatedAt' | 'bookSize' | 'rules'> & {
    errors?: DataHealthReport['errors'];
  },
  source: 'live' | 'recorded',
  asOf: string,
) {
  return {
    score: report.score,
    formulaVersion: report.formulaVersion,
    asOf,
    generatedAt: report.generatedAt,
    bookSize: report.bookSize,
    source,
    rules: report.rules.map((rule) => ({
      key: rule.key,
      label: rule.label,
      severity: rule.severity,
      describe: rule.describe,
      count: rule.count,
      sampleIds: rule.sampleIds,
      ...(rule.context ? { context: rule.context } : {}),
    })),
    errors: (report.errors ?? []).map((error) => ({
      key: error.key,
      label: LABEL_BY_KEY.get(error.key) ?? error.key,
      message: briefly(error.message),
    })),
  };
}

function cached(body: unknown) {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': `private, max-age=${CACHE_SECONDS}` },
  });
}

export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json(
        { error: 'Only CRM admins and managers can see the data health report' },
        { status: 403 },
      );
    }

    const orgId = typeof profile.organization_id === 'string' ? profile.organization_id : '';
    if (!UUID_RE.test(orgId)) {
      console.error('[data-health] caller profile has no usable organization_id');
      return NextResponse.json(
        { error: 'Your profile is not attached to an organization' },
        { status: 500 },
      );
    }

    // --- live sweep -------------------------------------------------------
    const dbUrl = resolveSweepDbUrl();
    if (dbUrl) {
      const startedAt = Date.now();
      const report = await withSweepExecutor(dbUrl, (executor) =>
        runRules(executor, { orgId }),
      );
      console.log(
        `[data-health] live sweep org=${orgId} score=${report.score} book=${report.bookSize} ` +
          `errors=${report.errors.length} ms=${Date.now() - startedAt}`,
      );
      return cached(payloadFrom(report, 'live', report.generatedAt.slice(0, 10)));
    }

    // --- last recorded sweep ----------------------------------------------
    // No sweep connection on this deployment. The committed audit report is a
    // real read-only pass over THIS org's book, scored by the same formula —
    // serve it labelled with its date rather than pretend the page is broken.
    const recorded = recordedSweepForOrg(orgId);
    if (recorded) {
      return cached(payloadFrom({ ...recorded, errors: [] }, 'recorded', recorded.asOf));
    }

    // --- fail closed -------------------------------------------------------
    console.error(
      '[data-health] no sweep connection (SUPABASE_DB_URL) and no recorded sweep for this org',
    );
    return NextResponse.json(
      {
        error:
          'Data health cannot run here — the read-only sweep connection is not configured',
        formulaVersion: FORMULA_VERSION,
      },
      { status: 500 },
    );
  } catch (err) {
    console.error('[data-health] unexpected error:', err);
    return NextResponse.json(
      {
        error: 'Failed to run the data health sweep',
        detail: briefly(err instanceof Error ? err.message : String(err)),
      },
      { status: 500 },
    );
  }
}
