/**
 * PATCH /api/crm/records/[id]/status
 * Update a CRM record's status with audit logging.
 * Supports operational status overrides from CRM users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { applyStatusToRecordUpdates } from '@/lib/crm/status-sync';
import { isAllowedCrmStatus } from '@/lib/crm/status-allowlist';
import { assertCrmPendingHasStartDate } from '@/lib/crm/pending-start-date-invariant';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordId } = await params;
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { status, reason } = body as { status: string; reason?: string };

    if (!status || !isAllowedCrmStatus(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    const { data: record, error: fetchError } = await supabase
      .from('crm_records')
      .select(
        'id, org_id, status, title, module_id, data, original_start_date, current_year_start_date, crm_modules!inner(key)',
      )
      .eq('id', recordId)
      .eq('org_id', profile.organization_id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const previousStatus = record.status;
    const moduleKey = (record as { crm_modules?: { key?: string } }).crm_modules?.key;

    const pendingStart = assertCrmPendingHasStartDate(status, {
      current_year_start_date: record.current_year_start_date as string | null,
      original_start_date: record.original_start_date as string | null,
      data: (record.data || {}) as Record<string, unknown>,
    });
    if (!pendingStart.ok) {
      return NextResponse.json(
        { error: pendingStart.error, code: 'PENDING_REQUIRES_START_DATE' },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    applyStatusToRecordUpdates(
      updates,
      status,
      moduleKey,
      (record.data || {}) as Record<string, unknown>,
    );

    const { error: updateError } = await supabase
      .from('crm_records')
      .update(updates)
      .eq('id', recordId)
      .eq('org_id', profile.organization_id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    await supabase.from('unified_audit_logs').insert({
      organization_id: profile.organization_id,
      app_source: 'crm',
      actor_id: profile.id,
      actor_role: profile.crm_role,
      actor_email: profile.full_name || profile.id,
      target_entity_type: 'crm_record',
      target_entity_id: recordId,
      action: 'update_status',
      action_category: 'data_modification',
      risk_level: 'medium',
      details: {
        record_title: record.title,
        reason: reason || null,
        source: 'crm_manual_override',
      },
      changes: {
        status: { from: previousStatus, to: status },
      },
    });

    revalidatePath('/crm');
    revalidatePath(`/crm/r/${recordId}`);
    // Module list pages (RSC) — best-effort path refresh
    if (moduleKey) {
      revalidatePath(`/crm/modules/${moduleKey}`);
      revalidatePath(`/crm/${moduleKey}`);
    }

    return NextResponse.json({
      success: true,
      previous_status: previousStatus,
      new_status: status,
    });
  } catch (error) {
    console.error('[Status PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
