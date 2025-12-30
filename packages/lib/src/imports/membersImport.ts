import type { ImportContext, ImportResult, ImportRowData } from './types';
import { MEMBER_COLUMN_MAP, VALID_MEMBER_STATUSES } from './types';
import { normalizeRowHeaders, mapToColumns, parseDate } from './normalize';
import type { Database } from '../types';

type MemberInsert = Database['public']['Tables']['members']['Insert'];

export async function importMembersFromRows(
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
      const mappedData = mapToColumns(normalizedRow, MEMBER_COLUMN_MAP);

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
      if (mappedData.status && !VALID_MEMBER_STATUSES.includes(mappedData.status)) {
        mappedData.status = 'pending'; // Default to pending if invalid
      }

      // Check for existing member (dedup logic)
      let existingMember = null;
      
      // First try member_number if provided
      if (mappedData.member_number) {
        const { data } = await supabase
          .from('members')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('member_number', mappedData.member_number)
          .single();
        existingMember = data;
      }
      
      // If not found, try email + date_of_birth combo
      if (!existingMember && mappedData.email) {
        const dob = parseDate(mappedData.date_of_birth);
        if (dob) {
          const { data } = await supabase
            .from('members')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('email', mappedData.email.toLowerCase())
            .eq('date_of_birth', dob)
            .single();
          existingMember = data;
        }
      }

      // Prepare insert/update data
      const memberData: Partial<MemberInsert> = {
        organization_id: organizationId,
        first_name: mappedData.first_name,
        last_name: mappedData.last_name,
        email: mappedData.email.toLowerCase(),
        phone: mappedData.phone || null,
        state: mappedData.state || null,
        date_of_birth: parseDate(mappedData.date_of_birth),
        member_number: mappedData.member_number || null,
        status: (mappedData.status as MemberInsert['status']) || 'pending',
        address_line1: mappedData.address_line1 || null,
        address_line2: mappedData.address_line2 || null,
        city: mappedData.city || null,
        postal_code: mappedData.postal_code || null,
        gender: mappedData.gender || null,
      };

      if (existingMember) {
        // Update existing member
        const { error } = await supabase
          .from('members')
          .update(memberData)
          .eq('id', existingMember.id);

        if (error) {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'error', error.message);
          result.errors.push({ rowIndex: row.index, message: error.message });
        } else {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'updated', null, existingMember.id);
          result.updated++;
        }
      } else {
        // Insert new member
        const { data: newMember, error } = await supabase
          .from('members')
          .insert(memberData as MemberInsert)
          .select('id')
          .single();

        if (error) {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'error', error.message);
          result.errors.push({ rowIndex: row.index, message: error.message });
        } else {
          await recordRowResult(supabase, jobId, row.index, row.data, mappedData, 'inserted', null, newMember?.id);
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

