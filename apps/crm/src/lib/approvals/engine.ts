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
