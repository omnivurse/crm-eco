/**
 * PATCH /api/crm/records/[id]/status
 * Update a CRM record's status with audit logging.
 * Supports operational status overrides from CRM users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = [
  // Core operational
  'Active', 'Active HS Member', 'Active Member', 'Active Insurance Client',
  'Active DPC', 'Active ADVISOR',
  'Inactive', 'In-Active', 'Pending', 'Cancelled', 'Cancellation Pending',
  'Terminated', 'Converted', 'Deceased', 'Hold', 'Archived', 'Suspended',
  // Enrollment
  'Enrolled - 2016', 'Enrolled - 2017', 'Enrolled - 2018', 'Enrolled - 2019',
  'Enrolled - 2020', 'Enrolled 2020', 'Enrolled - 2021', 'Enrolled - 2022', 'Enrolled - 2023',
  'Enrolled - 2024', 'Enrolled - 2025', 'Enrolled - 2026',
  'Enrolled Member', 'Enrolled-2016',
  // Pipeline
  'Approved Pending', 'Application in Process', 'Application In Process',
  'In process', 'In Process', 'Contacted', 'Not Contacted',
  'Attempted Contact One', 'Attempted Contact Two',
  'Attempted Contact Three', 'Attempted Contact Four', 'Attempted to Contact',
  // Prospects
  'Hot Prospect - ready to move', 'Warm Prospect - Maybe', 'Warm - Future Prospect',
  'Cold Prospect - Released', 'Future Prospect', 'DPC Prospect',
  'Agent - Prospect', 'Agent- PROSPECT', 'Employee Prospect',
  // Outcomes
  'Lost Opportunity', 'Dropout', 'Released', 'Not Qualified', 'Junk Lead',
  'Ready to Convert', 'Closed - New Member',
  'Decision Making Stage', 'Full Presentation Given - Decision Mode',
  'Full Presentation Completed', 'Product Selection', 'Qualification',
  // Special
  'Group Policy', 'Non Client', 'PERSONAL', 'Complimentary', 'LIVE',
  'Agency- SUPPORT', 'Agent- SPONSOR', 'Agent- SPONSOR- InActive',
  'Cancelled - In New CRM', 'Cancelled Application',
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

    // Fetch current record with module key so we know which JSONB status field to sync
    const { data: record, error: fetchError } = await supabase
      .from('crm_records')
      .select('id, org_id, status, title, module_id, data, crm_modules!inner(key)')
      .eq('id', recordId)
      .eq('org_id', profile.organization_id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const previousStatus = record.status;
    const moduleKey = (record as any).crm_modules?.key as string | undefined;

    // Sync both the row-level status column AND the JSONB status field
    const currentData = (record.data || {}) as Record<string, unknown>;
    const statusFieldKey = moduleKey === 'leads' ? 'lead_status' : 'contact_status';
    const updatedData = { ...currentData, [statusFieldKey]: status };

    const { error: updateError } = await supabase
      .from('crm_records')
      .update({
        status,
        data: updatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordId)
      .eq('org_id', profile.organization_id);

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

    revalidatePath('/crm');
    revalidatePath(`/crm/r/${recordId}`);

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
