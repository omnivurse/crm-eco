/**
 * CRM Approvals - Engine
 * Handles approval creation, actions, and resolution
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { executeApprovedTransition } from '../blueprints';
import type {
  CrmApproval,
  CrmApprovalProcess,
  CrmApprovalAction,
  ApprovalStep,
  ApprovalActionRequest,
  ApprovalActionResult,
  ApprovalStatus,
  PendingApproval,
  ResolvedApprover,
} from './types';
import { isUserApprover } from './types';

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
// Get Approval Process
// ============================================================================

export async function getApprovalProcess(processId: string): Promise<CrmApprovalProcess | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_approval_processes')
    .select('*')
    .eq('id', processId)
    .single();
  
  return data as CrmApprovalProcess | null;
}

// ============================================================================
// Get Approval
// ============================================================================

export async function getApproval(approvalId: string): Promise<CrmApproval | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_approvals')
    .select('*')
    .eq('id', approvalId)
    .single();
  
  return data as CrmApproval | null;
}

// ============================================================================
// Get Pending Approvals for User
// ============================================================================

export async function getPendingApprovalsForUser(
  profileId: string,
  userRole: string | null
): Promise<PendingApproval[]> {
  const supabase = await createClient();
  
  // Get all pending approvals
  const { data: approvals } = await supabase
    .from('crm_approvals')
    .select(`
      *,
      process:crm_approval_processes!inner(name, steps),
      record:crm_records!inner(title, module_id),
      requester:profiles!crm_approvals_requested_by_fkey(full_name)
    `)
    .eq('status', 'pending');
  
  if (!approvals) return [];
  
  const pending: PendingApproval[] = [];
  
  for (const approval of approvals) {
    const process = approval.process as CrmApprovalProcess;
    const steps = process.steps as ApprovalStep[];
    const currentStep = steps[approval.current_step];
    
    if (!currentStep) continue;
    
    // Check if user is approver for current step
    const record = approval.record as { title: string; module_id: string; owner_id?: string };
    const isApprover = isUserApprover(currentStep, profileId, userRole, record.owner_id || null);
    
    if (isApprover) {
      // Get module name
      const { data: module } = await supabase
        .from('crm_modules')
        .select('name')
        .eq('id', record.module_id)
        .single();
      
      pending.push({
        id: approval.id,
        process_name: process.name,
        record_id: approval.record_id,
        record_title: record.title,
        module_name: module?.name || 'Unknown',
        context: approval.context,
        current_step: approval.current_step,
        total_steps: steps.length,
        requested_by_name: (approval.requester as { full_name: string })?.full_name || null,
        created_at: approval.created_at,
      });
    }
  }
  
  return pending;
}

// ============================================================================
// Get Approval History
// ============================================================================

export async function getApprovalHistory(approvalId: string): Promise<CrmApprovalAction[]> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_approval_actions')
    .select(`
      *,
      actor:profiles!crm_approval_actions_actor_id_fkey(full_name, email)
    `)
    .eq('approval_id', approvalId)
    .order('created_at', { ascending: true });
  
  return (data || []) as CrmApprovalAction[];
}

// ============================================================================
// Validate User is Approver
// ============================================================================

export async function validateApprover(
  approvalId: string,
  profileId: string,
  userRole: string | null
): Promise<{ valid: boolean; approval?: CrmApproval; process?: CrmApprovalProcess; error?: string }> {
  const approval = await getApproval(approvalId);
  
  if (!approval) {
    return { valid: false, error: 'Approval not found' };
  }
  
  if (approval.status !== 'pending') {
    return { valid: false, error: 'Approval is not pending', approval };
  }
  
  const process = await getApprovalProcess(approval.process_id);
  
  if (!process) {
    return { valid: false, error: 'Approval process not found', approval };
  }
  
  const currentStep = process.steps[approval.current_step];
  
  if (!currentStep) {
    return { valid: false, error: 'Invalid approval step', approval, process };
  }
  
  // Get record to check owner
  const supabase = await createClient();
  const { data: record } = await supabase
    .from('crm_records')
    .select('owner_id')
    .eq('id', approval.record_id)
    .single();
  
  const isApprover = isUserApprover(currentStep, profileId, userRole, record?.owner_id || null);
  
  if (!isApprover) {
    return { valid: false, error: 'You are not an approver for this step', approval, process };
  }
  
  return { valid: true, approval, process };
}

// ============================================================================
// Create Notification
// ============================================================================

async function createNotification(
  orgId: string,
  userId: string,
  title: string,
  body: string,
  href?: string
): Promise<void> {
  const supabase = await createClient();
  
  await supabase.from('crm_notifications').insert({
    org_id: orgId,
    user_id: userId,
    title,
    body,
    href,
    icon: 'clipboard-check',
  });
}

// ============================================================================
// Notify Approvers
// ============================================================================

async function notifyApprovers(
  approval: CrmApproval,
  process: CrmApprovalProcess,
  stepIndex: number
): Promise<void> {
  const step = process.steps[stepIndex];
  if (!step) return;
  
  const supabase = await createClient();
  
  // Get record info for notification
  const { data: record } = await supabase
    .from('crm_records')
    .select('title, owner_id')
    .eq('id', approval.record_id)
    .single();
  
  let approverProfileIds: string[] = [];
  
  if (step.type === 'user') {
    approverProfileIds = [step.value];
  } else if (step.type === 'role') {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', approval.org_id)
      .eq('crm_role', step.value);
    
    approverProfileIds = (profiles || []).map(p => p.id);
  } else if (step.type === 'record_owner' && record?.owner_id) {
    approverProfileIds = [record.owner_id];
  }
  
  // Create notifications
  for (const profileId of approverProfileIds) {
    // Get user_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', profileId)
      .single();
    
    if (profile?.user_id) {
      await createNotification(
        approval.org_id,
        profile.user_id,
        'New Approval Request',
        `${record?.title || 'A record'} requires your approval`,
        `/crm/r/${approval.record_id}`
      );
    }
  }
}

// ============================================================================
// Execute Approval Action
// ============================================================================

export async function executeApprovalAction(
  request: ApprovalActionRequest,
  options: { profileId: string; userId: string; userRole: string | null }
): Promise<ApprovalActionResult> {
  const { approvalId, action, comment } = request;
  
  // Validate approver
  const validation = await validateApprover(approvalId, options.profileId, options.userRole);
  
  if (!validation.valid) {
    return {
      success: false,
      approvalId,
      newStatus: 'pending',
      error: validation.error,
    };
  }
  
  const approval = validation.approval!;
  const process = validation.process!;
  const currentStep = process.steps[approval.current_step];
  
  // Check if comment is required
  if (currentStep.require_comment && !comment) {
    return {
      success: false,
      approvalId,
      newStatus: 'pending',
      error: 'A comment is required for this approval',
    };
  }
  
  const supabase = await createClient();
  
  // Record the action
  await supabase.from('crm_approval_actions').insert({
    org_id: approval.org_id,
    approval_id: approvalId,
    step_index: approval.current_step,
    actor_id: options.profileId,
    action,
    comment,
  });
  
  let newStatus: ApprovalStatus = 'pending';
  let actionExecuted = false;
  
  if (action === 'approve') {
    // Check if there are more steps
    if (approval.current_step < process.steps.length - 1) {
      // Advance to next step
      await supabase
        .from('crm_approvals')
        .update({
          current_step: approval.current_step + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId);
      
      // Notify next approvers
      await notifyApprovers(approval, process, approval.current_step + 1);
      
      newStatus = 'pending';
    } else {
      // Final approval
      await supabase
        .from('crm_approvals')
        .update({
          status: 'approved',
          resolved_by: options.profileId,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId);
      
      newStatus = 'approved';
      
      // Execute the blocked action
      if (approval.context.action_type === 'stage_transition') {
        const result = await executeApprovedTransition(approvalId, {
          profileId: options.profileId,
          userId: options.userId,
        });
        actionExecuted = result.success;
      }
      
      // Notify requester
      if (approval.requested_by) {
        const { data: requesterProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', approval.requested_by)
          .single();
        
        if (requesterProfile?.user_id) {
          await createNotification(
            approval.org_id,
            requesterProfile.user_id,
            'Approval Granted',
            'Your request has been approved',
            `/crm/r/${approval.record_id}`
          );
        }
      }
    }
  } else if (action === 'reject') {
    await supabase
      .from('crm_approvals')
      .update({
        status: 'rejected',
        resolved_by: options.profileId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', approvalId);
    
    newStatus = 'rejected';
    
    // Notify requester
    if (approval.requested_by) {
      const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', approval.requested_by)
        .single();
      
      if (requesterProfile?.user_id) {
        await createNotification(
          approval.org_id,
          requesterProfile.user_id,
          'Approval Rejected',
          comment ? `Your request was rejected: ${comment}` : 'Your request has been rejected',
          `/crm/r/${approval.record_id}`
        );
      }
    }
  } else if (action === 'request_changes') {
    await supabase
      .from('crm_approvals')
      .update({
        status: 'changes_requested',
        updated_at: new Date().toISOString(),
      })
      .eq('id', approvalId);
    
    newStatus = 'changes_requested';
    
    // Notify requester
    if (approval.requested_by) {
      const { data: requesterProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', approval.requested_by)
        .single();
      
      if (requesterProfile?.user_id) {
        await createNotification(
          approval.org_id,
          requesterProfile.user_id,
          'Changes Requested',
          comment ? `Changes requested: ${comment}` : 'Changes have been requested for your approval',
          `/crm/r/${approval.record_id}`
        );
      }
    }
  }
  
  // Log to audit
  await supabase.from('crm_audit_log').insert({
    org_id: approval.org_id,
    actor_id: options.profileId,
    action: 'approval_action',
    entity: 'crm_approvals',
    entity_id: approvalId,
    diff: {
      action,
      comment,
      new_status: newStatus,
    },
  });
  
  return {
    success: true,
    approvalId,
    newStatus,
    actionExecuted,
  };
}

// ============================================================================
// Get Pending Approval for Record
// ============================================================================

export async function getRecordPendingApproval(recordId: string): Promise<CrmApproval | null> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_approvals')
    .select('*')
    .eq('record_id', recordId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  return data as CrmApproval | null;
}

// ============================================================================
// Cancel Approval
// ============================================================================

export async function cancelApproval(
  approvalId: string,
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const approval = await getApproval(approvalId);
  
  if (!approval) {
    return { success: false, error: 'Approval not found' };
  }
  
  if (approval.status !== 'pending') {
    return { success: false, error: 'Only pending approvals can be cancelled' };
  }
  
  // Only requester or admin can cancel
  const { data: profile } = await supabase
    .from('profiles')
    .select('crm_role')
    .eq('id', profileId)
    .single();
  
  if (approval.requested_by !== profileId && profile?.crm_role !== 'crm_admin') {
    return { success: false, error: 'Only the requester or admin can cancel this approval' };
  }
  
  await supabase
    .from('crm_approvals')
    .update({
      status: 'cancelled',
      resolved_by: profileId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', approvalId);
  
  return { success: true };
}

// ============================================================================
// W4: Create Approval Request
// ============================================================================

import type {
  CreateApprovalRequestInput,
  CreateApprovalRequestResult,
  ApplyApprovedActionInput,
  ApplyApprovedActionResult,
  ApprovalActionPayload,
  ApprovalInboxItem,
  ApprovalInboxFilters,
  ApprovalDetailData,
  CrmApprovalDecision,
} from './types';

/**
 * Generate a unique idempotency key for an approval request
 */
function generateIdempotencyKey(
  recordId: string,
  actionType: string,
  actionData?: Record<string, unknown>
): string {
  const timestamp = Date.now();
  const dataHash = actionData ? JSON.stringify(actionData).substring(0, 50) : '';
  return `${recordId}:${actionType}:${timestamp}:${dataHash}`;
}

/**
 * Create a new approval request
 */
export async function createApprovalRequest(
  input: CreateApprovalRequestInput
): Promise<CreateApprovalRequestResult> {
  const supabase = await createClient();
  
  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(
    input.recordId,
    input.actionPayload.type,
    input.actionPayload.data
  );
  
  // Get record data for snapshot
  let entitySnapshot = input.entitySnapshot;
  if (!entitySnapshot) {
    const { data: record } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', input.recordId)
      .single();
    
    if (record) {
      entitySnapshot = {
        id: record.id,
        title: record.title,
        stage: record.stage,
        data: record.data,
        owner_id: record.owner_id,
      };
    }
  }
  
  // Create the approval request
  const { data: approval, error } = await supabase
    .from('crm_approvals')
    .insert({
      org_id: input.orgId,
      process_id: input.processId,
      record_id: input.recordId,
      status: 'pending',
      current_step: 0,
      context: input.context,
      action_payload: input.actionPayload,
      entity_snapshot: entitySnapshot,
      idempotency_key: idempotencyKey,
      rule_id: input.ruleId || null,
      requested_by: input.requestedBy,
    })
    .select('id')
    .single();
  
  if (error) {
    // Check for duplicate idempotency key
    if (error.code === '23505') {
      return { success: false, error: 'An approval request already exists for this action' };
    }
    return { success: false, error: error.message };
  }
  
  // Get the process to notify approvers
  const process = await getApprovalProcess(input.processId);
  if (process) {
    await notifyApprovers(
      { ...approval, org_id: input.orgId, record_id: input.recordId } as CrmApproval,
      process,
      0
    );
  }
  
  // Log to audit
  await supabase.from('crm_audit_log').insert({
    org_id: input.orgId,
    actor_id: input.requestedBy,
    action: 'approval_request',
    entity: 'crm_approvals',
    entity_id: approval.id,
    diff: {
      trigger_type: input.triggerType,
      action_type: input.actionPayload.type,
      process_id: input.processId,
      rule_id: input.ruleId,
    },
  });
  
  return { success: true, approvalId: approval.id };
}

// ============================================================================
// W4: Apply Approved Action
// ============================================================================

/**
 * Apply an approved action (idempotent)
 */
export async function applyApprovedAction(
  input: ApplyApprovedActionInput
): Promise<ApplyApprovedActionResult> {
  const supabase = await createClient();
  
  // Get the approval with its payload
  const { data: approval } = await supabase
    .from('crm_approvals')
    .select('*')
    .eq('id', input.approvalId)
    .single();
  
  if (!approval) {
    return { success: false, applied: false, error: 'Approval not found' };
  }
  
  if (approval.status !== 'approved') {
    return { success: false, applied: false, error: 'Approval is not approved' };
  }
  
  // Check if already applied (idempotent)
  if (approval.applied_at) {
    return { success: true, applied: false }; // Already applied, not an error
  }
  
  const payload = approval.action_payload as ApprovalActionPayload;
  
  if (!payload) {
    return { success: false, applied: false, error: 'No action payload found' };
  }
  
  try {
    // Execute the action based on type
    switch (payload.type) {
      case 'stage_change': {
        // Use the existing blueprint transition
        const result = await executeApprovedTransition(input.approvalId, {
          profileId: input.profileId,
          userId: input.userId,
        });
        
        if (!result.success) {
          return { success: false, applied: false, error: result.error };
        }
        break;
      }
      
      case 'update': {
        // Apply field updates
        if (payload.data) {
          const { data: record } = await supabase
            .from('crm_records')
            .select('data')
            .eq('id', payload.record_id)
            .single();
          
          const { error } = await supabase
            .from('crm_records')
            .update({
              data: { ...(record?.data || {}), ...payload.data },
              updated_at: new Date().toISOString(),
            })
            .eq('id', payload.record_id);
          
          if (error) {
            return { success: false, applied: false, error: error.message };
          }
        }
        break;
      }
      
      case 'delete': {
        // Delete the record
        const { error } = await supabase
          .from('crm_records')
          .delete()
          .eq('id', payload.record_id);
        
        if (error) {
          return { success: false, applied: false, error: error.message };
        }
        break;
      }
      
      case 'field_update': {
        // Apply specific field changes
        if (payload.field_changes) {
          const { data: record } = await supabase
            .from('crm_records')
            .select('data')
            .eq('id', payload.record_id)
            .single();
          
          const newData = { ...(record?.data || {}) };
          for (const [field, change] of Object.entries(payload.field_changes)) {
            newData[field] = change.new;
          }
          
          const { error } = await supabase
            .from('crm_records')
            .update({
              data: newData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payload.record_id);
          
          if (error) {
            return { success: false, applied: false, error: error.message };
          }
        }
        break;
      }
    }
    
    // Mark as applied
    await supabase
      .from('crm_approvals')
      .update({
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.approvalId);
    
    // Log to audit
    await supabase.from('crm_audit_log').insert({
      org_id: approval.org_id,
      actor_id: input.profileId,
      action: 'approval_apply',
      entity: 'crm_records',
      entity_id: payload.record_id,
      diff: {
        approval_id: input.approvalId,
        action_type: payload.type,
        payload,
      },
    });
    
    return { success: true, applied: true };
  } catch (error) {
    console.error('Error applying approved action:', error);
    return { 
      success: false, 
      applied: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================================================
// W4: Get Approval Inbox
// ============================================================================

/**
 * Get approval inbox with filters
 */
export async function getApprovalInbox(
  orgId: string,
  profileId: string,
  userRole: string | null,
  filters: ApprovalInboxFilters = {}
): Promise<ApprovalInboxItem[]> {
  const supabase = await createClient();
  
  // Use the database function for optimized query
  const { data, error } = await supabase.rpc('get_approval_inbox', {
    p_org_id: orgId,
    p_profile_id: profileId,
    p_user_role: userRole,
    p_status: filters.status === 'all' ? null : (filters.status || null),
    p_entity_type: filters.entity_type || null,
    p_assigned_to_me: filters.assigned_to_me || false,
    p_requested_by_me: filters.requested_by_me || false,
    p_limit: 100,
    p_offset: 0,
  });
  
  if (error) {
    console.error('Error fetching approval inbox:', error);
    return [];
  }
  
  return (data || []) as ApprovalInboxItem[];
}

// ============================================================================
// W4: Get Approval Detail
// ============================================================================

/**
 * Get full approval details for detail page
 */
export async function getApprovalDetail(
  approvalId: string
): Promise<ApprovalDetailData | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('get_approval_detail', {
    p_approval_id: approvalId,
  });
  
  if (error || !data || data.length === 0) {
    console.error('Error fetching approval detail:', error);
    return null;
  }
  
  return data[0] as ApprovalDetailData;
}

// ============================================================================
// W4: Get Approval Decisions
// ============================================================================

/**
 * Get all decisions for an approval
 */
export async function getApprovalDecisions(
  approvalId: string
): Promise<CrmApprovalDecision[]> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('crm_approval_decisions')
    .select(`
      *,
      decider:profiles!crm_approval_decisions_decided_by_fkey(full_name, email)
    `)
    .eq('approval_id', approvalId)
    .order('created_at', { ascending: true });
  
  return (data || []) as CrmApprovalDecision[];
}

// ============================================================================
// W4: Record Decision
// ============================================================================

/**
 * Record a decision in the detailed decisions table
 */
export async function recordApprovalDecision(
  orgId: string,
  approvalId: string,
  stepIndex: number,
  decision: 'approve' | 'reject' | 'request_changes' | 'delegate' | 'escalate',
  decidedBy: string,
  comment?: string,
  delegatedTo?: string,
  stepStartedAt?: Date
): Promise<{ success: boolean; decisionId?: string; error?: string }> {
  const supabase = await createClient();
  
  const timeToDecision = stepStartedAt
    ? Math.floor((Date.now() - stepStartedAt.getTime()) / 1000)
    : null;
  
  const { data, error } = await supabase
    .from('crm_approval_decisions')
    .insert({
      org_id: orgId,
      approval_id: approvalId,
      step_index: stepIndex,
      decision,
      decided_by: decidedBy,
      comment,
      delegated_to: delegatedTo,
      time_to_decision_seconds: timeToDecision,
    })
    .select('id')
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, decisionId: data.id };
}

// ============================================================================
// W4: Get All Approval Processes
// ============================================================================

/**
 * Get all approval processes for an organization
 */
export async function getApprovalProcesses(
  orgId: string,
  moduleId?: string
): Promise<CrmApprovalProcess[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('crm_approval_processes')
    .select('*')
    .eq('org_id', orgId)
    .order('name');
  
  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }
  
  const { data } = await query;
  
  return (data || []) as CrmApprovalProcess[];
}

// ============================================================================
// W4: Create/Update Approval Process
// ============================================================================

/**
 * Create a new approval process
 */
export async function createApprovalProcessRecord(
  data: Omit<CrmApprovalProcess, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; process?: CrmApprovalProcess; error?: string }> {
  const supabase = await createClient();
  
  const { data: process, error } = await supabase
    .from('crm_approval_processes')
    .insert({
      org_id: data.org_id,
      module_id: data.module_id,
      name: data.name,
      description: data.description,
      is_enabled: data.is_enabled ?? true,
      trigger_type: data.trigger_type,
      trigger_config: data.trigger_config,
      conditions: data.conditions,
      steps: data.steps,
      on_approve_actions: data.on_approve_actions || [],
      on_reject_actions: data.on_reject_actions || [],
      auto_approve_after_hours: data.auto_approve_after_hours,
      created_by: data.created_by,
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, process: process as CrmApprovalProcess };
}

/**
 * Update an approval process
 */
export async function updateApprovalProcessRecord(
  processId: string,
  data: Partial<CrmApprovalProcess>
): Promise<{ success: boolean; process?: CrmApprovalProcess; error?: string }> {
  const supabase = await createClient();
  
  const { data: process, error } = await supabase
    .from('crm_approval_processes')
    .update({
      name: data.name,
      description: data.description,
      is_enabled: data.is_enabled,
      trigger_type: data.trigger_type,
      trigger_config: data.trigger_config,
      conditions: data.conditions,
      steps: data.steps,
      on_approve_actions: data.on_approve_actions,
      on_reject_actions: data.on_reject_actions,
      auto_approve_after_hours: data.auto_approve_after_hours,
    })
    .eq('id', processId)
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, process: process as CrmApprovalProcess };
}

/**
 * Delete an approval process
 */
export async function deleteApprovalProcess(
  processId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('crm_approval_processes')
    .delete()
    .eq('id', processId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}
