/**
 * Load Contacts CSV → Staging → Upsert into crm_records → Deduplicate
 *
 * Full pipeline:
 *   1. Truncate import_contacts_staging
 *   2. Parse & load CSV into staging table
 *   3. Call upsert_contacts_from_staging() to update/insert contacts
 *   4. Call deduplicate_contacts() to remove duplicates
 *
 * Prerequisites:
 *   - Run the SQL in scripts/upsert-contacts-and-dedup.sql first (creates the functions)
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage:  npx tsx scripts/load-and-update-contacts.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Config
// ============================================================================
const CONTACTS_CSV = 'C:/Users/User/Desktop/Contacts_2026_02_10.csv';

// Load env from root .env.local
function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      val = val.replace(/^["']|["']$/g, '').replace(/\\n$/, '');
      env[key] = val;
    }
  } catch { /* file not found */ }
  return env;
}

const envFile = loadEnv(resolve(__dirname, '..', '.env.local'));
const SUPABASE_URL = envFile['SUPABASE_URL'] || envFile['VITE_SUPABASE_URL'] || envFile['NEXT_PUBLIC_SUPABASE_URL'] || process.env.SUPABASE_URL;
const SUPABASE_KEY = envFile['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// ============================================================================
// CSV Parser (handles quoted fields with commas, newlines, escaped quotes)
// ============================================================================
function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current);
        current = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
          rows.push(row);
        }
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const headers = rows[0] || [];
  return { headers, rows: rows.slice(1) };
}

// ============================================================================
// Column mapping: CSV Header → staging column name
// ============================================================================
const CONTACTS_COLUMN_MAP: Record<string, string> = {
  'Record Id': 'record_id',
  'Contact Owner.id': 'contact_owner_id',
  'Contact Owner': 'contact_owner',
  'Lead Source': 'lead_source',
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Producer Name.id': 'producer_name_id',
  'Producer Name': 'producer_name',
  'Email': 'email',
  'Title': 'title',
  'Phone': 'phone',
  'Fax': 'fax',
  'Mobile': 'mobile',
  'Date of Birth': 'date_of_birth',
  'Created By.id': 'created_by_id',
  'Created By': 'created_by',
  'Modified By.id': 'modified_by_id',
  'Modified By': 'modified_by',
  'Created Time': 'created_time',
  'Modified Time': 'modified_time',
  'Contact Name': 'contact_name',
  'Mailing Street': 'mailing_street',
  'Mailing City': 'mailing_city',
  'Mailing State': 'mailing_state',
  'Mailing Zip': 'mailing_zip',
  'Email Opt Out': 'email_opt_out',
  'Salutation': 'salutation',
  'Secondary Email': 'secondary_email',
  'Currency': 'currency',
  'Exchange Rate': 'exchange_rate',
  'Last Activity Time': 'last_activity_time',
  'Territories': 'territories',
  'Spouse': 'spouse',
  'Spouse - DOB': 'spouse_dob',
  'Child 1': 'child_1',
  'Child 1-DOB': 'child_1_dob',
  'Child 2': 'child_2',
  'Child 2-DOB': 'child_2_dob',
  'Child 3': 'child_3',
  'Child 3 -DOB': 'child_3_dob',
  'Primary S.S Number': 'primary_ss_number',
  'Notes History': 'notes_history',
  'Affiliate': 'affiliate',
  'Carrier': 'carrier',
  'Previous Product': 'previous_product',
  'Monthly Premium': 'monthly_premium',
  'Commission Percentage': 'commission_percentage',
  'Contact Status': 'contact_status',
  'Product': 'product',
  'Coverage Option': 'coverage_option',
  'Start Date': 'start_date',
  'Referral Source': 'referral_source',
  'Referring Member': 'referring_member',
  'Add on Product': 'add_on_product',
  'Declined': 'declined',
  'Charge Waived': 'charge_waived',
  'Affiliate Referral': 'affiliate_referral',
  'Affiliate Rep  Monthly': 'affiliate_rep_monthly',
  'Affiliate Rep Monthly': 'affiliate_rep_monthly',
  'Amount Received': 'amount_received',
  'Team Leader Monthly': 'team_leader_monthly',
  'Team Leader': 'team_leader',
  'Primary Member Gender': 'primary_member_gender',
  'MPower Life Code': 'mpower_life_code',
  'Welcome call performed by': 'welcome_call_performed_by',
  'Producer Commission': 'producer_commission',
  'Team Leader Referral': 'team_leader_referral',
  'Child 4': 'child_4',
  'Child 5 -DOB': 'child_5_dob',
  'Child 5': 'child_5',
  'Child 4 -DOB': 'child_4_dob',
  'Director': 'director',
  'Director Referral': 'director_referral',
  'Director Monthly': 'director_monthly',
  '4th Life Code': 'life_code_4th',
  'Fulfillment Letter mailed': 'fulfillment_letter_mailed',
  'Fulfillment Email Sent': 'fulfillment_email_sent',
  'Complete Date': 'complete_date',
  '3rd Life Code': 'life_code_3rd',
  '2nd Life Code': 'life_code_2nd',
  'Date Referral Paid': 'date_referral_paid',
  'Welcome Call Status': 'welcome_call_status',
  'Child 4 S.S. Number': 'child_4_ss_number',
  'MEC Submitted': 'mec_submitted',
  'Child 3 S.S. Number': 'child_3_ss_number',
  'Child 5 S.S. Number': 'child_5_ss_number',
  'Child 1 S.S. Number': 'child_1_ss_number',
  'Spouse S.S. Number': 'spouse_ss_number',
  'Child 2 S.S. Number': 'child_2_ss_number',
  'Marital Status': 'marital_status',
  'Work Phone': 'work_phone',
  'Middle Initial': 'middle_initial',
  'MPB Referral Fee': 'referral_fee',
  'Referral requirement satisfied': 'referral_requirement_satisfied',
  'Tag': 'tag',
  'Days Visited': 'days_visited',
  'Average Time Spent (Minutes)': 'average_time_spent_minutes',
  'Number Of Chats': 'number_of_chats',
  'Most Recent Visit': 'most_recent_visit',
  'First Visit': 'first_visit',
  'First Page Visited': 'first_page_visited',
  'Referrer': 'referrer',
  'Visitor Score': 'visitor_score',
  'Risk assessment paid': 'risk_assessment_paid',
  'Company/Association': 'company_association',
  'Cancellation Date': 'cancellation_date',
  'Data Processing Basis Details.id': 'data_processing_basis_id',
  'Data Processing Basis': 'data_processing_basis',
  'Data Source': 'data_source',
  'Preferred Method of Communication': 'preferred_method_of_communication',
  'Vision': 'vision',
  'Dental': 'dental',
  'IUA Amount': 'iua_amount',
  'Business or Practice Name': 'business_or_practice_name',
  'DPC Name': 'dpc_name',
  'Cirrus registration Date': 'cirrus_registration_date',
  'MPB Portal Username': 'portal_username',
  'MPB Portal Password': 'portal_password',
  'Select Conversion Completed': 'select_conversion_completed',
  'MEC Decision Confirmed': 'mec_decision_confirmed',
  'Unsubscribed Mode': 'unsubscribed_mode',
  'Unsubscribed Time': 'unsubscribed_time',
  'Admin123': 'admin123',
  'Household Annual Adj Gross': 'household_annual_adj_gross',
  'Change Log Time': 'change_log_time',
  'Locked': 'locked',
  'Last Enriched Time': 'last_enriched_time',
  'Enrich Status': 'enrich_status',
  'MPB APP Downloaded': 'app_downloaded',
  'Birth Month': 'birth_month',
  'Third Party Payor': 'third_party_payor',
  'ATAP': 'atap',
  'Permission to Discuss Plan': 'permission_to_discuss_plan',
  'Medical Release Form on File': 'medical_release_form_on_file',
  '5th Life Code': 'life_code_5th',
  'WC Outreach Date': 'wc_outreach_date',
  'E123 Member ID': 'e123_member_id',
  'Child 3 Address': 'child_3_address',
  'Child 3 Phone Number': 'child_3_phone_number',
  'Child 1 Phone Number': 'child_1_phone_number',
  'Child 4 Address': 'child_4_address',
  'Child 1 Address': 'child_1_address',
  'Child 4 Phone Number': 'child_4_phone_number',
  'Child 2 Phone Number': 'child_2_phone_number',
  'Child 5 Address': 'child_5_address',
  'Child 2 Address': 'child_2_address',
  'Spouse Address': 'spouse_address',
  'Child 5 Phone Number': 'child_5_phone_number',
  'Spouse Phone Number': 'spouse_phone_number',
  'Child 1 Email': 'child_1_email',
  'Child 2 Email': 'child_2_email',
  'Child 3 Email': 'child_3_email',
  'Child 4 Email': 'child_4_email',
  'Child 5 Email': 'child_5_email',
  'Spouse Email': 'spouse_email',
  'Connected To.module': 'connected_to_module',
  'Connected To.id': 'connected_to_id',
  'Tax-ID': 'tax_id',
};

// ============================================================================
// HTTP helpers
// ============================================================================
const headers = {
  'apikey': SUPABASE_KEY!,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function supabasePost(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal,count=exact' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${err.slice(0, 300)}`);
  }
  return res;
}

async function supabaseRpc(fnName: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: '{}',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`RPC ${fnName} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function supabaseDelete(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DELETE ${path} failed (${res.status}): ${err.slice(0, 300)}`);
  }
}

// ============================================================================
// STEP 1: Truncate staging table
// ============================================================================
async function truncateStaging() {
  console.log('\n[Step 1] Truncating import_contacts_staging...');
  // Delete all rows (PostgREST doesn't have TRUNCATE, so we delete with a broad filter)
  await supabaseDelete('import_contacts_staging?row_num=gt.0');
  console.log('  Staging table cleared.');
}

// ============================================================================
// STEP 2: Load CSV into staging
// ============================================================================
async function loadCSVToStaging() {
  console.log('\n[Step 2] Loading CSV into staging...');
  console.log(`  File: ${CONTACTS_CSV}`);

  const raw = readFileSync(CONTACTS_CSV, 'utf-8');
  const { headers: csvHeaders, rows } = parseCSV(raw);

  console.log(`  CSV headers: ${csvHeaders.length} columns`);
  console.log(`  CSV rows: ${rows.length}`);

  // Map CSV headers to staging column names
  const mappedHeaders = csvHeaders.map(h => {
    const trimmed = h.trim();
    return CONTACTS_COLUMN_MAP[trimmed] || null;
  });

  const unmapped = mappedHeaders.filter(h => h === null).length;
  if (unmapped > 0) {
    console.warn(`  ${unmapped} unmapped columns will be skipped`);
  }

  // Batch insert
  const BATCH_SIZE = 200;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
    const batchRows = rows.slice(batchStart, batchStart + BATCH_SIZE);
    const objects = batchRows.map(row => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < mappedHeaders.length; i++) {
        const col = mappedHeaders[i];
        if (col && row[i] !== undefined && row[i] !== '') {
          obj[col] = row[i];
        }
      }
      return obj;
    }).filter(obj => Object.keys(obj).length > 0);

    if (objects.length === 0) continue;

    try {
      await supabasePost('import_contacts_staging', objects);
      totalInserted += objects.length;
    } catch (err) {
      console.error(`\n  Batch error: ${(err as Error).message.slice(0, 200)}`);
      totalErrors += objects.length;
    }

    const pct = Math.round(((batchStart + batchRows.length) / rows.length) * 100);
    process.stdout.write(`\r  Loading: ${pct}% (${totalInserted} rows)`);
  }

  console.log(`\n  Staging loaded: ${totalInserted} inserted, ${totalErrors} errors`);
  return { inserted: totalInserted, errors: totalErrors };
}

// ============================================================================
// STEP 3: Upsert contacts from staging
// ============================================================================
async function upsertContacts() {
  console.log('\n[Step 3] Upserting contacts (update existing + insert new)...');
  console.log('  This may take a few minutes for large datasets...');

  const result = await supabaseRpc('upsert_contacts_from_staging');
  console.log('  Upsert result:', JSON.stringify(result, null, 2));
  return result;
}

// ============================================================================
// STEP 4: Deduplicate contacts
// ============================================================================
async function deduplicateContacts() {
  console.log('\n[Step 4] Deduplicating contacts...');

  const result = await supabaseRpc('deduplicate_contacts');
  console.log('  Dedup result:', JSON.stringify(result, null, 2));
  return result;
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log('='.repeat(60));
  console.log('CONTACTS UPSERT & DEDUPLICATION PIPELINE');
  console.log('='.repeat(60));
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`CSV File: ${CONTACTS_CSV}`);

  // Pre-check: verify staging table is accessible
  const testRes = await fetch(`${SUPABASE_URL}/rest/v1/import_contacts_staging?select=row_num&limit=1`, {
    headers: { 'apikey': SUPABASE_KEY!, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!testRes.ok) {
    console.error(`Staging table not accessible (${testRes.status}). Run NOTIFY pgrst, 'reload schema'; first.`);
    process.exit(1);
  }

  const t0 = Date.now();

  // Execute pipeline
  await truncateStaging();
  const loadResult = await loadCSVToStaging();
  const upsertResult = await upsertContacts();
  const dedupResult = await deduplicateContacts();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n${'='.repeat(60)}`);
  console.log('PIPELINE COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`Time: ${elapsed}s`);
  console.log(`CSV rows loaded to staging: ${loadResult.inserted}`);
  console.log(`Upsert result:`, JSON.stringify(upsertResult));
  console.log(`Dedup result:`, JSON.stringify(dedupResult));
  console.log(`\nDone!`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
