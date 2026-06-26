import 'server-only';

import { cache } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getMemberForUser } from '@crm-eco/lib';

export interface MemberTicketView {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string | null;
}

export interface MemberTicketCommentView {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  is_member: boolean;
}

export const getMemberTicketById = cache(
  async (ticketId: string): Promise<MemberTicketView | null> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const context = await getMemberForUser(supabase, user.id);
    if (!context?.member.organization_id) return null;

    const { data } = await supabase
      .from('tickets')
      .select('id, subject, description, status, priority, category, created_at, updated_at')
      .eq('id', ticketId)
      .eq('member_id', context.member.id)
      .eq('organization_id', context.member.organization_id)
      .maybeSingle();

    return data as MemberTicketView | null;
  },
);

export const listMemberTicketComments = cache(
  async (ticketId: string): Promise<MemberTicketCommentView[]> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const context = await getMemberForUser(supabase, user.id);
    if (!context?.member.organization_id) return [];

    const { data: ticket } = await supabase
      .from('tickets')
      .select('id')
      .eq('id', ticketId)
      .eq('member_id', context.member.id)
      .eq('organization_id', context.member.organization_id)
      .maybeSingle();

    if (!ticket) return [];

    const { data: rows } = await supabase
      .from('ticket_comments')
      .select('id, body, created_at, created_by_profile_id, is_internal')
      .eq('ticket_id', ticketId)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });

    if (!rows?.length) return [];

    const profileIds = [...new Set(rows.map((r) => r.created_by_profile_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    return rows.map((row) => {
      const profile = profileById.get(row.created_by_profile_id);
      const isMember = row.created_by_profile_id === context.profile.id;
      const authorName = isMember
        ? 'You'
        : profile?.full_name?.trim() ||
          profile?.email?.split('@')[0] ||
          'Support team';

      return {
        id: row.id,
        body: row.body,
        created_at: row.created_at ?? new Date().toISOString(),
        author_name: authorName,
        is_member: isMember,
      };
    });
  },
);
