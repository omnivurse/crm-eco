import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  getRecordPendingApproval,
  checkApprovalRequired,
  createApprovalRequest,
} from '@/lib/approvals';
import { logPHIAccess } from '@/lib/security';
import { executeCrmRecordPatch } from '@/lib/crm/record-patch-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const result = await executeCrmRecordPatch({
      supabase,
      profile,
      id,
      body,
    });

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json(result.record);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the record to check approval rules
    const { data: record } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Check if deletion requires approval
    const ruleMatch = await checkApprovalRequired(
      profile.organization_id,
      record.module_id,
      'record_delete',
      { ...(record.data || {}), stage: record.stage }
    );

    if (ruleMatch) {
      // Create approval request instead of deleting
      const result = await createApprovalRequest({
        orgId: profile.organization_id,
        moduleId: record.module_id,
        recordId: id,
        processId: ruleMatch.processId,
        ruleId: ruleMatch.ruleId,
        triggerType: 'record_delete',
        actionPayload: {
          type: 'delete',
          record_id: id,
          module_id: record.module_id,
        },
        context: {
          action_type: 'record_delete',
          record_title: record.title,
        },
        requestedBy: profile.id,
        entitySnapshot: {
          id: record.id,
          title: record.title,
          stage: record.stage,
          data: record.data,
        },
      });

      if (result.success) {
        return NextResponse.json(
          {
            success: false,
            requiresApproval: true,
            approvalId: result.approvalId,
            message: 'Deletion requires approval',
          },
          { status: 202 }
        );
      }
    }

    const { error } = await supabase
      .from('crm_records')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log PHI access for deletion
    try {
      await logPHIAccess({
        userId: profile.id,
        organizationId: profile.organization_id,
        action: 'delete',
        resourceType: 'record',
        resourceId: id,
        recordName: record.title,
        metadata: { module_id: record.module_id },
      });
    } catch (err) {
      console.error('PHI audit logging error:', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
