/**
 * Import E123 enrollment data into members, enrollments, and enrollment_dependents tables.
 * Links members to existing CRM records by email/name and syncs e123_member_id.
 *
 * Usage: npx tsx scripts/import-e123-members.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Env ──
function loadEnv(fp: string): Record<string, string> {
  const e: Record<string, string> = {};
  try {
    for (const l of readFileSync(fp, 'utf-8').split('\n')) {
      const t = l.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      e[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* missing */ }
  return e;
}

const root = resolve(__dirname, '..');
const env = { ...loadEnv(resolve(root, '.env.local')), ...loadEnv(resolve(root, '.env')) };
const SUPABASE_URL = env['SUPABASE_URL'] || env['NEXT_PUBLIC_SUPABASE_URL'];
const KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
if (!SUPABASE_URL || !KEY) { console.error('Missing env'); process.exit(1); }

const ORG_ID = 'ac6e7228-2ea0-4582-8464-562c3e8ac56e';
const hdrs = {
  'apikey': KEY!,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

// ── CSV Parser (handles quoted fields) ──
function parseCSV(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuote = !inQuote; cur += ch; }
    else if (ch === '\n' && !inQuote) { lines.push(cur); cur = ''; }
    else if (ch === '\r' && !inQuote) { /* skip */ }
    else { cur += ch; }
  }
  if (cur.trim()) lines.push(cur);

  const headerLine = lines[0];
  const headers = splitCSVLine(headerLine);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (vals[j] || '').trim();
    }
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

// ── Helpers ──
function parseDate(s: string): string | null {
  if (!s) return null;
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts;
  const year = y.length === 2 ? (parseInt(y) > 50 ? `19${y}` : `20${y}`) : y;
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseNum(s: string): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseBool(s: string): boolean | null {
  if (!s) return null;
  return s.toLowerCase() === 'yes' || s.toLowerCase() === 'true';
}

function parseInt2(s: string): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

const MEMBER_STATUS_MAP: Record<string, string> = {
  'assigned': 'active',
  'converted': 'active',
  'active': 'active',
  'inactive': 'inactive',
  'terminated': 'terminated',
  'pending': 'pending',
  'prospect': 'prospect',
  'paused': 'paused',
};
function normMemberStatus(s: string): string {
  return MEMBER_STATUS_MAP[(s || '').toLowerCase().trim()] || 'active';
}

async function sbPost(table: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...hdrs, 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) {
    if (res.status === 409) return null; // duplicate
    console.error(`  POST ${table} ${res.status}: ${txt.slice(0, 200)}`);
    return null;
  }
  try {
    const data = JSON.parse(txt);
    return Array.isArray(data) ? data[0] : data;
  } catch { return null; }
}

async function sbGet(table: string, query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: hdrs });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function sbPatch(table: string, query: string, body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { ...hdrs, 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// ── Group E123 rows by Member ID + System ID ──
interface E123Row { [key: string]: string }

interface MemberGroup {
  memberID: string;
  primary: E123Row; // first PRIMARY row for demographics
  enrollments: { systemID: string; primary: E123Row; dependents: E123Row[] }[];
}

function groupRows(rows: E123Row[]): MemberGroup[] {
  const memberMap = new Map<string, MemberGroup>();

  for (const row of rows) {
    const memberID = row['Member ID'] || '';
    const systemID = row['System ID'] || '';
    const recordType = row['Record Type'] || '';

    if (!memberID) continue;

    if (!memberMap.has(memberID)) {
      memberMap.set(memberID, {
        memberID,
        primary: recordType === 'PRIMARY' ? row : row,
        enrollments: [],
      });
    }

    const group = memberMap.get(memberID)!;

    if (recordType === 'PRIMARY') {
      group.primary = row;
      // Find or create enrollment entry for this system ID
      let enr = group.enrollments.find(e => e.systemID === systemID);
      if (!enr) {
        enr = { systemID, primary: row, dependents: [] };
        group.enrollments.push(enr);
      } else {
        enr.primary = row;
      }
    } else if (recordType === 'DEPENDENT') {
      let enr = group.enrollments.find(e => e.systemID === systemID);
      if (!enr) {
        enr = { systemID, primary: row, dependents: [] };
        group.enrollments.push(enr);
      }
      enr.dependents.push(row);
    }
  }

  return Array.from(memberMap.values());
}

// ── Create/find advisors from E123 Agent IDs ──
async function ensureAdvisors(rows: E123Row[]): Promise<Map<string, string>> {
  const agentMap = new Map<string, string>(); // E123 Agent ID → advisor UUID
  const agents = new Map<string, string>(); // E123 Agent ID → Agent Label

  for (const r of rows) {
    const aid = r['Agent ID']?.trim();
    const label = r['Agent Label']?.trim();
    if (aid && r['Record Type']?.trim() === 'PRIMARY' && !agents.has(aid)) {
      agents.set(aid, label || '');
    }
  }

  console.log(`[0] Ensuring ${agents.size} advisors exist...`);

  for (const [agentId, label] of agents) {
    // Check if advisor already exists by admin123_agent_id
    const existing = await sbGet('advisors',
      `admin123_agent_id=eq.${agentId}&organization_id=eq.${ORG_ID}&select=id&limit=1`
    );
    if (existing.length > 0) {
      agentMap.set(agentId, existing[0].id as string);
      continue;
    }

    // Parse name from label (format: "First Last - Agency" or "First Last")
    const namePart = label.split('-')[0].trim().split(/\s+/);
    const firstName = namePart[0] || 'Agent';
    const lastName = namePart.slice(1).join(' ') || agentId;
    const agencyName = label.includes('-') ? label.split('-').slice(1).join('-').trim() : null;

    const advisor = await sbPost('advisors', {
      organization_id: ORG_ID,
      first_name: firstName,
      last_name: lastName,
      email: `agent-${agentId}@e123-import.local`,
      advisor_code: agentId,
      admin123_agent_id: agentId,
      agency_name: agencyName,
      status: 'active',
    });

    if (advisor) {
      agentMap.set(agentId, advisor.id as string);
      console.log(`  + Created advisor: ${firstName} ${lastName} (${agentId}) → ${agencyName || 'n/a'}`);
    } else {
      console.log(`  ! Failed to create advisor for Agent ID ${agentId}`);
    }
  }

  console.log(`  ${agentMap.size} advisors ready\n`);
  return agentMap;
}

// ── Main ──
async function main() {
  const csvPath = resolve(root, 'docs', 'E123_Members_Full_032026.csv');
  console.log(`Reading ${csvPath}...`);
  const raw = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(raw);
  console.log(`  ${rows.length} CSV rows`);

  const groups = groupRows(rows);
  console.log(`  ${groups.length} unique members`);
  console.log(`  ${groups.reduce((s, g) => s + g.enrollments.length, 0)} enrollment records`);
  console.log('');

  // Create advisors first
  const advisorMap = await ensureAdvisors(rows);

  let membersCreated = 0, membersSkipped = 0;
  let enrollmentsCreated = 0, enrollmentsSkipped = 0;
  let depsCreated = 0, depsSkipped = 0;
  let crmLinked = 0;
  let errors = 0;

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const r = g.primary;

    // ── 1. Create/find member ──
    const email = (r['Email'] || '').toLowerCase();
    const memberNumber = g.memberID;

    // Resolve advisor
    const e123AgentId = r['Agent ID']?.trim();
    const advisorId = e123AgentId ? advisorMap.get(e123AgentId) || null : null;

    // Check if member already exists
    let existing = await sbGet('members', `member_number=eq.${memberNumber}&organization_id=eq.${ORG_ID}&select=id&limit=1`);
    let memberId: string;

    if (existing.length > 0) {
      memberId = existing[0].id as string;
      membersSkipped++;
    } else {
      const memberBody: Record<string, unknown> = {
        organization_id: ORG_ID,
        advisor_id: advisorId,
        member_number: memberNumber,
        first_name: r['First Name'] || null,
        last_name: r['Last Name'] || null,
        email: email || `${memberNumber}@e123-import.local`,
        email2: r['Email2'] || null,
        email3: r['Email 3'] || null,
        phone: r['Phone 1'] || null,
        phone_ext: r['Phone 1 Ext'] || null,
        phone2: r['Phone 2'] || null,
        phone2_ext: r['Phone 2 Ext'] || null,
        phone3: r['Phone 3'] || null,
        phone3_ext: r['Phone 3 Ext'] || null,
        fax: r['Fax'] || null,
        fax_ext: r['Fax Ext'] || null,
        date_of_birth: parseDate(r['DOB']) || null,
        gender: r['Gender'] || null,
        ssn_last4: (r['SSN'] || '').slice(-4) || null,
        is_smoker: parseBool(r['Tobacco Use']),
        drivers_license: r['Drivers License'] || null,
        company_name: r['Company Name'] || null,
        position: r['Position'] || null,
        department: r['Department'] || null,
        division: r['Division'] || null,
        address_line1: r['Address'] || null,
        address_line2: r['Address2'] || null,
        city: r['City'] || null,
        state: r['State'] || null,
        postal_code: r['Zipcode'] || null,
        country: r['Country'] || null,
        county: r['County'] || null,
        external_username: r['Username'] || null,
        internal_id: r['Internal ID'] || null,
        referral: r['Referral'] || null,
        source: r['Source'] || null,
        receive_emails: r['Email Opt Out'] === 'No' ? true : r['Email Opt Out'] === 'Yes' ? false : null,
        member_type: r['Type'] || null,
        member_type2: r['Type 2'] || null,
        do_not_call: parseBool(r['Do Not Call']),
        ethnicity: r['Ethnicity'] || null,
        height: r['Height'] || null,
        weight: r['Weight'] || null,
        disability: r['Disability'] || null,
        status: normMemberStatus(r['Status']),
        stage: r['Stage'] || null,
        number_of_calls: parseInt2(r['## Calls']),
        call_status: r['Call Status'] || null,
        best_call_time: r['Best Call Time'] || null,
        next_step: r['Next Step'] || null,
        next_step_date: parseDate(r['Next Step Date']) || null,
        source_only: r['Source Only'] || null,
        probability: parseInt2(r['Probability']),
        household_role: 'primary',
      };

      const created = await sbPost('members', memberBody);
      if (created) {
        memberId = created.id as string;
        membersCreated++;
      } else {
        errors++;
        continue;
      }
    }

    // ── 2. Link to CRM record ──
    if (email) {
      const crmMatch = await sbGet('crm_records',
        `email=ilike.${encodeURIComponent(email)}&org_id=eq.${ORG_ID}&select=id,data&limit=1`
      );
      if (crmMatch.length > 0) {
        const crmId = crmMatch[0].id as string;
        const existingData = (crmMatch[0].data || {}) as Record<string, unknown>;
        if (!existingData.e123_member_id || existingData.e123_member_id !== memberNumber) {
          await sbPatch('crm_records', `id=eq.${crmId}`, {
            data: { ...existingData, e123_member_id: memberNumber },
          });
          crmLinked++;
        }
      }
    }

    // ── 3. Create enrollments ──
    for (const enr of g.enrollments) {
      const p = enr.primary;
      const systemID = enr.systemID;

      // Check if enrollment already exists (by system_id)
      let enrollmentId: string | null = null;
      if (systemID) {
        const existingEnr = await sbGet('enrollments',
          `system_id=eq.${systemID}&organization_id=eq.${ORG_ID}&select=id&limit=1`
        );
        if (existingEnr.length > 0) {
          enrollmentsSkipped++;
          enrollmentId = existingEnr[0].id as string;
        }
      }

      // Resolve product-level agent (may differ from member-level agent)
      const prodAgentId = p['Product Agent ID']?.trim();
      const enrollAdvisorId = prodAgentId ? advisorMap.get(prodAgentId) || advisorId : advisorId;

      const enrollmentBody: Record<string, unknown> = {
        organization_id: ORG_ID,
        primary_member_id: memberId,
        advisor_id: enrollAdvisorId,
        system_id: systemID || null,
        enrollment_source: 'e123',
        channel: 'import',
        status: 'active',
        enrollment_number: memberNumber,
        external_vendor_enrollment_id: memberNumber,
        product_created_date: parseDate(p['Product Created Date']) || null,
        effective_date: parseDate(p['Active Date']) || null,
        start_date: parseDate(p['Active Date']) || null,
        first_billing_date: parseDate(p['First Billing Date']) || null,
        next_billing_date: parseDate(p['Next Billing Date']) || null,
        fulfillment_date: parseDate(p['Fulfillment Date']) || null,
        termination_date: parseDate(p['Inactive Date']) || null,
        status_reason: p['Inactive Reason'] || null,
        hold_date: parseDate(p['Hold Date']) || null,
        hold_reason: p['Hold Reason'] || null,
        hold_return_date: parseDate(p['Hold Return']) || null,
        hold_amount: parseNum(p['Hold Amount']),
        product_label: p['Product Label'] || null,
        product_benefit: p['Product Benefit'] || null,
        period_label: p['Period Label'] || null,
        category3: p['Category 3'] || null,
        category4: p['Category 4'] || null,
        code: p['Code'] || null,
        permanent_bill_day: parseInt2(p['Permanent Bill Day']),
        product_source: p['Product Source'] || null,
        product_source_detail: p['Product Source Detail'] || null,
        product_status: p['Product Status'] || null,
        product_stage: p['Product Stage'] || null,
        product_number_of_calls: parseInt2(p['Product Number of Calls']),
        product_call_status: p['Product Call Status'] || null,
        product_next_step: p['Product Next Step'] || null,
        product_next_step_date: parseDate(p['Product Next Step Date']) || null,
        product_estimated_close_date: parseDate(p['Product Estimated Close Date']) || null,
        administration_fee: parseNum(p['Administration Fee']),
        annual_fee: parseNum(p['AnnualMembership Fee']),
        association_fee: parseNum(p['Association Fee']),
        setup_fee: parseNum(p['Enrollment Fee']),
        iua_fee: parseNum(p['IUA Fee']),
        product_fee: parseNum(p['Product Fee']),
        monthly_contribution_fee: parseNum(p['SederaMonthlyContribution Fee']),
        tobacco_surcharge: parseNum(p['TobaccoUse Fee']),
        primary_is_smoker: parseBool(p['Tobacco Use']),
        contract_number: p['Contract Number'] || null,
        contract_length: parseInt2(p['Contract Length']),
        enroller_id: p['Enroller ID'] || null,
        enroller_name: p['Enroller Name'] || null,
        pay_type: p['Paytype'] || null,
        refund_requested: parseBool(p['Refund Requested']),
        refund_requested_date: parseDate(p['Refund Requested Date']) || null,
        refund_provided: parseBool(p['Refund Provided']),
        refund_provided_date: parseDate(p['Refund Provided Date']) || null,
        refund_comment: p['Refund Comment'] || null,
        product_agent_id: p['Product Agent ID'] || null,
        product_agent_label: p['Product  Agent Label'] || null,
        is_paid: parseBool(p['Paid']),
        quantity: parseInt2(p['Quantity']),
        renewal_date: parseDate(p['Renewal Date']) || null,
        sale_date: parseDate(p['Sale Date']) || null,
        next_billing_amount: parseNum(p['Next Billing Amount']),
        assigned_agents: p['Assigned Agents'] || null,
        last_payment_date: parseDate(p['Last Payment']) || null,
        source_detail: p['Source Detail'] || null,
        tpv_code: p['TPV Code'] || null,
        tpv_date: parseDate(p['TPV Date']) || null,
        product_code: p['Product Code'] || null,
        agent_code: p['Agent Code'] || null,
        note_date: parseDate(p['Note Date']) || null,
        underwriter: p['Underwriter'] || null,
        category: p['Category'] || null,
        product_paid_through_date: parseDate(p['Product Paid Through Date']) || null,
        // Compute total monthly from fee components
        base_monthly_cost: parseNum(p['Product Fee']),
        total_monthly_cost: (parseNum(p['Product Fee']) || 0)
          + (parseNum(p['Administration Fee']) || 0)
          + (parseNum(p['Association Fee']) || 0)
          + (parseNum(p['TobaccoUse Fee']) || 0),
      };

      if (!enrollmentId) {
        const createdEnr = await sbPost('enrollments', enrollmentBody);
        if (createdEnr) {
          enrollmentsCreated++;
          enrollmentId = createdEnr.id as string;
        }
      }

      if (enrollmentId) {
        // ── 4. Create dependents in `dependents` table, then link via `enrollment_dependents` ──
        for (const dep of enr.dependents) {
          const depE123Id = dep['Dependent ID']?.trim();
          const depDob = parseDate(dep['DOB']) || '1900-01-01';

          // Find or create dependent record
          let depId: string | null = null;
          if (depE123Id) {
            const existing = await sbGet('dependents',
              `external_dependent_id=eq.${depE123Id}&organization_id=eq.${ORG_ID}&select=id&limit=1`
            );
            if (existing.length > 0) depId = existing[0].id as string;
          }

          if (!depId) {
            const created = await sbPost('dependents', {
              organization_id: ORG_ID,
              member_id: memberId,
              first_name: dep['First Name']?.trim() || 'Unknown',
              last_name: dep['Last Name']?.trim() || 'Unknown',
              date_of_birth: depDob,
              gender: dep['Gender']?.trim() || null,
              relationship: dep['Relationship']?.trim() || 'Other',
              is_smoker: parseBool(dep['Tobacco Use']),
              ssn_last4: (dep['SSN'] || '').slice(-4) || null,
              email: dep['Email']?.trim() || null,
              phone: dep['Phone 1']?.trim() || null,
              address_line1: dep['Address']?.trim() || null,
              city: dep['City']?.trim() || null,
              state: dep['State']?.trim() || null,
              zip_code: dep['Zipcode']?.trim() || null,
              country: dep['Country']?.trim() || null,
              status: 'active',
              is_student: parseBool(dep['Student']),
              external_dependent_id: depE123Id || null,
            });
            if (created) depId = created.id as string;
          }

          if (!depId) { depsSkipped++; continue; }

          const createdLink = await sbPost('enrollment_dependents', {
            enrollment_id: enrollmentId,
            dependent_id: depId,
            relationship: dep['Relationship']?.trim() || 'Other',
            is_primary: false,
            is_smoker: parseBool(dep['Tobacco Use']),
            coverage_start_date: parseDate(dep['Active Date']) || null,
            coverage_end_date: parseDate(dep['Inactive Date']) || null,
            status: 'active',
            dependent_product_fee: parseNum(dep['Dependent Product Fee']),
          });
          if (createdLink) { depsCreated++; }
          else { depsSkipped++; }
        }
      } else {
        errors++;
      }
    }

    if ((i + 1) % 50 === 0 || i === groups.length - 1) {
      process.stdout.write(`\r  Progress: ${i + 1}/${groups.length} members`);
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('E123 IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Members:     ${membersCreated} created, ${membersSkipped} existing`);
  console.log(`Enrollments: ${enrollmentsCreated} created, ${enrollmentsSkipped} existing`);
  console.log(`Dependents:  ${depsCreated} created, ${depsSkipped} skipped`);
  console.log(`CRM linked:  ${crmLinked} records got e123_member_id`);
  console.log(`Errors:      ${errors}`);

  // Verify
  const mRes = await fetch(`${SUPABASE_URL}/rest/v1/members?select=id&limit=0`, {
    headers: { ...hdrs, 'Prefer': 'count=exact' },
  });
  const eRes = await fetch(`${SUPABASE_URL}/rest/v1/enrollments?select=id&limit=0`, {
    headers: { ...hdrs, 'Prefer': 'count=exact' },
  });
  const dRes = await fetch(`${SUPABASE_URL}/rest/v1/enrollment_dependents?select=id&limit=0`, {
    headers: { ...hdrs, 'Prefer': 'count=exact' },
  });
  console.log(`\nDB totals: ${mRes.headers.get('content-range')?.split('/')[1]} members, ${eRes.headers.get('content-range')?.split('/')[1]} enrollments, ${dRes.headers.get('content-range')?.split('/')[1]} dependents`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
