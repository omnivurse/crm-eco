import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { Hourglass, Eye, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';
// Import from the `/types` subpath (NOT the package barrel): the barrel
// (@crm-eco/enrollment) re-exports SelfServeEnrollmentWizard + the step client
// components, which would drag that entire client component graph into this
// server component. The `/types` entry is type-only + the ENROLLMENT_STEPS
// const, so it stays server-safe.
import { ENROLLMENT_STEPS } from '@crm-eco/enrollment/types';

// E2 — ABANDONED ENROLLMENTS (READ-ONLY).
// Surfaces not-yet-submitted (draft / in_progress) enrollments whose last
// activity is older than `staleDays` days, so an advisor can re-engage the
// applicant. No mutation, no cron, no status churn — pure observability over
// the live enrollment ledger. The matching partial index is shipped in
// supabase/drafts/202606240007_enrollments_abandoned_index.sql.

// Canonical step order from the enrollment package (the wizard's source of
// truth). Used to derive "stalled before" — the step the applicant would have
// done next had they kept going.
// Keyed by plain string: lookups use enrollment_steps.step_key (a DB string),
// not the StepKey union, so a string-keyed map/array avoids unsafe casts.
const STEP_KEYS: string[] = ENROLLMENT_STEPS.map((s) => s.key);
const STEP_TITLE = new Map<string, string>(ENROLLMENT_STEPS.map((s) => [s.key, s.title]));
const TOTAL_STEPS = STEP_KEYS.length;

const DEFAULT_STALE_DAYS = 14;
const STALE_DAY_PRESETS = [7, 14, 30];

interface MemberEmbed {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface PlanEmbed {
  id: string;
  name: string | null;
  code: string | null;
}

interface EnrollmentRow {
  id: string;
  enrollment_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  primary_member_id: string | null;
  selected_plan_id: string | null;
  primary_member: MemberEmbed | null;
  plan: PlanEmbed | null;
}

interface StepRow {
  enrollment_id: string;
  step_key: string;
  is_completed: boolean | null;
  completed_at: string | null;
  updated_at: string | null;
}

interface AbandonedRow extends EnrollmentRow {
  last_activity: number; // epoch ms
  last_completed_step: string | null;
  stalled_before: string | null;
  completed_count: number;
}

function parseStaleDays(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = v ? Number.parseInt(v, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_STALE_DAYS;
  // Clamp to a sane ceiling so a bogus query param can't degenerate the scan.
  return Math.min(n, 365);
}

function toMs(ts: string | null | undefined): number {
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}

// Lightweight relative-time formatter (no extra dep — date-fns formatDistance
// would also work but this keeps the import surface aligned with page.tsx).
function relativeTime(epochMs: number): string {
  if (!epochMs) return '—';
  const diff = Date.now() - epochMs;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'in_progress':
      return 'In Progress';
    default:
      return status;
  }
}

async function getAbandoned(staleDays: number): Promise<AbandonedRow[]> {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return [];

  // (1) Candidate enrollments: not-yet-submitted drafts / in-progress.
  //     RLS (SSR cookie client) scopes to memberships; the explicit
  //     organization_id filter pins to the active tenant. Plan embed is
  //     PLAN-KEYED via selected_plan_id (enrollments_selected_plan_id_fkey) —
  //     NOT product_id / quoted_plan_id (both also FK plans, so the embed MUST
  //     name the FK to disambiguate). Oldest-touched first.
  const enrollmentsResult = await Promise.allSettled([
    (supabase
      .from('enrollments')
      .select(`
        id,
        enrollment_number,
        status,
        created_at,
        updated_at,
        primary_member_id,
        selected_plan_id,
        primary_member:members!enrollments_primary_member_id_fkey(
          id, first_name, last_name, email
        ),
        plan:plans!enrollments_selected_plan_id_fkey(id, name, code)
      `)
      .eq('organization_id', tenant.organizationId)
      .in('status', ['draft', 'in_progress'])
      .is('submitted_at', null)
      .order('updated_at', { ascending: true })
      .limit(300) as any),
  ]);

  const enrollments: EnrollmentRow[] =
    enrollmentsResult[0].status === 'fulfilled'
      ? ((enrollmentsResult[0].value.data as EnrollmentRow[] | null) ?? [])
      : [];

  if (enrollments.length === 0) return [];

  const ids = enrollments.map((e) => e.id);

  // (2) Per-step ledger for the candidates. Degrades to empty if the table /
  //     rows are absent (E depends on D drafts not yet on prod) — the surface
  //     must not crash, it just shows no per-step progress.
  const stepsResult = await Promise.allSettled([
    (supabase
      .from('enrollment_steps')
      .select('enrollment_id,step_key,is_completed,completed_at,updated_at')
      .in('enrollment_id', ids) as any),
  ]);

  const steps: StepRow[] =
    stepsResult[0].status === 'fulfilled'
      ? ((stepsResult[0].value.data as StepRow[] | null) ?? [])
      : [];

  // Group steps by enrollment.
  const stepsByEnrollment = new Map<string, StepRow[]>();
  for (const s of steps) {
    const arr = stepsByEnrollment.get(s.enrollment_id);
    if (arr) arr.push(s);
    else stepsByEnrollment.set(s.enrollment_id, [s]);
  }

  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;

  const rows: AbandonedRow[] = [];
  for (const e of enrollments) {
    const eSteps = stepsByEnrollment.get(e.id) ?? [];

    // last_activity = max(enrollment.updated_at, max(step.updated_at)).
    let lastActivity = toMs(e.updated_at);
    for (const s of eSteps) {
      const su = toMs(s.updated_at);
      if (su > lastActivity) lastActivity = su;
    }

    // KEEP only rows whose last activity predates the staleness cutoff.
    if (lastActivity >= cutoff) continue;

    // last_completed_step = the is_completed step with the latest completed_at.
    let lastCompletedStep: string | null = null;
    let lastCompletedAt = -1;
    let completedCount = 0;
    for (const s of eSteps) {
      if (!s.is_completed) continue;
      completedCount += 1;
      const ca = toMs(s.completed_at);
      if (ca > lastCompletedAt) {
        lastCompletedAt = ca;
        lastCompletedStep = s.step_key;
      }
    }

    // stalled_before = successor of last_completed_step in ENROLLMENT_STEPS.
    // No completed steps => stalled at the first step (intake). If the last
    // completed step is the final step, there is no successor (null).
    let stalledBefore: string | null;
    if (!lastCompletedStep) {
      stalledBefore = STEP_KEYS[0] ?? null;
    } else {
      const idx = STEP_KEYS.indexOf(lastCompletedStep);
      stalledBefore = idx >= 0 && idx + 1 < STEP_KEYS.length ? STEP_KEYS[idx + 1] : null;
    }

    rows.push({
      ...e,
      last_activity: lastActivity,
      last_completed_step: lastCompletedStep,
      stalled_before: stalledBefore,
      completed_count: completedCount,
    });
  }

  // Most-stale-first (oldest last_activity at the top).
  rows.sort((a, b) => a.last_activity - b.last_activity);

  return rows;
}

export default async function AbandonedEnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ staleDays?: string | string[] }>;
}) {
  const params = await searchParams;
  const staleDays = parseStaleDays(params.staleDays);
  const rows = await getAbandoned(staleDays);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abandoned Enrollments"
        description={`Not-yet-submitted applications with no activity in ${staleDays}+ days`}
        icon={<Hourglass className="w-6 h-6" />}
        gradient="from-amber-600 to-amber-400"
      />

      {/* Stale-window quick links + back to all enrollments */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Inactive for at least:</span>
          {STALE_DAY_PRESETS.map((d) => {
            const active = d === staleDays;
            return (
              <Link key={d} href={`/enrollments/abandoned?staleDays=${d}`} prefetch={false}>
                <Button variant={active ? 'default' : 'outline'} size="sm">
                  {d} days
                </Button>
              </Link>
            );
          })}
        </div>
        <Link href="/enrollments" prefetch={false}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            All Enrollments
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stalled Applications</CardTitle>
          <CardDescription>
            {rows.length} abandoned enrollment{rows.length === 1 ? '' : 's'} found
            {' · '}most stale first
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center py-12">
              <Hourglass className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">
                No abandoned enrollments in the last {staleDays} days. Nice.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-slate-500 text-sm">Member</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Last Activity</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Stalled At</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Progress</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Created</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const memberName = row.primary_member
                      ? `${row.primary_member.first_name ?? ''} ${row.primary_member.last_name ?? ''}`.trim()
                      : '';
                    const stalledLabel = row.stalled_before
                      ? (STEP_TITLE.get(row.stalled_before) ?? row.stalled_before)
                      : 'Ready to submit';
                    return (
                      <tr key={row.id} className="border-b hover:bg-slate-50">
                        <td className="py-3">
                          {row.primary_member ? (
                            <div>
                              <p className="text-sm font-medium">
                                {memberName || (
                                  <span className="text-slate-400">Unnamed applicant</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                {row.primary_member.email || (
                                  <span className="font-mono">
                                    {row.enrollment_number || row.id.slice(0, 8)}
                                  </span>
                                )}
                              </p>
                            </div>
                          ) : (
                            <span className="font-mono text-sm text-slate-500">
                              {row.enrollment_number || row.id.slice(0, 8)}
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <Badge variant="secondary">{getStatusLabel(row.status)}</Badge>
                        </td>
                        <td className="py-3 text-sm text-slate-500">
                          <span title={format(new Date(row.last_activity), 'MMM d, yyyy p')}>
                            {relativeTime(row.last_activity)}
                          </span>
                        </td>
                        <td className="py-3 text-sm">
                          {row.stalled_before ? (
                            <Badge variant="outline">{stalledLabel}</Badge>
                          ) : (
                            <span className="text-emerald-600 text-sm font-medium">
                              {stalledLabel}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-sm text-slate-600">
                          {row.completed_count}/{TOTAL_STEPS} steps
                        </td>
                        <td className="py-3 text-sm text-slate-500">
                          {format(new Date(row.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3">
                          <Link href={`/enrollments/${row.id}`} prefetch={false}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
