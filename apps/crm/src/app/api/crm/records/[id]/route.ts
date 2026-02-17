import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { executeMatchingWorkflows, applyScoring } from '@/lib/automation';
import { getModuleBlueprint } from '@/lib/blueprints';
import {
  getRecordPendingApproval,
  checkApprovalRequired,
  createApprovalRequest,
} from '@/lib/approvals';
import { logPHIAccess, identifyPHIFields } from '@/lib/security';
import type { CrmRecord } from '@/lib/crm/types';

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

    // Get the previous record state for change detection
    const { data: previousRecord } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!previousRecord) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.data !== undefined) updates.data = body.data;
    if (body.owner_id !== undefined) updates.owner_id = body.owner_id;
    if (body.status !== undefined) updates.status = body.status;
    if (body.title !== undefined) updates.title = body.title;

    // BLUEPRINT PROTECTION: Block direct stage changes when blueprint exists
    if (body.stage !== undefined && body.stage !== previousRecord.stage) {
      // Check if module has a blueprint
      const blueprint = await getModuleBlueprint(previousRecord.module_id);

      if (blueprint) {
        return NextResponse.json({
          error: 'Stage changes must go through the transition API when a blueprint is active',
          code: 'BLUEPRINT_STAGE_PROTECTION',
          hint: 'Use POST /api/crm/transition instead',
        }, { status: 400 });
      }

      // No blueprint - allow direct stage change
      updates.stage = body.stage;
    } else if (body.stage !== undefined) {
      // Same stage, just include it
      updates.stage = body.stage;
    }

    // APPROVAL PROTECTION: Block updates when pending approval exists
    const pendingApproval = await getRecordPendingApproval(id);
    if (pendingApproval && pendingApproval.context.action_type === 'stage_transition') {
      // Block stage-related changes while approval is pending
      if (body.stage !== undefined && body.stage !== previousRecord.stage) {
        return NextResponse.json({
          error: 'Cannot modify stage while an approval is pending',
          code: 'PENDING_APPROVAL',
          approvalId: pendingApproval.id,
        }, { status: 400 });
      }
    }

    const { data: record, error } = await supabase
      .from('crm_records')
      .update(updates)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedRecord = record as CrmRecord;

    // Execute on_update workflows (fire and forget for faster response)
    if (previousRecord) {
      executeMatchingWorkflows({
        orgId: typedRecord.org_id,
        moduleId: typedRecord.module_id,
        record: typedRecord,
        trigger: 'on_update',
        previousRecord: previousRecord as CrmRecord,
        dryRun: false,
        userId: profile.user_id,
        profileId: profile.id,
      }).catch(err => {
        console.error('Workflow execution error:', err);
      });
    }

    // Apply scoring rules
    applyScoring(typedRecord, {
      orgId: typedRecord.org_id,
      moduleId: typedRecord.module_id,
      record: typedRecord,
      trigger: 'on_update',
      dryRun: false,
    }).catch(err => {
      console.error('Scoring error:', err);
    });

    // Log PHI access for HIPAA compliance
    try {
      const phiFields = identifyPHIFields(typedRecord.data || {});
      if (phiFields.length > 0) {
        await logPHIAccess({
          userId: profile.id,
          organizationId: typedRecord.org_id,
          action: 'update',
          resourceType: 'record',
          resourceId: id,
          recordName: typedRecord.title || undefined,
          phiFieldsAccessed: phiFields,
          metadata: { module_id: typedRecord.module_id },
        });
      }
    } catch (err) {
      console.error('PHI audit logging error:', err);
    }

    return NextResponse.json(record);
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
        return NextResponse.json({
          success: false,
          requiresApproval: true,
          approvalId: result.approvalId,
          message: 'Deletion requires approval',
        }, { status: 202 });
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
