/**
 * Billing coverage activation — pending memberships/members → active when
 * effective_date <= today. Separate seam from CRM crm_records activation
 * (see membership-lifecycle/README.md). Enrollments stay `approved`.
 *
 * Also runs the SUPERSEDE pass for scheduled plan changes: when a due pending
 * membership belongs to a member who still has an active membership, the old
 * membership is terminated (last covered day = new effective_date − 1) before
 * the new one activates, and the old plan's own billing schedule is cancelled
 * when the new membership brings its own — so switch day never double-bills.
 *
 * Failure containment: each supersede candidate runs as its own
 * terminate → activate → refresh pipeline, and the bulk activate pass is
 * PINNED to the ids vetted this run — a candidate whose supersede fails stays
 * `pending` and is retried on the next run instead of being activated into a
 * double-billing state.
 *
 * Kill switch: SCHEDULED_PLAN_CHANGE_SUPERSEDE=0 disables the pass.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { recalculateMemberBillingFromCoverage } from '@crm-eco/lib';

export type DuePendingMembership = {
  id: string;
  member_id: string;
  organization_id: string | null;
  effective_date: string | null;
  plan_id: string | null;
  enrollment_id: string | null;
  billing_amount: number | null;
  custom_fields: Record<string, unknown> | null;
};

export type SupersedeCandidate = {
  member_id: string;
  organization_id: string | null;
  incoming_membership_id: string;
  incoming_plan_id: string | null;
  incoming_enrollment_id: string | null;
  incoming_effective_date: string;
  incoming_billing_amount: number | null;
  incoming_custom_fields: Record<string, unknown> | null;
  outgoing_membership_id: string;
  outgoing_enrollment_id: string | null;
  outgoing_end_date: string | null;
};

export type BillingActivationOptions = {
  dryRun?: boolean;
  /** Override the SCHEDULED_PLAN_CHANGE_SUPERSEDE env kill switch (tests). */
  supersede?: boolean;
};

export type BillingActivationResult = {
  today: string;
  dry_run: boolean;
  memberships_to_activate: number;
  members_to_activate: number;
  memberships_activated: number;
  members_activated: number;
  memberships_to_supersede: number;
  memberships_superseded: number;
  schedules_cancelled: number;
  due: DuePendingMembership[];
  supersede_errors: string[];
  error?: string;
};

/** Day before an ISO date, in UTC (no DST/local-time drift). */
export function previousDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function supersedeEnabled(opts: BillingActivationOptions): boolean {
  if (typeof opts.supersede === 'boolean') return opts.supersede;
  return process.env.SCHEDULED_PLAN_CHANGE_SUPERSEDE !== '0';
}

/**
 * The outgoing membership this pending row supersedes, when already known:
 * either the staff-lane scheduled_change back-pointer, or the
 * `supersede_outgoing` stamp this cron writes before terminating — the stamp
 * is what lets a retry re-pair after the outgoing row is no longer `active`.
 */
function scheduledChangeFromMembershipId(m: DuePendingMembership): string | null {
  const sc = m.custom_fields?.scheduled_change;
  if (sc && typeof sc === 'object' && !Array.isArray(sc)) {
    const from = (sc as Record<string, unknown>).from_membership_id;
    if (typeof from === 'string' && from) return from;
  }
  const stamped = m.custom_fields?.supersede_outgoing;
  return typeof stamped === 'string' && stamped ? stamped : null;
}

export async function listDuePendingMemberships(
  supabase: SupabaseClient,
  today: string,
): Promise<{ due: DuePendingMembership[]; error?: string }> {
  const { data, error } = await supabase
    .from('memberships')
    .select(
      'id, member_id, organization_id, effective_date, plan_id, enrollment_id, billing_amount, custom_fields',
    )
    .eq('status', 'pending')
    .lte('effective_date', today);

  if (error) {
    return { due: [], error: error.message };
  }

  return { due: (data ?? []) as DuePendingMembership[] };
}

/**
 * Pair each due pending membership with the member's still-active membership
 * it replaces (if any). When the pending row carries a scheduled_change
 * back-pointer, ONLY that membership is superseded — any other active row the
 * member holds is left alone. Rows without a back-pointer (re-enrollment lane)
 * pair with every active membership, preserving the one-active invariant.
 */
export async function listSupersedeCandidates(
  supabase: SupabaseClient,
  due: DuePendingMembership[],
): Promise<{ candidates: SupersedeCandidate[]; error?: string }> {
  const memberIds = Array.from(new Set(due.map((m) => m.member_id).filter(Boolean)));
  if (memberIds.length === 0) return { candidates: [] };

  const { data, error } = await supabase
    .from('memberships')
    .select('id, member_id, enrollment_id, end_date')
    .in('member_id', memberIds)
    .eq('status', 'active');

  if (error) {
    return { candidates: [], error: error.message };
  }

  type OutgoingRow = { id: string; enrollment_id: string | null; end_date: string | null };
  const activeByMember = new Map<string, OutgoingRow[]>();
  const activeIds = new Set<string>();
  for (const row of data ?? []) {
    const list = activeByMember.get(row.member_id) ?? [];
    list.push({ id: row.id, enrollment_id: row.enrollment_id ?? null, end_date: row.end_date ?? null });
    activeByMember.set(row.member_id, list);
    activeIds.add(row.id);
  }

  // Back-pointed outgoing rows may already be `terminated` (a prior run's
  // partial supersede) — fetch them by id regardless of status so the retry
  // can resume the billing handoff instead of degrading to a plain activation.
  const pointedIds = Array.from(
    new Set(
      due
        .map((m) => scheduledChangeFromMembershipId(m))
        .filter((id): id is string => Boolean(id) && !activeIds.has(id as string)),
    ),
  );
  const pointedById = new Map<string, OutgoingRow & { status: string; cancellation_reason: string | null }>();
  if (pointedIds.length > 0) {
    const { data: pointed, error: pointedError } = await supabase
      .from('memberships')
      .select('id, member_id, enrollment_id, end_date, status, cancellation_reason')
      .in('id', pointedIds);
    if (pointedError) {
      return { candidates: [], error: pointedError.message };
    }
    for (const row of pointed ?? []) {
      pointedById.set(row.id, {
        id: row.id,
        enrollment_id: row.enrollment_id ?? null,
        end_date: row.end_date ?? null,
        status: row.status,
        cancellation_reason: row.cancellation_reason ?? null,
      });
    }
  }

  const candidates: SupersedeCandidate[] = [];
  for (const incoming of due) {
    if (!incoming.effective_date) continue;
    const fromId = scheduledChangeFromMembershipId(incoming);
    let outgoings: OutgoingRow[];
    if (fromId) {
      const active = (activeByMember.get(incoming.member_id) ?? []).find((o) => o.id === fromId);
      const pointed = pointedById.get(fromId);
      // A terminated back-pointed row only counts when OUR pass terminated it
      // (partial-supersede resume) — never someone else's termination.
      const resumable =
        pointed &&
        (pointed.status === 'active' ||
          (pointed.status === 'terminated' &&
            pointed.cancellation_reason === 'superseded_by_scheduled_change'));
      outgoings = active ? [active] : resumable ? [pointed] : [];
    } else {
      outgoings = (activeByMember.get(incoming.member_id) ?? []).filter(
        (outgoing) => outgoing.id !== incoming.id,
      );
    }
    for (const outgoing of outgoings) {
      candidates.push({
        member_id: incoming.member_id,
        organization_id: incoming.organization_id,
        incoming_membership_id: incoming.id,
        incoming_plan_id: incoming.plan_id,
        incoming_enrollment_id: incoming.enrollment_id,
        incoming_effective_date: incoming.effective_date,
        incoming_billing_amount: incoming.billing_amount,
        incoming_custom_fields: incoming.custom_fields,
        outgoing_membership_id: outgoing.id,
        outgoing_enrollment_id: outgoing.enrollment_id,
        outgoing_end_date: outgoing.end_date,
      });
    }
  }

  return { candidates };
}

/**
 * Terminate the outgoing membership and hand its billing over.
 * Returns the number of billing schedules cancelled.
 */
async function applySupersede(
  supabase: SupabaseClient,
  candidate: SupersedeCandidate,
): Promise<{ schedulesCancelled: number; error?: string }> {
  const endDate = candidate.outgoing_end_date ?? previousDay(candidate.incoming_effective_date);

  // Stamp the pairing on the incoming row FIRST: if any later step fails, the
  // next run re-pairs via this stamp even though the outgoing row is no
  // longer `active`, and resumes the handoff instead of plain-activating.
  const alreadyPointed =
    scheduledChangeFromMembershipId({
      custom_fields: candidate.incoming_custom_fields,
    } as DuePendingMembership) === candidate.outgoing_membership_id;
  if (!alreadyPointed) {
    const { error: stampError } = await supabase
      .from('memberships')
      .update({
        custom_fields: {
          ...(candidate.incoming_custom_fields ?? {}),
          supersede_outgoing: candidate.outgoing_membership_id,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.incoming_membership_id)
      .eq('status', 'pending');
    if (stampError) {
      return { schedulesCancelled: 0, error: `stamp ${candidate.incoming_membership_id}: ${stampError.message}` };
    }
  }

  const { data: terminated, error: termError } = await supabase
    .from('memberships')
    .update({
      status: 'terminated',
      end_date: endDate,
      cancellation_reason: 'superseded_by_scheduled_change',
      updated_at: new Date().toISOString(),
    })
    .eq('id', candidate.outgoing_membership_id)
    .eq('status', 'active')
    .select('id');

  if (termError) {
    return { schedulesCancelled: 0, error: `terminate ${candidate.outgoing_membership_id}: ${termError.message}` };
  }
  if ((terminated ?? []).length === 0) {
    // 0 rows: either a prior partial run of THIS pass already terminated it
    // (resume the handoff below — every remaining step is idempotent), or
    // another writer changed the row (fail so the incoming stays pending).
    const { data: existing } = await supabase
      .from('memberships')
      .select('status, cancellation_reason')
      .eq('id', candidate.outgoing_membership_id)
      .maybeSingle();
    const isOurPartialRun =
      existing?.status === 'terminated' &&
      existing?.cancellation_reason === 'superseded_by_scheduled_change';
    if (!isOurPartialRun) {
      return {
        schedulesCancelled: 0,
        error: `terminate ${candidate.outgoing_membership_id}: row no longer active`,
      };
    }
  }

  // Billing handoff: only cancel the outgoing enrollment's schedules when the
  // incoming membership brings its OWN active schedule (re-enrollment case).
  // A staff-scheduled change (enrollment_id NULL) keeps the member's existing
  // schedule as the vehicle for the new amount — cancelling it would leave the
  // member unbilled.
  let schedulesCancelled = 0;
  const sameEnrollment =
    candidate.outgoing_enrollment_id != null &&
    candidate.outgoing_enrollment_id === candidate.incoming_enrollment_id;

  if (candidate.incoming_enrollment_id && candidate.outgoing_enrollment_id && !sameEnrollment) {
    const { data: incomingSchedules, error: schedLookupError } = await supabase
      .from('billing_schedules')
      .select('id')
      .eq('enrollment_id', candidate.incoming_enrollment_id)
      .in('status', ['active', 'paused'])
      .limit(1);

    if (schedLookupError) {
      return { schedulesCancelled, error: `schedule lookup: ${schedLookupError.message}` };
    }

    if ((incomingSchedules ?? []).length > 0) {
      const { data: cancelled, error: cancelError } = await supabase
        .from('billing_schedules')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_reason: 'membership_superseded_by_scheduled_change',
          updated_at: new Date().toISOString(),
        })
        .eq('enrollment_id', candidate.outgoing_enrollment_id)
        .in('status', ['active', 'paused'])
        .select('id');

      if (cancelError) {
        return { schedulesCancelled, error: `cancel schedules: ${cancelError.message}` };
      }
      schedulesCancelled = (cancelled ?? []).length;
    }
  }

  return { schedulesCancelled };
}

/**
 * After the incoming membership is active, refresh the denormalized member
 * plan columns and re-run the billing recalc so the surviving schedule carries
 * the new plan's amount. members.effective_date is deliberately untouched —
 * the members→crm_records sync projects it into original_start_date.
 */
async function refreshMemberAfterSwitch(
  supabase: SupabaseClient,
  candidate: SupersedeCandidate,
): Promise<{ error?: string }> {
  if (candidate.incoming_plan_id) {
    const { data: plan } = await supabase
      .from('plans')
      .select('name')
      .eq('id', candidate.incoming_plan_id)
      .maybeSingle();

    const memberUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (plan?.name) memberUpdate.plan_name = plan.name;
    if (candidate.incoming_billing_amount != null) {
      memberUpdate.monthly_share = candidate.incoming_billing_amount;
    }

    const { error: memberError } = await supabase
      .from('members')
      .update(memberUpdate)
      .eq('id', candidate.member_id);

    if (memberError) {
      return { error: `member refresh ${candidate.member_id}: ${memberError.message}` };
    }
  }

  if (candidate.organization_id) {
    try {
      await recalculateMemberBillingFromCoverage(supabase, candidate.member_id, candidate.organization_id);
    } catch (error) {
      return {
        error: `billing recalc ${candidate.member_id}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  return {};
}

/**
 * Activate due pending memberships and matching pending members.
 * Does not touch enrollments (commission invariant).
 */
export async function applyDueMembershipActivation(
  supabase: SupabaseClient,
  today: string,
  opts: BillingActivationOptions = {},
): Promise<BillingActivationResult> {
  const dryRun = Boolean(opts.dryRun);
  const { due, error } = await listDuePendingMemberships(supabase, today);

  const base: BillingActivationResult = {
    today,
    dry_run: dryRun,
    memberships_to_activate: due.length,
    members_to_activate: 0,
    memberships_activated: 0,
    members_activated: 0,
    memberships_to_supersede: 0,
    memberships_superseded: 0,
    schedules_cancelled: 0,
    due,
    supersede_errors: [],
  };

  if (error) {
    return { ...base, memberships_to_activate: 0, error };
  }

  let candidates: SupersedeCandidate[] = [];
  if (supersedeEnabled(opts) && due.length > 0) {
    const supersedeList = await listSupersedeCandidates(supabase, due);
    if (supersedeList.error) {
      return { ...base, error: supersedeList.error };
    }
    candidates = supersedeList.candidates;
    base.memberships_to_supersede = candidates.length;
  }

  const memberIds = Array.from(new Set(due.map((m) => m.member_id).filter(Boolean)));
  base.members_to_activate = memberIds.length;

  if (dryRun || due.length === 0) {
    return base;
  }

  // 1. Supersede pipelines — per candidate: terminate outgoing → activate
  //    incoming (by id) → refresh member/billing. A failure at any step leaves
  //    the incoming row `pending` (or records the refresh gap) and moves on.
  const candidatesByIncoming = new Map<string, SupersedeCandidate[]>();
  for (const candidate of candidates) {
    const list = candidatesByIncoming.get(candidate.incoming_membership_id) ?? [];
    list.push(candidate);
    candidatesByIncoming.set(candidate.incoming_membership_id, list);
  }

  const activatedMemberIds = new Set<string>();
  for (const [incomingId, group] of candidatesByIncoming) {
    let groupFailed = false;
    for (const candidate of group) {
      const { schedulesCancelled, error: supersedeError } = await applySupersede(supabase, candidate);
      if (supersedeError) {
        base.supersede_errors.push(supersedeError);
        groupFailed = true;
        break;
      }
      base.memberships_superseded += 1;
      base.schedules_cancelled += schedulesCancelled;
    }
    if (groupFailed) continue; // incoming stays pending — retried next run

    const { data: activated, error: activateError } = await supabase
      .from('memberships')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', incomingId)
      .eq('status', 'pending')
      .select('id');
    if (activateError) {
      base.supersede_errors.push(`activate ${incomingId}: ${activateError.message}`);
      continue;
    }
    if ((activated ?? []).length === 0) {
      // Raced with another writer — do not refresh or flip for a membership
      // this run did not actually activate.
      base.supersede_errors.push(`activate ${incomingId}: row no longer pending`);
      continue;
    }
    base.memberships_activated += (activated ?? []).length;
    activatedMemberIds.add(group[0].member_id);

    const { error: refreshError } = await refreshMemberAfterSwitch(supabase, group[0]);
    if (refreshError) base.supersede_errors.push(refreshError);
  }

  // 2. Plain first activations — PINNED to the due ids vetted this run that
  //    were not part of a supersede pipeline (never a blanket status update,
  //    so rows inserted mid-run or with a failed supersede are untouched).
  const plainIds = due
    .map((m) => m.id)
    .filter((id) => !candidatesByIncoming.has(id));
  if (plainIds.length > 0) {
    const { data: m1, error: e1 } = await supabase
      .from('memberships')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .in('id', plainIds)
      .eq('status', 'pending')
      .select('id, member_id');

    if (e1) {
      return { ...base, error: e1.message };
    }
    base.memberships_activated += (m1 ?? []).length;
    for (const row of m1 ?? []) {
      if (row.member_id) activatedMemberIds.add(row.member_id);
    }
  }

  // 3. Flip matching pending members (only for memberships actually activated).
  const memberIdsToFlip = Array.from(activatedMemberIds);
  if (memberIdsToFlip.length > 0) {
    const { data: m2, error: e2 } = await supabase
      .from('members')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .in('id', memberIdsToFlip)
      .eq('status', 'pending')
      .select('id');

    if (e2) {
      return { ...base, error: e2.message };
    }
    base.members_activated = (m2 ?? []).length;
  }

  if (base.supersede_errors.length > 0) {
    console.error('[activate-due-memberships] supersede errors:', base.supersede_errors);
  }

  return base;
}
