/**
 * Zoho CRM Contacts Migration Script
 *
 * Imports all contacts from Zoho CSV export with full field data and notes.
 *
 * Usage:
 *   npx tsx scripts/migrate-zoho-contacts.ts
 *
 * Required environment variables:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// CSV file path
const CSV_PATH = path.join(__dirname, '..', 'Contacts_2025_10_16.csv');

// Field mapping: Zoho CSV column -> CRM field key
const FIELD_MAP: Record<string, string> = {
  'Record Id': 'zoho_record_id',
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Email': 'email',
  'Phone': 'phone',
  'Mobile': 'mobile',
  'Title': 'job_title',
  'Contact Status': 'contact_status',
  'Contact Owner': 'contact_owner',
  'Lead Source': 'lead_source',
  'Date of Birth': 'date_of_birth',
  'Created Time': 'zoho_created_time',
  'Modified Time': 'zoho_modified_time',
  'Contact Name': 'full_name',
  'Mailing Street': 'mailing_street',
  'Mailing City': 'mailing_city',
  'Mailing State': 'mailing_state',
  'Mailing Zip': 'mailing_zip',
  'Email Opt Out': 'email_opt_out',
  'Salutation': 'salutation',
  'Secondary Email': 'secondary_email',
  'Fax': 'fax',
  'Work Phone': 'work_phone',
  'Middle Initial': 'middle_initial',
  'Affiliate': 'affiliate',
  'Producer Name': 'producer_name',
  'Spouse': 'spouse',
  'Spouse - DOB': 'spouse_dob',
  'Child 1': 'child_1',
  'Child 1-DOB': 'child_1_dob',
  'Child 2': 'child_2',
  'Child 2-DOB': 'child_2_dob',
  'Child 3': 'child_3',
  'Child 3 -DOB': 'child_3_dob',
  'Child 4': 'child_4',
  'Child 4 -DOB': 'child_4_dob',
  'Child 5': 'child_5',
  'Child 5 -DOB': 'child_5_dob',
  'Primary S.S Number': 'ssn_primary',
  'Spouse S.S. Number': 'ssn_spouse',
  'Child 1 S.S. Number': 'ssn_child_1',
  'Child 2 S.S. Number': 'ssn_child_2',
  'Child 3 S.S. Number': 'ssn_child_3',
  'Child 4 S.S. Number': 'ssn_child_4',
  'Child 5 S.S. Number': 'ssn_child_5',
  'Carrier': 'carrier',
  'Previous Product': 'previous_product',
  'Monthly Premium': 'monthly_premium',
  'Commission Percentage': 'commission_percentage',
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
  'Amount Received': 'amount_received',
  'Team Leader Monthly': 'team_leader_monthly',
  'Team Leader': 'team_leader',
  'Primary Member Gender': 'gender',
  'MPower Life Code': 'mpower_life_code',
  'Welcome call performed by': 'welcome_call_performed_by',
  'Producer Commission': 'producer_commission',
  'Team Leader Referral': 'team_leader_referral',
  'Director': 'director',
  'Director Referral': 'director_referral',
  'Director Monthly': 'director_monthly',
  '4th Life Code': 'life_code_4th',
  '3rd Life Code': 'life_code_3rd',
  '2nd Life Code': 'life_code_2nd',
  '5th Life Code': 'life_code_5th',
  'Fulfillment Letter mailed': 'fulfillment_letter_mailed',
  'Fulfillment Email Sent': 'fulfillment_email_sent',
  'Complete Date': 'complete_date',
  'Date Referral Paid': 'date_referral_paid',
  'Welcome Call Status': 'welcome_call_status',
  'MEC Submitted': 'mec_submitted',
  'Marital Status': 'marital_status',
  'MPB Referral Fee': 'mpb_referral_fee',
  'Referral requirement satisfied': 'referral_requirement_satisfied',
  'Tag': 'tag',
  'Company/Association': 'company_association',
  'Cancellation Date': 'cancellation_date',
  'Data Source': 'data_source',
  'Preferred Method of Communication': 'preferred_communication',
  'Vision': 'vision',
  'Dental': 'dental',
  'Payment Method': 'payment_method',
  'Account Type': 'account_type',
  'Routing Number': 'routing_number',
  'Account Number': 'account_number',
  'IUA Amount': 'iua_amount',
  'Business or Practice Name': 'business_name',
  'DPC Name': 'dpc_name',
  'Cirrus registration Date': 'cirrus_registration_date',
  'MPB Portal Username': 'mpb_portal_username',
  'MPB Portal Password': 'mpb_portal_password',
  'Select Conversion Completed': 'select_conversion_completed',
  'MEC Decision Confirmed': 'mec_decision_confirmed',
  'Household Annual Adj Gross': 'household_annual_gross',
  'MPB APP Downloaded': 'mpb_app_downloaded',
  'Birth Month': 'birth_month',
  'Third Party Payor': 'third_party_payor',
  'ATAP': 'atap',
  'Permission to Discuss Plan': 'permission_to_discuss',
  'Medical Release Form on File': 'medical_release_on_file',
  'WC Outreach Date': 'wc_outreach_date',
  'E123 Member ID': 'e123_member_id',
  'Notes History': '_notes_history', // Special handling
  // Child/Spouse contact info
  'Child 1 Address': 'child_1_address',
  'Child 1 Phone Number': 'child_1_phone',
  'Child 1 Email': 'child_1_email',
  'Child 2 Address': 'child_2_address',
  'Child 2 Phone Number': 'child_2_phone',
  'Child 2 Email': 'child_2_email',
  'Child 3 Address': 'child_3_address',
  'Child 3 Phone Number': 'child_3_phone',
  'Child 3 Email': 'child_3_email',
  'Child 4 Address': 'child_4_address',
  'Child 4 Phone Number': 'child_4_phone',
  'Child 4 Email': 'child_4_email',
  'Child 5 Address': 'child_5_address',
  'Child 5 Phone Number': 'child_5_phone',
  'Child 5 Email': 'child_5_email',
  'Spouse Address': 'spouse_address',
  'Spouse Phone Number': 'spouse_phone',
  'Spouse Email': 'spouse_email',
};

// Parse CSV handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Parse the full CSV file
function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split('\n').filter(line => line.trim());

  // Skip the first line if it's just a title
  const startIdx = lines[0].includes('Record Id') ? 0 : 1;
  const headers = parseCSVLine(lines[startIdx]);

  const rows: Record<string, string>[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (values[idx] && values[idx].trim()) {
        row[header] = values[idx].trim();
      }
    });
    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  return { headers, rows };
}

// Convert Zoho row to CRM record data
function mapRowToRecordData(row: Record<string, string>): {
  data: Record<string, unknown>;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string | null;
  notesHistory: string | null;
} {
  const data: Record<string, unknown> = {};
  let email: string | null = null;
  let phone: string | null = null;
  let title: string | null = null;
  let status: string | null = null;
  let notesHistory: string | null = null;

  for (const [zohoCol, value] of Object.entries(row)) {
    const crmField = FIELD_MAP[zohoCol];

    if (!crmField) {
      // Store unmapped fields with sanitized key
      const sanitizedKey = zohoCol.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (sanitizedKey && value) {
        data[`zoho_${sanitizedKey}`] = value;
      }
      continue;
    }

    if (crmField === '_notes_history') {
      notesHistory = value || null;
      continue;
    }

    // Extract system fields
    if (crmField === 'email' && value) {
      email = value;
    }
    if ((crmField === 'phone' || crmField === 'mobile') && value && !phone) {
      phone = value;
    }
    if (crmField === 'contact_status' && value) {
      status = value;
    }

    // Store in data
    data[crmField] = value;
  }

  // Build title from name fields
  const firstName = data.first_name as string || '';
  const lastName = data.last_name as string || '';
  title = [firstName, lastName].filter(Boolean).join(' ') || null;

  return { data, email, phone, title, status, notesHistory };
}

async function main() {
  console.log('🚀 Starting Zoho Contacts Migration\n');

  // Read CSV
  console.log('📄 Reading CSV file...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const { headers, rows } = parseCSV(csvContent);
  console.log(`   Found ${rows.length} contacts with ${headers.length} columns\n`);

  // Get organization and module
  console.log('🔍 Looking up organization and contacts module...');

  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .limit(1);

  if (orgError || !orgs?.length) {
    console.error('❌ No organization found. Please create one first.');
    process.exit(1);
  }

  const orgId = orgs[0].id;
  console.log(`   Organization: ${orgs[0].name} (${orgId})`);

  const { data: modules, error: modError } = await supabase
    .from('crm_modules')
    .select('id, key, name')
    .eq('org_id', orgId)
    .eq('key', 'contacts')
    .single();

  if (modError || !modules) {
    console.error('❌ Contacts module not found. Please run CRM seed first.');
    process.exit(1);
  }

  const moduleId = modules.id;
  console.log(`   Module: ${modules.name} (${moduleId})\n`);

  // Get a profile for created_by (first admin)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', orgId)
    .in('crm_role', ['crm_admin', 'crm_manager'])
    .limit(1);

  const createdBy = profiles?.[0]?.id || null;
  console.log(`   Created by profile: ${createdBy || 'null (system)'}\n`);

  // Process in batches
  const BATCH_SIZE = 100;
  let totalInserted = 0;
  let totalNotes = 0;
  let totalErrors = 0;

  console.log('📥 Importing contacts...\n');

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, rows.length)})...`);

    const recordsToInsert: Array<{
      org_id: string;
      module_id: string;
      title: string | null;
      status: string | null;
      email: string | null;
      phone: string | null;
      data: Record<string, unknown>;
      created_by: string | null;
    }> = [];

    const notesMap: Map<number, string> = new Map(); // batch index -> notes

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const { data, email, phone, title, status, notesHistory } = mapRowToRecordData(row);

      recordsToInsert.push({
        org_id: orgId,
        module_id: moduleId,
        title,
        status,
        email,
        phone,
        data,
        created_by: createdBy,
      });

      if (notesHistory) {
        notesMap.set(j, notesHistory);
      }
    }

    // Insert records
    const { data: inserted, error: insertError } = await supabase
      .from('crm_records')
      .insert(recordsToInsert)
      .select('id');

    if (insertError) {
      console.log(` ❌ Error: ${insertError.message}`);
      totalErrors += batch.length;
      continue;
    }

    totalInserted += inserted?.length || 0;

    // Insert notes for records that have them
    if (inserted && notesMap.size > 0) {
      const notesToInsert: Array<{
        org_id: string;
        record_id: string;
        body: string;
        created_by: string | null;
      }> = [];

      for (const [batchIdx, noteBody] of notesMap.entries()) {
        if (inserted[batchIdx]) {
          notesToInsert.push({
            org_id: orgId,
            record_id: inserted[batchIdx].id,
            body: noteBody,
            created_by: createdBy,
          });
        }
      }

      if (notesToInsert.length > 0) {
        const { error: noteError } = await supabase
          .from('crm_notes')
          .insert(notesToInsert);

        if (!noteError) {
          totalNotes += notesToInsert.length;
        }
      }
    }

    console.log(` ✓ ${inserted?.length || 0} records, ${notesMap.size} notes`);
  }

  console.log('\n✅ Migration Complete!');
  console.log(`   Records imported: ${totalInserted}`);
  console.log(`   Notes created: ${totalNotes}`);
  console.log(`   Errors: ${totalErrors}`);
}

main().catch(console.error);
