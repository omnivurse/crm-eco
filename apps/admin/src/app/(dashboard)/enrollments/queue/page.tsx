import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { Inbox, Eye, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';

/**
 * Admin REVIEW QUEUE (SLICE E1)
 * ----------------------------------------------------------------
 * A FIFO triage surface for enrollments awaiting a reviewer decision:
 * status IN (submitted, pending_review, more_info). Mirrors the read idioms
 * of the enrollments list (page.tsx) and detail (`[id]/page.tsx`):
 *   - getActiveTenant() resolves the org; the SSR cookie client is the RLS
 *     gatekeeper (NEVER service-role on an admin surface).
 *   - The main query embeds member / plan / advisor / assigned reviewer using
 *     the EXACT FK constraint names confirmed against the replica. plans is
 *     joined via enrollments_selected_plan_id_fkey (catalog is PLAN-KEYED;
 *     enrollments also FKs plans via quoted_plan_id, so the constraint name
 *     MUST be explicit to avoid an ambiguous-embed error).
 *   - The OPEN parallel-binding approval per listed enrollment is fetched in a
 *     SEPARATE, degrade-to-empty query and merged via a Map — NOT embedded in
 *     the main query. This avoids row fan-out AND keeps the page from being
 *     coupled to a table that may not yet be on prod (the D drafts are not yet
 *     applied there). enrollment_approvals is also not in the generated Database
 *     type, so it uses the established `(supabase as any)` cast convention.
 *
 * SAFETY: this surface is strictly READ-ONLY. No status writes, no
 * base_monthly_cost, no approval mutations happen here — decisions are made on
 * the detail page via the existing server actions.
 */

const QUEUE_STATUSES = ['submitted', 'pending_review', 'more_info'] as const;

type QueueEnrollment = {
  id: string;
  enrollment_number: string | null;
  status: string;
  priority: string | null;
  sla_due_at: string | null;
  created_at: string;
  primary_member: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  plan: { id: string; name: string | null; code: string | null } | null;
  advisor: { id: string; first_name: string | null; last_name: string | null } | null;
  reviewer: { id: string; full_name: string | null } | null;
};

type OpenApproval = {
  enrollment_id: string;
  status: string;
  rule_id: string | null;
  rule_name: string | null;
};

async function getQueue(): Promise<QueueEnrollment[]> {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return [];

  // FK constraint names verified against the replica:
  //   primary_member -> enrollments_primary_member_id_fkey  (members)
  //   plan           -> enrollments_selected_plan_id_fkey   (plans; PLAN-KEYED)
  //   advisor        -> enrollments_advisor_id_fkey         (advisors)
  //   reviewer       -> enrollments_assigned_reviewer_id_fkey (profiles)
  //
  // SORT: sla_due_at ascending (overdue/soonest first, NULLs last) then
  // created_at ascending (FIFO). priority is rendered as a badge but is NOT a
  // sort key — its vocabulary is undefined on the replica (no CHECK, no rows),
  // so priority-based ordering is DEFERRED until the vocab is defined.
  const { data } = await (supabase
    .from('enrollments')
    .select(`
      id,
      enrollment_number,
      status,
      priority,
      sla_due_at,
      created_at,
      primary_member:members!enrollments_primary_member_id_fkey(
        id, first_name, last_name, email
      ),
      plan:plans!enrollments_selected_plan_id_fkey(id, name, code),
      advisor:advisors!enrollments_advisor_id_fkey(id, first_name, last_name),
      reviewer:profiles!enrollments_assigned_reviewer_id_fkey(id, full_name)
    `)
    .eq('organization_id', tenant.organizationId)
    .in('status', QUEUE_STATUSES as unknown as string[])
    .order('sla_due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(200) as any);

  return (data ?? []) as QueueEnrollment[];
}

/**
 * Map of enrollment_id -> its single OPEN (status='pending') approval row.
 *
 * Degrade-to-empty: the parallel-binding enrollment_approvals table (and its
 * matched crm_approval_rules) may not yet be provisioned on prod, so a thrown
 * PostgREST error must NOT crash the queue. There is NO FK from
 * enrollment_approvals to crm_approval_rules (confirmed on the replica), so the
 * rule name CANNOT be embedded — it is resolved by a second keyed lookup
 * against crm_approval_rules, falling back to context.rule_name (the convention
 * the detail page uses).
 */
async function getOpenApprovals(enrollmentIds: string[]): Promise<Map<string, OpenApproval>> {
  const result = new Map<string, OpenApproval>();
  if (enrollmentIds.length === 0) return result;

  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return result;

  let rows: Array<{
    enrollment_id: string;
    status: string;
    rule_id: string | null;
    context: { rule_name?: string } | null;
  }> = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- draft-only
    // table (enrollment_approvals) is not in the generated Database type; matches
    // the codebase cast convention (see enrollments/actions.ts + portal submit route).
    const { data } = await (supabase as any)
      .from('enrollment_approvals')
      .select('enrollment_id, status, rule_id, context')
      .eq('organization_id', tenant.organizationId)
      .in('enrollment_id', enrollmentIds)
      .eq('status', 'pending');
    rows = (data ?? []) as typeof rows;
  } catch {
    // approvals table absent / locked — render the queue without rule badges.
    return result;
  }

  // Resolve rule names via a second degrade-to-empty lookup (no FK to embed).
  const ruleNames = new Map<string, string>();
  const ruleIds = Array.from(
    new Set(rows.map((r) => r.rule_id).filter((v): v is string => Boolean(v))),
  );
  if (ruleIds.length > 0) {
    try {
      const { data: ruleData } = await (supabase
        .from('crm_approval_rules')
        .select('id, name')
        .in('id', ruleIds) as any);
      for (const rule of (ruleData ?? []) as Array<{ id: string; name: string | null }>) {
        if (rule.name) ruleNames.set(rule.id, rule.name);
      }
    } catch {
      // rules table absent — fall back to context.rule_name below.
    }
  }

  for (const row of rows) {
    // Keep the first open row per enrollment (idx_enrollment_approvals_open
    // enforces at most one pending row per enrollment anyway).
    if (result.has(row.enrollment_id)) continue;
    result.set(row.enrollment_id, {
      enrollment_id: row.enrollment_id,
      status: row.status,
      rule_id: row.rule_id,
      rule_name:
        (row.rule_id ? ruleNames.get(row.rule_id) : null) ??
        row.context?.rule_name ??
        null,
    });
  }

  return result;
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'submitted':
    case 'pending_review':
      return 'secondary';
    case 'more_info':
      return 'outline';
    default:
      return 'outline';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'submitted':
      return 'Submitted';
    case 'pending_review':
      return 'Pending Review';
    case 'more_info':
      return 'More Info Needed';
    default:
      return status.replace(/_/g, ' ');
  }
}

function getPriorityBadgeVariant(priority: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  // Undefined vocab on the replica — best-effort visual cue only. Anything that
  // reads as "high/urgent" surfaces as destructive; everything else neutral.
  const p = priority.toLowerCase();
  if (p.includes('urgent') || p.includes('high') || p.includes('critical')) return 'destructive';
  if (p.includes('low')) return 'outline';
  return 'secondary';
}

export default async function EnrollmentQueuePage() {
  const queue = await getQueue();
  const approvals = await getOpenApprovals(queue.map((e) => e.id));
  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        description="Enrollments awaiting a reviewer decision"
        icon={<Inbox className="w-6 h-6" />}
        gradient="from-amber-600 to-amber-400"
        actions={
          <Link href="/enrollments" prefetch={false}>
            <Button variant="outline" size="sm">
              All Enrollments
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Pending Review</CardTitle>
          <CardDescription>
            {queue.length} enrollment{queue.length === 1 ? '' : 's'} in the queue
            {' '}(submitted, pending review, or more info needed)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">The review queue is empty</p>
              <p className="text-sm text-slate-400 mt-1">
                Submitted enrollments awaiting a decision will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-slate-500 text-sm">Member</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Plan</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">SLA Due</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Priority</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Reviewer</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Matched Rule</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Submitted</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((enrollment) => {
                    const approval = approvals.get(enrollment.id);
                    const slaDue = enrollment.sla_due_at ? new Date(enrollment.sla_due_at) : null;
                    const overdue = slaDue ? slaDue.getTime() < now : false;

                    return (
                      <tr key={enrollment.id} className="border-b hover:bg-slate-50">
                        <td className="py-3">
                          {enrollment.primary_member ? (
                            <div>
                              <p className="text-sm font-medium">
                                {enrollment.primary_member.first_name}{' '}
                                {enrollment.primary_member.last_name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {enrollment.primary_member.email}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 text-sm">
                          {enrollment.plan?.name || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-3">
                          <Badge variant={getStatusBadgeVariant(enrollment.status)}>
                            {getStatusLabel(enrollment.status)}
                          </Badge>
                        </td>
                        <td className="py-3 text-sm">
                          {slaDue ? (
                            <span
                              className={
                                overdue
                                  ? 'inline-flex items-center gap-1 font-medium text-red-600'
                                  : 'text-slate-600'
                              }
                            >
                              {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                              {format(slaDue, 'MMM d, yyyy h:mm a')}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          {enrollment.priority ? (
                            <Badge
                              variant={getPriorityBadgeVariant(enrollment.priority)}
                              className="capitalize"
                            >
                              {enrollment.priority.replace(/_/g, ' ')}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 text-sm">
                          {enrollment.reviewer?.full_name || (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 text-sm">
                          {approval?.rule_name ? (
                            <span className="text-slate-600">{approval.rule_name}</span>
                          ) : approval ? (
                            <span className="text-slate-400">Pending approval</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 text-sm text-slate-500">
                          {format(new Date(enrollment.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3">
                          <Link href={`/enrollments/${enrollment.id}`} prefetch={false}>
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
