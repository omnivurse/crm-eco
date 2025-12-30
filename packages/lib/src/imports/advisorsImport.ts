import type { ImportContext, ImportResult, ImportRowData } from './types';
import { ADVISOR_COLUMN_MAP, VALID_ADVISOR_STATUSES } from './types';
import { normalizeRowHeaders, mapToColumns } from './normalize';
import type { Database } from '../types';

type AdvisorInsert = Database['public']['Tables']['advisors']['Insert'];

export async function importAdvisorsFromRows(
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
      const mappedData = mapToColumns(normalizedRow, ADVISOR_COLUMN_MAP);

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
      if (mappedData.status && !VALID_ADVISOR_STATUSES.includes(mappedData.status)) {
        mappedData.status = 'pending'; // Default to pending if invalid
      }

      // Parse license_states if provided (comma-separated)
      let licenseStates: string[] = [];
      if (mappedData.license_states) {
        licenseStates = mappedData.license_states
          .split(',')
          .map(s => s.trim().toUpperCase())
          .filter(s => s.length === 2);
      }

      // Check for existing advisor (dedup logic)
      let existingAdvisor = null;
      
      // First try by email
      const { data: byEmail } = await supabase
        .from('advisors')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('email', mappedData.email.toLowerCase())
        .single();
      existingAdvisor = byEmail;
      
      // If not found, try advisor_code
      if (!existingAdvisor && mappedData.advisor_code) {
        const { data: byCode } = await supabase
          .from('advisors')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('advisor_code', mappedData.advisor_code)
          .single();
        existingAdvisor = byCode;
      }
      
      // If not found, try NPN
      if (!existingAdvisor && mappedData.npn) {
        const { data: byNpn } = await supabase
          .from('advisors')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('npn', mappedData.npn)
          .single();
        existingAdvisor = byNpn;
      }

      // Prepare insert/update data
      const advisorData: Partial<AdvisorInsert> = {
        organization_id: organizationId,
        first_name: mappedData.first_name,
        last_name: mappedData.last_name,
        email: mappedData.email.toLowerCase(),
        phone: mappedData.phone || null,
        agency_name: mappedData.agency_name || null,
        license_number: mappedData.license_number || null,
        license_states: licenseStates,
        npn: mappedData.npn || null,
        advisor_code: mappedData.advisor_code || null,
        status: (mappedData.status as AdvisorInsert['status']) || 'pending',
      };

      if (existingAdvisor) {
        // Update existing advisor
        const { error } = await supabase
          .from('advisors')
          .update(advisorData)
          .eq('id', existingAdvisor.id);

        if (error) {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'error', error.message);
          result.errors.push({ rowIndex: row.index, message: error.message });
        } else {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'updated', null, existingAdvisor.id);
          result.updated++;
        }
      } else {
        // Insert new advisor
        const { data: newAdvisor, error } = await supabase
          .from('advisors')
          .insert(advisorData as AdvisorInsert)
          .select('id')
          .single();

        if (error) {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'error', error.message);
          result.errors.push({ rowIndex: row.index, message: error.message });
        } else {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'inserted', null, newAdvisor?.id);
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

