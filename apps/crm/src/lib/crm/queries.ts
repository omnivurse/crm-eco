/**
 * CRM Supabase Query Functions
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getAuthUser as getCachedAuthUser } from '../supabase-server';
import type {
  CrmModule,
  CrmField,
  CrmLayout,
  CrmView,
  CrmRecord,
  CrmNote,
  CrmNoteWithAuthor,
  CrmTask,
  CrmTaskWithAssignee,
  CrmAuditLog,
  CrmAuditLogWithActor,
  CrmImportJob,
  CrmProfile,
  ViewFilter,
  ViewSort,
  ModuleStats,
  CrmDealStage,
  CrmStageHistory,
  CrmStageHistoryWithUser,
  CrmRecordLink,
  CrmLinkedRecord,
  CrmAttachment,
  CrmAttachmentWithAuthor,
  TimelineEvent,
  FilterOperator,
  CrmTerritory,
} from './types';
import { moduleKeyFromJoinedRelation, resolveNoteSourceRecordIdsWithClient } from './note-aggregate';
import { applyCrmRecordTextSearch, applyHideConvertedLeadsFilter, isConvertedLeadRow } from './record-search';
import { alignMisalignedRecordModule } from './align-record-module';
import { resolveCrmRecordFilterField } from './report-field-path';

// ============================================================================
// Date Range Helper Functions
// ============================================================================

interface DateRange {
  start: Date;
  end: Date;
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDateRangeForPreset(preset: FilterOperator, nValue?: number): DateRange | null {
  const now = new Date();
  const today = getStartOfDay(now);

  switch (preset) {
    case 'today':
      return { start: today, end: getEndOfDay(now) };

    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: getEndOfDay(yesterday) };
    }

    case 'this_week': {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - day); // Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return { start: startOfWeek, end: getEndOfDay(endOfWeek) };
    }

    case 'last_week': {
      const startOfLastWeek = new Date(today);
      const day = startOfLastWeek.getDay();
      startOfLastWeek.setDate(startOfLastWeek.getDate() - day - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
      return { start: startOfLastWeek, end: getEndOfDay(endOfLastWeek) };
    }

    case 'this_month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: startOfMonth, end: getEndOfDay(endOfMonth) };
    }

    case 'last_month': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfLastMonth, end: getEndOfDay(endOfLastMonth) };
    }

    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
      const endOfQuarter = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      return { start: startOfQuarter, end: getEndOfDay(endOfQuarter) };
    }

    case 'last_quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      const lastQuarter = quarter === 0 ? 3 : quarter - 1;
      const year = quarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const startOfLastQuarter = new Date(year, lastQuarter * 3, 1);
      const endOfLastQuarter = new Date(year, lastQuarter * 3 + 3, 0);
      return { start: startOfLastQuarter, end: getEndOfDay(endOfLastQuarter) };
    }

    case 'this_year': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      return { start: startOfYear, end: getEndOfDay(endOfYear) };
    }

    case 'last_year': {
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
      return { start: startOfLastYear, end: getEndOfDay(endOfLastYear) };
    }

    case 'last_n_days': {
      const n = nValue || 7;
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - n);
      return { start: startDate, end: getEndOfDay(now) };
    }

    case 'next_n_days': {
      const n = nValue || 7;
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + n);
      return { start: today, end: getEndOfDay(endDate) };
    }

    default:
      return null;
  }
}

// ============================================================================
// Supabase Client Helper
// ============================================================================

export async function createCrmClient() {
  // Validate environment variables early
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[CRM] Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    throw new Error('Missing Supabase configuration. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  
  const cookieStore = await cookies();
  
  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context - cookies are read-only
          }
        },
      },
    }
  );
}

// ============================================================================
// User & Profile Queries
// ============================================================================
// Tenant: `profiles.organization_id` is the same UUID as `crm_*`.`org_id` for that tenant
// (conventions: `lib/crm/org-scope.ts`).

export async function getCurrentProfile(): Promise<CrmProfile | null> {
  try {
    // Use cached auth to prevent concurrent token refresh conflicts (409 errors)
    const { user, error: authError } = await getCachedAuthUser();
    
    if (authError) {
      console.error('[CRM] Auth error getting user:', authError.message);
      return null;
    }
    
    if (!user) return null;

    const supabase = await createCrmClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, organization_id, email, full_name, avatar_url, role, crm_role, is_active, created_at, updated_at, advisor_id, ui_preferences')
      .eq('user_id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[CRM] Error fetching profile:', profileError.message);
    }

    if (!profile) return null;

    // Override organization_id with the active tenant when the user has
    // switched orgs via organization_members. Mirrors the same pattern in
    // apps/crm/src/lib/supabase-server.ts so every CRM call site that reads
    // profile.organization_id auto-scopes to the active tenant.
    const { getActiveTenant } = await import('@/lib/tenant');
    const tenant = await getActiveTenant();
    if (tenant && tenant.organizationId !== profile.organization_id) {
      return { ...profile, organization_id: tenant.organizationId } as CrmProfile;
    }

    return profile as CrmProfile;
  } catch (error) {
    console.error('[CRM] getCurrentProfile failed:', error);
    return null; // Return null instead of throwing — callers check for null
  }
}

/**
 * Cached version of getCurrentProfile - deduplicates within a single request
 * Use this in layouts to avoid re-fetching on every navigation
 */
export const getCachedCurrentProfile = cache(getCurrentProfile);

export async function getOrganizationProfiles(orgId: string): Promise<CrmProfile[]> {
  const supabase = await createCrmClient();

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', orgId)
    .not('crm_role', 'is', null)
    .order('full_name');

  return (data || []) as CrmProfile[];
}

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
}

export async function getOrganization(orgId: string): Promise<OrganizationInfo | null> {
  const supabase = await createCrmClient();

  const { data } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('id', orgId)
    .single();

  return data as OrganizationInfo | null;
}

/**
 * Per-request memoized version of getOrganization.
 * Uses React.cache() for deduplication within a single request.
 * Safe with cookies()/auth — no unstable_cache proxy issues.
 */
export const getCachedOrganization = cache(
  async (orgId: string) => getOrganization(orgId)
);

// ============================================================================
// Module Queries
// ============================================================================

export async function getModules(orgId: string): Promise<CrmModule[]> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from('crm_modules')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_enabled', true)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmModule[];
}

/**
 * Per-request memoized version of getModules.
 * Uses React.cache() for deduplication within a single request.
 */
export const getCachedModules = cache(
  async (orgId: string) => getModules(orgId)
);

// ============================================================================
// Territories
// ============================================================================

/**
 * Fetch all active territories for an organization.
 */
export async function getTerritories(orgId: string): Promise<CrmTerritory[]> {
  const supabase = await createCrmClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('crm_territories')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmTerritory[];
}

/** Per-request memoized version of getTerritories */
export const getCachedTerritories = cache(
  async (orgId: string) => getTerritories(orgId)
);

// ============================================================================
// Module queries
// ============================================================================

export async function getModuleByKey(orgId: string, key: string): Promise<CrmModule | null> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from('crm_modules')
    .select('id, org_id, key, name, name_plural, icon, description, is_system, is_enabled, display_order, settings, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmModule | null;
}

export async function getAllModules(orgId: string): Promise<CrmModule[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_modules')
    .select('*')
    .eq('org_id', orgId)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmModule[];
}

// ============================================================================
// Field Queries
// ============================================================================

export async function getFieldsForModule(moduleId: string): Promise<CrmField[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_fields')
    .select('*')
    .eq('module_id', moduleId)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmField[];
}

export async function getFieldsBySection(moduleId: string): Promise<Record<string, CrmField[]>> {
  const fields = await getFieldsForModule(moduleId);
  
  return fields.reduce((acc, field) => {
    const section = field.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {} as Record<string, CrmField[]>);
}

// ============================================================================
// Layout Queries
// ============================================================================

export async function getDefaultLayout(moduleId: string): Promise<CrmLayout | null> {
  const supabase = await createCrmClient();

  // Tolerate accidental duplicate defaults: pick the most recently updated.
  // The DB also enforces uniqueness via uq_crm_layouts_one_default_per_module
  // (202605040002), this is the application-side belt-and-suspenders.
  const { data, error } = await supabase
    .from('crm_layouts')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_default', true)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return ((data?.[0] ?? null) as CrmLayout | null);
}

export async function getLayoutsForModule(moduleId: string): Promise<CrmLayout[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_layouts')
    .select('*')
    .eq('module_id', moduleId)
    .order('name');

  if (error) throw error;
  return (data || []) as CrmLayout[];
}

// ============================================================================
// View Queries
// ============================================================================

export async function getViewsForModule(moduleId: string): Promise<CrmView[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_views')
    .select('*')
    .eq('module_id', moduleId)
    .order('name');

  if (error) throw error;
  return (data || []) as CrmView[];
}

export async function getDefaultView(moduleId: string): Promise<CrmView | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_views')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmView | null;
}

// ============================================================================
// Record Queries
// ============================================================================

export interface RecordQueryOptions {
  moduleId: string;
  /** Always pass the module's `org_id` so lists cannot cross organizations if `module_id` is ever wrong. */
  orgId?: string;
  page?: number;
  pageSize?: number;
  filters?: ViewFilter[];
  sort?: ViewSort[];
  search?: string;
  /** `crm_fields.key` paths for searching `data->>key` (avoids brittle `data::text` filters) */
  searchDataJsonKeys?: string[];
  scope?: 'all' | 'mine' | 'downline';
  /** Optional territory ID to filter records by */
  territoryId?: string;
  /**
   * When false, the query does not request an exact row count (cheaper for paged export).
   * Returned `total` will be 0.
   */
  includeCount?: boolean;
  /** When `'leads'`, hide converted leads from list counts (Zoho-style). */
  moduleKey?: string;
  /** Override hide-converted behavior (default: true when moduleKey is leads). */
  hideConvertedLeads?: boolean;
}

export interface RecordQueryResult {
  records: CrmRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getRecords(options: RecordQueryOptions): Promise<RecordQueryResult> {
  const supabase = await createCrmClient();
  const {
    moduleId,
    orgId,
    page = 1,
    pageSize = 25,
    filters = [],
    sort = [],
    search,
    searchDataJsonKeys,
    scope = 'all',
    territoryId,
    includeCount = true,
    moduleKey,
    hideConvertedLeads,
  } = options;

  const shouldHideConvertedLeads =
    hideConvertedLeads ?? moduleKey === 'leads';

  let query = includeCount
    ? supabase
        .from('crm_records')
        .select('*', { count: 'exact' })
        .eq('module_id', moduleId)
    : supabase.from('crm_records').select('*').eq('module_id', moduleId);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  if (shouldHideConvertedLeads) {
    query = applyHideConvertedLeadsFilter(query);
  }

  // Apply territory filter
  if (territoryId) {
    query = query.eq('territory_id', territoryId);
  }

  // Apply scope filtering (My Records / My Downline / All)
  if (scope === 'mine' || scope === 'downline') {
    // Get the current user's profile ID to filter by owner
    const { user } = await getCachedAuthUser();
    if (user) {
      if (scope === 'mine') {
        // Only records owned by the current user's profile
        const { data: myProfile } = await (supabase as any)
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (myProfile) {
          query = query.eq('owner_id', myProfile.id);
        }
      } else if (scope === 'downline') {
        // Records owned by the current user OR any of their downline advisors' profiles
        const { data: myProfile } = await (supabase as any)
          .from('profiles')
          .select('id, advisor_id')
          .eq('user_id', user.id)
          .single();
        if (myProfile?.advisor_id) {
          // Get downline advisor IDs using the DB function
          const { data: downlineIds } = await (supabase as any)
            .rpc('get_advisor_downline_ids', { p_advisor_id: myProfile.advisor_id });
          // Get profile IDs for all downline advisors
          const advisorIds = [myProfile.advisor_id, ...(downlineIds?.map((r: any) => r) || [])];
          const { data: downlineProfiles } = await (supabase as any)
            .from('profiles')
            .select('id')
            .in('advisor_id', advisorIds);
          const profileIds = [
            myProfile.id,
            ...(downlineProfiles?.map((p: any) => p.id) || []),
          ];
          // Include records by owner_id (manually created) OR canonical_advisor_id (imported)
          query = query.or(
            `owner_id.in.(${profileIds.join(',')}),canonical_advisor_id.in.(${advisorIds.join(',')})`
          );
        } else if (myProfile) {
          // User is not an advisor, just show their own records
          query = query.eq('owner_id', myProfile.id);
        }
      }
    }
  }

  // ── Separate filters by category ──
  const fieldFilters = filters.filter((f) => !f.category || f.category === 'field');
  const systemFilters = filters.filter((f) => f.category === 'system' && f.systemPreset);
  const relatedFilters = filters.filter((f) => f.category === 'related' && f.relatedModule);

  // ── Apply system preset filters via RPC ──
  if (systemFilters.length > 0) {
    // Get user profile ID for user-scoped system presets
    let userProfileId: string | null = null;
    const needsUser = systemFilters.some((f) => f.systemPreset === 'my_records');
    if (needsUser) {
      const { user } = await getCachedAuthUser();
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prof } = await (supabase as any)
          .from('profiles').select('id').eq('user_id', user.id).single();
        userProfileId = prof?.id ?? null;
      }
    }

    // Parallelize system filter RPCs for performance
    const systemRpcResults = await Promise.allSettled(
      systemFilters.map((sf) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc('filter_records_by_system_preset', {
          p_module_id: moduleId,
          p_preset: sf.systemPreset,
          p_user_profile_id: userProfileId,
          p_value: sf.secondValue != null ? String(sf.secondValue) : null,
        })
      )
    );

    for (const result of systemRpcResults) {
      if (result.status === 'fulfilled') {
        const { data: matchedIds, error: rpcErr } = result.value;
        if (!rpcErr && matchedIds && matchedIds.length > 0) {
          query = query.in('id', matchedIds);
        } else if (!rpcErr && matchedIds && matchedIds.length === 0) {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        console.error('[CRM] System filter RPC failed:', result.reason);
      }
    }
  }

  // ── Apply related module filters via RPC ──
  if (relatedFilters.length > 0) {
    // Map related module keys to RPC arguments
    const RELATED_MODULE_MAP: Record<string, { relatedType: string; activityType: string | null }> = {
      // Core activities
      activities: { relatedType: 'activities', activityType: null },
      calls: { relatedType: 'calls', activityType: 'call' },
      emails: { relatedType: 'emails', activityType: 'email' },
      meetings: { relatedType: 'appointments', activityType: 'meeting' },
      tasks: { relatedType: 'tasks', activityType: 'task' },
      notes: { relatedType: 'notes', activityType: null },
      // Connected records
      accounts: { relatedType: 'linked_records', activityType: 'accounts' },
      contacts: { relatedType: 'linked_records', activityType: 'contacts' },
      leads: { relatedType: 'linked_records', activityType: 'leads' },
      campaigns: { relatedType: 'linked_records', activityType: 'campaigns' },
      products: { relatedType: 'linked_records', activityType: 'products' },
      lead_products: { relatedType: 'linked_records', activityType: 'products' },
      invoices: { relatedType: 'linked_records', activityType: 'invoices' },
      prospects: { relatedType: 'linked_records', activityType: 'prospects' },
      prospect_roles: { relatedType: 'linked_by_type', activityType: 'prospect_role' },
      providers: { relatedType: 'linked_records', activityType: 'providers' },
      // Health sharing specific
      aca_clients: { relatedType: 'linked_records', activityType: 'aca_clients' },
      cirrusmd_contacts: { relatedType: 'linked_records', activityType: 'cirrusmd_contacts' },
      planstin_contacts: { relatedType: 'linked_records', activityType: 'planstin_contacts' },
      pricing_matrix: { relatedType: 'linked_records', activityType: 'pricing_matrix' },
      producers: { relatedType: 'linked_records', activityType: 'producers' },
      // Service & support
      services: { relatedType: 'linked_records', activityType: 'services' },
      solutions: { relatedType: 'linked_records', activityType: 'solutions' },
      support: { relatedType: 'linked_records', activityType: 'support' },
      // System
      data_subject_requests: { relatedType: 'linked_records', activityType: 'data_subject_requests' },
      reporting_contacts: { relatedType: 'linked_records', activityType: 'contacts' },
      meeting_invitees: { relatedType: 'meeting_invitees', activityType: null },
    };

    // Build RPC calls for related filters, skipping unmapped modules
    const relatedRpcCalls = relatedFilters
      .map((rf) => ({ filter: rf, mapping: RELATED_MODULE_MAP[rf.relatedModule!] }))
      .filter((entry) => entry.mapping != null);

    // Parallelize related filter RPCs for performance
    const relatedRpcResults = await Promise.all(
      relatedRpcCalls.map(({ filter: rf, mapping }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc('filter_records_by_related', {
          p_module_id: moduleId,
          p_related_type: mapping.relatedType,
          p_condition: rf.relatedCondition || 'has_any',
          p_activity_type: mapping.activityType,
        })
      )
    );

    for (const { data: matchedIds, error: rpcErr } of relatedRpcResults) {
      if (!rpcErr && matchedIds && matchedIds.length > 0) {
        query = query.in('id', matchedIds);
      } else if (!rpcErr && matchedIds && matchedIds.length === 0) {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
  }

  /** Escape PostgreSQL LIKE/ILIKE wildcard characters in user input */
  function escapeLikePattern(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }

  // ── Apply field-based filters ──
  for (const filter of fieldFilters) {
    const fieldPath =
      resolveCrmRecordFilterField(filter.field, 'crm_records') ??
      `data->>${filter.field}`;

    // Boolean system columns: convert string 'true'/'false' to actual boolean
    const isBooleanColumn = ['tobacco_user', 'age_is_estimated'].includes(filter.field);
    let filterValue = filter.value;
    if (isBooleanColumn && typeof filterValue === 'string') {
      filterValue = filterValue === 'true';
    }

    switch (filter.operator) {
      // Basic comparison operators
      case 'equals':
        query = query.eq(fieldPath, filterValue);
        break;
      case 'not_equals':
        query = query.neq(fieldPath, filterValue);
        break;
      case 'contains':
        query = query.ilike(fieldPath, `%${escapeLikePattern(String(filter.value ?? ''))}%`);
        break;
      case 'starts_with':
        query = query.ilike(fieldPath, `${escapeLikePattern(String(filter.value ?? ''))}%`);
        break;
      case 'ends_with':
        query = query.ilike(fieldPath, `%${escapeLikePattern(String(filter.value ?? ''))}`);
        break;

      // Numeric/date comparison operators
      case 'gt':
        query = query.gt(fieldPath, filter.value);
        break;
      case 'gte':
        query = query.gte(fieldPath, filter.value);
        break;
      case 'lt':
        query = query.lt(fieldPath, filter.value);
        break;
      case 'lte':
        query = query.lte(fieldPath, filter.value);
        break;

      // Null checks
      case 'is_null':
        query = query.is(fieldPath, null);
        break;
      case 'is_not_null':
        query = query.not(fieldPath, 'is', null);
        break;

      // Array operators
      case 'in':
        if (Array.isArray(filter.value)) {
          query = query.in(fieldPath, filter.value);
        } else if (typeof filter.value === 'string') {
          query = query.in(fieldPath, filter.value.split(',').map(v => v.trim()));
        }
        break;
      case 'not_in':
        if (Array.isArray(filter.value)) {
          query = query.not(fieldPath, 'in', `(${filter.value.join(',')})`);
        } else if (typeof filter.value === 'string') {
          const values = filter.value.split(',').map(v => v.trim());
          query = query.not(fieldPath, 'in', `(${values.join(',')})`);
        }
        break;

      // Between operator (requires secondValue)
      case 'between':
        if (filter.value != null && filter.secondValue != null) {
          query = query.gte(fieldPath, filter.value).lte(fieldPath, filter.secondValue);
        }
        break;

      // Date preset operators
      case 'today':
      case 'yesterday':
      case 'this_week':
      case 'last_week':
      case 'this_month':
      case 'last_month':
      case 'this_quarter':
      case 'last_quarter':
      case 'this_year':
      case 'last_year': {
        const range = getDateRangeForPreset(filter.operator);
        if (range) {
          query = query.gte(fieldPath, range.start.toISOString()).lte(fieldPath, range.end.toISOString());
        }
        break;
      }

      // Last/Next N days (uses filter.value as N)
      case 'last_n_days':
      case 'next_n_days': {
        const nValue = typeof filter.value === 'number' ? filter.value : parseInt(filter.value as string, 10);
        const range = getDateRangeForPreset(filter.operator, isNaN(nValue) ? 7 : nValue);
        if (range) {
          query = query.gte(fieldPath, range.start.toISOString()).lte(fieldPath, range.end.toISOString());
        }
        break;
      }
    }
  }

  if (search?.trim()) {
    let dataJsonKeys = searchDataJsonKeys;
    if (!dataJsonKeys?.length) {
      const flds = await getFieldsForModule(moduleId);
      dataJsonKeys = flds.map((f) => f.key);
    }
    query = applyCrmRecordTextSearch(query, search, { dataJsonKeys });
  }

  // Apply sorting — real columns on crm_records vs JSONB `data` paths
  if (sort.length > 0) {
    for (const s of sort) {
      const fieldPath =
        resolveCrmRecordFilterField(s.field, 'crm_records') ??
        `data->>${s.field}`;
      query = query.order(fieldPath, { ascending: s.direction === 'asc' });
    }
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  const rows = (data || []) as CrmRecord[];
  const seenIds = new Set<string>();
  const records = rows.filter((r) => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    if (shouldHideConvertedLeads && isConvertedLeadRow({ module_key: moduleKey ?? 'leads', status: r.status, data: r.data as Record<string, unknown> | null })) {
      return false;
    }
    return true;
  });

  return {
    records,
    total: includeCount ? count || 0 : 0,
    page,
    pageSize,
    totalPages: includeCount ? Math.ceil((count || 0) / pageSize) : 0,
  };
}

export async function getRecordById(recordId: string): Promise<CrmRecord | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmRecord | null;
}

export async function getRecordWithModule(recordId: string): Promise<{ record: CrmRecord; module: CrmModule } | null> {
  const profile = await getCachedCurrentProfile();
  if (!profile?.organization_id) return null;

  await alignMisalignedRecordModule(profile.organization_id, recordId);

  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from('crm_records')
    .select('*, module:crm_modules!crm_records_module_id_fkey(*)')
    .eq('id', recordId)
    .single();

  if (error || !data) return null;

  const { module: moduleData, ...recordData } = data;
  if (!moduleData) return null;

  return {
    record: recordData as CrmRecord,
    module: moduleData as CrmModule,
  };
}

// ============================================================================
// Notes Queries
// ============================================================================

const DEFAULT_NOTES_LIMIT = 500;

/** All CRM record IDs whose notes appear on this record (person lineage, deal links, etc.). */
export async function resolveNoteSourceRecordIds(
  record: CrmRecord,
  moduleKey: string,
): Promise<string[]> {
  const supabase = await createCrmClient();
  return resolveNoteSourceRecordIdsWithClient(supabase, record, moduleKey);
}

export async function getNotesForRecords(
  recordIds: string[],
  limit = DEFAULT_NOTES_LIMIT,
): Promise<CrmNoteWithAuthor[]> {
  const uniqueIds = [...new Set(recordIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const supabase = await createCrmClient();

  let data, error;
  ({ data, error } = await supabase
    .from('crm_notes')
    .select(`
      *,
      author:profiles!crm_notes_created_by_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .in('record_id', uniqueIds)
    .order('created_at', { ascending: false })
    .limit(limit));

  if (error) {
    console.warn('[CRM] Notes FK hint failed, trying without hint:', error.message);
    ({ data, error } = await supabase
      .from('crm_notes')
      .select(`
        *,
        author:profiles(
          id,
          full_name,
          avatar_url
        )
      `)
      .in('record_id', uniqueIds)
      .order('created_at', { ascending: false })
      .limit(limit));
  }

  if (error) {
    console.error('[CRM] getNotesForRecords failed:', error);
    return [];
  }

  const rows = (data || []) as CrmNoteWithAuthor[];

  // Deduplicate: when notes are aggregated across linked records (e.g. a
  // lead was converted to a contact and both got the same Zoho notes), the
  // same body + timestamp can appear twice. Keep the first occurrence.
  if (uniqueIds.length > 1) {
    const seen = new Set<string>();
    const deduped: CrmNoteWithAuthor[] = [];
    for (const note of rows) {
      const key = `${(note.body || '').trim().slice(0, 200)}|${note.created_at}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(note);
    }
    return deduped;
  }

  return rows;
}

export async function getNotesForRecordAggregated(
  record: CrmRecord,
  moduleKey: string,
  limit = DEFAULT_NOTES_LIMIT,
): Promise<CrmNoteWithAuthor[]> {
  const ids = await resolveNoteSourceRecordIds(record, moduleKey);
  return getNotesForRecords(ids, limit);
}

export async function getNotesForRecord(
  recordId: string,
  limit = DEFAULT_NOTES_LIMIT,
): Promise<CrmNoteWithAuthor[]> {
  return getNotesForRecords([recordId], limit);
}

// ============================================================================
// Tasks Queries
// ============================================================================

export async function getTasksForRecord(recordId: string, limit = 100): Promise<CrmTask[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_tasks')
    .select('*')
    .eq('record_id', recordId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CrmTask[];
}

export async function getMyTasks(profileId: string, includeCompleted = false, limit = 200): Promise<CrmTask[]> {
  const supabase = await createCrmClient();
  
  let query = supabase
    .from('crm_tasks')
    .select('*')
    .eq('assigned_to', profileId);

  if (!includeCompleted) {
    query = query.neq('status', 'completed');
  }

  const { data, error } = await query
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CrmTask[];
}

export async function getUpcomingTasks(profileId: string, days = 7, limit = 100): Promise<CrmTask[]> {
  const supabase = await createCrmClient();
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  const { data, error } = await supabase
    .from('crm_tasks')
    .select('*')
    .eq('assigned_to', profileId)
    .neq('status', 'completed')
    .lte('due_at', futureDate.toISOString())
    .order('due_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CrmTask[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  type: 'meeting' | 'call' | 'task' | 'reminder';
}

export async function getCalendarEvents(orgId: string, days = 14): Promise<CalendarEvent[]> {
  const supabase = await createCrmClient();

  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  // Fetch meetings and calls from crm_tasks
  const { data, error } = await supabase
    .from('crm_tasks')
    .select('id, title, due_at, activity_type, meeting_location')
    .eq('org_id', orgId)
    .in('activity_type', ['meeting', 'call'])
    .neq('status', 'completed')
    .gte('due_at', now.toISOString())
    .lte('due_at', futureDate.toISOString())
    .order('due_at', { ascending: true })
    .limit(20);

  if (error) throw error;

  // Transform to CalendarEvent format
  return (data || []).map((task: {
    id: string;
    title: string;
    due_at: string | null;
    activity_type: string;
    meeting_location: string | null;
  }) => ({
    id: task.id,
    title: task.title,
    start_time: task.due_at || new Date().toISOString(),
    end_time: task.due_at
      ? new Date(new Date(task.due_at).getTime() + 3600000).toISOString() // 1 hour duration
      : new Date().toISOString(),
    location: task.meeting_location || undefined,
    type: task.activity_type as 'meeting' | 'call',
  }));
}

// ============================================================================
// Audit Log Queries
// ============================================================================

export async function getAuditLogForRecord(recordId: string, limit = 50): Promise<CrmAuditLog[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_audit_log')
    .select('id, org_id, actor_id, action, entity, entity_id, diff, meta, created_at')
    .eq('entity', 'crm_records')
    .eq('entity_id', recordId)
    // `created_at` ties happen often (bulk imports / batch jobs write rows
    // within the same microsecond). Adding `id` as the secondary key makes
    // the LIMIT cutoff reproducible run-to-run.
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CrmAuditLog[];
}

export async function getRecentActivity(orgId: string, limit = 20): Promise<CrmAuditLog[]> {
  const supabase = await createCrmClient();

  // Only select fields needed for display - reduces payload size
  const { data, error } = await supabase
    .from('crm_audit_log')
    .select('id, action, entity, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CrmAuditLog[];
}

// ============================================================================
// Import Queries
// ============================================================================

export async function getRecentImportJobs(orgId: string, limit = 10): Promise<CrmImportJob[]> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from('crm_import_jobs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as CrmImportJob[];
}

export async function getImportJob(jobId: string): Promise<CrmImportJob | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_import_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmImportJob | null;
}

// ============================================================================
// Dashboard Stats Queries
// ============================================================================

export async function getModuleStats(orgId: string): Promise<ModuleStats[]> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase.rpc('get_module_stats', {
    p_org_id: orgId,
  });

  if (error) {
    console.error('[getModuleStats] RPC error:', error);
    return [];
  }

  return (data || []) as ModuleStats[];
}

export interface DashboardHeroStats {
  todaysTaskCount: number;
  overdueCount: number;
  atRiskCount: number;
  newThisWeek: number;
}

export async function getDashboardHeroStats(
  orgId: string,
  userId: string,
): Promise<DashboardHeroStats> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase.rpc('get_dashboard_hero_stats', {
    p_org_id: orgId,
    p_user_id: userId,
  });

  if (error) {
    console.error('[getDashboardHeroStats] RPC error:', error);
    return { todaysTaskCount: 0, overdueCount: 0, atRiskCount: 0, newThisWeek: 0 };
  }

  return {
    todaysTaskCount: data?.todaysTaskCount ?? 0,
    overdueCount: data?.overdueCount ?? 0,
    atRiskCount: data?.atRiskCount ?? 0,
    newThisWeek: data?.newThisWeek ?? 0,
  };
}

export interface AtRiskDeal {
  id: string;
  name: string;
  value: number;
  stage: string;
  daysInStage: number;
  ownerId: string | null;
  ownerName: string | null;
  reason: 'stale' | 'overdue_task' | 'no_activity';
}

export async function getAtRiskDeals(orgId: string, limit: number = 5): Promise<AtRiskDeal[]> {
  const supabase = await createCrmClient();

  // Get deals that have been in the same stage for more than 7 days
  // Single query using inner join with crm_modules to filter by org and module key
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: records } = await supabase
    .from('crm_records')
    .select(`
      id,
      data,
      owner_id,
      stage_updated_at,
      profiles:owner_id (full_name),
      crm_modules!inner (org_id, key)
    `)
    .eq('crm_modules.org_id', orgId)
    .eq('crm_modules.key', 'deals')
    .lt('stage_updated_at', sevenDaysAgo.toISOString())
    .not('data->stage', 'in', '("Closed Won","Closed Lost","closed_won","closed_lost")')
    .order('stage_updated_at', { ascending: true })
    .limit(limit);

  if (!records || records.length === 0) return [];

  const now = new Date();
  return records.map(record => {
    const data = record.data as Record<string, unknown>;
    const stageUpdated = record.stage_updated_at ? new Date(record.stage_updated_at) : now;
    const daysInStage = Math.floor((now.getTime() - stageUpdated.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: record.id,
      name: (data.name || data.deal_name || 'Unnamed Deal') as string,
      value: (data.value || data.amount || data.deal_value || 0) as number,
      stage: (data.stage || data.deal_stage || 'Unknown') as string,
      daysInStage,
      ownerId: record.owner_id,
      ownerName: (() => {
        const profiles = record.profiles as { full_name: string } | { full_name: string }[] | null;
        if (!profiles) return null;
        if (Array.isArray(profiles)) return profiles[0]?.full_name || null;
        return profiles.full_name || null;
      })(),
      reason: 'stale' as const,
    };
  });
}

export async function getTodaysTasks(userId: string, limit = 100): Promise<CrmTask[]> {
  const supabase = await createCrmClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data } = await supabase
    .from('crm_tasks')
    .select('*')
    .eq('assigned_to', userId)
    .neq('status', 'completed')
    .gte('due_at', today.toISOString())
    .lt('due_at', tomorrow.toISOString())
    .order('due_at', { ascending: true })
    .limit(limit);

  return (data || []) as CrmTask[];
}

// ============================================================================
// Reporting Queries
// ============================================================================

export interface MonthlyRecordCounts {
  month: string;
  leads: number;
  contacts: number;
  deals: number;
}

export async function getMonthlyRecordCounts(orgId: string, monthsBack: number = 6): Promise<MonthlyRecordCounts[]> {
  const supabase = await createCrmClient();

  // Get module IDs
  const { data: modules } = await supabase
    .from('crm_modules')
    .select('id, key')
    .eq('org_id', orgId)
    .in('key', ['leads', 'contacts', 'deals']);

  if (!modules || modules.length === 0) {
    return [];
  }

  const moduleMap: Record<string, string> = {};
  modules.forEach(m => { moduleMap[m.key] = m.id; });

  const now = new Date();
  const moduleKeys = ['leads', 'contacts', 'deals'] as const;

  // Build all month ranges
  const monthRanges = Array.from({ length: monthsBack }, (_, i) => {
    const idx = monthsBack - 1 - i;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - idx, 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - idx + 1, 0, 23, 59, 59);
    return {
      monthName: startOfMonth.toLocaleString('en-US', { month: 'short' }),
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString(),
    };
  });

  // Execute ALL queries in parallel - eliminates nested loop N+1 problem
  const allQueries = monthRanges.flatMap((range, monthIndex) =>
    moduleKeys.map(key => {
      if (!moduleMap[key]) {
        return Promise.resolve({ monthIndex, key, count: 0 });
      }
      return supabase
        .from('crm_records')
        .select('*', { count: 'exact', head: true })
        .eq('module_id', moduleMap[key])
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .then(r => ({ monthIndex, key, count: r.count || 0 }));
    })
  );

  const queryResults = await Promise.all(allQueries);

  // Build results from parallel query responses
  const results: MonthlyRecordCounts[] = monthRanges.map((range, idx) => ({
    month: range.monthName,
    leads: 0,
    contacts: 0,
    deals: 0,
  }));

  queryResults.forEach(({ monthIndex, key, count }) => {
    results[monthIndex][key] = count;
  });

  return results;
}

// ============================================================================
// Cached Dashboard Queries - For expensive operations
// ============================================================================

/**
 * Per-request memoized version of getModuleStats.
 * Uses React.cache() — safe with cookies/auth, deduplicates within a request.
 */
export const getCachedModuleStats = cache(
  async (orgId: string) => getModuleStats(orgId)
);

/**
 * Per-request memoized version of getDashboardHeroStats.
 */
export const getCachedDashboardHeroStats = cache(
  async (orgId: string, userId: string) => getDashboardHeroStats(orgId, userId)
);

/**
 * Per-request memoized version of getMonthlyRecordCounts.
 */
export const getCachedMonthlyRecordCounts = cache(
  async (orgId: string, monthsBack: number = 6) => getMonthlyRecordCounts(orgId, monthsBack)
);

/**
 * Per-request memoized version of getAtRiskDeals.
 */
export const getCachedAtRiskDeals = cache(
  async (orgId: string, limit: number = 5) => getAtRiskDeals(orgId, limit)
);

export interface ReportSummary {
  totalContacts: number;
  totalLeads: number;
  totalDeals: number;
  totalAccounts: number;
  leadsThisWeek: number;
  contactsThisWeek: number;
  dealsClosedThisWeek: number;
  conversionRate: number;
}

export async function getReportSummary(orgId: string): Promise<ReportSummary> {
  const stats = await getModuleStats(orgId);
  
  const totalContacts = stats.find(s => s.moduleKey === 'contacts')?.totalRecords || 0;
  const totalLeads = stats.find(s => s.moduleKey === 'leads')?.totalRecords || 0;
  const totalDeals = stats.find(s => s.moduleKey === 'deals')?.totalRecords || 0;
  const totalAccounts = stats.find(s => s.moduleKey === 'accounts')?.totalRecords || 0;
  
  const leadsThisWeek = stats.find(s => s.moduleKey === 'leads')?.createdThisWeek || 0;
  const contactsThisWeek = stats.find(s => s.moduleKey === 'contacts')?.createdThisWeek || 0;
  const dealsClosedThisWeek = stats.find(s => s.moduleKey === 'deals')?.createdThisWeek || 0;
  
  // Calculate conversion rate (converted leads / total leads)
  const conversionRate = totalLeads > 0 ? Math.round((totalContacts / totalLeads) * 100) : 0;

  return {
    totalContacts,
    totalLeads,
    totalDeals,
    totalAccounts,
    leadsThisWeek,
    contactsThisWeek,
    dealsClosedThisWeek,
    conversionRate,
  };
}

// ============================================================================
// Deal Stages Queries
// ============================================================================

export async function getDealStages(orgId: string): Promise<CrmDealStage[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_deal_stages')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('display_order');

  if (error) throw error;
  return (data || []) as CrmDealStage[];
}

export async function getDealStageByKey(orgId: string, key: string): Promise<CrmDealStage | null> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_deal_stages')
    .select('*')
    .eq('org_id', orgId)
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as CrmDealStage | null;
}

// ============================================================================
// Stage History Queries
// ============================================================================

export async function getStageHistory(recordId: string): Promise<CrmStageHistoryWithUser[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_deal_stage_history')
    .select(`
      *,
      changed_by_profile:profiles!crm_deal_stage_history_changed_by_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((item: Record<string, unknown>) => ({
    ...item,
    changed_by_name: (item.changed_by_profile as { full_name: string } | null)?.full_name || null,
  })) as CrmStageHistoryWithUser[];
}

// ============================================================================
// Record Links Queries
// ============================================================================

export async function getRecordLinks(recordId: string): Promise<CrmLinkedRecord[]> {
  const supabase = await createCrmClient();

  // Run both queries in parallel
  const [outboundResult, inboundResult] = await Promise.all([
    // Get outbound links (this record -> other)
    supabase
      .from('crm_record_links')
      .select(`
        id,
        link_type,
        is_primary,
        created_at,
        target_record:crm_records!crm_record_links_target_record_id_fkey(
          id,
          title,
          module:crm_modules!crm_records_module_id_fkey(
            key,
            name
          )
        )
      `)
      .eq('source_record_id', recordId),
    // Get inbound links (other -> this record)
    supabase
      .from('crm_record_links')
      .select(`
        id,
        link_type,
        is_primary,
        created_at,
        source_record:crm_records!crm_record_links_source_record_id_fkey(
          id,
          title,
          module:crm_modules!crm_records_module_id_fkey(
            key,
            name
          )
        )
      `)
      .eq('target_record_id', recordId),
  ]);

  if (outboundResult.error) throw outboundResult.error;
  if (inboundResult.error) throw inboundResult.error;

  const outbound = outboundResult.data;
  const inbound = inboundResult.data;

  // Transform both link arrays using flatMap for proper null filtering
  const outboundLinks: CrmLinkedRecord[] = (outbound || []).flatMap(link => {
    const record = link.target_record as unknown as { id: string; title: string; module: { key: string; name: string } };
    if (!record) return [];
    return [{
      link_id: link.id,
      link_type: link.link_type,
      is_primary: link.is_primary,
      direction: 'outbound' as const,
      record_id: record.id,
      record_title: record.title,
      record_module_key: record.module?.key || '',
      record_module_name: record.module?.name || '',
      created_at: link.created_at,
    }];
  });

  const inboundLinks: CrmLinkedRecord[] = (inbound || []).flatMap(link => {
    const record = link.source_record as unknown as { id: string; title: string; module: { key: string; name: string } };
    if (!record) return [];
    return [{
      link_id: link.id,
      link_type: link.link_type,
      is_primary: link.is_primary,
      direction: 'inbound' as const,
      record_id: record.id,
      record_title: record.title,
      record_module_key: record.module?.key || '',
      record_module_name: record.module?.name || '',
      created_at: link.created_at,
    }];
  });

  // Combine and sort by created_at desc
  return [...outboundLinks, ...inboundLinks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ============================================================================
// Attachments Queries
// ============================================================================

export async function getAttachmentsForRecord(recordId: string): Promise<CrmAttachmentWithAuthor[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_attachments')
    .select(`
      *,
      author:profiles!crm_attachments_created_by_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CrmAttachmentWithAuthor[];
}

// ============================================================================
// Timeline Queries
// ============================================================================

export async function getTimelineForRecord(
  recordId: string,
  limit = 50,
  noteRecordIds?: string[],
): Promise<TimelineEvent[]> {
  const supabase = await createCrmClient();
  const noteIds =
    noteRecordIds && noteRecordIds.length > 0 ? noteRecordIds : [recordId];

  // Fetch all timeline sources in parallel
  const [stageHistory, tasks, notes, attachments, auditLogs] = await Promise.all([
    // Stage history
    supabase
      .from('crm_deal_stage_history')
      .select(`
        *,
        changed_by_profile:profiles!crm_deal_stage_history_changed_by_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('record_id', recordId)
      // Each timeline subquery uses (created_at DESC, id DESC) so the LIMIT
      // cutoff is reproducible — bulk inserts (imports, batch jobs) often
      // share `created_at` to the microsecond, which would otherwise let
      // Postgres pick an arbitrary subset.
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit),

    // Tasks/Activities
    supabase
      .from('crm_tasks')
      .select(`
        *,
        assignee:profiles!crm_tasks_assigned_to_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit),

    // Notes (may span lead + contact after conversion)
    supabase
      .from('crm_notes')
      .select(`
        *,
        author:profiles!crm_notes_created_by_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .in('record_id', noteIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit),

    // Attachments
    supabase
      .from('crm_attachments')
      .select(`
        *,
        author:profiles!crm_attachments_created_by_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit),

    // Audit logs
    supabase
      .from('crm_audit_log')
      .select(`
        *,
        actor:profiles!crm_audit_log_actor_id_fkey(
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('entity', 'crm_records')
      .eq('entity_id', recordId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit),
  ]);

  const events: TimelineEvent[] = [];

  // Add stage history
  if (stageHistory.data) {
    for (const item of stageHistory.data) {
      events.push({
        id: item.id,
        type: 'stage_change',
        timestamp: item.created_at,
        data: {
          ...item,
          changed_by_name: (item.changed_by_profile as { full_name: string } | null)?.full_name || null,
        } as CrmStageHistoryWithUser,
      });
    }
  }

  // Add tasks/activities
  if (tasks.data) {
    for (const item of tasks.data) {
      events.push({
        id: item.id,
        type: 'activity',
        timestamp: item.created_at,
        data: item as CrmTaskWithAssignee,
      });
    }
  }

  // Add notes
  if (notes.data) {
    for (const item of notes.data) {
      events.push({
        id: item.id,
        type: 'note',
        timestamp: item.created_at,
        data: item as CrmNoteWithAuthor,
      });
    }
  }

  // Add attachments
  if (attachments.data) {
    for (const item of attachments.data) {
      events.push({
        id: item.id,
        type: 'attachment',
        timestamp: item.created_at,
        data: item as CrmAttachmentWithAuthor,
      });
    }
  }

  // Add audit logs
  if (auditLogs.data) {
    for (const item of auditLogs.data) {
      events.push({
        id: item.id,
        type: 'audit',
        timestamp: item.created_at,
        data: item as CrmAuditLogWithActor,
      });
    }
  }

  // Sort by timestamp descending and limit
  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/** Notes on the timeline include the linked lead/contact when applicable. */
export async function getTimelineForRecordAggregated(
  recordId: string,
  limit = 50,
): Promise<TimelineEvent[]> {
  const supabase = await createCrmClient();
  const { data: row, error } = await supabase
    .from('crm_records')
    .select('id, data, module:crm_modules!crm_records_module_id_fkey(key)')
    .eq('id', recordId)
    .maybeSingle();

  if (error || !row) {
    return getTimelineForRecord(recordId, limit);
  }

  const moduleKey = moduleKeyFromJoinedRelation(row.module);
  const record = { id: row.id, data: row.data } as CrmRecord;
  const noteIds = await resolveNoteSourceRecordIds(record, moduleKey);
  return getTimelineForRecord(recordId, limit, noteIds);
}

// ============================================================================
// Activities Queries
// ============================================================================

export async function getActivitiesForRecord(recordId: string): Promise<CrmTaskWithAssignee[]> {
  const supabase = await createCrmClient();
  
  const { data, error } = await supabase
    .from('crm_tasks')
    .select(`
      *,
      assignee:profiles!crm_tasks_assigned_to_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CrmTaskWithAssignee[];
}

export async function getAllActivities(orgId: string, options?: {
  activityType?: string;
  status?: string;
  limit?: number;
}): Promise<CrmTaskWithAssignee[]> {
  const supabase = await createCrmClient();
  
  let query = supabase
    .from('crm_tasks')
    .select(`
      *,
      assignee:profiles!crm_tasks_assigned_to_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('org_id', orgId);

  if (options?.activityType) {
    query = query.eq('activity_type', options.activityType);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as CrmTaskWithAssignee[];
}

// ============================================================================
// Command Console Stats (Enterprise Dashboard)
// ============================================================================

/** Work queue item returned from the command console RPC */
export interface WorkQueueItem {
  id: string;
  type: 'billing_failure' | 'enrollment_review' | 'docs_pending' | 'overdue_task';
  title: string;
  subtitle: string;
  priority: number;
  createdAt: string;
}

/** Full command console stats returned from get_command_console_stats RPC */
export interface CommandConsoleStats {
  enrollmentStats: {
    startedToday: number;
    submittedToday: number;
    activatedToday: number;
    pendingUnderwriting: number;
    docsRequired: number;
    activationDelayed: number;
    rejectedCount: number;
    expiringSoon: number;
    totalDraft: number;
  };
  billingStats: {
    collectedToday: number;
    mrr: number;
    failedToday: number;
    pendingAch: number;
    lastSuccessfulPaymentAt: string | null;
  };
  pipelineCounts: {
    leads: number;
    draft: number;
    inProgress: number;
    submitted: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
  operationsStats: {
    overdueTasks: number;
    atRiskDeals: number;
  };
  workQueue: WorkQueueItem[];
}

/** Default empty stats used when the RPC call fails */
const EMPTY_CONSOLE_STATS: CommandConsoleStats = {
  enrollmentStats: {
    startedToday: 0, submittedToday: 0, activatedToday: 0,
    pendingUnderwriting: 0, docsRequired: 0, activationDelayed: 0,
    rejectedCount: 0, expiringSoon: 0, totalDraft: 0,
  },
  billingStats: {
    collectedToday: 0, mrr: 0, failedToday: 0,
    pendingAch: 0, lastSuccessfulPaymentAt: null,
  },
  pipelineCounts: {
    leads: 0, draft: 0, inProgress: 0, submitted: 0,
    approved: 0, rejected: 0, cancelled: 0,
  },
  operationsStats: { overdueTasks: 0, atRiskDeals: 0 },
  workQueue: [],
};

/**
 * Fetch all command console stats in a single RPC round-trip.
 * Returns enrollment, billing, pipeline, operations, and work queue data.
 */
export async function getCommandConsoleStats(
  orgId: string,
  userId: string,
): Promise<CommandConsoleStats> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase.rpc('get_command_console_stats', {
    p_org_id: orgId,
    p_user_id: userId,
  });

  if (error) {
    console.error('[getCommandConsoleStats] RPC error:', error);
    return EMPTY_CONSOLE_STATS;
  }

  return {
    enrollmentStats: {
      startedToday: data?.enrollmentStats?.startedToday ?? 0,
      submittedToday: data?.enrollmentStats?.submittedToday ?? 0,
      activatedToday: data?.enrollmentStats?.activatedToday ?? 0,
      pendingUnderwriting: data?.enrollmentStats?.pendingUnderwriting ?? 0,
      docsRequired: data?.enrollmentStats?.docsRequired ?? 0,
      activationDelayed: data?.enrollmentStats?.activationDelayed ?? 0,
      rejectedCount: data?.enrollmentStats?.rejectedCount ?? 0,
      expiringSoon: data?.enrollmentStats?.expiringSoon ?? 0,
      totalDraft: data?.enrollmentStats?.totalDraft ?? 0,
    },
    billingStats: {
      collectedToday: Number(data?.billingStats?.collectedToday ?? 0),
      mrr: Number(data?.billingStats?.mrr ?? 0),
      failedToday: data?.billingStats?.failedToday ?? 0,
      pendingAch: data?.billingStats?.pendingAch ?? 0,
      lastSuccessfulPaymentAt: data?.billingStats?.lastSuccessfulPaymentAt ?? null,
    },
    pipelineCounts: {
      leads: data?.pipelineCounts?.leads ?? 0,
      draft: data?.pipelineCounts?.draft ?? 0,
      inProgress: data?.pipelineCounts?.inProgress ?? 0,
      submitted: data?.pipelineCounts?.submitted ?? 0,
      approved: data?.pipelineCounts?.approved ?? 0,
      rejected: data?.pipelineCounts?.rejected ?? 0,
      cancelled: data?.pipelineCounts?.cancelled ?? 0,
    },
    operationsStats: {
      overdueTasks: data?.operationsStats?.overdueTasks ?? 0,
      atRiskDeals: data?.operationsStats?.atRiskDeals ?? 0,
    },
    workQueue: (data?.workQueue ?? []) as WorkQueueItem[],
  };
}

/**
 * Per-request memoized version of getCommandConsoleStats.
 */
export const getCachedCommandConsoleStats = cache(
  async (orgId: string, userId: string) => getCommandConsoleStats(orgId, userId)
);

// ============================================================================
// Advisor Tree Queries (for "By Advisor" tree view)
// ============================================================================

export interface AdvisorTreeData {
  advisors: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    status: string;
    commission_tier: string | null;
    agency_name: string | null;
    parent_advisor_id: string | null;
    producer_code: string | null;
  }>;
  recordCounts: Record<string, number>;
}

function dedupeAdvisorsById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/**
 * Fetch advisors and their record counts for the tree view.
 * Admins see all org advisors; agents/advisors see only their downline.
 */
export async function getAdvisorsForTree(
  orgId: string,
  moduleId: string,
  userAdvisorId: string | null,
  isAdmin: boolean,
): Promise<AdvisorTreeData> {
  const supabase = await createCrmClient();

  // 1. Fetch advisors scoped by role
  let advisorQuery = supabase
    .from('advisors')
    .select('id, first_name, last_name, email, phone, status, commission_tier, agency_name, parent_advisor_id, producer_code')
    .eq('organization_id', orgId)
    .order('first_name');

  if (!isAdmin && userAdvisorId) {
    // Get self + downline advisor IDs
    const { data: downlineIds } = await supabase.rpc('get_advisor_downline_ids', { p_advisor_id: userAdvisorId });
    const allowedIds = [userAdvisorId, ...(downlineIds || [])];
    advisorQuery = advisorQuery.in('id', allowedIds);
  }

  const { data: advisors, error } = await advisorQuery;
  if (error) {
    console.error('Error fetching advisors for tree:', error);
    return { advisors: [], recordCounts: {} };
  }

  const advisorList = dedupeAdvisorsById(advisors || []);
  if (advisorList.length === 0) {
    return { advisors: [], recordCounts: {} };
  }

  // 2. Get record counts per advisor
  const advisorIds = advisorList.map(a => a.id);
  const { data: counts } = await supabase.rpc('get_record_counts_by_advisor', {
    p_module_id: moduleId,
    p_advisor_ids: advisorIds,
  });

  const recordCounts: Record<string, number> = {};
  if (counts) {
    for (const c of counts as Array<{ advisor_id: string; record_count: number }>) {
      recordCounts[c.advisor_id] = Number(c.record_count);
    }
  }

  return { advisors: advisorList, recordCounts };
}

/* ------------------------------------------------------------------ */
/*  Agent tree (text-field based grouping with server-side counts)     */
/* ------------------------------------------------------------------ */

export interface AgentTreeData {
  agents: Array<{ name: string; recordCount: number }>;
  totalRecords: number;
}

/**
 * Fetch distinct agent names with record counts for the agent tree view.
 * Admins see all agents; non-admins see only records they own (or their downline's).
 */
export async function getAgentTreeData(
  orgId: string,
  moduleId: string,
  userProfileId: string,
  userAdvisorId: string | null,
  isAdmin: boolean,
): Promise<AgentTreeData> {
  const supabase = await createCrmClient();

  // Determine scoping: use canonical_advisor_id for imported records + owner_id for legacy
  let ownerIds: string[] | null = null;
  let canonicalAdvisorIds: string[] | null = null;

  if (!isAdmin) {
    if (userAdvisorId) {
      // Get downline advisor IDs
      const { data: downlineIds } = await supabase.rpc('get_advisor_downline_ids', {
        p_advisor_id: userAdvisorId,
      });
      const allAdvisorIds = [userAdvisorId, ...(downlineIds || [])];

      // Pass advisor IDs for canonical_advisor_id scoping (imported records)
      canonicalAdvisorIds = allAdvisorIds;

      // Also resolve profile IDs for owner_id scoping (manually created records)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .in('advisor_id', allAdvisorIds);

      ownerIds = profiles && profiles.length > 0
        ? profiles.map((p: { id: string }) => p.id)
        : [userProfileId];
    } else {
      ownerIds = [userProfileId];
    }
  }

  const { data, error } = await supabase.rpc('get_agent_tree_data', {
    p_module_id: moduleId,
    p_owner_ids: ownerIds,
    p_canonical_advisor_ids: canonicalAdvisorIds,
  });

  if (error) {
    console.error('Error fetching agent tree data:', error);
    return { agents: [], totalRecords: 0 };
  }

  const rawAgents = (data || []).map((d: { agent_name: string; record_count: number }) => ({
    name: d.agent_name,
    recordCount: Number(d.record_count),
  }));

  // RPC should group by name, but duplicate keys still surface as repeated rows; merge counts.
  const byName = new Map<string, number>();
  for (const a of rawAgents) {
    byName.set(a.name, (byName.get(a.name) ?? 0) + a.recordCount);
  }
  const agents = Array.from(byName.entries()).map(([name, recordCount]) => ({ name, recordCount }));

  const totalRecords = agents.reduce((sum: number, a: { recordCount: number }) => sum + a.recordCount, 0);

  return { agents, totalRecords };
}

/**
 * Fetch advisor contact summary from the reporting view.
 * Used by the dashboard advisor widgets.
 */
export async function getAdvisorContactSummary(orgId: string) {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from('advisor_contact_summary')
    .select('*')
    .eq('organization_id', orgId)
    .order('total_contacts', { ascending: false });

  if (error) {
    console.error('Error fetching advisor contact summary:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch contact groups with member counts from the summary view.
 */
export async function getContactGroups(orgId: string) {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from('group_contact_counts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('group_name', { ascending: true });

  if (error) {
    console.error('Error fetching contact groups:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch groups that a specific record belongs to.
 */
export async function getGroupsForRecord(recordId: string) {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from('crm_contact_group_members')
    .select('group_id, added_at, crm_contact_groups(id, group_name, group_type, color, icon)')
    .eq('record_id', recordId);

  if (error) {
    console.error('Error fetching groups for record:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch Medicaid dashboard stats for the org.
 */
export async function getMedicaidStats(orgId: string) {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from('medicaid_dashboard_stats')
    .select('*')
    .eq('organization_id', orgId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching medicaid stats:', error);
  }

  return data || {
    total_medicaid_members: 0,
    active_medicaid: 0,
    former_medicaid: 0,
    transitioning_from_medicaid: 0,
    new_medicaid_this_month: 0,
  };
}

/**
 * Fetch org-wide lifecycle KPIs.
 */
export async function getLifecycleStats(orgId: string) {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from('lifecycle_org_stats')
    .select('*')
    .eq('organization_id', orgId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching lifecycle stats:', error);
  }

  return data || {
    total_tracked_members: 0,
    enrolled_this_month: 0,
    cancelled_this_month: 0,
    total_returned: 0,
    churn_rate_12m: 0,
    top_cancel_reason: null,
  };
}
