'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { revalidatePath } from 'next/cache';
import { findRecentDuplicate } from '@/lib/api/guard';

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const VALID_CATEGORIES = [
  'service', // General Question
  'enrollment', // Enrollment / Membership
  'billing', // Billing / Payments
  'need', // Needs / Sharing
  'other', // Technical Support
] as const;

type TicketCategory = typeof VALID_CATEGORIES[number];

// Map form category values to DB values
const categoryMap: Record<string, TicketCategory> = {
  'general': 'service',
  'enrollment': 'enrollment',
  'billing': 'billing',
  'needs': 'need',
  'technical': 'other',
};

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Create a new support ticket from the member portal
 */
export async function createMemberTicket(formData: {
  subject: string;
  category: string;
  message: string;
  relatedEnrollmentId?: string;
}): Promise<ActionResult<{ ticketId: string }>> {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Resolve member from profile
    const context = await getMemberForUser(supabase, user.id);

    if (!context) {
      return { success: false, error: 'Member account not found' };
    }

    const { profile, member } = context;

    // Validate required fields
    if (!formData.subject?.trim()) {
      return { success: false, error: 'Subject is required' };
    }

    if (!formData.message?.trim()) {
      return { success: false, error: 'Message is required' };
    }

    if (!formData.category) {
      return { success: false, error: 'Category is required' };
    }

    // Map category to DB value
    const dbCategory = categoryMap[formData.category] || 'other';

    // Idempotency: collapse an accidental double-submit (same member + subject)
    // into the existing ticket instead of opening two.
    const duplicateTicketId = await findRecentDuplicate(supabase, 'tickets', {
      member_id: member.id,
      organization_id: member.organization_id,
      subject: formData.subject.trim(),
    });
    if (duplicateTicketId) {
      return { success: true, data: { ticketId: duplicateTicketId } };
    }

    // Create ticket
    const ticketData: Record<string, unknown> = {
      organization_id: member.organization_id,
      member_id: member.id,
      created_by_profile_id: profile.id,
      subject: formData.subject.trim(),
      description: formData.message.trim(),
      category: dbCategory,
      status: 'open',
      priority: 'normal',
    };

    const { data: ticket, error: ticketError } = await (supabase as any)
      .from('tickets')
      .insert(ticketData)
      .select()
      .single();

    if (ticketError || !ticket) {
      return { success: false, error: 'Failed to create support ticket' };
    }

    // Create first comment with the message
    const commentData = {
      ticket_id: ticket.id,
      created_by_profile_id: profile.id,
      body: formData.message.trim(),
      is_internal: false,
    };

    const { error: commentError } = await (supabase as any)
      .from('ticket_comments')
      .insert(commentData);

    if (commentError) {
      // Don't fail the whole operation - ticket was created
    }

    revalidatePath('/support');

    return { 
      success: true, 
      data: { ticketId: ticket.id } 
    };
  } catch (error) {
    console.error('createMemberTicket error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

const CLOSED_TICKET_STATUSES = new Set(['resolved', 'closed']);

/**
 * Add a member reply to an existing support ticket.
 */
export async function addMemberTicketComment(
  ticketId: string,
  body: string,
): Promise<ActionResult> {
  try {
    const trimmed = body.trim();
    if (!trimmed) {
      return { success: false, error: 'Message is required' };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const context = await getMemberForUser(supabase, user.id);
    if (!context?.member.organization_id) {
      return { success: false, error: 'Member account not found' };
    }

    const { profile, member } = context;

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, status, member_id, organization_id')
      .eq('id', ticketId)
      .eq('member_id', member.id)
      .eq('organization_id', member.organization_id)
      .maybeSingle();

    if (ticketError || !ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    if (CLOSED_TICKET_STATUSES.has(ticket.status)) {
      return { success: false, error: 'This ticket is closed and cannot receive new replies.' };
    }

    const { error: commentError } = await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      created_by_profile_id: profile.id,
      body: trimmed,
      is_internal: false,
    });

    if (commentError) {
      return { success: false, error: 'Failed to send reply' };
    }

    // Re-open waiting tickets when member replies
    if (ticket.status === 'waiting') {
      await supabase
        .from('tickets')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', ticketId);
    } else {
      await supabase
        .from('tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId);
    }

    revalidatePath('/support');
    revalidatePath(`/support/${ticketId}`);

    return { success: true };
  } catch (error) {
    console.error('addMemberTicketComment error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Get tickets for the current member (for revalidation)
 */
export async function getMemberTicketsAction(): Promise<ActionResult<unknown[]>> {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const context = await getMemberForUser(supabase, user.id);

    if (!context) {
      return { success: false, error: 'Member account not found' };
    }

    const { member } = context;

    const { data: tickets, error } = await (supabase as any)
      .from('tickets')
      .select(`
        id,
        subject,
        status,
        priority,
        category,
        created_at
      `)
      .eq('member_id', member.id)
      .eq('organization_id', member.organization_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return { success: false, error: 'Failed to load tickets' };
    }

    return { success: true, data: tickets || [] };
  } catch (error) {
    console.error('getMemberTicketsAction error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

