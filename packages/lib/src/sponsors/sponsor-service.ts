import type { SupabaseClient } from '@supabase/supabase-js';
import { decideEnrollmentMatch, rosterMatchKey } from './match';
import { applyDependentCapToImport, planRosterImport, parseRosterCsv } from './rosterImport';
import { planEligibilityEndings } from './eligibility';
import { buildSponsorInvoiceDraft } from './invoice';
import { isDependentRelationship, wouldExceedDependentCap } from './caps';
import { isKnownRosterEnabled } from './flags';
import { knownRosterRelationship, planKnownRosterEnroll } from './knownRoster';
import { linkSponsorshipToMembership, shouldHealSponsorshipLink } from './linkMembership';
import { planSponsorshipDecision } from './approvals';
import { findOrCreatePublicMember } from '../enrollment/submitPublicEnrollment';
import type {
  EnrollmentMatchDecision,
  RosterPersonInput,
  RosterImportResult,
  SponsorInvoiceDraft,
  SponsorRelationship,
} from './types';

type AnyClient = SupabaseClient;

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function matchSponsorEnrollment(
  supabase: AnyClient,
  input: {
    organizationId: string;
    sponsorId: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth?: string | null;
  }
): Promise<EnrollmentMatchDecision> {
  if (!input.sponsorId) {
    return decideEnrollmentMatch(null, []);
  }

  const { data, error } = await supabase.rpc('sponsor_match_roster', {
    p_org_id: input.organizationId,
    p_sponsor_id: input.sponsorId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_date_of_birth: input.dateOfBirth || null,
  });

  if (error) {
    return {
      outcome: 'needs_approval',
      reason: `Roster match failed: ${error.message}`,
    };
  }

  const matches = (data ?? []).map((row: {
    roster_id: string;
    status: string;
    relationship: string;
    member_id: string | null;
  }) => ({
    roster_id: row.roster_id,
    status: row.status,
    relationship: row.relationship,
    member_id: row.member_id,
  }));

  return decideEnrollmentMatch(input.sponsorId, matches);
}

export async function importSponsorRoster(
  supabase: AnyClient,
  input: {
    organizationId: string;
    sponsorId: string;
    csvText: string;
    mode: 'dry_run' | 'apply';
    enrollMode?: 'eligible_only' | 'known_roster';
    filename?: string;
    actorId?: string | null;
  }
): Promise<RosterImportResult & { known_roster?: ReturnType<typeof planKnownRosterEnroll> }> {
  const incoming = parseRosterCsv(input.csvText);
  const [{ data: existing, error: existingErr }, { data: sponsor, error: sponsorErr }] =
    await Promise.all([
      supabase
        .from('sponsor_roster')
        .select('id, match_key, status, external_id, relationship')
        .eq('organization_id', input.organizationId)
        .eq('sponsor_id', input.sponsorId),
      supabase
        .from('sponsors')
        .select('dependent_cap')
        .eq('id', input.sponsorId)
        .eq('organization_id', input.organizationId)
        .maybeSingle(),
    ]);

  if (existingErr) throw new Error(existingErr.message);
  if (sponsorErr) throw new Error(sponsorErr.message);

  const plan = applyDependentCapToImport(
    planRosterImport(incoming, existing ?? []),
    existing ?? [],
    sponsor?.dependent_cap ?? null
  );

  const { data: importRow, error: importErr } = await supabase
    .from('sponsor_roster_imports')
    .insert({
      organization_id: input.organizationId,
      sponsor_id: input.sponsorId,
      mode: input.mode,
      filename: input.filename ?? null,
      total_rows: plan.total_rows,
      matched_rows: plan.matched_rows,
      inserted_rows: plan.inserted_rows,
      updated_rows: plan.updated_rows,
      terminated_rows: plan.terminated_rows,
      error_rows: plan.error_rows,
      created_by: input.actorId ?? null,
    })
    .select('id')
    .single();

  if (importErr) throw new Error(importErr.message);

  if (plan.rows.length > 0) {
    await supabase.from('sponsor_roster_import_rows').insert(
      plan.rows.map((row) => ({
        organization_id: input.organizationId,
        import_id: importRow.id,
        row_number: row.row_number,
        action: row.action,
        payload: row.payload,
        message: row.message ?? null,
      }))
    );
  }

  if (input.mode === 'apply') {
    await applyRosterPlan(supabase, input.organizationId, input.sponsorId, incoming, plan);
  }

  let known_roster: ReturnType<typeof planKnownRosterEnroll> | undefined;
  if (input.enrollMode === 'known_roster') {
    if (!isKnownRosterEnabled() && input.mode === 'apply') {
      throw new Error('Known-roster enroll is off. Set SPONSOR_KNOWN_ROSTER_ENABLED=true.');
    }
    const { data: members } = await supabase
      .from('members')
      .select('id, first_name, last_name, date_of_birth, email')
      .eq('organization_id', input.organizationId)
      .is('merged_into_id', null)
      .limit(5000);
    known_roster = planKnownRosterEnroll(incoming, members ?? []);
    if (input.mode === 'apply') {
      if (known_roster.error_count > 0) {
        throw new Error(
          `Known-roster dry-run would fail on ${known_roster.error_count} row(s). Fix those first.`,
        );
      }
      await applyKnownRosterPlan(supabase, {
        organizationId: input.organizationId,
        sponsorId: input.sponsorId,
        planned: known_roster,
      });
    }
  }

  return { ...plan, known_roster };
}

async function applyRosterPlan(
  supabase: AnyClient,
  organizationId: string,
  sponsorId: string,
  incoming: RosterPersonInput[],
  plan: RosterImportResult
) {
  for (const row of plan.rows) {
    const person = row.payload;
    if (row.action === 'error' || row.action === 'skip') continue;

    if (row.action === 'insert') {
      await supabase.from('sponsor_roster').insert({
        organization_id: organizationId,
        sponsor_id: sponsorId,
        first_name: person.first_name.trim(),
        last_name: person.last_name.trim(),
        date_of_birth: person.date_of_birth || null,
        email: person.email || null,
        external_id: person.external_id || null,
        relationship: person.relationship ?? 'employee',
        status: person.eligible_end ? 'terminated' : 'eligible',
        eligible_start: person.eligible_start || null,
        eligible_end: person.eligible_end || null,
      });
      continue;
    }

    const { data: found } = await supabase
      .from('sponsor_roster')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('sponsor_id', sponsorId)
      .eq('match_key', row.match_key)
      .maybeSingle();

    if (!found) continue;

    if (row.action === 'terminate') {
      await supabase
        .from('sponsor_roster')
        .update({
          status: 'terminated',
          eligible_end: person.eligible_end || new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq('id', found.id);
      continue;
    }

    await supabase
      .from('sponsor_roster')
      .update({
        email: person.email ?? undefined,
        external_id: person.external_id ?? undefined,
        relationship: person.relationship ?? undefined,
        eligible_start: person.eligible_start ?? undefined,
        eligible_end: person.eligible_end ?? undefined,
        status: 'eligible',
        updated_at: new Date().toISOString(),
      })
      .eq('id', found.id);
  }
}

export async function applySponsorEligibilityEndings(
  supabase: AnyClient,
  organizationId: string,
  asOfIso = new Date().toISOString().slice(0, 10)
): Promise<{ ended: number; skipped: number }> {
  const { data: rows, error } = await supabase
    .from('sponsorships')
    .select(`
      id,
      sponsor_id,
      roster_id,
      member_id,
      membership_id,
      enrollment_id,
      status,
      end_date,
      sponsor_roster ( id, eligible_end, status ),
      memberships ( id, status, end_date, member_id )
    `)
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'active']);

  if (error) throw new Error(error.message);

  const resolved: Array<{
    membership_id: string;
    roster_id: string | null;
    sponsorship_id: string;
    member_id: string;
    status: string;
    end_date: string | null;
    eligible_end: string | null;
  }> = [];

  for (const row of rows ?? []) {
    const joinedMembership = firstJoin(row.memberships);
    const joinedRoster = firstJoin(row.sponsor_roster);
    let membershipId = row.membership_id ?? joinedMembership?.id ?? null;
    if (!membershipId && row.enrollment_id) {
      const found = await supabase
        .from('memberships')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('enrollment_id', row.enrollment_id)
        .maybeSingle();
      membershipId = found.data?.id ?? null;
    }
    if (!membershipId && row.member_id) {
      const found = await supabase
        .from('memberships')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('member_id', row.member_id)
        .in('status', ['active', 'pending'])
        .limit(1)
        .maybeSingle();
      membershipId = found.data?.id ?? null;
    }
    if (shouldHealSponsorshipLink(row.membership_id, membershipId) && membershipId) {
      if (row.enrollment_id) {
        await linkSponsorshipToMembership(supabase, {
          organizationId,
          enrollmentId: row.enrollment_id,
          membershipId,
          sponsorId: row.sponsor_id,
          memberId: row.member_id,
        });
      } else {
        await supabase
          .from('sponsorships')
          .update({
            membership_id: membershipId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .eq('organization_id', organizationId);
        if (row.sponsor_id) {
          await supabase
            .from('memberships')
            .update({
              sponsor_id: row.sponsor_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', membershipId)
            .eq('organization_id', organizationId);
        }
      }
    }
    if (!membershipId) continue;
    resolved.push({
      membership_id: membershipId,
      roster_id: row.roster_id,
      sponsorship_id: row.id,
      member_id: row.member_id ?? joinedMembership?.member_id,
      status: joinedMembership?.status ?? row.status,
      end_date: joinedMembership?.end_date ?? row.end_date,
      eligible_end: joinedRoster?.eligible_end ?? null,
    });
  }

  const planned = planEligibilityEndings(resolved, asOfIso);

  let ended = 0;
  let skipped = 0;

  for (const action of planned) {
    await supabase.from('sponsor_eligibility_events').insert({
      organization_id: organizationId,
      sponsor_id: (
        await supabase.from('sponsorships').select('sponsor_id').eq('id', action.sponsorship_id).maybeSingle()
      ).data?.sponsor_id,
      roster_id: action.roster_id,
      sponsorship_id: action.sponsorship_id,
      membership_id: action.membership_id,
      event_type: action.event_type,
      message: action.message,
    });

    if (action.event_type !== 'ended') {
      skipped += 1;
      continue;
    }

    await supabase
      .from('memberships')
      .update({
        status: 'terminated',
        end_date: action.end_date,
        cancellation_reason: 'sponsor_eligibility_ended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', action.membership_id)
      .eq('organization_id', organizationId);

    if (action.sponsorship_id) {
      await supabase
        .from('sponsorships')
        .update({
          status: 'ended',
          end_date: action.end_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', action.sponsorship_id)
        .eq('organization_id', organizationId);
    }

    if (action.roster_id) {
      await supabase
        .from('sponsor_roster')
        .update({
          status: 'terminated',
          eligible_end: action.end_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', action.roster_id);
    }

    ended += 1;
  }

  return { ended, skipped };
}

export async function generateSponsorInvoice(
  supabase: AnyClient,
  input: {
    organizationId: string;
    sponsorId: string;
    periodStart: string;
    periodEnd: string;
    createdBy?: string | null;
  }
): Promise<SponsorInvoiceDraft> {
  const { data: sponsor, error: sponsorErr } = await supabase
    .from('sponsors')
    .select('id, name, organization_id')
    .eq('id', input.sponsorId)
    .eq('organization_id', input.organizationId)
    .single();

  if (sponsorErr || !sponsor) throw new Error(sponsorErr?.message ?? 'Sponsor not found');

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, line_items, period_start, period_end')
    .eq('organization_id', input.organizationId)
    .eq('sponsor_id', input.sponsorId)
    .eq('payer_type', 'sponsor')
    .eq('period_start', input.periodStart)
    .eq('period_end', input.periodEnd)
    .not('status', 'in', '(void,cancelled)')
    .maybeSingle();

  const { data: sponsorships, error: spErr } = await supabase
    .from('sponsorships')
    .select(`
      id, roster_id, member_id, membership_id, role, status, effective_date, end_date,
      members ( id, first_name, last_name ),
      sponsor_roster ( first_name, last_name ),
      memberships ( id, billing_amount, plan_id, plans ( id, name ) )
    `)
    .eq('organization_id', input.organizationId)
    .eq('sponsor_id', input.sponsorId)
    .in('status', ['pending', 'active']);

  if (spErr) throw new Error(spErr.message);

  const draft = buildSponsorInvoiceDraft({
    sponsor_id: input.sponsorId,
    organization_id: input.organizationId,
    sponsor_name: sponsor.name,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    rows: (sponsorships ?? []).map((raw) => {
      const row = raw as {
        roster_id: string | null;
        member_id: string | null;
        membership_id: string | null;
        role: SponsorRelationship;
        status: string;
        effective_date: string | null;
        end_date: string | null;
        members?: { first_name?: string | null; last_name?: string | null } | null;
        sponsor_roster?: { first_name?: string | null; last_name?: string | null } | null;
        memberships?: {
          billing_amount?: number | null;
          plan_id?: string | null;
          plans?: { id?: string | null; name?: string | null } | null;
        } | null;
      };
      const member = firstJoin(row.members);
      const roster = firstJoin(row.sponsor_roster);
      const membership = firstJoin(row.memberships);
      const plan = firstJoin(membership?.plans);
      return {
        roster_id: row.roster_id,
        member_id: row.member_id,
        membership_id: row.membership_id,
        first_name: member?.first_name || roster?.first_name || '',
        last_name: member?.last_name || roster?.last_name || '',
        role: row.role,
        amount: Number(membership?.billing_amount) || 0,
        plan_id: membership?.plan_id ?? plan?.id ?? null,
        plan_name: plan?.name ?? null,
        status: row.status,
        effective_date: row.effective_date,
        end_date: row.end_date,
      };
    }),
  });

  if (existing) {
    const lineItems = Array.isArray(existing.line_items)
      ? (existing.line_items as SponsorInvoiceDraft['line_items'])
      : draft.line_items;
    return {
      sponsor_id: input.sponsorId,
      organization_id: input.organizationId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      title: draft.title,
      line_items: lineItems,
      subtotal: Number(existing.total) || 0,
      total: Number(existing.total) || 0,
      headcount: lineItems.length,
      already_exists: true,
      invoice_id: existing.id,
    };
  }

  const invoiceNumber = `INV-SP-${input.sponsorId.slice(0, 8).toUpperCase()}-${input.periodStart.replace(/-/g, '')}`;

  const { data: created, error: invErr } = await supabase
    .from('invoices')
    .insert({
      organization_id: input.organizationId,
      invoice_number: invoiceNumber,
      title: draft.title,
      status: 'draft',
      payer_type: 'sponsor',
      sponsor_id: input.sponsorId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      line_items: draft.line_items,
      subtotal: draft.subtotal,
      tax_amount: 0,
      total: draft.total,
      amount_paid: 0,
      balance_due: draft.total,
      due_date: input.periodEnd,
      created_by: input.createdBy ?? null,
      notes: `${draft.headcount} covered lives`,
    })
    .select('id')
    .single();

  if (invErr) throw new Error(invErr.message);
  return { ...draft, already_exists: false, invoice_id: created?.id ?? null };
}

export async function attachSponsorshipAfterMatch(
  supabase: AnyClient,
  input: {
    organizationId: string;
    sponsorId: string;
    rosterId: string;
    memberId: string;
    enrollmentId?: string | null;
    membershipId?: string | null;
    role?: string;
    effectiveDate?: string | null;
    needsApproval?: boolean;
  }
) {
  const status = input.needsApproval ? 'needs_approval' : 'pending';
  const payload = {
    organization_id: input.organizationId,
    sponsor_id: input.sponsorId,
    roster_id: input.rosterId,
    member_id: input.memberId,
    enrollment_id: input.enrollmentId ?? null,
    membership_id: input.membershipId ?? null,
    role: input.role ?? 'employee',
    status,
    effective_date: input.effectiveDate ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from('sponsorships')
    .select('id')
    .eq('sponsor_id', input.sponsorId)
    .eq('member_id', input.memberId)
    .in('status', ['pending', 'active', 'needs_approval'])
    .maybeSingle();
  if (existing) {
    await supabase.from('sponsorships').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('sponsorships').insert(payload);
  }

  await supabase
    .from('sponsor_roster')
    .update({
      member_id: input.memberId,
      status: input.needsApproval ? 'pending_approval' : 'enrolled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.rosterId);

  if (input.membershipId) {
    await supabase
      .from('memberships')
      .update({ sponsor_id: input.sponsorId })
      .eq('id', input.membershipId)
      .eq('organization_id', input.organizationId);
  }
}

export async function addSponsorRosterPerson(
  supabase: AnyClient,
  input: {
    organizationId: string;
    sponsorId: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string | null;
    email?: string | null;
    relationship?: SponsorRelationship;
  }
) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) throw new Error('First and last name are required');

  const relationship = input.relationship ?? 'employee';
  const [{ data: sponsor, error: sponsorErr }, { data: existing, error: existingErr }] =
    await Promise.all([
      supabase
        .from('sponsors')
        .select('id, dependent_cap')
        .eq('id', input.sponsorId)
        .eq('organization_id', input.organizationId)
        .maybeSingle(),
      supabase
        .from('sponsor_roster')
        .select('id, relationship, status')
        .eq('organization_id', input.organizationId)
        .eq('sponsor_id', input.sponsorId),
    ]);

  if (sponsorErr) throw new Error(sponsorErr.message);
  if (!sponsor) throw new Error('Sponsor not found');
  if (existingErr) throw new Error(existingErr.message);

  const open = (existing ?? []).filter((row: { status: string }) => row.status !== 'terminated');
  const employees = open.filter((row: { relationship: string }) => row.relationship === 'employee').length;
  const dependents = open.filter((row: { relationship: string }) =>
    isDependentRelationship(row.relationship)
  ).length;

  if (
    isDependentRelationship(relationship) &&
    wouldExceedDependentCap({
      cap: sponsor.dependent_cap,
      employeeCount: employees,
      dependentCountAfter: dependents + 1,
    })
  ) {
    throw new Error(`Dependent cap exceeded (max ${sponsor.dependent_cap} per employee)`);
  }

  const { error: insertErr } = await supabase.from('sponsor_roster').insert({
    organization_id: input.organizationId,
    sponsor_id: input.sponsorId,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: input.dateOfBirth || null,
    email: input.email || null,
    relationship,
    status: 'eligible',
  });

  if (insertErr) throw new Error(insertErr.message);
}

async function applyKnownRosterPlan(
  supabase: AnyClient,
  input: {
    organizationId: string;
    sponsorId: string;
    planned: ReturnType<typeof planKnownRosterEnroll>;
  },
) {
  const { data: sponsor, error: sponsorErr } = await supabase
    .from('sponsors')
    .select('id, default_plan_id, enrollment_cutoff_day, backbill_months')
    .eq('id', input.sponsorId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (sponsorErr || !sponsor?.default_plan_id) {
    throw new Error(sponsorErr?.message ?? 'Known-roster enroll needs a default sponsor plan.');
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('id, name, monthly_share')
    .eq('id', sponsor.default_plan_id)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (!plan) throw new Error('Default sponsor plan was not found.');

  const today = new Date().toISOString().slice(0, 10);

  for (const row of input.planned.rows) {
    if (row.action !== 'attach' && row.action !== 'create') continue;
    const person = row.payload;
    let memberId = row.member_id ?? null;
    if (row.action === 'create' || !memberId) {
      const created = await findOrCreatePublicMember(supabase, {
        organizationId: input.organizationId,
        member: {
          first_name: person.first_name,
          last_name: person.last_name,
          email: person.email ?? `${rosterMatchKey(person.first_name, person.last_name, person.date_of_birth)}@roster.local`,
          date_of_birth: person.date_of_birth ?? undefined,
        },
        coverageStart: today,
        source: 'sponsor_known_roster',
      });
      if ('error' in created) throw new Error(created.message ?? created.error);
      memberId = created.memberId;
    }

    const existing = await supabase
      .from('memberships')
      .select('id')
      .eq('organization_id', input.organizationId)
      .eq('member_id', memberId)
      .in('status', ['active', 'pending'])
      .limit(1)
      .maybeSingle();
    let membershipId = existing.data?.id as string | undefined;

    if (!membershipId) {
      const provisioned = await provisionSponsoredEnrollment(supabase, {
        organizationId: input.organizationId,
        memberId,
        sponsorId: input.sponsorId,
        planId: plan.id,
        amount: Number(plan.monthly_share) || 0,
        effectiveDate: today,
        relationship: knownRosterRelationship(person.relationship),
      });
      membershipId = provisioned.membershipId;
    }

    const { data: roster } = await supabase
      .from('sponsor_roster')
      .select('id')
      .eq('organization_id', input.organizationId)
      .eq('sponsor_id', input.sponsorId)
      .eq('match_key', row.match_key)
      .maybeSingle();

    if (roster?.id && membershipId) {
      await attachSponsorshipAfterMatch(supabase, {
        organizationId: input.organizationId,
        sponsorId: input.sponsorId,
        rosterId: roster.id,
        memberId,
        membershipId,
        role: knownRosterRelationship(person.relationship),
        effectiveDate: today,
      });
    }
  }
}

export async function provisionSponsoredEnrollment(
  supabase: AnyClient,
  input: {
    organizationId: string;
    memberId: string;
    sponsorId: string;
    planId: string;
    amount: number;
    effectiveDate: string;
    relationship?: SponsorRelationship;
    enrollmentId?: string | null;
  },
): Promise<{ membershipId: string; enrollmentId: string }> {
  let enrollmentId = input.enrollmentId ?? null;
  if (enrollmentId) {
    await supabase
      .from('enrollments')
      .update({
        status: 'approved',
        selected_plan_id: input.planId,
        sponsor_id: input.sponsorId,
        effective_date: input.effectiveDate,
        requested_effective_date: input.effectiveDate,
        base_monthly_cost: input.amount,
        total_monthly_cost: input.amount,
        approved_at: new Date().toISOString(),
      })
      .eq('id', enrollmentId)
      .eq('organization_id', input.organizationId);
  } else {
    const { data: enrollment, error: enrErr } = await supabase
      .from('enrollments')
      .insert({
        organization_id: input.organizationId,
        primary_member_id: input.memberId,
        selected_plan_id: input.planId,
        status: 'approved',
        enrollment_mode: 'internal_ops',
        enrollment_source: 'sponsor_known_roster',
        effective_date: input.effectiveDate,
        requested_effective_date: input.effectiveDate,
        base_monthly_cost: input.amount,
        total_monthly_cost: input.amount,
        sponsor_id: input.sponsorId,
        approved_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (enrErr || !enrollment?.id) throw new Error(enrErr?.message ?? 'Could not create sponsored enrollment');
    enrollmentId = enrollment.id;
  }
  if (!enrollmentId) throw new Error('Sponsored enrollment id missing');

  const { data: existingMembership } = await supabase
    .from('memberships')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('enrollment_id', enrollmentId)
    .maybeSingle();

  let membershipId = existingMembership?.id as string | undefined;
  if (membershipId) {
    const { error: updMemErr } = await supabase
      .from('memberships')
      .update({
        sponsor_id: input.sponsorId,
        plan_id: input.planId,
        status: 'active',
        layer: 'core',
        effective_date: input.effectiveDate,
        billing_amount: input.amount,
        billing_frequency: 'monthly',
        custom_fields: { layer: 'core', sponsored: true },
        updated_at: new Date().toISOString(),
      })
      .eq('id', membershipId)
      .eq('organization_id', input.organizationId);
    if (updMemErr) throw new Error(updMemErr.message);
  } else {
    const { data: membership, error: memErr } = await supabase
      .from('memberships')
      .insert({
        organization_id: input.organizationId,
        member_id: input.memberId,
        plan_id: input.planId,
        enrollment_id: enrollmentId,
        sponsor_id: input.sponsorId,
        status: 'active',
        layer: 'core',
        effective_date: input.effectiveDate,
        billing_amount: input.amount,
        billing_frequency: 'monthly',
        custom_fields: { layer: 'core', sponsored: true },
      })
      .select('id')
      .single();
    if (memErr || !membership) throw new Error(memErr?.message ?? 'Could not create sponsored membership');
    membershipId = membership.id;
  }
  if (!membershipId) throw new Error('Sponsored membership id missing');

  await linkSponsorshipToMembership(supabase, {
    organizationId: input.organizationId,
    enrollmentId,
    membershipId,
    sponsorId: input.sponsorId,
    memberId: input.memberId,
  });

  return { membershipId, enrollmentId };
}

export async function applySponsorshipDecision(
  supabase: AnyClient,
  input: {
    organizationId: string;
    sponsorId: string;
    sponsorshipId: string;
    decision: 'approve' | 'deny';
  },
) {
  const { data: row, error } = await supabase
    .from('sponsorships')
    .select('id, status, enrollment_id, member_id, roster_id')
    .eq('id', input.sponsorshipId)
    .eq('sponsor_id', input.sponsorId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();
  if (error || !row) throw new Error(error?.message ?? 'Sponsorship not found');

  const planned = planSponsorshipDecision({
    currentStatus: row.status,
    decision: input.decision,
  });
  if (!planned.ok) throw new Error(planned.error);

  if (input.decision === 'deny') {
    const { error: updErr } = await supabase
      .from('sponsorships')
      .update({
        status: planned.nextStatus,
        end_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (updErr) throw new Error(updErr.message);

    if (row.enrollment_id) {
      await supabase
        .from('enrollments')
        .update({
          status: 'cancelled',
          status_reason: 'Employer denied',
        })
        .eq('id', row.enrollment_id);
    }

    if (row.roster_id) {
      await supabase
        .from('sponsor_roster')
        .update({
          status: 'terminated',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.roster_id);
    }

    return { ok: true, status: planned.nextStatus };
  }

  const { error: pendingErr } = await supabase
    .from('sponsorships')
    .update({
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (pendingErr) throw new Error(pendingErr.message);

  const { data: enrollment } = row.enrollment_id
    ? await supabase
        .from('enrollments')
        .select('id, selected_plan_id, primary_member_id, base_monthly_cost, total_monthly_cost, requested_effective_date, effective_date')
        .eq('id', row.enrollment_id)
        .maybeSingle()
    : { data: null };

  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('default_plan_id')
    .eq('id', input.sponsorId)
    .maybeSingle();

  const memberId = row.member_id ?? enrollment?.primary_member_id ?? null;
  const planId = enrollment?.selected_plan_id ?? sponsor?.default_plan_id ?? null;
  if (!memberId || !planId) {
    throw new Error('Approved enrollment is missing a member or plan');
  }

  const amount = Number(enrollment?.total_monthly_cost ?? enrollment?.base_monthly_cost ?? 0);
  const effectiveDate =
    enrollment?.requested_effective_date ??
    enrollment?.effective_date ??
    new Date().toISOString().slice(0, 10);

  const provisioned = await provisionSponsoredEnrollment(supabase, {
    organizationId: input.organizationId,
    memberId,
    sponsorId: input.sponsorId,
    planId,
    amount,
    effectiveDate,
    enrollmentId: row.enrollment_id ?? enrollment?.id ?? null,
  });

  if (row.roster_id) {
    await supabase
      .from('sponsor_roster')
      .update({
        status: 'enrolled',
        member_id: memberId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.roster_id);
  }

  return { ok: true, status: 'active', membershipId: provisioned.membershipId };
}

export async function completeSponsorPaidEnrollment(
  supabase: AnyClient,
  input: {
    organizationId: string;
    enrollmentId: string;
    memberId: string;
    sponsorId: string;
    planId: string;
    amount: number;
    effectiveDate: string;
  },
) {
  return provisionSponsoredEnrollment(supabase, {
    organizationId: input.organizationId,
    memberId: input.memberId,
    sponsorId: input.sponsorId,
    planId: input.planId,
    amount: input.amount,
    effectiveDate: input.effectiveDate,
    enrollmentId: input.enrollmentId,
  });
}
