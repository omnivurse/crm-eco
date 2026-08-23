import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { logPHIAccess } from '@/lib/security';
import {
  coverageHasStarted,
  planReactivate,
} from '@/lib/crm/person-identity-lookup';
import { appendLifecycleTransition } from '@/lib/crm/person-lifecycle-ledger';

/**
 * POST /api/crm/records/[id]/reactivate
 *
 * History → Contacts (same UUID) or Members in place. Status Active, or
 * Pending when coverage has not started / the caller asks. Appends `returned`
 * when an open cancelled period exists. Members-source twins do not hop.
 * Fail closed: auth, role, org, historical status, History or Members door.
 * Does not wipe cancellation_date.
 */
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
    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let requestedStatus: string | null = null;
    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text) as { status?: unknown };
        requestedStatus = typeof body.status === 'string' ? body.status : null;
      }
    } catch {
      requestedStatus = null;
    }

    const supabase = await createClient();
    const { data: record, error: fetchError } = await supabase
      .from('crm_records')
      .select(
        'id, org_id, organization_id, module_id, status, system, data, deleted_at, cancellation_date, current_year_start_date, original_start_date, module:crm_modules!crm_records_module_id_fkey(key)',
      )
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const joined = record.module as { key?: string } | { key?: string }[] | null;
    const moduleKey = Array.isArray(joined) ? joined[0]?.key : joined?.key;
    const recordData =
      record.data && typeof record.data === 'object' && !Array.isArray(record.data)
        ? (record.data as Record<string, unknown>)
        : {};

    const { data: contactsModule } = await supabase
      .from('crm_modules')
      .select('id')
      .eq('org_id', profile.organization_id)
      .eq('key', 'contacts')
      .eq('is_enabled', true)
      .maybeSingle();

    const plan = planReactivate({
      moduleKey,
      contactsModuleId: contactsModule?.id ?? null,
      system: record.system,
      status: record.status,
      requestedStatus,
      coverageHasStarted: coverageHasStarted({
        current_year_start_date: record.current_year_start_date as string | null,
        original_start_date: record.original_start_date as string | null,
        data: recordData,
      }),
    });
    if (!plan.ok) {
      return NextResponse.json({ error: plan.error }, { status: plan.status });
    }

    const nextData = { ...recordData, contact_status: plan.nextStatus };

    const updates: Record<string, unknown> = {
      status: plan.nextStatus,
      data: nextData,
      updated_at: new Date().toISOString(),
    };
    if (plan.nextModuleId) {
      updates.module_id = plan.nextModuleId;
    }

    const { data: updated, error: updateError } = await supabase
      .from('crm_records')
      .update(updates)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .is('deleted_at', null)
      .select('id, module_id, status, cancellation_date')
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const toModule = plan.nextModuleId ? 'contacts' : moduleKey;
    const ledger = await appendLifecycleTransition({
      supabase,
      organizationId: (record.organization_id as string | null) ?? profile.organization_id,
      contactId: id,
      eventType: 'returned',
      createdBy: profile.id,
      source: 'reactivate',
      metadata: {
        from_module: moduleKey,
        to_module: toModule,
        previous_status: record.status,
        from_status: record.status,
      },
    });
    if (ledger.error) {
      console.error('[reactivate] lifecycle ledger write failed:', ledger.error);
    }

    try {
      await supabase.from('crm_audit_log').insert({
        org_id: profile.organization_id,
        actor_id: profile.id,
        action: 'update',
        entity: 'crm_records',
        entity_id: id,
        diff: {
          status: { from: record.status, to: plan.nextStatus },
          module: { from: moduleKey, to: toModule },
        },
        meta: { source: 'reactivate' },
      });
    } catch (err) {
      console.error('[reactivate] audit log failed:', err);
    }

    try {
      await logPHIAccess({
        userId: profile.id,
        organizationId: profile.organization_id,
        action: 'update',
        resourceType: 'record',
        resourceId: id,
        recordName: 'reactivate',
        metadata: { reactivated: true, from_module: moduleKey, to_module: toModule },
      });
    } catch (err) {
      console.error('PHI audit logging error (reactivate):', err);
    }

    return NextResponse.json({
      success: true,
      id: updated.id,
      status: updated.status,
      module_id: updated.module_id,
      cancellation_date: updated.cancellation_date ?? record.cancellation_date ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
