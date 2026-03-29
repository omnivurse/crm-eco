/**
 * Import Zoho CRM exports (2026-03-20) into Supabase.
 *
 * Pipeline:
 *   Phase 1 — Contacts: staging → upsert_contacts_batch → deduplicate
 *   Phase 2 — Leads:    direct REST upsert (only 1K rows, no staging needed)
 *   Phase 3 — Notes:    staging → import_notes_batch
 *
 * Usage:  npx tsx scripts/import-zoho-2026-03-20.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const DOCS = resolve(__dirname, '..', 'docs');
const CONTACTS_CSV = resolve(DOCS, 'Contacts_2026_03_20.csv');
const LEADS_CSV = resolve(DOCS, 'Leads_2026_03_20.csv');
const NOTES_CSV = resolve(DOCS, 'Notes_Contacts_2026_03_20.csv');

const ORG_ID = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
const LEADS_MODULE_ID = 'd2eebec8-1612-4ed2-a240-0c40fefe6ec5';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* missing */ }
  return env;
}

const root = resolve(__dirname, '..');
const env = { ...loadEnv(resolve(root, '.env.local')), ...loadEnv(resolve(root, '.env')) };
const SUPABASE_URL = env['SUPABASE_URL'] || env['NEXT_PUBLIC_SUPABASE_URL'] || env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields, embedded commas/newlines)
// ---------------------------------------------------------------------------
function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let cur = '';
  let inQ = false;
  let row: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const nx = content[i + 1];
    if (inQ) {
      if (ch === '"' && nx === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || (ch === '\r' && nx === '\n')) {
        row.push(cur); cur = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else { cur += ch; }
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return { headers: rows[0] || [], rows: rows.slice(1) };
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------
const hdrs = {
  'apikey': SUPABASE_KEY!,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function sbPost(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...hdrs, 'Prefer': 'return=minimal,count=exact' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function sbRpc(fn: string, params: Record<string, unknown> = {}, timeoutMs = 180_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { ...hdrs, 'Prefer': 'return=representation' },
      body: JSON.stringify(params),
      signal: ac.signal,
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`RPC ${fn} (${res.status}): ${txt.slice(0, 500)}`);
    try { return JSON.parse(txt); } catch { return txt; }
  } finally { clearTimeout(t); }
}

async function sbDelete(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers: hdrs });
  if (!res.ok) throw new Error(`DELETE ${path} (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...hdrs, 'Prefer': 'return=representation' },
  });
  if (!res.ok) throw new Error(`GET ${path} (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Column maps
// ---------------------------------------------------------------------------
const CONTACTS_COL: Record<string, string> = {
  'Record Id': 'record_id', 'Contact Owner.id': 'contact_owner_id', 'Contact Owner': 'contact_owner',
  'Lead Source': 'lead_source', 'First Name': 'first_name', 'Last Name': 'last_name',
  'Producer Name.id': 'producer_name_id', 'Producer Name': 'producer_name',
  'Email': 'email', 'Title': 'title', 'Phone': 'phone', 'Fax': 'fax', 'Mobile': 'mobile',
  'Date of Birth': 'date_of_birth', 'Created By.id': 'created_by_id', 'Created By': 'created_by',
  'Modified By.id': 'modified_by_id', 'Modified By': 'modified_by',
  'Created Time': 'created_time', 'Modified Time': 'modified_time', 'Contact Name': 'contact_name',
  'Mailing Street': 'mailing_street', 'Mailing City': 'mailing_city',
  'Mailing State': 'mailing_state', 'Mailing Zip': 'mailing_zip',
  'Email Opt Out': 'email_opt_out', 'Salutation': 'salutation', 'Secondary Email': 'secondary_email',
  'Currency': 'currency', 'Exchange Rate': 'exchange_rate',
  'Last Activity Time': 'last_activity_time', 'Territories': 'territories',
  'Spouse': 'spouse', 'Spouse - DOB': 'spouse_dob',
  'Child 1': 'child_1', 'Child 1-DOB': 'child_1_dob',
  'Child 2': 'child_2', 'Child 2-DOB': 'child_2_dob',
  'Child 3': 'child_3', 'Child 3 -DOB': 'child_3_dob',
  'Primary S.S Number': 'primary_ss_number', 'Notes History': 'notes_history',
  'Affiliate': 'affiliate', 'Carrier': 'carrier', 'Previous Product': 'previous_product',
  'Monthly Premium': 'monthly_premium', 'Commission Percentage': 'commission_percentage',
  'Contact Status': 'contact_status', 'Product': 'product', 'Coverage Option': 'coverage_option',
  'Start Date': 'start_date', 'Referral Source': 'referral_source',
  'Referring Member': 'referring_member', 'Add on Product': 'add_on_product',
  'Declined': 'declined', 'Charge Waived': 'charge_waived',
  'Affiliate Referral': 'affiliate_referral',
  'Affiliate Rep  Monthly': 'affiliate_rep_monthly', 'Affiliate Rep Monthly': 'affiliate_rep_monthly',
  'Amount Received': 'amount_received', 'Team Leader Monthly': 'team_leader_monthly',
  'Team Leader': 'team_leader', 'Primary Member Gender': 'primary_member_gender',
  'MPower Life Code': 'mpower_life_code', 'Welcome call performed by': 'welcome_call_performed_by',
  'Producer Commission': 'producer_commission', 'Team Leader Referral': 'team_leader_referral',
  'Child 4': 'child_4', 'Child 5 -DOB': 'child_5_dob', 'Child 5': 'child_5',
  'Child 4 -DOB': 'child_4_dob', 'Director': 'director', 'Director Referral': 'director_referral',
  'Director Monthly': 'director_monthly', '4th Life Code': 'life_code_4th',
  'Fulfillment Letter mailed': 'fulfillment_letter_mailed',
  'Fulfillment Email Sent': 'fulfillment_email_sent', 'Complete Date': 'complete_date',
  '3rd Life Code': 'life_code_3rd', '2nd Life Code': 'life_code_2nd',
  'Date Referral Paid': 'date_referral_paid', 'Welcome Call Status': 'welcome_call_status',
  'Child 4 S.S. Number': 'child_4_ss_number', 'MEC Submitted': 'mec_submitted',
  'Child 3 S.S. Number': 'child_3_ss_number', 'Child 5 S.S. Number': 'child_5_ss_number',
  'Child 1 S.S. Number': 'child_1_ss_number', 'Spouse S.S. Number': 'spouse_ss_number',
  'Child 2 S.S. Number': 'child_2_ss_number', 'Marital Status': 'marital_status',
  'Work Phone': 'work_phone', 'Middle Initial': 'middle_initial',
  'MPB Referral Fee': 'referral_fee', 'Referral requirement satisfied': 'referral_requirement_satisfied',
  'Tag': 'tag', 'Days Visited': 'days_visited',
  'Average Time Spent (Minutes)': 'average_time_spent_minutes',
  'Number Of Chats': 'number_of_chats', 'Most Recent Visit': 'most_recent_visit',
  'First Visit': 'first_visit', 'First Page Visited': 'first_page_visited',
  'Referrer': 'referrer', 'Visitor Score': 'visitor_score',
  'Risk assessment paid': 'risk_assessment_paid', 'Company/Association': 'company_association',
  'Cancellation Date': 'cancellation_date',
  'Data Processing Basis Details.id': 'data_processing_basis_id',
  'Data Processing Basis': 'data_processing_basis', 'Data Source': 'data_source',
  'Preferred Method of Communication': 'preferred_method_of_communication',
  'Vision': 'vision', 'Dental': 'dental', 'IUA Amount': 'iua_amount',
  'Business or Practice Name': 'business_or_practice_name', 'DPC Name': 'dpc_name',
  'Cirrus registration Date': 'cirrus_registration_date',
  'MPB Portal Username': 'portal_username', 'MPB Portal Password': 'portal_password',
  'Select Conversion Completed': 'select_conversion_completed',
  'MEC Decision Confirmed': 'mec_decision_confirmed',
  'Unsubscribed Mode': 'unsubscribed_mode', 'Unsubscribed Time': 'unsubscribed_time',
  'Admin123': 'admin123', 'Household Annual Adj Gross': 'household_annual_adj_gross',
  'Change Log Time': 'change_log_time', 'Locked': 'locked',
  'Last Enriched Time': 'last_enriched_time', 'Enrich Status': 'enrich_status',
  'MPB APP Downloaded': 'app_downloaded', 'Birth Month': 'birth_month',
  'Third Party Payor': 'third_party_payor', 'ATAP': 'atap',
  'Permission to Discuss Plan': 'permission_to_discuss_plan',
  'Medical Release Form on File': 'medical_release_form_on_file',
  '5th Life Code': 'life_code_5th', 'WC Outreach Date': 'wc_outreach_date',
  'E123 Member ID': 'e123_member_id',
  'Child 3 Address': 'child_3_address', 'Child 3 Phone Number': 'child_3_phone_number',
  'Child 1 Phone Number': 'child_1_phone_number', 'Child 4 Address': 'child_4_address',
  'Child 1 Address': 'child_1_address', 'Child 4 Phone Number': 'child_4_phone_number',
  'Child 2 Phone Number': 'child_2_phone_number', 'Child 5 Address': 'child_5_address',
  'Child 2 Address': 'child_2_address', 'Spouse Address': 'spouse_address',
  'Child 5 Phone Number': 'child_5_phone_number', 'Spouse Phone Number': 'spouse_phone_number',
  'Child 1 Email': 'child_1_email', 'Child 2 Email': 'child_2_email',
  'Child 3 Email': 'child_3_email', 'Child 4 Email': 'child_4_email',
  'Child 5 Email': 'child_5_email', 'Spouse Email': 'spouse_email',
  'Connected To.module': 'connected_to_module', 'Connected To.id': 'connected_to_id',
  'Tax-ID': 'tax_id',
};

const NOTES_COL: Record<string, string> = {
  'Record Id': 'record_id', 'Associated_Id': 'associated_id',
  'Created By.id': 'created_by_id', 'Created By': 'created_by',
  'Created Time': 'created_time', 'Modified By.id': 'modified_by_id',
  'Modified By': 'modified_by', 'Modified Time': 'modified_time',
  'Note Content': 'note_content', 'Note Owner.id': 'note_owner_id',
  'Note Owner': 'note_owner', 'Note Title': 'note_title',
  'Parent ID.id': 'parent_id', 'Parent ID': 'parent_name',
};

// ---------------------------------------------------------------------------
// Generic CSV → staging loader
// ---------------------------------------------------------------------------
function mapCSVToObjects(csvPath: string, colMap: Record<string, string>) {
  console.log(`  File: ${csvPath}`);
  const raw = readFileSync(csvPath, 'utf-8');
  const { headers: csvH, rows } = parseCSV(raw);
  console.log(`  ${csvH.length} columns, ${rows.length} rows`);

  const mapped = csvH.map(h => colMap[h.trim()] || null);
  const valid = [...new Set(mapped.filter((h): h is string => h !== null))];

  return rows.map(row => {
    const obj: Record<string, string> = {};
    for (const c of valid) obj[c] = '';
    for (let i = 0; i < mapped.length; i++) {
      const c = mapped[i];
      if (c && row[i] !== undefined && row[i] !== '') obj[c] = row[i];
    }
    return obj;
  });
}

async function loadToStaging(table: string, objects: Record<string, string>[]) {
  const BATCH = 200;
  let ok = 0, err = 0;
  for (let i = 0; i < objects.length; i += BATCH) {
    const batch = objects.slice(i, i + BATCH);
    try {
      await sbPost(table, batch);
      ok += batch.length;
    } catch (e) {
      console.error(`\n  Batch err: ${(e as Error).message.slice(0, 200)}`);
      err += batch.length;
    }
    process.stdout.write(`\r  Loading: ${Math.round(((i + batch.length) / objects.length) * 100)}% (${ok} rows)`);
  }
  console.log(`\n  Staging: ${ok} ok, ${err} errors`);
  return ok;
}

// ---------------------------------------------------------------------------
// Phase 1: Contacts (staging → RPC)
// ---------------------------------------------------------------------------
async function importContacts() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1: CONTACTS');
  console.log('='.repeat(60));

  console.log('\n[1a] Clearing contacts staging...');
  await sbDelete('import_contacts_staging?row_num=gt.0');

  console.log('[1b] Loading CSV → staging...');
  const objs = mapCSVToObjects(CONTACTS_CSV, CONTACTS_COL);
  const loaded = await loadToStaging('import_contacts_staging', objs);

  console.log('\n[1c] Upserting contacts (batched)...');
  const BATCH = 500;
  let ins = 0, upd = 0, skip = 0, errs = 0;
  for (let off = 0; off < loaded; off += BATCH) {
    try {
      const r = await sbRpc('upsert_contacts_batch', { p_offset: off, p_limit: BATCH });
      const row = Array.isArray(r) ? r[0] : r;
      ins += row.inserted || 0;
      upd += row.updated || 0;
      skip += row.skipped || 0;
      errs += row.errors || 0;
      const pct = Math.min(100, Math.round(((off + BATCH) / loaded) * 100));
      process.stdout.write(`\r  Upserting: ${pct}% (${ins} new, ${upd} updated, ${errs} errors)`);
    } catch (e) {
      console.error(`\n  Batch err at ${off}: ${(e as Error).message.slice(0, 200)}`);
      errs += BATCH;
    }
  }
  console.log(`\n  Contacts upsert: ${ins} inserted, ${upd} updated, ${skip} skipped, ${errs} errors`);

  console.log('\n[1d] Deduplicating...');
  const dedup = await sbRpc('deduplicate_contacts');
  console.log('  Dedup result:', JSON.stringify(dedup));

  return { inserted: ins, updated: upd, errors: errs };
}

// ---------------------------------------------------------------------------
// Phase 2: Leads (direct REST upsert — small dataset)
// ---------------------------------------------------------------------------
async function importLeads() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: LEADS');
  console.log('='.repeat(60));

  const raw = readFileSync(LEADS_CSV, 'utf-8');
  const { headers: csvH, rows } = parseCSV(raw);
  console.log(`  ${rows.length} lead rows`);

  const hIdx = (name: string) => csvH.findIndex(h => h.trim() === name);
  const col = (row: string[], name: string) => {
    const i = hIdx(name);
    return i >= 0 ? (row[i] || '').trim() : '';
  };

  let ins = 0, upd = 0, skip = 0, errs = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const recordId = col(r, 'Record Id');
    const email = col(r, 'Email');
    const firstName = col(r, 'First Name');
    const lastName = col(r, 'Last Name');
    const phone = col(r, 'Phone');

    if (!recordId || (!firstName && !lastName)) { skip++; continue; }

    try {
      // Check for existing by email or source_record_id
      let existingId: string | null = null;

      if (email) {
        const matches: any[] = await sbGet(
          `crm_records?org_id=eq.${ORG_ID}&module_id=eq.${LEADS_MODULE_ID}&email=ilike.${encodeURIComponent(email)}&select=id&limit=1`
        );
        if (matches.length > 0) existingId = matches[0].id;
      }

      if (!existingId) {
        const matches: any[] = await sbGet(
          `crm_records?org_id=eq.${ORG_ID}&module_id=eq.${LEADS_MODULE_ID}&source_record_id=eq.${encodeURIComponent(recordId)}&select=id&limit=1`
        );
        if (matches.length > 0) existingId = matches[0].id;
      }

      if (!existingId) {
        const matches: any[] = await sbGet(
          `crm_records?org_id=eq.${ORG_ID}&module_id=eq.${LEADS_MODULE_ID}&data->>zoho_record_id=eq.${encodeURIComponent(recordId)}&select=id&limit=1`
        );
        if (matches.length > 0) existingId = matches[0].id;
      }

      const title = col(r, 'Lead Name') || [firstName, lastName].filter(Boolean).join(' ');
      const data: Record<string, unknown> = {};
      const set = (k: string, v: string) => { if (v) data[k] = v; };

      set('zoho_record_id', recordId);
      set('first_name', firstName);
      set('last_name', lastName);
      set('email', email);
      set('phone', phone);
      set('mobile', col(r, 'Mobile'));
      set('lead_source', col(r, 'Lead Source'));
      set('lead_status', col(r, 'Lead Status'));
      set('company', col(r, 'Company'));
      set('lead_owner', col(r, 'Lead Owner'));
      set('date_of_birth', col(r, 'Date of Birth'));
      set('mailing_street', col(r, 'Street'));
      set('mailing_city', col(r, 'City'));
      set('mailing_state', col(r, 'State'));
      set('mailing_zip', col(r, 'Zip Code'));
      set('spouse', col(r, 'Spouse'));
      set('spouse_dob', col(r, 'Spouse - DOB'));
      set('child_1', col(r, 'Child 1'));
      set('child_1_dob', col(r, 'Child 1 - DOB'));
      set('child_2', col(r, 'Child 2'));
      set('child_2_dob', col(r, 'Child 2 - DOB'));
      set('child_3', col(r, 'Child 3'));
      set('child_3_dob', col(r, 'Child 3 - DOB'));
      set('child_4', col(r, 'Child 4'));
      set('child_4_dob', col(r, 'Child 4 - DOB'));
      set('child_5', col(r, 'Child 5'));
      set('child_5_dob', col(r, 'Child 5 - DOB'));
      set('product_type', col(r, 'Product Type'));
      set('next_step', col(r, 'Next Step'));
      set('producer_name', col(r, 'Producer'));
      set('coverage_option', col(r, 'Coverage Option'));
      set('tag', col(r, 'Tag'));
      set('business_type', col(r, 'Business Type'));
      set('referring_member', col(r, 'Referring Member'));
      set('middle_name', col(r, 'Middle Name'));
      set('business_or_practice_name', col(r, 'Business or Practice Name'));
      set('data_source', col(r, 'Data Source'));
      set('zoho_created_time', col(r, 'Created Time'));
      set('zoho_modified_time', col(r, 'Modified Time'));
      const isConverted = col(r, 'Is Converted') === 'true';
      if (isConverted) data['is_converted'] = true;

      const status = col(r, 'Lead Status') || 'New';

      if (existingId) {
        // Merge data into existing record
        const res = await fetch(`${SUPABASE_URL}/rest/v1/crm_records?id=eq.${existingId}`, {
          method: 'PATCH',
          headers: { ...hdrs, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            title,
            status,
            email: email || undefined,
            phone: phone || undefined,
            data,
            source_record_id: recordId,
            import_source: 'zoho_csv',
            updated_at: new Date().toISOString(),
          }),
        });
        if (!res.ok) throw new Error(`PATCH lead ${existingId}: ${res.status}`);
        upd++;
      } else {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/crm_records`, {
          method: 'POST',
          headers: { ...hdrs, 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            org_id: ORG_ID,
            module_id: LEADS_MODULE_ID,
            title,
            status,
            email: email || null,
            phone: phone || null,
            data,
            source_record_id: recordId,
            import_source: 'zoho_csv',
          }),
        });
        if (!res.ok) throw new Error(`POST lead: ${res.status} ${(await res.text()).slice(0, 200)}`);
        ins++;
      }
    } catch (e) {
      errs++;
      if (errs <= 5) console.error(`\n  Lead error (${firstName} ${lastName}): ${(e as Error).message.slice(0, 150)}`);
    }

    if (i % 50 === 0) {
      process.stdout.write(`\r  Leads: ${Math.round((i / rows.length) * 100)}% (${ins} new, ${upd} updated, ${errs} errors)`);
    }
  }

  console.log(`\n  Leads: ${ins} inserted, ${upd} updated, ${skip} skipped, ${errs} errors`);
  return { inserted: ins, updated: upd, errors: errs };
}

// ---------------------------------------------------------------------------
// Phase 3: Notes (staging → RPC)
// ---------------------------------------------------------------------------
async function importNotes() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 3: NOTES');
  console.log('='.repeat(60));

  console.log('\n[3a] Clearing notes staging...');
  await sbDelete('import_notes_staging?row_num=gt.0');

  console.log('[3b] Loading Notes CSV → staging...');
  const objs = mapCSVToObjects(NOTES_CSV, NOTES_COL);
  const loaded = await loadToStaging('import_notes_staging', objs);

  console.log('\n[3c] Importing notes (batched, linking to records)...');
  const BATCH = 1000;
  let imp = 0, skip = 0, errs = 0;
  for (let off = 0; off < loaded; off += BATCH) {
    try {
      const r = await sbRpc('import_notes_batch', { p_offset: off, p_limit: BATCH });
      const row = Array.isArray(r) ? r[0] : r;
      imp += row.imported || 0;
      skip += row.skipped || 0;
      errs += row.errors || 0;
      const pct = Math.min(100, Math.round(((off + BATCH) / loaded) * 100));
      process.stdout.write(`\r  Notes: ${pct}% (${imp} imported, ${skip} skipped, ${errs} errors)`);
    } catch (e) {
      console.error(`\n  Batch err at ${off}: ${(e as Error).message.slice(0, 200)}`);
      errs += BATCH;
    }
  }
  console.log(`\n  Notes: ${imp} imported, ${skip} skipped, ${errs} errors`);
  return { imported: imp, skipped: skip, errors: errs };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60));
  console.log('ZOHO CRM IMPORT — 2026-03-20 EXPORT');
  console.log('='.repeat(60));
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Org:      ${ORG_ID}`);

  // Pre-flight: verify staging tables
  for (const tbl of ['import_contacts_staging', 'import_notes_staging']) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${tbl}?select=row_num&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY!, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) {
      console.error(`${tbl} not accessible (${res.status}). Run: NOTIFY pgrst, 'reload schema';`);
      process.exit(1);
    }
  }
  console.log('Staging tables confirmed accessible.\n');

  // Snapshot before
  const before = await sbGet('crm_records?select=id&limit=1&order=id');
  const beforeCount = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_records?select=id&limit=0`,
    { headers: { ...hdrs, 'Prefer': 'count=exact' } }
  );
  const recsBefore = parseInt(beforeCount.headers.get('content-range')?.split('/')[1] || '0');
  const notesBefore = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_notes?select=id&limit=0`,
    { headers: { ...hdrs, 'Prefer': 'count=exact' } }
  );
  const nBefore = parseInt(notesBefore.headers.get('content-range')?.split('/')[1] || '0');
  console.log(`Before: ${recsBefore} records, ${nBefore} notes\n`);

  const t0 = Date.now();

  const c = await importContacts();
  const l = await importLeads();
  const n = await importNotes();

  // Snapshot after
  const recsAfter = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_records?select=id&limit=0`,
    { headers: { ...hdrs, 'Prefer': 'count=exact' } }
  );
  const rAfter = parseInt(recsAfter.headers.get('content-range')?.split('/')[1] || '0');
  const notesAfter = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_notes?select=id&limit=0`,
    { headers: { ...hdrs, 'Prefer': 'count=exact' } }
  );
  const nAfter = parseInt(notesAfter.headers.get('content-range')?.split('/')[1] || '0');

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Time: ${elapsed}s`);
  console.log(`\nContacts: ${c.inserted} new, ${c.updated} updated, ${c.errors} errors`);
  console.log(`Leads:    ${l.inserted} new, ${l.updated} updated, ${l.errors} errors`);
  console.log(`Notes:    ${n.imported} imported, ${n.skipped} skipped, ${n.errors} errors`);
  console.log(`\nRecords: ${recsBefore} → ${rAfter} (${rAfter - recsBefore >= 0 ? '+' : ''}${rAfter - recsBefore})`);
  console.log(`Notes:   ${nBefore} → ${nAfter} (${nAfter - nBefore >= 0 ? '+' : ''}${nAfter - nBefore})`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
