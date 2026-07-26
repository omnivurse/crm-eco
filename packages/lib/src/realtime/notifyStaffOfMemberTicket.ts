/**
 * Notify org staff when a member opens (or re-opens via reply) a portal support ticket.
 * Fire-and-forget safe: failures are logged and never thrown to the caller.
 *
 * admin_notifications.user_id is compared to auth.uid() by RLS — store the
 * Auth user id (profiles.user_id), not profiles.id.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { broadcastAdminNotification } from './broadcast';

const STAFF_ROLES = ['owner', 'super_admin', 'admin'] as const;

export interface NotifyStaffOfMemberTicketInput {
  orgId: string;
  ticketId: string;
  memberId: string;
  memberName: string;
  subject: string;
  priority?: string;
  /** Defaults to create; use 'reply' when a waiting ticket is re-opened by the member. */
  kind?: 'create' | 'reply';
}

let serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient | null {
  if (serviceClient) return serviceClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[notifyStaffOfMemberTicket] Missing SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  return serviceClient;
}

export async function notifyStaffOfMemberTicket(
  input: NotifyStaffOfMemberTicketInput,
): Promise<void> {
  try {
    const client = getServiceClient();
    if (!client) return;

    const href = `/members/${input.memberId}?tab=support`;
    const title =
      input.kind === 'reply' ? 'Support ticket reply' : 'New support ticket';
    const message = `${input.memberName}: ${input.subject}`.slice(0, 500);
    const meta = {
      href,
      ticket_id: input.ticketId,
      member_id: input.memberId,
      priority: input.priority ?? 'normal',
      kind: input.kind ?? 'create',
    };

    const { data: staff, error: staffError } = await client
      .from('profiles')
      .select('id, user_id')
      .eq('organization_id', input.orgId)
      .in('role', [...STAFF_ROLES])
      .not('user_id', 'is', null)
      .limit(50);

    if (staffError) {
      console.error('[notifyStaffOfMemberTicket] Failed to resolve staff:', staffError);
      return;
    }

    if (!staff?.length) {
      // Fail closed — no recipients, nothing to insert.
      return;
    }

    const rows = staff
      .filter((p): p is { id: string; user_id: string } => Boolean(p.user_id))
      .map((p) => ({
        user_id: p.user_id,
        organization_id: input.orgId,
        type: 'support_ticket',
        title,
        message,
        is_read: false,
        meta,
      }));

    if (rows.length === 0) return;

    const { data: inserted, error: insertError } = await client
      .from('admin_notifications')
      .insert(rows)
      .select('id, user_id, created_at');

    if (insertError) {
      console.error('[notifyStaffOfMemberTicket] Insert failed:', insertError);
      return;
    }

    await Promise.all(
      (inserted ?? []).map((row) =>
        broadcastAdminNotification({
          id: row.id,
          user_id: row.user_id,
          title,
          body: message,
          href,
          icon: 'file-text',
          type: 'support_ticket',
          meta,
          created_at: row.created_at,
        }),
      ),
    );

    // Optional parallel CRM bell for agents who live in CRM.
    const crmHref = `/crm/tickets/${input.ticketId}`;
    const crmRows = staff
      .filter((p): p is { id: string; user_id: string } => Boolean(p.id))
      .map((p) => ({
        user_id: p.id,
        org_id: input.orgId,
        organization_id: input.orgId,
        title,
        body: message,
        href: crmHref,
        icon: 'ticket',
        is_read: false,
        meta,
      }));

    if (crmRows.length > 0) {
      const { error: crmError } = await client.from('crm_notifications').insert(crmRows);
      if (crmError) {
        console.error('[notifyStaffOfMemberTicket] CRM notify failed:', crmError);
      }
    }
  } catch (error) {
    console.error('[notifyStaffOfMemberTicket] Unexpected error:', error);
  }
}
