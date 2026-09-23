/**
 * GET / POST /api/crm/records/[id]/schedule-membership-change
 *
 * Schedule or cancel a membership upgrade/downgrade/lateral from the CRM
 * coverage snapshot. CRM-only records write scheduled_plan_change; linked
 * members also call staffSchedulePlanChange.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  currentPlanFieldsFromData,
  executeCancelScheduledMembershipChange,
  executeScheduleMembershipChange,
  listOrgCorePlans,
  loadActiveCoreMembership,
  type ScheduleMembershipChangeInput,
} from '@/lib/crm/schedule-membership-change';
import {
  isAutomatedMembershipChangeType,
  isRecordSyncedToMember,
  parseScheduledPlanChange,
  shouldAutomateMembershipChange,
} from '@/lib/crm/scheduled-plan-change-apply';
import { localTodayIso } from '@/lib/crm/plan-change-follow-up';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['crm_admin', 'crm_manager', 'crm_agent'];

function staffCtxFor(
  profile: { id: string; organization_id: string },
): Parameters<typeof executeScheduleMembershipChange>[0]['staffCtx'] {
  return {
    supabase: createServiceRoleClient(),
    organizationId: profile.organization_id,
    profileId: profile.id,
    source: 'crm',
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: record, error } = await supabase
      .from('crm_records')
      .select('id, title, data, system')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .is('deleted_at' as never, null)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data = (record.data as Record<string, unknown> | null) ?? null;
    const linked = isRecordSyncedToMember({
      system: (record.system as Record<string, unknown> | null) ?? null,
      data,
    });
    const memberId =
      typeof data?.linked_member_id === 'string' ? data.linked_member_id : null;

    const service = createServiceRoleClient();
    const plans = linked ? await listOrgCorePlans(service, profile.organization_id) : [];
    const activeCore =
      linked && memberId
        ? await loadActiveCoreMembership(service, {
            organizationId: profile.organization_id,
            memberId,
          })
        : null;

    return NextResponse.json({
      record_id: record.id,
      title: record.title,
      linked,
      has_active_core: Boolean(activeCore),
      current: currentPlanFieldsFromData(data),
      scheduled: parseScheduledPlanChange(data),
      plans,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!WRITE_ROLES.includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: record, error } = await supabase
      .from('crm_records')
      .select('id, email, phone, data, system, updated_at')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .is('deleted_at' as never, null)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const action = body.action === 'cancel' ? 'cancel' : 'schedule';
    const staffCtx = staffCtxFor(profile);
    const recordForChange = {
      id: record.id as string,
      email: record.email,
      phone: record.phone,
      updated_at: record.updated_at,
      data: (record.data as Record<string, unknown> | null) ?? null,
      system: (record.system as Record<string, unknown> | null) ?? null,
    };

    if (action === 'cancel') {
      const result = await executeCancelScheduledMembershipChange({
        userSupabase: supabase,
        staffCtx,
        organizationId: profile.organization_id,
        record: recordForChange,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, action: 'cancel', data: result.data });
    }

    const type = typeof body.type === 'string' ? body.type : '';
    if (!isAutomatedMembershipChangeType(type)) {
      return NextResponse.json(
        { error: 'Only upgrades, downgrades, and lateral plan changes can be scheduled.' },
        { status: 400 },
      );
    }
    if (typeof body.effective_date !== 'string') {
      return NextResponse.json({ error: 'Effective date is required' }, { status: 400 });
    }
    if (!shouldAutomateMembershipChange(type, body.effective_date, localTodayIso())) {
      return NextResponse.json(
        { error: 'Scheduled plan changes must start on a future date.' },
        { status: 400 },
      );
    }

    const input: ScheduleMembershipChangeInput = {
      type,
      effective_date: body.effective_date,
      ...(typeof body.to_plan === 'string' && { to_plan: body.to_plan }),
      ...(typeof body.to_iua === 'string' && { to_iua: body.to_iua }),
      ...(typeof body.to_monthly === 'string' && { to_monthly: body.to_monthly }),
      ...(typeof body.from_plan === 'string' && { from_plan: body.from_plan }),
      ...(typeof body.from_iua === 'string' && { from_iua: body.from_iua }),
      ...(typeof body.from_monthly === 'string' && { from_monthly: body.from_monthly }),
      ...(typeof body.notes === 'string' && { notes: body.notes }),
      ...(typeof body.plan_id === 'string' && { plan_id: body.plan_id }),
      ...(typeof body.change_id === 'string' && { change_id: body.change_id }),
      ...(typeof body.follow_up_task_id === 'string' && {
        follow_up_task_id: body.follow_up_task_id,
      }),
    };

    const result = await executeScheduleMembershipChange({
      userSupabase: supabase,
      staffCtx,
      organizationId: profile.organization_id,
      profileId: profile.id,
      record: recordForChange,
      input,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.plans && { plans: result.plans }) },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      action: 'schedule',
      lane: result.lane,
      data: result.data,
      ...(result.warning && { warning: result.warning }),
      ...(result.mms_membership_id && { mms_membership_id: result.mms_membership_id }),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
