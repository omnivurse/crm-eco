/**
 * App-layer sync helpers for lead conversion — keeps indexed columns aligned
 * with JSONB coverage fields without requiring new RPC migrations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeCrmDataJsonIntoRowColumns } from '@/lib/crm/merge-crm-data-json-to-row';

export interface CoverageIndexedColumnPatch {
  market_type?: string | null;
  carrier_id?: string | null;
  original_start_date?: string | null;
  current_year_start_date?: string | null;
  tobacco_user?: boolean | null;
  group_name?: string | null;
}

/** Derive indexed-column updates from a JSONB coverage payload. */
export function deriveCoverageIndexedColumns(
  data: Record<string, unknown>,
  options?: { moduleKey?: string | null },
): CoverageIndexedColumnPatch {
  const patch = mergeCrmDataJsonIntoRowColumns(data, options);
  const out: CoverageIndexedColumnPatch = {};
  if (patch.market_type !== undefined) out.market_type = patch.market_type as string | null;
  if (patch.carrier_id !== undefined) out.carrier_id = patch.carrier_id as string | null;
  if (patch.original_start_date !== undefined) {
    out.original_start_date = patch.original_start_date as string | null;
  }
  if (patch.current_year_start_date !== undefined) {
    out.current_year_start_date = patch.current_year_start_date as string | null;
  }
  if (patch.tobacco_user !== undefined) out.tobacco_user = patch.tobacco_user as boolean | null;
  if (patch.group_name !== undefined) out.group_name = patch.group_name as string | null;
  return out;
}

/** After lead→contact RPC, align indexed columns when JSONB has insurance / HealthShare data. */
export async function syncContactIndexedColumnsFromCoverage(
  adminClient: SupabaseClient,
  contactId: string,
  moduleKey: string | null = 'contacts',
): Promise<{ ok: boolean; error?: string }> {
  const { data: contact, error: fetchError } = await adminClient
    .from('crm_records')
    .select('id, data, market_type, carrier_id, original_start_date, current_year_start_date')
    .eq('id', contactId)
    .single();

  if (fetchError || !contact) {
    return { ok: false, error: fetchError?.message ?? 'Contact not found' };
  }

  const data =
    contact.data && typeof contact.data === 'object'
      ? (contact.data as Record<string, unknown>)
      : {};

  const derived = deriveCoverageIndexedColumns(data, { moduleKey });
  const updates: Record<string, unknown> = {};

  if (
    derived.market_type &&
    (contact.market_type == null || contact.market_type === '')
  ) {
    updates.market_type = derived.market_type;
  }
  if (derived.carrier_id && (contact.carrier_id == null || contact.carrier_id === '')) {
    updates.carrier_id = derived.carrier_id;
  }
  if (
    derived.original_start_date &&
    (contact.original_start_date == null || contact.original_start_date === '')
  ) {
    updates.original_start_date = derived.original_start_date;
    if (
      derived.current_year_start_date &&
      (contact.current_year_start_date == null || contact.current_year_start_date === '')
    ) {
      updates.current_year_start_date = derived.current_year_start_date;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true };
  }

  const { error: updateError } = await adminClient
    .from('crm_records')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', contactId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }
  return { ok: true };
}

/**
 * After lead→member RPC, create a CRM `members` module record carrying lead
 * coverage JSONB and link to the enrollment `members` row.
 */
export async function ensureCrmMemberRecordFromLead(
  adminClient: SupabaseClient,
  params: {
    orgId: string;
    leadRecordId: string;
    enrollmentMemberId: string;
    userId: string;
  },
): Promise<{ ok: boolean; crmMemberRecordId?: string; error?: string }> {
  const { data: lead, error: leadError } = await adminClient
    .from('crm_records')
    .select('id, title, email, phone, status, owner_id, data, module:crm_modules!crm_records_module_id_fkey(key)')
    .eq('id', params.leadRecordId)
    .single();

  if (leadError || !lead) {
    return { ok: false, error: leadError?.message ?? 'Lead not found' };
  }

  const moduleKey = (lead.module as { key?: string } | null)?.key;
  if (moduleKey !== 'leads') {
    return { ok: false, error: 'Record is not a lead' };
  }

  const { data: membersModule } = await adminClient
    .from('crm_modules')
    .select('id')
    .eq('org_id', params.orgId)
    .eq('key', 'members')
    .eq('is_enabled', true)
    .maybeSingle();

  if (!membersModule?.id) {
    return { ok: true };
  }

  const { data: existing } = await adminClient
    .from('crm_records')
    .select('id')
    .eq('module_id', membersModule.id)
    .eq('org_id', params.orgId)
    .contains('data', { linked_member_id: params.enrollmentMemberId })
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, crmMemberRecordId: existing.id };
  }

  const leadData =
    lead.data && typeof lead.data === 'object'
      ? { ...(lead.data as Record<string, unknown>) }
      : {};

  const memberData: Record<string, unknown> = {
    ...leadData,
    linked_member_id: params.enrollmentMemberId,
    converted_from_lead_id: params.leadRecordId,
    contact_status: 'Active',
  };
  delete memberData.is_converted;
  delete memberData.lead_status;
  delete memberData.converted_contact_id;

  const rowPatch = deriveCoverageIndexedColumns(memberData, { moduleKey: 'members' });

  const { data: inserted, error: insertError } = await adminClient
    .from('crm_records')
    .insert({
      org_id: params.orgId,
      module_id: membersModule.id,
      owner_id: lead.owner_id,
      title: lead.title,
      email: lead.email,
      phone: lead.phone,
      status: 'Active',
      data: memberData,
      created_by: params.userId,
      ...rowPatch,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? 'Failed to create CRM member record' };
  }

  await adminClient.from('crm_record_links').insert({
    org_id: params.orgId,
    organization_id: params.orgId,
    source_record_id: params.leadRecordId,
    target_record_id: inserted.id,
    link_type: 'lead_to_member',
    is_primary: true,
    created_by: params.userId,
  });

  return { ok: true, crmMemberRecordId: inserted.id };
}
