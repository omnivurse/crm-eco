/**
 * PATCH /api/crm/records/[id]/status
 * Update a CRM record's status with audit logging.
 * Supports operational status overrides from CRM users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = [
  'Active', 'Inactive', 'Pending', 'Cancelled', 'Terminated',
  'Converted', 'Deceased', 'Hold', 'Archived',
];

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

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch current record
    const { data: record, error: fetchError } = await supabase
      .from('crm_records')
      .select('id, org_id, status, title, module_id')
      .eq('id', recordId)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    if (record.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const previousStatus = record.status;

    // Update status
    const { error: updateError } = await supabase
      .from('crm_records')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    // Write audit log
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
