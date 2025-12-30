import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext, getCurrentProfile } from '@/lib/auth';
import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';
import {
  TicketsBoardShell,
  type TicketWithRelations,
  type AssignableProfile,
} from '@/components/tickets/TicketsBoardShell';
import {
  TICKETS_BOARD_CONTEXT,
  type TicketsBoardSavedView,
  type TicketsBoardSavedFilters,
} from '@crm-eco/lib';

type TicketRow = Database['public']['Tables']['tickets']['Row'];

interface RawTicketWithRelations extends TicketRow {
  created_by?: { full_name: string } | null;
  assigned_to?: { full_name: string } | null;
  members?: { id: string; first_name: string; last_name: string } | null;
}

async function getTickets(): Promise<TicketWithRelations[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();

  if (!context) {
    console.error('No role context found');
    return [];
  }

  let query = supabase
    .from('tickets')
    .select(`
      *,
      created_by:profiles!tickets_created_by_profile_id_fkey(full_name),
      assigned_to:profiles!tickets_assigned_to_profile_id_fkey(full_name),
      members(id, first_name, last_name)
    `)
    .order('created_at', { ascending: false });

  // For advisors, filter to their own tickets or tickets assigned to them or related to them
  if (!context.isAdmin && context.role === 'advisor') {
    const filters = [
      `created_by_profile_id.eq.${context.profileId}`,
      `assigned_to_profile_id.eq.${context.profileId}`,
    ];
    if (context.advisorId) {
      filters.push(`advisor_id.eq.${context.advisorId}`);
    }
    query = query.or(filters.join(','));
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tickets:', error);
    return [];
  }

  return ((data ?? []) as RawTicketWithRelations[]).map((t) => ({
    id: t.id,
    subject: t.subject,
    description: t.description,
    status: t.status,
    priority: t.priority,
    category: t.category,
    created_at: t.created_at,
    updated_at: t.updated_at,
    assigned_to_profile_id: t.assigned_to_profile_id,
    created_by: t.created_by,
    assigned_to: t.assigned_to,
    members: t.members,
  }));
}

async function getAssignableProfiles(): Promise<AssignableProfile[]> {
  const supabase = await createServerSupabaseClient();
  const profile = await getCurrentProfile();

  if (!profile) return [];

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('organization_id', profile.organization_id)
    .order('full_name', { ascending: true });

  return (data ?? []).map((p: { id: string; full_name: string }) => ({
    id: p.id,
    full_name: p.full_name,
  }));
}

export default async function TicketsPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="text-center py-12 text-slate-500">
        Please log in to view tickets.
      </div>
    );
  }

  const [tickets, assignableProfiles] = await Promise.all([
    getTickets(),
    getAssignableProfiles(),
  ]);

  // Calculate stats
  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    urgent: tickets.filter((t) => t.priority === 'urgent').length,
  };

  // Fetch saved views for this user
  const supabase = await createServerSupabaseClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: savedViewsData } = await (supabase as any)
    .from('saved_views')
    .select(
      'id, organization_id, owner_profile_id, context, name, is_default, filters, created_at, updated_at'
    )
    .eq('organization_id', profile.organization_id)
    .eq('owner_profile_id', profile.id)
    .eq('context', TICKETS_BOARD_CONTEXT)
    .order('created_at', { ascending: true });

  // Parse saved views
  const savedViews: TicketsBoardSavedView[] = (savedViewsData || []).map(
    (v: {
      id: string;
      organization_id: string;
      owner_profile_id: string;
      context: 'tickets_board';
      name: string;
      is_default: boolean;
      filters: TicketsBoardSavedFilters;
      created_at: string;
      updated_at: string;
    }) => ({
      id: v.id,
      organization_id: v.organization_id,
      owner_profile_id: v.owner_profile_id,
      context: v.context,
      name: v.name,
      is_default: v.is_default,
      filters: v.filters as TicketsBoardSavedFilters,
      created_at: v.created_at,
      updated_at: v.updated_at,
    })
  );

  // Find the default view if any
  const defaultSavedView = savedViews.find((v) => v.is_default) ?? null;

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
        </div>
        <CreateTicketDialog />
      </div>

      {/* Board Shell */}
      <TicketsBoardShell
        tickets={tickets}
        savedViews={savedViews}
        defaultSavedViewId={defaultSavedView?.id ?? null}
        assignableProfiles={assignableProfiles}
        stats={stats}
      />
    </div>
  );
}
