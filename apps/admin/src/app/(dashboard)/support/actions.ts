'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

export interface ActionResult {
  success: boolean;
  error?: string;
}

async function getStaffContext() {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', tenant.organizationId)
    .maybeSingle();

  if (!profile?.id) return null;

  const role = profile.role ?? '';
  if (!['owner', 'super_admin', 'admin', 'staff'].includes(role)) {
    return null;
  }

  return { supabase, organizationId: tenant.organizationId, profileId: profile.id };
}

/**
 * Staff reply / internal note on a shared tickets row (same table CRM uses).
 */
export async function addAdminTicketComment(input: {
  ticketId: string;
  body: string;
  isInternal?: boolean;
}): Promise<ActionResult> {
  try {
    const trimmed = input.body.trim();
    if (!trimmed) return { success: false, error: 'Message is required' };

    const ctx = await getStaffContext();
    if (!ctx) return { success: false, error: 'Not authorized' };

    const { data: ticket, error: ticketError } = await ctx.supabase
      .from('tickets')
      .select('id, organization_id, status')
      .eq('id', input.ticketId)
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();

    if (ticketError || !ticket) {
      return { success: false, error: 'Ticket not found' };
    }

    const { error: commentError } = await ctx.supabase.from('ticket_comments').insert({
      ticket_id: input.ticketId,
      created_by_profile_id: ctx.profileId,
      body: trimmed,
      is_internal: Boolean(input.isInternal),
    });

    if (commentError) {
      return { success: false, error: 'Failed to add comment' };
    }

    await ctx.supabase
      .from('tickets')
      .update({
        status: ticket.status === 'open' ? 'in_progress' : ticket.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.ticketId)
      .eq('organization_id', ctx.organizationId);

    revalidatePath('/support');
    revalidatePath(`/support/${input.ticketId}`);
    return { success: true };
  } catch (error) {
    console.error('addAdminTicketComment error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function updateAdminTicketStatus(input: {
  ticketId: string;
  status: string;
}): Promise<ActionResult> {
  try {
    const allowed = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
    if (!allowed.includes(input.status)) {
      return { success: false, error: 'Invalid status' };
    }

    const ctx = await getStaffContext();
    if (!ctx) return { success: false, error: 'Not authorized' };

    const { error } = await ctx.supabase
      .from('tickets')
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq('id', input.ticketId)
      .eq('organization_id', ctx.organizationId);

    if (error) return { success: false, error: 'Failed to update status' };

    revalidatePath('/support');
    revalidatePath(`/support/${input.ticketId}`);
    return { success: true };
  } catch (error) {
    console.error('updateAdminTicketStatus error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
