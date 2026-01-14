import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfile, getRecordById } from '@/lib/crm/queries';
import { executeTransition, getModuleBlueprint, validateTransition } from '@/lib/blueprints';
import { validateStageTransition } from '@/lib/validation-rules';
import { executeMatchingWorkflows } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';
import type { RecordWithStage } from '@/lib/blueprints/types';

/**
 * POST /api/crm/stage-change
 * Change a record's stage with blueprint enforcement
 * Used for pipeline drag-drop and simple stage changes
 * 
 * For full transition control with payload, use /api/crm/blueprint-transition
 * 
 * Body: {
 *   recordId: string;
 *   newStage: string;
 *   reason?: string;
 *   payload?: Record<string, unknown>;  // Field values to update
 *   skipValidation?: boolean;  // For backward compatibility (admin only)
 * }
 * 
 * Returns:
 *   - On success: the updated record
 *   - On validation failure: { error, missingFields?, validationErrors?, requiresApproval? }
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
    const { recordId, newStage, reason, payload, skipValidation } = body;

    if (!recordId || !newStage) {
      return NextResponse.json(
        { error: 'recordId and newStage are required' },
        { status: 400 }
      );
    }

    // Get the record before the change to capture previous state
    const previousRecord = await getRecordById(recordId);
    if (!previousRecord) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
    
    const previousStage = previousRecord.stage;

    // Skip validation only for admins with explicit flag (backward compat)
    const shouldValidate = !skipValidation || profile.crm_role !== 'crm_admin';

    if (shouldValidate) {
      // Check blueprint for this module
      const blueprint = await getModuleBlueprint(previousRecord.module_id);

      if (blueprint) {
        // Validate blueprint transition
        const blueprintValidation = validateTransition(blueprint, previousRecord as unknown as RecordWithStage, newStage, {
          userRole: profile.crm_role ?? undefined,
          pendingUpdates: payload,
          reason,
        });

        if (!blueprintValidation.allowed) {
          return NextResponse.json({
            error: blueprintValidation.error || 'Transition not allowed',
            invalidTransition: true,
            gatingRequired: true,
          }, { status: 422 });
        }

        if (!blueprintValidation.valid) {
          return NextResponse.json({
            error: blueprintValidation.error || 'Transition blocked',
            missingFields: blueprintValidation.missingFields,
            requiresApproval: blueprintValidation.requiresApproval,
            requiresReason: blueprintValidation.requiresReason,
            gatingRequired: true,
          }, { status: 422 });
        }
      }

      // Run validation rules
      const validationResult = await validateStageTransition(
        previousRecord as unknown as Record<string, unknown>,
        newStage,
        {
          trigger: 'stage_change',
          from_stage: previousStage,
          to_stage: newStage,
          pending_updates: payload,
          profile_id: profile.id,
          user_id: profile.user_id,
        }
      );

      if (!validationResult.valid) {
        return NextResponse.json({
          error: 'Validation failed',
          validationErrors: validationResult.errors.map(e => ({
            field: e.field,
            message: e.message,
            rule_name: e.rule_name,
            rule_type: e.rule_type,
          })),
          gatingRequired: true,
        }, { status: 422 });
      }
    }

    // Execute the transition via blueprint engine
    // This handles stage history, actions, and audit logging
    const result = await executeTransition(
      { recordId, toStage: newStage, reason, payload },
      {
        profileId: profile.id,
        userId: profile.user_id,
        userRole: profile.crm_role,
      }
    );

    if (!result.success) {
      return NextResponse.json({
        error: result.error,
        missingFields: result.missingFields,
        requiresApproval: result.requiresApproval,
        approvalId: result.approvalId,
        invalidTransition: result.invalidTransition,
        gatingRequired: true,
      }, { status: 422 });
    }

    // Get the updated record
    const updatedRecord = await getRecordById(recordId);

    // Trigger on_stage_change workflows if stage actually changed
    if (previousStage !== newStage && updatedRecord) {
      try {
        // Execute matching workflows asynchronously (don't block response)
        executeMatchingWorkflows({
          orgId: updatedRecord.org_id,
          moduleId: updatedRecord.module_id,
          record: updatedRecord as CrmRecord,
          trigger: 'on_stage_change',
          previousRecord: previousRecord as CrmRecord | undefined,
          dryRun: false,
          profileId: profile.id,
        }).catch(err => {
          console.error('Error executing on_stage_change workflows:', err);
        });
      } catch (err) {
        // Don't fail the stage change if workflow execution fails
        console.error('Error triggering on_stage_change workflows:', err);
      }
    }

    return NextResponse.json(updatedRecord);
  } catch (error) {
    console.error('Error changing stage:', error);
    return NextResponse.json(
      { error: 'Failed to change stage' },
      { status: 500 }
    );
  }
}
