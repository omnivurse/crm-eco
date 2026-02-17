import type { ImportContext, ImportResult, ImportRowData } from './types';
import { ADVISOR_COLUMN_MAP, VALID_ADVISOR_STATUSES } from './types';
import { normalizeRowHeaders, mapToColumns } from './normalize';
import type { Database } from '../types';

type AdvisorInsert = Database['public']['Tables']['advisors']['Insert'];

/**
 * Resolve an advisor reference (name, email, producer_code, or advisor_code)
 * to an advisor ID. Tries multiple matching strategies in order.
 */
async function resolveAdvisorRef(
  supabase: ImportContext['supabase'],
  organizationId: string,
  value: string
): Promise<string | null> {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();

  // Try producer_code (exact, case-insensitive)
  const { data: byProdCode } = await (supabase as any)
    .from('advisors')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('producer_code', trimmed)
    .limit(1)
    .single();
  if (byProdCode) return byProdCode.id;

  // Try advisor_code (exact)
  const { data: byCode } = await supabase
    .from('advisors')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('advisor_code', trimmed)
    .single();
  if (byCode) return byCode.id;

  // Try email (exact, case-insensitive)
  const { data: byEmail } = await supabase
    .from('advisors')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('email', trimmed)
    .single();
  if (byEmail) return byEmail.id;

  // Try full name match (first_name + ' ' + last_name)
  // Split the value into parts for matching
  const nameParts = trimmed.split(/\s+/);
  if (nameParts.length >= 2) {
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    const { data: byName } = await supabase
      .from('advisors')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .single();
    if (byName) return byName.id;
  }

  return null;
}

/**
 * Parse a string to a boolean value.
 * Accepts: "true", "yes", "1", "y" as true; everything else as false.
 */
function parseBool(value: string | undefined | null): boolean {
  if (!value) return false;
  return ['true', 'yes', '1', 'y'].includes(value.trim().toLowerCase());
}

/**
 * Parse a date string. Returns ISO date string or null.
 */
function parseDate(value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();

  // Try direct Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Try MM/DD/YYYY or M/D/YYYY
  const parts = trimmed.split(/[/\-]/);
  if (parts.length === 3) {
    const [m, d2, y] = parts;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d2));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  return null;
}

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

      // Resolve parent advisor lookup
      let parentAdvisorId: string | null = null;
      if (mappedData.parent_advisor_lookup) {
        parentAdvisorId = await resolveAdvisorRef(supabase, organizationId, mappedData.parent_advisor_lookup);
      }

      // Resolve referring affiliate lookup
      let referringAffiliateId: string | null = null;
      if (mappedData.referring_affiliate_lookup) {
        referringAffiliateId = await resolveAdvisorRef(supabase, organizationId, mappedData.referring_affiliate_lookup);
      }

      // Resolve producer owner lookup
      let producerOwnerId: string | null = null;
      if (mappedData.producer_owner_lookup) {
        producerOwnerId = await resolveAdvisorRef(supabase, organizationId, mappedData.producer_owner_lookup);
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

      // If not found, try producer_code
      if (!existingAdvisor && mappedData.producer_code) {
        const { data: byProdCode } = await (supabase as any)
          .from('advisors')
          .select('id')
          .eq('organization_id', organizationId)
          .ilike('producer_code', mappedData.producer_code)
          .single();
        existingAdvisor = byProdCode;
      }

      // Prepare insert/update data
      const advisorData: Record<string, any> = {
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
        // New producer fields
        producer_code: mappedData.producer_code || null,
        admin123_agent_id: mappedData.admin123_agent_id || null,
        producer_type: mappedData.producer_type || null,
        mobile_phone: mappedData.mobile_phone || null,
        website_url: mappedData.website_url || null,
        master_click_funnel: mappedData.master_click_funnel || null,
        mpb_certified: parseBool(mappedData.mpb_certified),
        mpb_eo_current: parseBool(mappedData.mpb_eo_current),
        crm_owner: parseBool(mappedData.crm_owner),
        setup_fee_waived: parseBool(mappedData.setup_fee_waived),
        compliance_training_completed: parseDate(mappedData.compliance_training_completed),
      };

      // Only set FK references if they resolved successfully
      if (parentAdvisorId) {
        advisorData.parent_advisor_id = parentAdvisorId;
      }
      if (referringAffiliateId) {
        advisorData.referring_affiliate_id = referringAffiliateId;
      }
      if (producerOwnerId) {
        advisorData.producer_owner_id = producerOwnerId;
      }

      if (existingAdvisor) {
        // Update existing advisor
        const { error } = await (supabase as any)
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
        const { data: newAdvisor, error } = await (supabase as any)
          .from('advisors')
          .insert(advisorData)
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
