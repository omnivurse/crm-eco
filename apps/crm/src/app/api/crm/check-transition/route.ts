import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfile, getRecordById, getFieldsForModule } from '@/lib/crm/queries';
import { 
  getModuleBlueprint, 
  validateTransition, 
  getAvailableTransitions,
  getFieldRequirements,
} from '@/lib/blueprints';
import { getStageValidationRules, validateRecord } from '@/lib/validation-rules';
import type { AvailableTransition, FieldRequirement, RecordWithStage } from '@/lib/blueprints/types';

/**
 * POST /api/crm/check-transition
 * Pre-check a stage transition without executing it
 * Returns requirements, missing fields, and validation status
 * 
 * Body: {
 *   recordId: string;
 *   toStage?: string;  // If not provided, returns all available transitions
 *   payload?: Record<string, unknown>;  // Pending field values to consider
 * }
 * 
 * Returns: {
 *   allowed: boolean;
 *   valid: boolean;
 *   requiresApproval: boolean;
 *   requiresReason: boolean;
 *   missingFields: FieldRequirement[];
 *   validationErrors: Array<{ field, message, rule_name }>;
 *   availableTransitions?: AvailableTransition[];
 *   currentStage: string | null;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { recordId, toStage, payload } = body;

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId is required' },
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

    const currentStage = record.stage;

    // Get blueprint for module
    const blueprint = await getModuleBlueprint(record.module_id);
    
    // Get field definitions for requirement details
    const fields = await getFieldsForModule(record.module_id);
    const fieldDefs = fields.map(f => ({ key: f.key, label: f.label, type: f.type }));

    // If no toStage specified, return all available transitions
    if (!toStage) {
      const available: AvailableTransition[] = blueprint
        ? getAvailableTransitions(blueprint, currentStage, profile.crm_role ?? undefined)
        : [];

      // Get validation rules for stage_change trigger
      const rules = await getStageValidationRules(record.module_id, currentStage, '');

      return NextResponse.json({
        currentStage,
        availableTransitions: available,
        hasBlueprint: !!blueprint,
        validationRulesCount: rules.length,
      });
    }

    // Check specific transition
    if (!blueprint) {
      // No blueprint - just check validation rules
      const rules = await getStageValidationRules(record.module_id, currentStage, toStage);
      
      const effectiveRecord = {
        ...record,
        data: {
          ...(record.data as Record<string, unknown> || {}),
          ...(payload || {}),
        },
      } as Record<string, unknown>;

      const validationResult = await validateRecord(effectiveRecord, rules, {
        trigger: 'stage_change',
        from_stage: currentStage,
        to_stage: toStage,
        pending_updates: payload,
      });

      return NextResponse.json({
        allowed: true,
        valid: validationResult.valid,
        requiresApproval: false,
        requiresReason: false,
        missingFields: [],
        validationErrors: validationResult.errors.map(e => ({
          field: e.field,
          message: e.message,
          rule_name: e.rule_name,
          rule_type: e.rule_type,
        })),
        currentStage,
        hasBlueprint: false,
      });
    }

    // Validate against blueprint
    const validation = validateTransition(blueprint, record as unknown as RecordWithStage, toStage, {
      userRole: profile.crm_role ?? undefined,
      pendingUpdates: payload,
    });

    // Get field requirements with current values
    const requiredFields = validation.transition?.required_fields || [];
    const fieldRequirements = getFieldRequirements(
      record as unknown as RecordWithStage,
      requiredFields,
      fieldDefs
    );

    // Run validation rules
    const rules = await getStageValidationRules(record.module_id, currentStage, toStage);
    
    const effectiveRecord = {
      ...record,
      data: {
        ...(record.data as Record<string, unknown> || {}),
        ...(payload || {}),
      },
    } as Record<string, unknown>;

    const validationResult = await validateRecord(effectiveRecord, rules, {
      trigger: 'stage_change',
      from_stage: currentStage,
      to_stage: toStage,
      pending_updates: payload,
    });

    // Combine blueprint validation and rule validation
    const allValid = validation.valid && validationResult.valid;
    const missingFields = fieldRequirements.filter(f => !f.isFilled);

    return NextResponse.json({
      allowed: validation.allowed,
      valid: allValid,
      requiresApproval: validation.requiresApproval,
      requiresReason: validation.requiresReason,
      missingFields: missingFields,
      allRequiredFields: fieldRequirements,
      validationErrors: validationResult.errors.map(e => ({
        field: e.field,
        message: e.message,
        rule_name: e.rule_name,
        rule_type: e.rule_type,
      })),
      blueprintError: validation.error,
      currentStage,
      toStage,
      hasBlueprint: true,
      transition: validation.transition ? {
        from: validation.transition.from,
        to: validation.transition.to,
        requires_approval: validation.transition.requires_approval,
        require_reason: validation.transition.require_reason,
        required_fields: validation.transition.required_fields,
      } : null,
    });
  } catch (error) {
    console.error('Error checking transition:', error);
    return NextResponse.json(
      { error: 'Failed to check transition' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crm/check-transition?recordId=xxx&toStage=yyy
 * Same as POST but with query params
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const recordId = searchParams.get('recordId');
  const toStage = searchParams.get('toStage');

  if (!recordId) {
    return NextResponse.json(
      { error: 'recordId is required' },
      { status: 400 }
    );
  }

  // Create a mock request with the params as body
  const mockRequest = {
    json: async () => ({ recordId, toStage }),
  } as NextRequest;

  return POST(mockRequest);
}
