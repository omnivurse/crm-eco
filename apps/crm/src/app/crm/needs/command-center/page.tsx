import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { ShieldAlert } from 'lucide-react';
import { NeedsCommandCenterShell } from '@/components/needs/command-center';
import type { NeedStatus } from '@crm-eco/lib';
import {
  OPEN_NEED_STATUSES,
  NEEDS_COMMAND_CENTER_CONTEXT,
  type NeedsCommandCenterSavedView,
  type NeedsCommandCenterSavedFilters,
} from '@crm-eco/lib';
import type { NeedWithMember } from '@/components/needs/command-center/NeedsTable';

// Ops roles that can access this page
const OPS_ROLES = ['owner', 'admin', 'staff'];

// Type for raw need data from database
interface RawNeed {
  id: string;
  status: string;
  urgency_light: string | null;
  sla_target_date: string | null;
  need_type: string;
  description: string | null;
  billed_amount: number | string | null;
  approved_amount: number | string | null;
  member_responsibility_amount: number | string | null;
  eligible_amount: number | string | null;
  reimbursed_amount: number | string | null;
  iua_met: boolean | null;
  member_id: string | null;
  assigned_to_profile_id: string | null;
  updated_at: string;
  created_at: string;
}

// Type for raw member data
interface RawMember {
  id: string;
  first_name: string;
  last_name: string;
}

// Type for raw profile data (assignees)
interface RawProfile {
  id: string;
  full_name: string;
  role?: string;
}

// Assignable profile type (exported for components)
export interface AssignableProfile {
  id: string;
  full_name: string;
  role: string;
}

// Workload bucket type (exported for shell component)
export interface WorkloadBucket {
  profileId: string;
  name: string;
  total: number;
  green: number;
  orange: number;
  red: number;
}

export default async function NeedsCommandCenterPage() {
  // Get current user profile
  const profile = await getCurrentProfile();

  // Check authentication
  if (!profile) {
    return (
      <UnauthorizedMessage message="You must be logged in to access this page." />
    );
  }

  // Check role authorization
  if (!OPS_ROLES.includes(profile.role)) {
    return (
      <UnauthorizedMessage 
        message="This page is restricted to Operations staff. Advisors do not have access to the Command Center." 
      />
    );
  }

  // Fetch needs for this organization
  const supabase = await createServerSupabaseClient();
  
  const { data: needsData, error: needsError } = await (supabase as any)
    .from('needs')
    .select(`
      id,
      status,
      urgency_light,
      sla_target_date,
      need_type,
      description,
      billed_amount,
      approved_amount,
      member_responsibility_amount,
      eligible_amount,
      reimbursed_amount,
      iua_met,
      member_id,
      assigned_to_profile_id,
      updated_at,
      created_at
    `)
    .eq('organization_id', profile.organization_id)
    .order('urgency_light', { ascending: true, nullsFirst: false })
    .order('sla_target_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(300);

  if (needsError) {
    console.error('Failed to fetch needs:', needsError);
    return (
      <UnauthorizedMessage message="Failed to load needs. Please try again." />
    );
  }

  const needs: RawNeed[] = needsData || [];

  // Fetch member info for all needs with member_ids
  const memberIds = Array.from(
    new Set(needs.map(n => n.member_id).filter((id): id is string => Boolean(id)))
  );
  
  let membersMap: Record<string, { first_name: string; last_name: string }> = {};
  
  if (memberIds.length > 0) {
    const { data: membersData } = await (supabase as any)
      .from('members')
      .select('id, first_name, last_name')
      .in('id', memberIds);
    
    const members: RawMember[] = membersData || [];
    membersMap = members.reduce((acc, m) => {
      acc[m.id] = { first_name: m.first_name, last_name: m.last_name };
      return acc;
    }, {} as Record<string, { first_name: string; last_name: string }>);
  }

  // Fetch assignee (profile) info for all needs with assigned_to_profile_id
  const assigneeIds = Array.from(
    new Set(needs.map(n => n.assigned_to_profile_id).filter((id): id is string => Boolean(id)))
  );

  let assigneesMap: Record<string, { full_name: string }> = {};

  if (assigneeIds.length > 0) {
    const { data: profilesData } = await (supabase as any)
      .from('profiles')
      .select('id, full_name')
      .in('id', assigneeIds);
    
    const profiles: RawProfile[] = profilesData || [];
    assigneesMap = profiles.reduce((acc, p) => {
      acc[p.id] = { full_name: p.full_name };
      return acc;
    }, {} as Record<string, { full_name: string }>);
  }

  // Enrich needs with member names and assignee names
  const enrichedNeeds: NeedWithMember[] = needs.map(need => ({
    id: need.id,
    status: need.status as NeedStatus,
    urgency_light: need.urgency_light as 'green' | 'orange' | 'red' | null,
    sla_target_date: need.sla_target_date,
    need_type: need.need_type,
    description: need.description,
    billed_amount: need.billed_amount ? Number(need.billed_amount) : null,
    approved_amount: need.approved_amount ? Number(need.approved_amount) : null,
    member_responsibility_amount: need.member_responsibility_amount ? Number(need.member_responsibility_amount) : null,
    eligible_amount: need.eligible_amount ? Number(need.eligible_amount) : null,
    reimbursed_amount: need.reimbursed_amount ? Number(need.reimbursed_amount) : null,
    iua_met: need.iua_met ?? false,
    updated_at: need.updated_at,
    created_at: need.created_at,
    member_id: need.member_id,
    member_first_name: need.member_id ? membersMap[need.member_id]?.first_name || null : null,
    member_last_name: need.member_id ? membersMap[need.member_id]?.last_name || null : null,
    assigned_to_profile_id: need.assigned_to_profile_id,
    assigned_to_name: need.assigned_to_profile_id 
      ? assigneesMap[need.assigned_to_profile_id]?.full_name || null 
      : null,
  }));

  // Compute SLA counts
  const slaCounts = {
    overdue: enrichedNeeds.filter(n => n.urgency_light === 'red').length,
    atRisk: enrichedNeeds.filter(n => n.urgency_light === 'orange').length,
    onTrack: enrichedNeeds.filter(n => n.urgency_light === 'green').length,
  };

  // Compute workload metrics for open needs only
  const openNeeds = enrichedNeeds.filter(n => 
    OPEN_NEED_STATUSES.includes(n.status)
  );

  const workloadMap = new Map<string, WorkloadBucket>();

  for (const need of openNeeds) {
    const profileId = need.assigned_to_profile_id ?? 'unassigned';
    const name = need.assigned_to_profile_id && need.assigned_to_name
      ? need.assigned_to_name
      : 'Unassigned';

    if (!workloadMap.has(profileId)) {
      workloadMap.set(profileId, {
        profileId,
        name,
        total: 0,
        green: 0,
        orange: 0,
        red: 0,
      });
    }

    const bucket = workloadMap.get(profileId)!;
    bucket.total += 1;

    if (need.urgency_light === 'green') bucket.green += 1;
    else if (need.urgency_light === 'orange') bucket.orange += 1;
    else if (need.urgency_light === 'red') bucket.red += 1;
  }

  // Convert to array and sort by most loaded first
  const workload = Array.from(workloadMap.values()).sort(
    (a, b) => b.total - a.total
  );

  // Fetch all Ops profiles in this organization for assignment picker
  const { data: opsProfilesData } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, role')
    .eq('organization_id', profile.organization_id)
    .in('role', OPS_ROLES)
    .order('full_name', { ascending: true });

  const assignableProfiles: AssignableProfile[] = (opsProfilesData || []).map(
    (p: RawProfile & { role: string }) => ({
      id: p.id,
      full_name: p.full_name,
      role: p.role,
    })
  );

  // Fetch saved views for this user in the Needs Command Center context
  const { data: savedViewsData } = await (supabase as any)
    .from('saved_views')
    .select('id, organization_id, owner_profile_id, context, name, is_default, filters, created_at, updated_at')
    .eq('organization_id', profile.organization_id)
    .eq('owner_profile_id', profile.id)
    .eq('context', NEEDS_COMMAND_CENTER_CONTEXT)
    .order('created_at', { ascending: true });

  // Parse saved views
  const savedViews: NeedsCommandCenterSavedView[] = (savedViewsData || []).map(
    (v: {
      id: string;
      organization_id: string;
      owner_profile_id: string;
      context: string;
      name: string;
      is_default: boolean;
      filters: NeedsCommandCenterSavedFilters;
      created_at: string;
      updated_at: string;
    }) => ({
      id: v.id,
      organization_id: v.organization_id,
      owner_profile_id: v.owner_profile_id,
      context: v.context,
      name: v.name,
      is_default: v.is_default,
      filters: v.filters as NeedsCommandCenterSavedFilters,
      created_at: v.created_at,
      updated_at: v.updated_at,
    })
  );

  // Find the default view if any
  const defaultSavedView = savedViews.find(v => v.is_default) ?? null;

  return (
    <NeedsCommandCenterShell 
      needs={enrichedNeeds} 
      slaCounts={slaCounts}
      workload={workload}
      assignableProfiles={assignableProfiles}
      currentProfileId={profile.id}
      savedViews={savedViews}
      defaultSavedViewId={defaultSavedView?.id ?? null}
    />
  );
}

// Unauthorized message component
function UnauthorizedMessage({ message }: { message: string }) {
  return (
    <div className="max-w-2xl mx-auto mt-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-6 h-6" />
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
