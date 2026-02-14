/**
 * Direct Zoho CSV → crm_records + crm_notes import
 * Bypasses staging tables entirely. Inserts directly via PostgREST.
 * 
 * Usage:  npx tsx scripts/import-zoho-direct.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// ENV
// ============================================================================
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
  } catch { /* */ }
  return env;
}

// Load from .env.vercel (production/correct database: PIF-ECO-V2 / sffisarikcreyyjzdjvb)
const envFile = loadEnv(resolve(__dirname, '..', '.env.vercel'));
const SUPABASE_URL = envFile['NEXT_PUBLIC_SUPABASE_URL'] || envFile['SUPABASE_URL'] || envFile['VITE_SUPABASE_URL'];
const SUPABASE_KEY = envFile['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ============================================================================
// CSV Parser
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
      if (ch === '"' && next === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(current); current = ''; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current); current = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else { current += ch; }
    }
  }
  if (current || row.length > 0) { row.push(current); rows.push(row); }
  const headers = rows[0] || [];
  return { headers, rows: rows.slice(1) };
}

function csvToObjects(filePath: string, columnMap: Record<string, string>): Record<string, string>[] {
  const raw = readFileSync(filePath, 'utf-8');
  const { headers, rows } = parseCSV(raw);
  const mapped = headers.map(h => columnMap[h.trim()] || null);
  return rows.map(row => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < mapped.length; i++) {
      if (mapped[i] && row[i] !== undefined && row[i] !== '') obj[mapped[i]!] = row[i];
    }
    return obj;
  }).filter(o => Object.keys(o).length > 0);
}

// ============================================================================
// Supabase helpers
// ============================================================================
async function supabasePost(table: string, data: any[]): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `${res.status}: ${t.slice(0, 300)}` };
  }
  return { ok: true };
}

async function supabaseGet(table: string, query: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`);
  return res.json();
}

// ============================================================================
// Helpers
// ============================================================================
function parseDate(s: string | undefined): string | null {
  if (!s || s === '0000-00-00') return null;
  try { return new Date(s).toISOString().split('T')[0]; } catch { return null; }
}

function parseDatetime(s: string | undefined): string | null {
  if (!s) return null;
  try { return new Date(s).toISOString(); } catch { return null; }
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseBool(s: string | undefined): boolean {
  if (!s) return false;
  return ['true', 'yes', '1'].includes(s.toLowerCase());
}

// strip null/empty values from an object
function clean(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== '' && v !== false) result[k] = v;
  }
  return result;
}

// ============================================================================
// Column Maps
// ============================================================================
const CONTACTS_MAP: Record<string, string> = {
  'Record Id': 'record_id', 'Contact Owner.id': 'contact_owner_id', 'Contact Owner': 'contact_owner',
  'Lead Source': 'lead_source', 'First Name': 'first_name', 'Last Name': 'last_name',
  'Producer Name.id': 'producer_name_id', 'Producer Name': 'producer_name',
  'Email': 'email', 'Title': 'title', 'Phone': 'phone', 'Fax': 'fax', 'Mobile': 'mobile',
  'Date of Birth': 'date_of_birth', 'Created By.id': 'created_by_id', 'Created By': 'created_by',
  'Modified By.id': 'modified_by_id', 'Modified By': 'modified_by',
  'Created Time': 'created_time', 'Modified Time': 'modified_time',
  'Contact Name': 'contact_name', 'Mailing Street': 'mailing_street',
  'Mailing City': 'mailing_city', 'Mailing State': 'mailing_state', 'Mailing Zip': 'mailing_zip',
  'Email Opt Out': 'email_opt_out', 'Salutation': 'salutation', 'Secondary Email': 'secondary_email',
  'Currency': 'currency', 'Exchange Rate': 'exchange_rate', 'Last Activity Time': 'last_activity_time',
  'Territories': 'territories', 'Spouse': 'spouse', 'Spouse - DOB': 'spouse_dob',
  'Child 1': 'child_1', 'Child 1-DOB': 'child_1_dob', 'Child 2': 'child_2', 'Child 2-DOB': 'child_2_dob',
  'Child 3': 'child_3', 'Child 3 -DOB': 'child_3_dob', 'Primary S.S Number': 'primary_ss_number',
  'Notes History': 'notes_history', 'Affiliate': 'affiliate', 'Carrier': 'carrier',
  'Previous Product': 'previous_product', 'Monthly Premium': 'monthly_premium',
  'Commission Percentage': 'commission_percentage', 'Contact Status': 'contact_status',
  'Product': 'product', 'Coverage Option': 'coverage_option', 'Start Date': 'start_date',
  'Referral Source': 'referral_source', 'Referring Member': 'referring_member',
  'Add on Product': 'add_on_product', 'Declined': 'declined', 'Charge Waived': 'charge_waived',
  'Affiliate Referral': 'affiliate_referral', 'Affiliate Rep  Monthly': 'affiliate_rep_monthly',
  'Affiliate Rep Monthly': 'affiliate_rep_monthly', 'Amount Received': 'amount_received',
  'Team Leader Monthly': 'team_leader_monthly', 'Team Leader': 'team_leader',
  'Primary Member Gender': 'primary_member_gender', 'MPower Life Code': 'mpower_life_code',
  'Welcome call performed by': 'welcome_call_performed_by', 'Producer Commission': 'producer_commission',
  'Team Leader Referral': 'team_leader_referral', 'Child 4': 'child_4', 'Child 5 -DOB': 'child_5_dob',
  'Child 5': 'child_5', 'Child 4 -DOB': 'child_4_dob', 'Director': 'director',
  'Director Referral': 'director_referral', 'Director Monthly': 'director_monthly',
  '4th Life Code': 'life_code_4th', 'Fulfillment Letter mailed': 'fulfillment_letter_mailed',
  'Fulfillment Email Sent': 'fulfillment_email_sent', 'Complete Date': 'complete_date',
  '3rd Life Code': 'life_code_3rd', '2nd Life Code': 'life_code_2nd',
  'Date Referral Paid': 'date_referral_paid', 'Welcome Call Status': 'welcome_call_status',
  'Child 4 S.S. Number': 'child_4_ss_number', 'MEC Submitted': 'mec_submitted',
  'Child 3 S.S. Number': 'child_3_ss_number', 'Child 5 S.S. Number': 'child_5_ss_number',
  'Child 1 S.S. Number': 'child_1_ss_number', 'Spouse S.S. Number': 'spouse_ss_number',
  'Child 2 S.S. Number': 'child_2_ss_number', 'Marital Status': 'marital_status',
  'Work Phone': 'work_phone', 'Middle Initial': 'middle_initial',
  'MPB Referral Fee': 'referral_fee', 'Referral requirement satisfied': 'referral_requirement_satisfied',
  'Tag': 'tag', 'Days Visited': 'days_visited', 'Average Time Spent (Minutes)': 'average_time_spent_minutes',
  'Number Of Chats': 'number_of_chats', 'Most Recent Visit': 'most_recent_visit',
  'First Visit': 'first_visit', 'First Page Visited': 'first_page_visited', 'Referrer': 'referrer',
  'Visitor Score': 'visitor_score', 'Risk assessment paid': 'risk_assessment_paid',
  'Company/Association': 'company_association', 'Cancellation Date': 'cancellation_date',
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
  'E123 Member ID': 'e123_member_id', 'Child 3 Address': 'child_3_address',
  'Child 3 Phone Number': 'child_3_phone_number', 'Child 1 Phone Number': 'child_1_phone_number',
  'Child 4 Address': 'child_4_address', 'Child 1 Address': 'child_1_address',
  'Child 4 Phone Number': 'child_4_phone_number', 'Child 2 Phone Number': 'child_2_phone_number',
  'Child 5 Address': 'child_5_address', 'Child 2 Address': 'child_2_address',
  'Spouse Address': 'spouse_address', 'Child 5 Phone Number': 'child_5_phone_number',
  'Spouse Phone Number': 'spouse_phone_number', 'Child 1 Email': 'child_1_email',
  'Child 2 Email': 'child_2_email', 'Child 3 Email': 'child_3_email',
  'Child 4 Email': 'child_4_email', 'Child 5 Email': 'child_5_email',
  'Spouse Email': 'spouse_email', 'Connected To.module': 'connected_to_module',
  'Connected To.id': 'connected_to_id', 'Tax-ID': 'tax_id',
};

const LEADS_MAP: Record<string, string> = {
  'Record Id': 'record_id', 'Lead Owner.id': 'lead_owner_id', 'Lead Owner': 'lead_owner',
  'Is Converted': 'is_converted', 'Company': 'company', 'First Name': 'first_name',
  'Last Name': 'last_name', 'Email': 'email', 'Phone': 'phone', 'Mobile': 'mobile',
  'Lead Source': 'lead_source', 'Lead Status': 'lead_status',
  'Created By.id': 'created_by_id', 'Created By': 'created_by',
  'Modified By.id': 'modified_by_id', 'Modified By': 'modified_by',
  'Created Time': 'created_time', 'Modified Time': 'modified_time',
  'Lead Name': 'lead_name', 'Street': 'street', 'City': 'city', 'State': 'state',
  'Zip Code': 'zip_code', 'Email Opt Out': 'email_opt_out', 'Salutation': 'salutation',
  'Last Activity Time': 'last_activity_time', 'Spouse': 'spouse', 'Spouse - DOB': 'spouse_dob',
  'Child 1': 'child_1', 'Child 1 - DOB': 'child_1_dob', 'Child 2': 'child_2',
  'Child 2 - DOB': 'child_2_dob', 'Child 3': 'child_3', 'Child 3 - DOB': 'child_3_dob',
  'Product Type': 'product_type', 'Next Step': 'next_step',
  'Producer.id': 'producer_id', 'Producer': 'producer', 'Date of Birth': 'date_of_birth',
  'Child 5 - DOB': 'child_5_dob', 'Child 5': 'child_5', 'Child 4 - DOB': 'child_4_dob',
  'Child 4': 'child_4', 'Coverage Option': 'coverage_option', 'Tag': 'tag',
  'Business Type': 'business_type', 'Days Visited': 'days_visited',
  'Average Time Spent (Minutes)': 'average_time_spent_minutes',
  'Number Of Chats': 'number_of_chats', 'Most Recent Visit': 'most_recent_visit',
  'First Visit': 'first_visit', 'First Page Visited': 'first_page_visited',
  'Referrer': 'referrer', 'Visitor Score': 'visitor_score',
  'Data Processing Basis Details.id': 'data_processing_basis_id',
  'Data Processing Basis': 'data_processing_basis', 'Data Source': 'data_source',
  'Middle Name': 'middle_name', 'Business or Practice Name': 'business_or_practice_name',
  'Converted Date Time': 'converted_date_time', 'Lead Conversion Time': 'lead_conversion_time',
  'Unsubscribed Mode': 'unsubscribed_mode', 'Unsubscribed Time': 'unsubscribed_time',
  'Converted Account.id': 'converted_account_id', 'Converted Account': 'converted_account',
  'Converted Contact.id': 'converted_contact_id', 'Converted Contact': 'converted_contact',
  'Converted Deal.id': 'converted_deal_id', 'Converted Deal': 'converted_deal',
  'Change Log Time': 'change_log_time', 'Locked': 'locked',
  'Last Enriched Time': 'last_enriched_time', 'Enrich Status': 'enrich_status',
  'Referring Member': 'referring_member', 'Mobile 2': 'mobile_2',
  'Connected To.module': 'connected_to_module', 'Connected To.id': 'connected_to_id',
};

const NOTES_MAP: Record<string, string> = {
  'Record Id': 'record_id', 'Associated_Id': 'associated_id',
  'Created By.id': 'created_by_id', 'Created By': 'created_by',
  'Created Time': 'created_time', 'Modified By.id': 'modified_by_id',
  'Modified By': 'modified_by', 'Modified Time': 'modified_time',
  'Note Content': 'note_content', 'Note Owner.id': 'note_owner_id',
  'Note Owner': 'note_owner', 'Note Title': 'note_title',
  'Parent ID.id': 'parent_id', 'Parent ID': 'parent_name',
};

// ============================================================================
// Transform contact row → crm_records insert
// ============================================================================
function contactToRecord(row: Record<string, string>, orgId: string, moduleId: string) {
  const r = row;
  const data = clean({
    zoho_record_id: r.record_id,
    zoho_contact_owner_id: r.contact_owner_id,
    zoho_producer_id: r.producer_name_id,
    first_name: r.first_name, last_name: r.last_name, contact_name: r.contact_name,
    salutation: r.salutation, middle_initial: r.middle_initial, title: r.title,
    date_of_birth: parseDate(r.date_of_birth), birth_month: r.birth_month,
    primary_member_gender: r.primary_member_gender, marital_status: r.marital_status,
    secondary_email: r.secondary_email, mobile: r.mobile, work_phone: r.work_phone, fax: r.fax,
    mailing_street: r.mailing_street, mailing_city: r.mailing_city,
    mailing_state: r.mailing_state, mailing_zip: r.mailing_zip,
    contact_status: r.contact_status, contact_owner: r.contact_owner,
    lead_source: r.lead_source, affiliate: r.affiliate, producer_name: r.producer_name,
    referral_source: r.referral_source, referring_member: r.referring_member,
    tag: r.tag, territories: r.territories, company_association: r.company_association,
    data_source: r.data_source,
    spouse: r.spouse, spouse_dob: parseDate(r.spouse_dob),
    spouse_ss_number: r.spouse_ss_number, spouse_address: r.spouse_address,
    spouse_phone_number: r.spouse_phone_number, spouse_email: r.spouse_email,
    child_1: r.child_1, child_1_dob: parseDate(r.child_1_dob), child_1_ss_number: r.child_1_ss_number,
    child_1_address: r.child_1_address, child_1_phone_number: r.child_1_phone_number, child_1_email: r.child_1_email,
    child_2: r.child_2, child_2_dob: parseDate(r.child_2_dob), child_2_ss_number: r.child_2_ss_number,
    child_2_address: r.child_2_address, child_2_phone_number: r.child_2_phone_number, child_2_email: r.child_2_email,
    child_3: r.child_3, child_3_dob: parseDate(r.child_3_dob), child_3_ss_number: r.child_3_ss_number,
    child_3_address: r.child_3_address, child_3_phone_number: r.child_3_phone_number, child_3_email: r.child_3_email,
    child_4: r.child_4, child_4_dob: parseDate(r.child_4_dob), child_4_ss_number: r.child_4_ss_number,
    child_4_address: r.child_4_address, child_4_phone_number: r.child_4_phone_number, child_4_email: r.child_4_email,
    child_5: r.child_5, child_5_dob: parseDate(r.child_5_dob), child_5_ss_number: r.child_5_ss_number,
    child_5_address: r.child_5_address, child_5_phone_number: r.child_5_phone_number, child_5_email: r.child_5_email,
    product: r.product, coverage_option: r.coverage_option, carrier: r.carrier,
    previous_product: r.previous_product, monthly_premium: parseNum(r.monthly_premium),
    start_date: parseDate(r.start_date), cancellation_date: r.cancellation_date,
    iua_amount: r.iua_amount, add_on_product: r.add_on_product, vision: r.vision, dental: r.dental,
    commission_percentage: parseNum(r.commission_percentage),
    producer_commission: parseNum(r.producer_commission), amount_received: parseNum(r.amount_received),
    team_leader: r.team_leader, team_leader_monthly: parseNum(r.team_leader_monthly),
    team_leader_referral: parseNum(r.team_leader_referral),
    director: r.director, director_monthly: parseNum(r.director_monthly),
    director_referral: parseNum(r.director_referral),
    affiliate_referral: r.affiliate_referral, affiliate_rep_monthly: parseNum(r.affiliate_rep_monthly),
    referral_fee: parseNum(r.referral_fee), date_referral_paid: parseDate(r.date_referral_paid),
    referral_requirement_satisfied: r.referral_requirement_satisfied,
    declined: parseBool(r.declined), charge_waived: parseBool(r.charge_waived),
    household_annual_adj_gross: parseNum(r.household_annual_adj_gross),
    primary_ss_number: r.primary_ss_number, tax_id: r.tax_id,
    mpower_life_code: r.mpower_life_code, life_code_2nd: r.life_code_2nd,
    life_code_3rd: r.life_code_3rd, life_code_4th: r.life_code_4th, life_code_5th: r.life_code_5th,
    e123_member_id: r.e123_member_id,
    portal_username: r.portal_username, portal_password: r.portal_password,
    cirrus_registration_date: parseDate(r.cirrus_registration_date),
    app_downloaded: parseBool(r.app_downloaded),
    select_conversion_completed: parseBool(r.select_conversion_completed),
    mec_submitted: parseBool(r.mec_submitted), mec_decision_confirmed: parseBool(r.mec_decision_confirmed),
    medical_release_form_on_file: parseBool(r.medical_release_form_on_file),
    permission_to_discuss_plan: parseBool(r.permission_to_discuss_plan),
    atap: r.atap, third_party_payor: r.third_party_payor, risk_assessment_paid: r.risk_assessment_paid,
    welcome_call_status: r.welcome_call_status, welcome_call_performed_by: r.welcome_call_performed_by,
    wc_outreach_date: parseDate(r.wc_outreach_date),
    fulfillment_letter_mailed: parseDate(r.fulfillment_letter_mailed),
    fulfillment_email_sent: parseDate(r.fulfillment_email_sent),
    complete_date: parseDate(r.complete_date),
    business_or_practice_name: r.business_or_practice_name, dpc_name: r.dpc_name,
    email_opt_out: parseBool(r.email_opt_out),
    preferred_method_of_communication: r.preferred_method_of_communication,
    notes_history: r.notes_history,
    created_by_name: r.created_by, modified_by_name: r.modified_by,
    zoho_created_time: parseDatetime(r.created_time), zoho_modified_time: parseDatetime(r.modified_time),
    locked: parseBool(r.locked), admin123: r.admin123,
  });

  return {
    org_id: orgId,
    module_id: moduleId,
    title: r.contact_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
    status: r.contact_status || 'Active',
    email: r.email || null,
    phone: r.phone || null,
    data,
    created_at: parseDatetime(r.created_time) || new Date().toISOString(),
    updated_at: parseDatetime(r.modified_time) || new Date().toISOString(),
  };
}

// ============================================================================
// Transform lead row → crm_records insert
// ============================================================================
function leadToRecord(row: Record<string, string>, orgId: string, moduleId: string) {
  const r = row;
  const data = clean({
    zoho_record_id: r.record_id, zoho_lead_owner_id: r.lead_owner_id, zoho_producer_id: r.producer_id,
    first_name: r.first_name, last_name: r.last_name, lead_name: r.lead_name,
    salutation: r.salutation, middle_name: r.middle_name, date_of_birth: parseDate(r.date_of_birth),
    company: r.company, mobile: r.mobile, mobile_2: r.mobile_2,
    street: r.street, city: r.city, state: r.state, zip_code: r.zip_code,
    lead_status: r.lead_status, lead_source: r.lead_source, lead_owner: r.lead_owner,
    producer: r.producer, is_converted: parseBool(r.is_converted),
    tag: r.tag, referring_member: r.referring_member,
    product_type: r.product_type, coverage_option: r.coverage_option,
    next_step: r.next_step, business_type: r.business_type,
    business_or_practice_name: r.business_or_practice_name,
    spouse: r.spouse, spouse_dob: parseDate(r.spouse_dob),
    child_1: r.child_1, child_1_dob: parseDate(r.child_1_dob),
    child_2: r.child_2, child_2_dob: parseDate(r.child_2_dob),
    child_3: r.child_3, child_3_dob: parseDate(r.child_3_dob),
    child_4: r.child_4, child_4_dob: parseDate(r.child_4_dob),
    child_5: r.child_5, child_5_dob: parseDate(r.child_5_dob),
    converted_date_time: parseDatetime(r.converted_date_time),
    converted_account: r.converted_account, converted_contact: r.converted_contact,
    converted_deal: r.converted_deal,
    email_opt_out: parseBool(r.email_opt_out),
    created_by_name: r.created_by, modified_by_name: r.modified_by,
    zoho_created_time: parseDatetime(r.created_time), zoho_modified_time: parseDatetime(r.modified_time),
    data_source: r.data_source, locked: parseBool(r.locked),
  });

  return {
    org_id: orgId,
    module_id: moduleId,
    title: r.lead_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
    status: r.lead_status || 'New',
    email: r.email || null,
    phone: r.phone || null,
    data,
    created_at: parseDatetime(r.created_time) || new Date().toISOString(),
    updated_at: parseDatetime(r.modified_time) || new Date().toISOString(),
  };
}

// ============================================================================
// Batch insert with progress
// ============================================================================
async function batchInsert(table: string, records: any[], label: string, batchSize = 100) {
  let inserted = 0, errors = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { ok, error } = await supabasePost(table, batch);
    if (!ok) {
      console.error(`\n  Batch ${Math.floor(i / batchSize) + 1} error: ${error}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
    const pct = Math.round(((i + batch.length) / records.length) * 100);
    process.stdout.write(`\r  ${label}: ${pct}% (${inserted} inserted, ${errors} errors)`);
  }
  console.log('');
  return { inserted, errors };
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('Zoho CRM Direct Import');
  console.log('='.repeat(60));
  console.log(`Target: ${SUPABASE_URL}\n`);

  // 1. Get org_id and module_ids
  console.log('Fetching organization and module IDs...');
  const orgs = await supabaseGet('organizations', 'select=id&limit=1');
  if (!orgs.length) { console.error('No organization found!'); process.exit(1); }
  const orgId = orgs[0].id;
  console.log(`  org_id: ${orgId}`);

  const modules = await supabaseGet('crm_modules', `select=id,key&org_id=eq.${orgId}`);
  const contactsModule = modules.find((m: any) => m.key === 'contacts');
  const leadsModule = modules.find((m: any) => m.key === 'leads');
  if (!contactsModule) { console.error('Contacts module not found!'); process.exit(1); }
  if (!leadsModule) { console.error('Leads module not found!'); process.exit(1); }
  console.log(`  contacts module_id: ${contactsModule.id}`);
  console.log(`  leads module_id: ${leadsModule.id}`);

  // 2. Parse CSVs
  console.log('\nParsing CSV files...');
  const contactRows = csvToObjects('C:/Users/User/Desktop/Contacts_2026_02_10.csv', CONTACTS_MAP);
  console.log(`  Contacts: ${contactRows.length} rows`);
  const leadRows = csvToObjects('C:/Users/User/Desktop/Leads_2026_02_10_WS_Only/Leads_2026_02_10.csv', LEADS_MAP);
  console.log(`  Leads: ${leadRows.length} rows`);
  const noteRows = csvToObjects('C:/Users/User/Desktop/Notes_Contacts_2026_02_10_WS_Notes/Notes_Contacts_2026_02_10.csv', NOTES_MAP);
  console.log(`  Notes: ${noteRows.length} rows`);

  // 3. Transform and insert contacts
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTING CONTACTS...');
  const contactRecords = contactRows
    .filter(r => r.first_name || r.last_name)
    .map(r => contactToRecord(r, orgId, contactsModule.id));
  const cResult = await batchInsert('crm_records', contactRecords, 'Contacts');

  // 4. Transform and insert leads
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTING LEADS...');
  const leadRecords = leadRows
    .filter(r => r.first_name || r.last_name)
    .map(r => leadToRecord(r, orgId, leadsModule.id));
  const lResult = await batchInsert('crm_records', leadRecords, 'Leads');

  // 5. Import notes -- need to look up parent records by zoho_record_id
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTING NOTES...');
  console.log('  Building zoho_record_id → crm_records.id lookup...');

  // Fetch all records with their zoho_record_id from data column
  // We need to paginate since there could be thousands
  const zohoIdMap = new Map<string, string>(); // zoho_record_id → crm_records.id
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const records = await supabaseGet('crm_records',
      `select=id,data->zoho_record_id&org_id=eq.${orgId}&offset=${offset}&limit=${pageSize}`
    );
    if (records.length === 0) break;
    for (const rec of records) {
      const zohoId = rec.zoho_record_id;
      if (zohoId) zohoIdMap.set(zohoId, rec.id);
    }
    offset += records.length;
    if (records.length < pageSize) break;
  }
  console.log(`  Found ${zohoIdMap.size} records with zoho_record_id`);

  // Transform notes
  const noteRecords: any[] = [];
  let notesSkipped = 0;
  for (const n of noteRows) {
    if (!n.note_content || !n.parent_id) { notesSkipped++; continue; }
    const parentId = zohoIdMap.get(n.parent_id);
    if (!parentId) { notesSkipped++; continue; }
    noteRecords.push({
      org_id: orgId,
      record_id: parentId,
      body: n.note_content,
      is_pinned: false,
      created_at: parseDatetime(n.created_time) || new Date().toISOString(),
      updated_at: parseDatetime(n.modified_time) || new Date().toISOString(),
    });
  }
  console.log(`  ${noteRecords.length} notes matched to parents, ${notesSkipped} skipped (no parent)`);

  const nResult = await batchInsert('crm_notes', noteRecords, 'Notes');

  // 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Contacts: ${cResult.inserted} imported, ${cResult.errors} errors`);
  console.log(`Leads:    ${lResult.inserted} imported, ${lResult.errors} errors`);
  console.log(`Notes:    ${nResult.inserted} imported, ${nResult.errors} errors, ${notesSkipped} skipped`);
  console.log('\nAll records are now live in the CRM frontend.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
