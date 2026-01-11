/**
 * CRM Blueprints - Transition Engine
 * Executes stage transitions with validation, approval checks, and actions
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateTransition, findTransition } from './validator';
import { executeActions } from '../automation/actions';
import type {
  CrmBlueprint,
  RecordWithStage,
  TransitionRequest,
  TransitionResult,
} from './types';
import type { CrmRecord } from '../crm/types';
import type { AutomationContext } from '../automation/types';

// ============================================================================
// Supabase Client
// ============================================================================

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context
          }
        },
      },
    }
  );
}

// ============================================================================
// Blueprint Loading
// ============================================================================

/**
 * Get blueprint for a module
 */
export async function getModuleBlueprint(moduleId: string): Promise<CrmBlueprint | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_blueprints')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_enabled', true)
    .eq('is_default', true)
    .single();
  
  return data as CrmBlueprint | null;
}

/**
 * Get blueprint by ID
 */
export async function getBlueprintById(blueprintId: string): Promise<CrmBlueprint | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_blueprints')
    .select('*')
    .eq('id', blueprintId)
    .single();
  
  return data as CrmBlueprint | null;
}

// ============================================================================
// Record Loading
// ============================================================================

async function getRecord(recordId: string): Promise<RecordWithStage | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .single();
  
  return data as RecordWithStage | null;
}

// ============================================================================
// Stage History
// ============================================================================

async function createStageHistory(
  orgId: string,
  recordId: string,
  blueprintId: string | null,
  fromStage: string | null,
  toStage: string,
  options: {
    reason?: string;
    transitionData?: Record<string, unknown>;
    changedBy?: string;
    approvalId?: string;
  }
): Promise<void> {
  const supabase = await createClient();
  
  await supabase.from('crm_stage_history').insert({
    org_id: orgId,
    record_id: recordId,
    blueprint_id: blueprintId,
    from_stage: fromStage,
    to_stage: toStage,
    reason: options.reason,
    transition_data: options.transitionData || {},
    changed_by: options.changedBy,
    approval_id: options.approvalId,
  });
}

// ============================================================================
// Create Approval Request
// ============================================================================

async function createApprovalRequest(
  orgId: string,
  recordId: string,
  blueprintId: string,
  transition: { from: string | null; to: string },
  approvalProcessId: string,
  requestedBy: string
): Promise<string> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('crm_approvals')
    .insert({
      org_id: orgId,
      process_id: approvalProcessId,
      record_id: recordId,
      status: 'pending',
      current_step: 0,
      context: {
        action_type: 'stage_transition',
        blueprint_id: blueprintId,
        from_stage: transition.from,
        to_stage: transition.to,
      },
      requested_by: requestedBy,
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

// ============================================================================
// Find Approval Process for Transition
// ============================================================================

async function findApprovalProcess(
  orgId: string,
  moduleId: string,
  fromStage: string | null,
  toStage: string
): Promise<string | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_approval_processes')
    .select('id, trigger_config')
    .eq('org_id', orgId)
    .eq('module_id', moduleId)
    .eq('trigger_type', 'stage_transition')
    .eq('is_enabled', true);
  
  if (!data) return null;
  
  // Find matching process
  for (const process of data) {
    const config = process.trigger_config as { stage_from?: string; stage_to?: string };
    
    // Check if this process matches the transition
    const fromMatches = !config.stage_from || config.stage_from === '*' || config.stage_from === fromStage;
    const toMatches = !config.stage_to || config.stage_to === '*' || config.stage_to === toStage;
    
    if (fromMatches && toMatches) {
      return process.id;
    }
  }
  
  return null;
}

// ============================================================================
// Execute Transition Actions
// ============================================================================

async function executeTransitionActions(
  record: CrmRecord,
  transition: { actions: Array<{ id: string; type: string; config: unknown; order: number }> },
  context: AutomationContext
): Promise<void> {
  if (!transition.actions || transition.actions.length === 0) {
    return;
  }
  
  try {
    await executeActions(transition.actions, record, context);
  } catch (error) {
    console.error('Error executing transition actions:', error);
    // Don't fail the transition if actions fail
  }
}

// ============================================================================
// Main Transition Function
// ============================================================================

/**
 * Execute a stage transition
 */
export async function executeTransition(
  request: TransitionRequest,
  options: {
    profileId?: string;
    userId?: string;
    userRole?: string;
  }
): Promise<TransitionResult> {
  const { recordId, toStage, reason, payload } = request;
  
  // 1. Load record
  const record = await getRecord(recordId);
  if (!record) {
    return {
      success: false,
      error: 'Record not found',
    };
  }
  
  // 2. Load blueprint
  const blueprint = await getModuleBlueprint(record.module_id);
  if (!blueprint) {
    // No blueprint - allow direct stage change
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('crm_records')
      .update({ stage: toStage })
      .eq('id', recordId);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return {
      success: true,
      record: { id: recordId, stage: toStage },
    };
  }
  
  // 3. Validate transition
  const validation = validateTransition(blueprint, record, toStage, {
    userRole: options.userRole,
    pendingUpdates: payload,
    reason,
  });
  
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      missingFields: validation.missingFields,
      invalidTransition: !validation.allowed,
    };
  }
  
  const transition = validation.transition!;
  const fromStage = record.stage;
  
  // 4. Check if approval is required
  let requiresApproval = transition.requires_approval || false;
  let approvalProcessId = transition.approval_process_id;
  
  // Also check for approval processes defined separately
  if (!requiresApproval) {
    approvalProcessId = await findApprovalProcess(
      record.org_id,
      record.module_id,
      fromStage,
      toStage
    );
    requiresApproval = !!approvalProcessId;
  }
  
  if (requiresApproval && approvalProcessId) {
    // Create approval request instead of transitioning
    const approvalId = await createApprovalRequest(
      record.org_id,
      recordId,
      blueprint.id,
      { from: fromStage, to: toStage },
      approvalProcessId,
      options.profileId || ''
    );
    
    return {
      success: true,
      requiresApproval: true,
      approvalId,
    };
  }
  
  // 5. Apply updates and stage change
  const supabase = await createClient();
  
  const updateData: Record<string, unknown> = {
    stage: toStage,
    updated_at: new Date().toISOString(),
  };
  
  // Merge payload into data
  if (payload && Object.keys(payload).length > 0) {
    const currentData = record.data || {};
    updateData.data = { ...currentData, ...payload };
  }
  
  const { error } = await supabase
    .from('crm_records')
    .update(updateData)
    .eq('id', recordId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // 6. Record stage history
  await createStageHistory(
    record.org_id,
    recordId,
    blueprint.id,
    fromStage,
    toStage,
    {
      reason,
      transitionData: payload,
      changedBy: options.profileId,
    }
  );
  
  // 7. Execute transition actions
  const updatedRecord = {
    ...record,
    stage: toStage,
    data: { ...record.data, ...payload },
  } as CrmRecord;
  
  const automationContext: AutomationContext = {
    orgId: record.org_id,
    moduleId: record.module_id,
    record: updatedRecord,
    previousRecord: record as unknown as CrmRecord,
    trigger: 'on_update',
    dryRun: false,
    userId: options.userId,
    profileId: options.profileId,
  };
  
  await executeTransitionActions(updatedRecord, transition, automationContext);
  
  // 8. Log to automation runs
  await supabase.from('crm_automation_runs').insert({
    org_id: record.org_id,
    source: 'blueprint',
    trigger: 'stage_transition',
    module_id: record.module_id,
    record_id: recordId,
    status: 'success',
    input: {
      from_stage: fromStage,
      to_stage: toStage,
      reason,
    },
    output: {
      actions_count: transition.actions?.length || 0,
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
  
  return {
    success: true,
    record: { id: recordId, stage: toStage },
  };
}

/**
 * Execute a transition after approval
 */
export async function executeApprovedTransition(
  approvalId: string,
  options: { profileId?: string; userId?: string }
): Promise<TransitionResult> {
  const supabase = await createClient();
  
  // Get approval details
  const { data: approval } = await supabase
    .from('crm_approvals')
    .select('*')
    .eq('id', approvalId)
    .single();
  
  if (!approval) {
    return { success: false, error: 'Approval not found' };
  }
  
  if (approval.status !== 'approved') {
    return { success: false, error: 'Approval is not approved' };
  }
  
  const context = approval.context as {
    action_type: string;
    blueprint_id: string;
    from_stage: string | null;
    to_stage: string;
  };
  
  if (context.action_type !== 'stage_transition') {
    return { success: false, error: 'Invalid approval type' };
  }
  
  // Execute the transition (without approval check this time)
  const record = await getRecord(approval.record_id);
  if (!record) {
    return { success: false, error: 'Record not found' };
  }
  
  const blueprint = await getBlueprintById(context.blueprint_id);
  const transition = blueprint 
    ? findTransition(blueprint, context.from_stage, context.to_stage)
    : null;
  
  // Update record stage
  const { error } = await supabase
    .from('crm_records')
    .update({ stage: context.to_stage })
    .eq('id', approval.record_id);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Record stage history with approval reference
  await createStageHistory(
    record.org_id,
    approval.record_id,
    context.blueprint_id,
    context.from_stage,
    context.to_stage,
    {
      changedBy: options.profileId,
      approvalId,
    }
  );
  
  // Execute transition actions if any
  if (transition && blueprint) {
    const updatedRecord = {
      ...record,
      stage: context.to_stage,
    } as CrmRecord;
    
    const automationContext: AutomationContext = {
      orgId: record.org_id,
      moduleId: record.module_id,
      record: updatedRecord,
      previousRecord: record as unknown as CrmRecord,
      trigger: 'on_update',
      dryRun: false,
      userId: options.userId,
      profileId: options.profileId,
    };
    
    await executeTransitionActions(updatedRecord, transition, automationContext);
  }
  
  return {
    success: true,
    record: { id: approval.record_id, stage: context.to_stage },
  };
}
