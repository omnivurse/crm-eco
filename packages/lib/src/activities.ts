import { createClient } from './supabase/client';
import type { Database } from './types';

type Json = Database['public']['Tables']['activities']['Row']['metadata'];

export interface ActivityLogParams {
  organizationId: string;
  createdByProfileId: string;
  type: string;
  subject: string;
  description?: string;
  metadata?: Json;
}

export interface MemberActivityParams extends ActivityLogParams {
  memberId: string;
}

export interface AdvisorActivityParams extends ActivityLogParams {
  advisorId: string;
}

export interface LeadActivityParams extends ActivityLogParams {
  leadId: string;
}

export interface TicketActivityParams extends ActivityLogParams {
  ticketId: string;
  memberId?: string;
  advisorId?: string;
}

export interface NeedActivityParams extends ActivityLogParams {
  needId: string;
  memberId?: string;
  advisorId?: string;
}

/**
 * Log an activity for a member
 */
export async function logActivityForMember(params: MemberActivityParams) {
  const supabase = createClient();
  
  const { error } = await supabase.from('activities').insert({
    organization_id: params.organizationId,
    created_by_profile_id: params.createdByProfileId,
    member_id: params.memberId,
    type: params.type,
    subject: params.subject,
    description: params.description || null,
    metadata: params.metadata || {},
    occurred_at: new Date().toISOString(),
  } as any);

  if (error) {
    console.error('Failed to log member activity:', error);
  }
  
  return { error };
}

/**
 * Log an activity for an advisor
 */
export async function logActivityForAdvisor(params: AdvisorActivityParams) {
  const supabase = createClient();
  
  const { error } = await supabase.from('activities').insert({
    organization_id: params.organizationId,
    created_by_profile_id: params.createdByProfileId,
    advisor_id: params.advisorId,
    type: params.type,
    subject: params.subject,
    description: params.description || null,
    metadata: params.metadata || {},
    occurred_at: new Date().toISOString(),
  } as any);

  if (error) {
    console.error('Failed to log advisor activity:', error);
  }
  
  return { error };
}

/**
 * Log an activity for a lead
 */
export async function logActivityForLead(params: LeadActivityParams) {
  const supabase = createClient();
  
  const { error } = await supabase.from('activities').insert({
    organization_id: params.organizationId,
    created_by_profile_id: params.createdByProfileId,
    lead_id: params.leadId,
    type: params.type,
    subject: params.subject,
    description: params.description || null,
    metadata: params.metadata || {},
    occurred_at: new Date().toISOString(),
  } as any);

  if (error) {
    console.error('Failed to log lead activity:', error);
  }
  
  return { error };
}

/**
 * Log an activity for a ticket
 */
export async function logActivityForTicket(params: TicketActivityParams) {
  const supabase = createClient();
  
  const { error } = await supabase.from('activities').insert({
    organization_id: params.organizationId,
    created_by_profile_id: params.createdByProfileId,
    ticket_id: params.ticketId,
    member_id: params.memberId || null,
    advisor_id: params.advisorId || null,
    type: params.type,
    subject: params.subject,
    description: params.description || null,
    metadata: params.metadata || {},
    occurred_at: new Date().toISOString(),
  } as any);

  if (error) {
    console.error('Failed to log ticket activity:', error);
  }
  
  return { error };
}

/**
 * Log an activity for a need
 */
export async function logActivityForNeed(params: NeedActivityParams) {
  const supabase = createClient();
  
  const { error } = await supabase.from('activities').insert({
    organization_id: params.organizationId,
    created_by_profile_id: params.createdByProfileId,
    need_id: params.needId,
    member_id: params.memberId || null,
    advisor_id: params.advisorId || null,
    type: params.type,
    subject: params.subject,
    description: params.description || null,
    metadata: params.metadata || {},
    occurred_at: new Date().toISOString(),
  } as any);

  if (error) {
    console.error('Failed to log need activity:', error);
  }
  
  return { error };
}

/**
 * Activity type constants for consistency
 */
export const ActivityTypes = {
  // Member activities
  MEMBER_CREATED: 'member_created',
  MEMBER_UPDATED: 'member_updated',
  MEMBER_STATUS_CHANGED: 'member_status_changed',
  
  // Advisor activities
  ADVISOR_CREATED: 'advisor_created',
  ADVISOR_UPDATED: 'advisor_updated',
  ADVISOR_STATUS_CHANGED: 'advisor_status_changed',
  
  // Lead activities
  LEAD_CREATED: 'lead_created',
  LEAD_UPDATED: 'lead_updated',
  LEAD_STATUS_CHANGED: 'lead_status_changed',
  LEAD_CONVERTED: 'lead_converted',
  
  // Ticket activities
  TICKET_CREATED: 'ticket_created',
  TICKET_UPDATED: 'ticket_updated',
  TICKET_STATUS_CHANGED: 'ticket_status_changed',
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_COMMENT_ADDED: 'ticket_comment_added',
  
  // Need activities
  NEED_CREATED: 'need_created',
  NEED_UPDATED: 'need_updated',
  NEED_STATUS_CHANGED: 'need_status_changed',
  NEED_PAYMENT_PROCESSED: 'need_payment_processed',
  
  // General activities
  NOTE_ADDED: 'note_added',
  CALL_LOGGED: 'call_logged',
  EMAIL_SENT: 'email_sent',
  MEETING_SCHEDULED: 'meeting_scheduled',
} as const;

export type ActivityType = typeof ActivityTypes[keyof typeof ActivityTypes];


