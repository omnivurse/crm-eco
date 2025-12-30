'use server';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';
import { revalidatePath } from 'next/cache';

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
      console.error('Failed to create ticket:', ticketError);
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
      console.error('Failed to create ticket comment:', commentError);
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
      console.error('Failed to get tickets:', error);
      return { success: false, error: 'Failed to load tickets' };
    }

    return { success: true, data: tickets || [] };
  } catch (error) {
    console.error('getMemberTicketsAction error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

