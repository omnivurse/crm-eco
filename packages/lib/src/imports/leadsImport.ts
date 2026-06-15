import type { ImportContext, ImportResult, ImportRowData } from './types';
import { LEAD_COLUMN_MAP, VALID_LEAD_STATUSES } from './types';
import { normalizeRowHeaders, mapToColumns, parseNumber } from './normalize';
import {
  buildCrmLeadRecordPayload,
  normalizeLeadStatus,
  resolveLeadsModuleId,
} from '../crm/crm-leads';
import type { Json } from '../types';

export async function importLeadsFromRows(
  context: ImportContext,
  rows: ImportRowData[]
): Promise<ImportResult> {
  const { supabase, organizationId, jobId } = context;

  const leadsModuleId = await resolveLeadsModuleId(supabase, organizationId);
  if (!leadsModuleId) {
    return {
      total: rows.length,
      inserted: 0,
      updated: 0,
      skipped: rows.length,
      errors: [{ rowIndex: 0, message: 'Leads module is not configured for this organization' }],
    };
  }

  const result: ImportResult = {
    total: rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    try {
      const normalizedRow = normalizeRowHeaders(row.data);
      const mappedData = mapToColumns(normalizedRow, LEAD_COLUMN_MAP);

      if (!mappedData.first_name || !mappedData.last_name) {
        await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'error', 'Missing required field: first_name or last_name');
        result.errors.push({ rowIndex: row.index, message: 'Missing required field: first_name or last_name' });
        continue;
      }

      if (!mappedData.email) {
        await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'error', 'Missing required field: email');
        result.errors.push({ rowIndex: row.index, message: 'Missing required field: email' });
        continue;
      }

      if (mappedData.status && !VALID_LEAD_STATUSES.includes(mappedData.status)) {
        mappedData.status = 'new';
      }

      const emailLc = mappedData.email.toLowerCase();
      let existingLead: { id: string; data: Json | null } | null = null;

      if (mappedData.email && mappedData.phone) {
        const { data: byBoth } = await supabase
          .from('crm_records')
          .select('id, data')
          .eq('org_id', organizationId)
          .eq('module_id', leadsModuleId)
          .eq('email', emailLc)
          .eq('phone', mappedData.phone)
          .maybeSingle();
        existingLead = byBoth;
      }

      if (!existingLead && mappedData.email) {
        const { data: byEmail } = await supabase
          .from('crm_records')
          .select('id, data')
          .eq('org_id', organizationId)
          .eq('module_id', leadsModuleId)
          .eq('email', emailLc)
          .maybeSingle();
        existingLead = byEmail;
      }

      const payload = buildCrmLeadRecordPayload({
        first_name: mappedData.first_name,
        last_name: mappedData.last_name,
        email: mappedData.email,
        phone: mappedData.phone || null,
        state: mappedData.state || null,
        source: mappedData.source || null,
        campaign: mappedData.campaign || null,
        status: normalizeLeadStatus(mappedData.status || 'new'),
        household_size: parseNumber(mappedData.household_size),
        notes: mappedData.notes || null,
      });

      if (existingLead) {
        const priorData =
          existingLead.data && typeof existingLead.data === 'object' && !Array.isArray(existingLead.data)
            ? (existingLead.data as Record<string, unknown>)
            : {};

        const { error } = await supabase
          .from('crm_records')
          .update({
            title: payload.title,
            status: payload.status,
            email: payload.email,
            phone: payload.phone,
            data: { ...priorData, ...payload.data } as Json,
          })
          .eq('id', existingLead.id);

        if (error) {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'error', error.message);
          result.errors.push({ rowIndex: row.index, message: error.message });
        } else {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'updated', null, existingLead.id);
          result.updated++;
        }
      } else {
        const { data: newLead, error } = await supabase
          .from('crm_records')
          .insert({
            org_id: organizationId,
            module_id: leadsModuleId,
            title: payload.title,
            status: payload.status,
            email: payload.email,
            phone: payload.phone,
            data: payload.data as Json,
          })
          .select('id')
          .single();

        if (error) {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'error', error.message);
          result.errors.push({ rowIndex: row.index, message: error.message });
        } else {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'inserted', null, newLead?.id);
          result.inserted++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await recordRowResult(supabase, jobId, row.index, row.data, {}, 'error', message);
      result.errors.push({ rowIndex: row.index, message });
    }
  }

  return result;
}

async function recordRowResult(
  supabase: ImportContext['supabase'],
  jobId: string,
  rowIndex: number,
  rawData: Record<string, string>,
  normalizedData: Record<string, string>,
  status: 'pending' | 'inserted' | 'updated' | 'skipped' | 'error',
  errorMessage: string | null,
  entityId?: string
) {
  await supabase.from('import_job_rows').insert({
    import_job_id: jobId,
    row_index: rowIndex,
    raw_data: rawData,
    normalized_data: normalizedData,
    status,
    error_message: errorMessage,
    entity_id: entityId || null,
    processed_at: new Date().toISOString(),
  });
}
