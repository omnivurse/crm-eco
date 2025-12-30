import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import type { Database } from '@crm-eco/lib/types';
import { getRoleQueryContext, getCurrentProfile } from '@/lib/auth';
import { CreateLeadDialog } from '@/components/leads/create-lead-dialog';
import {
  LeadsBoardShell,
  type LeadWithAdvisor,
  type AdvisorOption,
} from '@/components/leads/LeadsBoardShell';
import {
  LEADS_BOARD_CONTEXT,
  type LeadsBoardSavedView,
  type LeadsBoardSavedFilters,
} from '@crm-eco/lib';

type Lead = Database['public']['Tables']['leads']['Row'];

interface RawLeadWithAdvisor extends Lead {
  advisors?: { first_name: string; last_name: string } | null;
}

async function getLeads(): Promise<LeadWithAdvisor[]> {
  const supabase = await createServerSupabaseClient();
  const context = await getRoleQueryContext();

  if (!context) {
    console.error('No role context found');
    return [];
  }

  let query = supabase
    .from('leads')
    .select('*, advisors(first_name, last_name)')
    .order('created_at', { ascending: false });

  // Filter by advisor if user is an advisor
  if (!context.isAdmin && context.role === 'advisor' && context.advisorId) {
    query = query.eq('advisor_id', context.advisorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching leads:', error);
    return [];
  }

  return ((data ?? []) as RawLeadWithAdvisor[]).map((l) => ({
    id: l.id,
    first_name: l.first_name,
    last_name: l.last_name,
    email: l.email,
    phone: l.phone,
    state: l.state,
    status: l.status,
    source: l.source,
    advisor_id: l.advisor_id,
    created_at: l.created_at,
    updated_at: l.updated_at,
    advisors: l.advisors,
  }));
}

async function getLeadStats(advisorId: string | null, isAdmin: boolean) {
  const supabase = await createServerSupabaseClient();

  const buildQuery = (status?: string) => {
    let query = supabase.from('leads').select('id', { count: 'exact', head: true });
    if (!isAdmin && advisorId) {
      query = query.eq('advisor_id', advisorId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    return query;
  };

  const [totalResult, newResult, qualifiedResult, convertedResult] = await Promise.all([
    buildQuery(),
    buildQuery('new'),
    buildQuery('qualified'),
    buildQuery('converted'),
  ]);

  return {
    total: totalResult.count ?? 0,
    new: newResult.count ?? 0,
    qualified: qualifiedResult.count ?? 0,
    converted: convertedResult.count ?? 0,
  };
}

async function getAdvisors(): Promise<AdvisorOption[]> {
  const supabase = await createServerSupabaseClient();
  const profile = await getCurrentProfile();

  if (!profile) return [];

  const { data } = await supabase
    .from('advisors')
    .select('id, first_name, last_name')
    .eq('organization_id', profile.organization_id)
    .order('first_name', { ascending: true });

  return (data ?? []).map((a: { id: string; first_name: string; last_name: string }) => ({
    id: a.id,
    first_name: a.first_name,
    last_name: a.last_name,
  }));
}

export default async function LeadsPage() {
  const profile = await getCurrentProfile();
  const context = await getRoleQueryContext();

  if (!profile || !context) {
    return (
      <div className="text-center py-12 text-slate-500">
        Please log in to view leads.
      </div>
    );
  }

  const advisorId = context.advisorId ?? null;
  const isAdmin = context.isAdmin ?? false;

  const [leads, stats, advisors] = await Promise.all([
    getLeads(),
    getLeadStats(advisorId, isAdmin),
    getAdvisors(),
  ]);

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
    .eq('context', LEADS_BOARD_CONTEXT)
    .order('created_at', { ascending: true });

  // Parse saved views
  const savedViews: LeadsBoardSavedView[] = (savedViewsData || []).map(
    (v: {
      id: string;
      organization_id: string;
      owner_profile_id: string;
      context: 'leads_board';
      name: string;
      is_default: boolean;
      filters: LeadsBoardSavedFilters;
      created_at: string;
      updated_at: string;
    }) => ({
      id: v.id,
      organization_id: v.organization_id,
      owner_profile_id: v.owner_profile_id,
      context: v.context,
      name: v.name,
      is_default: v.is_default,
      filters: v.filters as LeadsBoardSavedFilters,
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
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        </div>
        <CreateLeadDialog />
      </div>

      {/* Board Shell */}
      <LeadsBoardShell
        leads={leads}
        savedViews={savedViews}
        defaultSavedViewId={defaultSavedView?.id ?? null}
        advisors={advisors}
        stats={stats}
      />
    </div>
  );
}
