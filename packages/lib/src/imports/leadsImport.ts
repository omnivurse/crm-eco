import type { ImportContext, ImportResult, ImportRowData } from './types';
import { LEAD_COLUMN_MAP, VALID_LEAD_STATUSES } from './types';
import { normalizeRowHeaders, mapToColumns, parseNumber } from './normalize';
import type { Database } from '../types';

type LeadInsert = Database['public']['Tables']['leads']['Insert'];

export async function importLeadsFromRows(
  context: ImportContext,
  rows: ImportRowData[]
): Promise<ImportResult> {
  const { supabase, organizationId, jobId } = context;
  
  const result: ImportResult = {
    total: rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    try {
      // Normalize headers and map to columns
      const normalizedRow = normalizeRowHeaders(row.data);
      const mappedData = mapToColumns(normalizedRow, LEAD_COLUMN_MAP);

      // Validate required fields
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

      // Validate status if provided
      if (mappedData.status && !VALID_LEAD_STATUSES.includes(mappedData.status)) {
        mappedData.status = 'new'; // Default to new if invalid
      }

      // Check for existing lead (dedup logic)
      let existingLead = null;
      
      // Try (email, phone) if both available
      if (mappedData.email && mappedData.phone) {
        const { data: byBoth } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('email', mappedData.email.toLowerCase())
          .eq('phone', mappedData.phone)
          .single();
        existingLead = byBoth;
      }
      
      // If not found, try email only
      if (!existingLead && mappedData.email) {
        const { data: byEmail } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('email', mappedData.email.toLowerCase())
          .single();
        existingLead = byEmail;
      }

      // Prepare insert/update data
      const leadData: Partial<LeadInsert> = {
        organization_id: organizationId,
        first_name: mappedData.first_name,
        last_name: mappedData.last_name,
        email: mappedData.email.toLowerCase(),
        phone: mappedData.phone || null,
        state: mappedData.state || null,
        source: mappedData.source || null,
        campaign: mappedData.campaign || null,
        status: (mappedData.status as LeadInsert['status']) || 'new',
        household_size: parseNumber(mappedData.household_size),
        notes: mappedData.notes || null,
      };

      if (existingLead) {
        // Update existing lead
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', existingLead.id);

        if (error) {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'error', error.message);
          result.errors.push({ rowIndex: row.index, message: error.message });
        } else {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'updated', null, existingLead.id);
          result.updated++;
        }
      } else {
        // Insert new lead
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert(leadData as LeadInsert)
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

