import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../types';

export const CRM_LEADS_MODULE_KEY = 'leads';

/** Legacy import / lowercase statuses → CRM lead status labels */
export const LEGACY_LEAD_STATUS_TO_CRM: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  working: 'Working',
  qualified: 'Qualified',
  unqualified: 'Unqualified',
  converted: 'Converted',
  lost: 'Lost',
  inactive: 'Inactive',
  proposal: 'Proposal',
};

export const CRM_TERMINAL_LEAD_STATUSES = ['Converted', 'Lost', 'Inactive'] as const;

export type CrmLeadListItem = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string | null;
};

/** Minimal row shape needed to detect an already-converted lead. */
export interface ConvertedLeadCheck {
  module_key?: string | null;
  status?: string | null;
  data?: Record<string, unknown> | null;
}

type OrFilterQuery = { or: (filters: string) => OrFilterQuery };

/**
 * Resolve the enabled Leads module id for an organization.
 * All lead intake and queries must filter by this module_id on `crm_records`.
 */
export async function resolveLeadsModuleId(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('crm_modules')
    .select('id')
    .eq('org_id', orgId)
    .eq('key', CRM_LEADS_MODULE_KEY)
    .eq('is_enabled', true)
    .maybeSingle();

  return data?.id ?? null;
}

/** Normalize legacy lowercase or CRM Title Case statuses to CRM labels. */
export function normalizeLeadStatus(status: string | null | undefined): string {
  if (!status?.trim()) return 'New';
  const trimmed = status.trim();
  const mapped = LEGACY_LEAD_STATUS_TO_CRM[trimmed.toLowerCase()];
  return mapped ?? trimmed;
}

/** Case-insensitive status key for analytics / pipeline bucketing. */
export function leadStatusKey(status: string | null | undefined): string {
  return (status ?? 'new').trim().toLowerCase();
}

export function crmRecordToLeadListItem(row: {
  id: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string | null;
  data: Json | null;
}): CrmLeadListItem {
  const data =
    row.data && typeof row.data === 'object' && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    first_name: (data.first_name as string) ?? null,
    last_name: (data.last_name as string) ?? null,
    email: row.email ?? (data.email as string) ?? null,
    phone: row.phone ?? (data.phone as string) ?? null,
    status: row.status,
    created_at: row.created_at,
  };
}

export function buildCrmLeadRecordPayload(input: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  state?: string | null;
  source?: string | null;
  campaign?: string | null;
  status?: string;
  household_size?: number | null;
  notes?: string | null;
  advisor_id?: string | null;
  desired_start_date?: string | null;
  current_coverage?: string | null;
  source_details?: string | null;
}) {
  const status = normalizeLeadStatus(input.status);
  const title = `${input.first_name} ${input.last_name}`.trim();
  const email = input.email.toLowerCase();

  return {
    title,
    status,
    email,
    phone: input.phone ?? null,
    advisor_id: input.advisor_id ?? null,
    data: {
      first_name: input.first_name,
      last_name: input.last_name,
      email,
      phone: input.phone ?? null,
      state: input.state ?? null,
      lead_source: input.source ?? null,
      campaign: input.campaign ?? null,
      lead_status: status,
      household_size: input.household_size ?? null,
      notes: input.notes ?? null,
      advisor_id: input.advisor_id ?? null,
      desired_start_date: input.desired_start_date ?? null,
      current_coverage: input.current_coverage ?? null,
      source_details: input.source_details ?? null,
    },
  };
}

/**
 * Exclude converted leads at the database layer (lists, exports, workqueue).
 */
export function applyHideConvertedLeadsFilter<
  Q extends OrFilterQuery & { neq: (column: string, value: string) => Q },
>(query: Q): Q {
  const filtered = query
    .neq('status', 'Converted')
    .or('data->>is_converted.is.null,data->>is_converted.neq.true')
    .or('data->>lead_status.is.null,data->>lead_status.neq.Converted')
    .or('data->>converted_contact_id.is.null,data->>converted_contact_id.eq.');
  return filtered as Q;
}

export function isConvertedLeadRow(row: ConvertedLeadCheck): boolean {
  if ((row.module_key ?? '') !== CRM_LEADS_MODULE_KEY) return false;
  if ((row.status ?? '') === 'Converted') return true;

  const data = row.data ?? {};
  const isConverted = data['is_converted'];
  if (isConverted === true || isConverted === 'true') return true;

  const convertedContactId = data['converted_contact_id'];
  if (typeof convertedContactId === 'string' && convertedContactId.trim().length > 0) {
    return true;
  }

  return data['lead_status'] === 'Converted';
}

/** Base query filters: org + leads module + hide converted. */
export function applyActiveCrmLeadsFilters<
  Q extends OrFilterQuery & {
    neq: (column: string, value: string) => Q;
    eq: (column: string, value: string) => Q;
  },
>(query: Q, orgId: string, moduleId: string): Q {
  const scoped = query.eq('org_id', orgId).eq('module_id', moduleId) as Q;
  return applyHideConvertedLeadsFilter(scoped);
}

export async function insertCrmLead(
  supabase: SupabaseClient<Database>,
  params: {
    orgId: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    state?: string | null;
    status?: string;
    source?: string | null;
    source_details?: string | null;
    advisor_id?: string | null;
    campaign?: string | null;
    household_size?: number | null;
    notes?: string | null;
    import_batch_id?: string | null;
  },
): Promise<{ id: string } | { error: string }> {
  const moduleId = await resolveLeadsModuleId(supabase, params.orgId);
  if (!moduleId) {
    return { error: 'Leads module is not configured for this organization' };
  }

  const payload = buildCrmLeadRecordPayload({
    first_name: params.first_name,
    last_name: params.last_name,
    email: params.email,
    phone: params.phone,
    state: params.state,
    status: params.status,
    source: params.source,
    source_details: params.source_details,
    advisor_id: params.advisor_id,
    campaign: params.campaign,
    household_size: params.household_size,
    notes: params.notes,
  });

  const { data, error } = await supabase
    .from('crm_records')
    .insert({
      org_id: params.orgId,
      module_id: moduleId,
      title: payload.title,
      status: payload.status,
      email: payload.email,
      phone: payload.phone,
      advisor_id: params.advisor_id ?? null,
      data: payload.data as Json,
      import_batch_id: params.import_batch_id ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { error: error?.message ?? 'Failed to create lead' };
  }

  return { id: data.id };
}
