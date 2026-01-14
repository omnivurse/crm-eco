import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfile, getRecordById } from '@/lib/crm/queries';
import { executeTransition, getModuleBlueprint, validateTransition } from '@/lib/blueprints';
import { validateStageTransition } from '@/lib/validation-rules';
import { executeMatchingWorkflows } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';
import type { RecordWithStage } from '@/lib/blueprints/types';

/**
 * POST /api/crm/blueprint-transition
 * Execute a stage transition with full blueprint validation and gating
 * 
 * Body: {
 *   recordId: string;
 *   toStage: string;
 *   reason?: string;
 *   payload?: Record<string, unknown>;  // Field values to update during transition
 * }
 * 
 * Returns: {
 *   success: boolean;
 *   requiresApproval?: boolean;
 *   approvalId?: string;
 *   missingFields?: string[];
 *   validationErrors?: Array<{ field, message, rule_name }>;
 *   error?: string;
 *   record?: { id, stage };
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for appropriate role
    if (!profile.crm_role || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { recordId, toStage, reason, payload } = body;

    if (!recordId || !toStage) {
      return NextResponse.json(
        { error: 'recordId and toStage are required' },
        { status: 400 }
      );
    }

    // Get the current record
    const record = await getRecordById(recordId);
    if (!record) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    const previousStage = record.stage;

    // Check if blueprint exists for this module
    const blueprint = await getModuleBlueprint(record.module_id);

    if (blueprint) {
      // 1. Validate blueprint transition
      const blueprintValidation = validateTransition(blueprint, record as unknown as RecordWithStage, toStage, {
        userRole: profile.crm_role,
        pendingUpdates: payload,
        reason,
      });

      if (!blueprintValidation.allowed) {
        return NextResponse.json({
          success: false,
          error: blueprintValidation.error || 'Transition not allowed',
          invalidTransition: true,
        }, { status: 422 });
      }

      if (!blueprintValidation.valid) {
        return NextResponse.json({
          success: false,
          error: blueprintValidation.error || 'Transition blocked',
          missingFields: blueprintValidation.missingFields,
          requiresApproval: blueprintValidation.requiresApproval,
          requiresReason: blueprintValidation.requiresReason,
        }, { status: 422 });
      }

      // 2. Run validation rules
      const validationResult = await validateStageTransition(
        record as unknown as Record<string, unknown>,
        toStage,
        {
          trigger: 'stage_change',
          from_stage: previousStage,
          to_stage: toStage,
          pending_updates: payload,
          profile_id: profile.id,
          user_id: profile.user_id,
        }
      );

      if (!validationResult.valid) {
        return NextResponse.json({
          success: false,
          error: 'Validation failed',
          validationErrors: validationResult.errors.map(e => ({
            field: e.field,
            message: e.message,
            rule_name: e.rule_name,
            rule_type: e.rule_type,
          })),
        }, { status: 422 });
      }

      // 3. Execute transition via blueprint engine
      const result = await executeTransition(
        { recordId, toStage, reason, payload },
        {
          profileId: profile.id,
          userId: profile.user_id,
          userRole: profile.crm_role,
        }
      );

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error,
          missingFields: result.missingFields,
          requiresApproval: result.requiresApproval,
          approvalId: result.approvalId,
          invalidTransition: result.invalidTransition,
        }, { status: 422 });
      }

      // 4. Trigger on_stage_change workflows
      if (previousStage !== toStage && result.record) {
        try {
          const updatedRecord = await getRecordById(recordId);
          if (updatedRecord) {
            executeMatchingWorkflows({
              orgId: updatedRecord.org_id,
              moduleId: updatedRecord.module_id,
              record: updatedRecord as CrmRecord,
              trigger: 'on_stage_change',
              previousRecord: record as CrmRecord,
              dryRun: false,
              profileId: profile.id,
            }).catch(err => {
              console.error('Error executing on_stage_change workflows:', err);
            });
          }
        } catch (err) {
          console.error('Error triggering workflows:', err);
        }
      }

      return NextResponse.json({
        success: true,
        requiresApproval: result.requiresApproval,
        approvalId: result.approvalId,
        record: result.record,
      });
    }

    // No blueprint - still run validation rules
    const validationResult = await validateStageTransition(
      record as unknown as Record<string, unknown>,
      toStage,
      {
        trigger: 'stage_change',
        from_stage: previousStage,
        to_stage: toStage,
        pending_updates: payload,
        profile_id: profile.id,
        user_id: profile.user_id,
      }
    );

    if (!validationResult.valid) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        validationErrors: validationResult.errors.map(e => ({
          field: e.field,
          message: e.message,
          rule_name: e.rule_name,
          rule_type: e.rule_type,
        })),
      }, { status: 422 });
    }

    // Execute simple transition via blueprint engine (handles history logging)
    const result = await executeTransition(
      { recordId, toStage, reason, payload },
      {
        profileId: profile.id,
        userId: profile.user_id,
        userRole: profile.crm_role,
      }
    );

    // Trigger workflows
    if (previousStage !== toStage && result.success) {
      try {
        const updatedRecord = await getRecordById(recordId);
        if (updatedRecord) {
          executeMatchingWorkflows({
            orgId: updatedRecord.org_id,
            moduleId: updatedRecord.module_id,
            record: updatedRecord as CrmRecord,
            trigger: 'on_stage_change',
            previousRecord: record as CrmRecord,
            dryRun: false,
            profileId: profile.id,
          }).catch(err => {
            console.error('Error executing on_stage_change workflows:', err);
          });
        }
      } catch (err) {
        console.error('Error triggering workflows:', err);
      }
    }

    return NextResponse.json({
      success: result.success,
      error: result.error,
      record: result.record,
    });
  } catch (error) {
    console.error('Error in blueprint transition:', error);
    return NextResponse.json(
      { error: 'Failed to execute transition' },
      { status: 500 }
    );
  }
}
