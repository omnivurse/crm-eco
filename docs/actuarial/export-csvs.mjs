/**
 * @fileoverview Exports all 5 actuarial CSV datasets from Supabase.
 *
 * Uses the service role key to call the actuarial RPC directly.
 * Reads credentials from apps/admin/.env.local.
 *
 * Usage:
 *   node docs/actuarial/export-csvs.mjs [org_id] [months]
 *
 * If org_id is omitted, the script lists available organizations and exits.
 * months defaults to 24.
 *
 * Output: docs/actuarial/output/csv/
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output', 'csv');
mkdirSync(OUTPUT_DIR, { recursive: true });

function loadEnv() {
  const envPath = join(__dirname, '..', '..', 'apps', 'admin', '.env.local');
  const raw = readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

function toCsv(headers, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

function writeCsv(filename, headers, rows) {
  const path = join(OUTPUT_DIR, filename);
  writeFileSync(path, toCsv(headers, rows));
  console.log(`  ✓ ${filename} (${rows.length} rows)`);
  return path;
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/admin/.env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orgId = process.argv[2];
  const months = parseInt(process.argv[3] || '24', 10);

  if (!orgId) {
    console.log('No org_id provided. Listing organizations...\n');
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching organizations:', error.message);
      process.exit(1);
    }

    if (!orgs?.length) {
      console.log('No organizations found.');
      process.exit(0);
    }

    console.log('Available organizations:');
    console.log('─'.repeat(80));
    for (const org of orgs) {
      console.log(`  ${org.id}  │  ${org.name}`);
    }
    console.log('─'.repeat(80));
    console.log(`\nUsage: node docs/actuarial/export-csvs.mjs <org_id> [months]\n`);
    process.exit(0);
  }

  console.log(`\nExporting actuarial data for org: ${orgId}`);
  console.log(`Lookback period: ${months} months\n`);

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - (months - 1));
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  const startIso = startDate.toISOString();

  console.log('Fetching data from Supabase RPCs...\n');

  const [monthly, needsByType, contributions, ageBands, exposure] = await Promise.allSettled([
    supabase.rpc('_actuarial_monthly', { p_org_id: orgId, p_start: startIso }),
    supabase.rpc('_actuarial_needs_by_type', { p_org_id: orgId, p_start: startIso }),
    supabase.rpc('_actuarial_contributions', { p_org_id: orgId, p_start: startIso }),
    supabase.rpc('_actuarial_age_bands', { p_org_id: orgId, p_start: startIso }),
    supabase.rpc('_actuarial_exposure_dev', { p_org_id: orgId, p_start: startIso }),
  ]);

  const results = { monthly, needsByType, contributions, ageBands, exposure };
  let anyFailed = false;

  for (const [name, result] of Object.entries(results)) {
    if (result.status === 'rejected') {
      console.error(`  ✗ ${name}: ${result.reason}`);
      anyFailed = true;
    } else if (result.value.error) {
      console.error(`  ✗ ${name}: ${result.value.error.message}`);
      anyFailed = true;
    }
  }

  if (anyFailed) {
    console.error('\nSome datasets failed. The helper functions may not be callable directly via service role.');
    console.log('Attempting fallback: calling main RPC via SQL...\n');
    await fallbackExport(supabase, orgId, months);
    return;
  }

  console.log('Generating CSV files...\n');

  const d1 = Array.isArray(monthly.value.data) ? monthly.value.data : (monthly.value.data || []);
  const d2 = Array.isArray(needsByType.value.data) ? needsByType.value.data : (needsByType.value.data || []);
  const d3 = Array.isArray(contributions.value.data) ? contributions.value.data : (contributions.value.data || []);
  const d4 = Array.isArray(ageBands.value.data) ? ageBands.value.data : (ageBands.value.data || []);
  const d5 = Array.isArray(exposure.value.data) ? exposure.value.data : (exposure.value.data || []);

  exportAllDatasets(d1, d2, d3, d4, d5);
}

async function fallbackExport(supabase, orgId, months) {
  const sql = `SELECT public.get_actuarial_experience('${orgId}'::uuid, ${months});`;

  const { data, error } = await supabase.rpc('get_actuarial_experience', {
    p_org_id: orgId,
    p_months: months,
  });

  if (error) {
    console.error('Fallback also failed:', error.message);
    console.log('\nThe RPC requires an authenticated user session.');
    console.log('Alternative: use the admin dashboard (Analytics > Actuarial Data > Export All CSVs).');
    console.log('Or run the admin app locally and hit the API:\n');
    console.log(`  curl -H "Cookie: <session>" http://localhost:3000/api/analytics/actuarial-experience?months=${months}\n`);
    process.exit(1);
  }

  console.log('Fallback succeeded. Generating CSV files...\n');

  const d1 = data?.monthlyExperience || [];
  const d2 = data?.needsByType || [];
  const d3 = data?.contributionAdequacy || [];
  const d4 = data?.ageBandExperience || [];
  const d5 = data?.exposureDevelopment || [];

  exportAllDatasets(d1, d2, d3, d4, d5);

  if (data?.summary) {
    const summary = data.summary;
    const summaryRows = Object.entries(summary).map(([key, value]) => ({ metric: key, value }));
    writeCsv('Dataset_0_Portfolio_Summary.csv', ['metric', 'value'], summaryRows);
  }
}

function exportAllDatasets(d1, d2, d3, d4, d5) {
  if (d1.length) {
    writeCsv('Dataset_1_Monthly_Experience_Summary.csv', [
      'period', 'eligibleMembers', 'newMembers',
      'contributionsCollected', 'processingFees', 'netRevenue',
      'failedPayments', 'failedAmount',
      'needsSubmittedCount', 'needsSubmittedAmount',
      'needsApprovedCount', 'needsApprovedAmount', 'needsPaidAmount',
      'avgNeedSize', 'medianNeedSize', 'maxSingleNeed',
      'needsOver25k', 'needsOver50k',
      'needsPer100', 'lossRatio', 'avgMemberContribution',
      'iuaApplied', 'memberResponsibility',
    ], d1);
  } else {
    console.log('  ⚠ Dataset 1 (Monthly Experience): no data');
  }

  if (d2.length) {
    writeCsv('Dataset_2_Needs_By_Type.csv', [
      'needType', 'count', 'totalSubmitted', 'totalApproved',
      'totalPaid', 'avgAmount', 'pctOfTotal',
    ], d2);
  } else {
    console.log('  ⚠ Dataset 2 (Needs by Type): no data');
  }

  if (d3.length) {
    writeCsv('Dataset_3_Contribution_Adequacy.csv', [
      'period', 'activeBillingSchedules',
      'avgMonthlyContribution', 'medianMonthlyContribution',
      'totalExpected', 'totalCollected', 'totalFailed',
      'failedCount', 'processingFees', 'netRevenue', 'collectionRate',
    ], d3);
  } else {
    console.log('  ⚠ Dataset 3 (Contribution Adequacy): no data');
  }

  if (d4.length) {
    writeCsv('Dataset_4_Age_Band_Loss_Experience.csv', [
      'ageBand', 'eligibleMembers', 'needsCount',
      'totalSubmitted', 'totalPaid', 'avgNeedSize',
      'needsPer100', 'preExistingPct',
    ], d4);
  } else {
    console.log('  ⚠ Dataset 4 (Age-Band Loss): no data');
  }

  if (d5.length) {
    writeCsv('Dataset_5_Exposure_Development.csv', [
      'period', 'serviceMonth', 'memberMonths',
      'beginningMembers', 'endingMembers',
      'newEnrollments', 'terminations',
      'incurredAmount', 'paidAmount', 'pendingAmount',
      'pmpm', 'reportLagDays', 'paymentLagDays',
    ], d5);
  } else {
    console.log('  ⚠ Dataset 5 (Exposure & Development): no data');
  }

  console.log(`\nAll CSVs saved to: docs/actuarial/output/csv/`);
  console.log('Zip these for submission: zip -j actuarial_data_csvs.zip docs/actuarial/output/csv/*.csv');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
