import { createClient } from './supabase/client';
import type { Database, Json } from './types';

type ActivityInsert = Database['public']['Tables']['activities']['Insert'];

export interface ActivityLogParams {
  organizationId: string;
  createdByProfileId: string;
  type: string;
  subject: string;
  description?: string;
  metadata?: Json;
}

/** Default empty metadata object — typed as Json for Supabase inserts. */
function emptyMetadata(): Json {
  return {};
}

/**
 * Safely merge caller metadata with extra key/value pairs. `metadata`
 * is typed as Json (which permits primitives) so we only spread when
 * it is actually a plain object — primitives are dropped.
 */
function mergeMetadata(metadata: Json | undefined, extra: Record<string, Json>): Json {
  const base: Record<string, Json> =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, Json>)
      : {};
  return { ...base, ...extra } as Json;
}

function buildActivityInsert(row: ActivityInsert): ActivityInsert {
  return row;
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
  
  const { error } = await supabase.from('activities').insert(
    buildActivityInsert({
      organization_id: params.organizationId,
      created_by_profile_id: params.createdByProfileId,
      entity_type: 'member',
      entity_id: params.memberId,
      action: params.type,
      member_id: params.memberId,
      type: params.type,
      subject: params.subject,
      description: params.description || null,
      metadata: params.metadata ?? emptyMetadata(),
      occurred_at: new Date().toISOString(),
    }),
  );

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
  
  const { error } = await supabase.from('activities').insert(
    buildActivityInsert({
      organization_id: params.organizationId,
      created_by_profile_id: params.createdByProfileId,
      entity_type: 'advisor',
      entity_id: params.advisorId,
      action: params.type,
      advisor_id: params.advisorId,
      type: params.type,
      subject: params.subject,
      description: params.description || null,
      metadata: params.metadata ?? emptyMetadata(),
      occurred_at: new Date().toISOString(),
    }),
  );

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
  
  const { error } = await supabase.from('activities').insert(
    buildActivityInsert({
      organization_id: params.organizationId,
      created_by_profile_id: params.createdByProfileId,
      entity_type: 'lead',
      entity_id: params.leadId,
      action: params.type,
      lead_id: params.leadId,
      type: params.type,
      subject: params.subject,
      description: params.description || null,
      metadata: params.metadata ?? emptyMetadata(),
      occurred_at: new Date().toISOString(),
    }),
  );

  if (error) {
    console.error('Failed to log lead activity:', error);
  }
  
  return { error };
}

/**
 * Log an activity for a ticket.
 *
 * The `activities` table does not have a dedicated `ticket_id` column —
 * tickets are tracked via the generic (entity_type, entity_id) pair, with
 * the ticket id also mirrored into metadata for legacy callers.
 */
export async function logActivityForTicket(params: TicketActivityParams) {
  const supabase = createClient();

  const { error } = await supabase.from('activities').insert(
    buildActivityInsert({
      organization_id: params.organizationId,
      created_by_profile_id: params.createdByProfileId,
      entity_type: 'ticket',
      entity_id: params.ticketId,
      action: params.type,
      member_id: params.memberId || null,
      advisor_id: params.advisorId || null,
      type: params.type,
      subject: params.subject,
      description: params.description || null,
      metadata: mergeMetadata(params.metadata, { ticket_id: params.ticketId }),
      occurred_at: new Date().toISOString(),
    }),
  );

  if (error) {
    console.error('Failed to log ticket activity:', error);
  }
  
  return { error };
}

/**
 * Log an activity for a member need.
 *
 * Like tickets, `need_id` is not a dedicated column on `activities`; we
 * use the generic (entity_type, entity_id) shortcut and copy the id into
 * metadata for callers that still expect it.
 */
export async function logActivityForNeed(params: NeedActivityParams) {
  const supabase = createClient();

  const { error } = await supabase.from('activities').insert(
    buildActivityInsert({
      organization_id: params.organizationId,
      created_by_profile_id: params.createdByProfileId,
      entity_type: 'need',
      entity_id: params.needId,
      action: params.type,
      member_id: params.memberId || null,
      advisor_id: params.advisorId || null,
      type: params.type,
      subject: params.subject,
      description: params.description || null,
      metadata: mergeMetadata(params.metadata, { need_id: params.needId }),
      occurred_at: new Date().toISOString(),
    }),
  );

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


