import 'server-only';

import { cache } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  TICKETS_BOARD_CONTEXT,
  type TicketsBoardSavedView,
} from '@crm-eco/lib';
import type { TicketWithRelations, AssignableProfile } from '@/components/tickets/TicketsBoardShell';
import { getCachedCurrentProfile } from '@/lib/crm/queries';

type TicketRow = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  assigned_to_profile_id: string | null;
  created_by_profile_id: string;
  member_id: string | null;
};

export interface TicketsBoardData {
  tickets: TicketWithRelations[];
  savedViews: TicketsBoardSavedView[];
  defaultSavedViewId: string | null;
  assignableProfiles: AssignableProfile[];
  stats: {
    total: number;
    open: number;
    inProgress: number;
    urgent: number;
  };
}

export const getTicketsBoardData = cache(async (): Promise<TicketsBoardData | null> => {
  const profile = await getCachedCurrentProfile();
  if (!profile?.organization_id) return null;

  const supabase = await createServerSupabaseClient();
  const orgId = profile.organization_id;

  const [ticketsResult, savedViewsResult, assignableResult] = await Promise.all([
    supabase
      .from('tickets')
      .select(
        'id, subject, description, status, priority, category, created_at, updated_at, assigned_to_profile_id, created_by_profile_id, member_id',
      )
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('saved_views')
      .select('id, organization_id, owner_profile_id, context, name, is_default, filters, created_at, updated_at')
      .eq('organization_id', orgId)
      .eq('owner_profile_id', profile.id)
      .eq('context', TICKETS_BOARD_CONTEXT)
      .is('deleted_at' as never, null)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', orgId)
      .in('role', ['owner', 'admin', 'staff', 'advisor'])
      .order('full_name'),
  ]);

  const rows = (ticketsResult.data ?? []) as TicketRow[];

  const profileIds = new Set<string>();
  const memberIds = new Set<string>();
  for (const row of rows) {
    profileIds.add(row.created_by_profile_id);
    if (row.assigned_to_profile_id) profileIds.add(row.assigned_to_profile_id);
    if (row.member_id) memberIds.add(row.member_id);
  }

  const [profilesResult, membersResult] = await Promise.all([
    profileIds.size
      ? supabase.from('profiles').select('id, full_name').in('id', [...profileIds])
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    memberIds.size
      ? supabase.from('members').select('id, first_name, last_name').in('id', [...memberIds])
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
  ]);

  const profileById = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p]),
  );
  const memberById = new Map(
    (membersResult.data ?? []).map((m) => [m.id, m]),
  );

  const tickets: TicketWithRelations[] = rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    category: row.category,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assigned_to_profile_id: row.assigned_to_profile_id,
    created_by: profileById.get(row.created_by_profile_id)
      ? { full_name: profileById.get(row.created_by_profile_id)!.full_name ?? 'Unknown' }
      : null,
    assigned_to: row.assigned_to_profile_id
      ? profileById.get(row.assigned_to_profile_id)
        ? { full_name: profileById.get(row.assigned_to_profile_id)!.full_name ?? 'Unknown' }
        : null
      : null,
    members: row.member_id && memberById.get(row.member_id)
      ? memberById.get(row.member_id)!
      : null,
  }));

  const savedViews = (savedViewsResult.data ?? []) as TicketsBoardSavedView[];
  const defaultSavedViewId =
    savedViews.find((view) => view.is_default)?.id ?? null;

  const assignableProfiles: AssignableProfile[] = (assignableResult.data ?? [])
    .filter((p): p is { id: string; full_name: string } => Boolean(p.full_name))
    .map((p) => ({ id: p.id, full_name: p.full_name }));

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    urgent: tickets.filter((t) => t.priority === 'urgent').length,
  };

  return {
    tickets,
    savedViews,
    defaultSavedViewId,
    assignableProfiles,
    stats,
  };
});

export interface StaffTicketDetail {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string | null;
  assigned_to_profile_id: string | null;
  member: { id: string; first_name: string; last_name: string; email: string | null } | null;
  assigned_to: { full_name: string | null } | null;
  created_by: { full_name: string | null } | null;
}

export interface StaffTicketComment {
  id: string;
  body: string;
  created_at: string;
  is_internal: boolean;
  author_name: string;
}

export const getStaffTicketDetail = cache(
  async (ticketId: string): Promise<{ ticket: StaffTicketDetail; comments: StaffTicketComment[] } | null> => {
    const profile = await getCachedCurrentProfile();
    if (!profile?.organization_id) return null;

    const supabase = await createServerSupabaseClient();

    const { data: ticketRow } = await supabase
      .from('tickets')
      .select(
        'id, subject, description, status, priority, category, created_at, updated_at, assigned_to_profile_id, created_by_profile_id, member_id',
      )
      .eq('id', ticketId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!ticketRow) return null;

    const row = ticketRow as TicketRow;

    const profileIds = [row.created_by_profile_id];
    if (row.assigned_to_profile_id) profileIds.push(row.assigned_to_profile_id);

    const [profilesResult, memberResult, commentsResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', profileIds),
      row.member_id
        ? supabase
            .from('members')
            .select('id, first_name, last_name, email')
            .eq('id', row.member_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('ticket_comments')
        .select('id, body, created_at, created_by_profile_id, is_internal')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
    ]);

    const commentRows = commentsResult.data ?? [];
    const commentProfileIds = [...new Set(commentRows.map((c) => c.created_by_profile_id))];
    const { data: commentProfiles } = commentProfileIds.length
      ? await supabase.from('profiles').select('id, full_name, email').in('id', commentProfileIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

    const commentProfileById = new Map((commentProfiles ?? []).map((p) => [p.id, p]));
    const profileById = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));

    const ticket: StaffTicketDetail = {
      id: row.id,
      subject: row.subject,
      description: row.description,
      status: row.status,
      priority: row.priority,
      category: row.category,
      created_at: row.created_at,
      updated_at: row.updated_at,
      assigned_to_profile_id: row.assigned_to_profile_id,
      member: memberResult.data as StaffTicketDetail['member'],
      assigned_to: row.assigned_to_profile_id
        ? { full_name: profileById.get(row.assigned_to_profile_id)?.full_name ?? null }
        : null,
      created_by: { full_name: profileById.get(row.created_by_profile_id)?.full_name ?? null },
    };

    const comments: StaffTicketComment[] = commentRows.map((comment) => {
      const author = commentProfileById.get(comment.created_by_profile_id);
      return {
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at ?? new Date().toISOString(),
        is_internal: Boolean(comment.is_internal),
        author_name:
          author?.full_name?.trim() ||
          author?.email?.split('@')[0] ||
          'Staff',
      };
    });

    return { ticket, comments };
  },
);
