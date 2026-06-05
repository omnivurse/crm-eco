#!/usr/bin/env node
/**
 * Seed Own Your Labs + Health Cost Labs into `service_providers` for one or more orgs.
 *
 * Idempotent: skips rows that already exist for the same organization_id + external_url.
 *
 * Usage (from repo root):
 *   node apps/portal/scripts/seed-lab-providers.mjs
 *   PORTAL_SEED_ORG_ID=<uuid> node apps/portal/scripts/seed-lab-providers.mjs
 *   node apps/portal/scripts/seed-lab-providers.mjs --org=<uuid> --all-orgs
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env / .env.local
 */

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

loadEnv({ path: path.join(repoRoot, '.env') });
loadEnv({ path: path.join(repoRoot, '.env.local'), override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OYL_URL = 'https://ownyourlabs.com/';
const HCL_URL = 'https://www.healthcostlabs.com/';

const SEED_ROWS = [
  {
    category: 'labs',
    name: 'Own Your Labs',
    description:
      'Affordable direct-to-consumer blood tests. Order online, draw at your local Labcorp®, view results securely.',
    external_url: OYL_URL,
    sso_kind: 'none',
    sort_order: 10,
    is_active: true,
    plan_filters: {},
    sso_config: {},
  },
  {
    category: 'labs',
    name: 'Health Cost Labs',
    description:
      'Discount lab testing to help members find affordable blood work and diagnostic panels.',
    external_url: HCL_URL,
    sso_kind: 'none',
    sort_order: 20,
    is_active: true,
    plan_filters: {},
    sso_config: {},
  },
];

function parseArgs(argv) {
  let orgId = process.env.PORTAL_SEED_ORG_ID ?? null;
  let allOrgs = false;

  for (const arg of argv) {
    if (arg.startsWith('--org=')) orgId = arg.slice('--org='.length);
    if (arg === '--all-orgs') allOrgs = true;
  }

  return { orgId, allOrgs };
}

async function listOrgIds(supabase) {
  const { data, error } = await supabase.from('organizations').select('id, name').order('name');
  if (error) throw new Error(`organizations query failed: ${error.message}`);
  return data ?? [];
}

async function seedOrg(supabase, organizationId, orgLabel) {
  let inserted = 0;
  let skipped = 0;

  for (const row of SEED_ROWS) {
    const { data: existing } = await supabase
      .from('service_providers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('external_url', row.external_url)
      .maybeSingle();

    if (existing?.id) {
      skipped++;
      console.log(`  skip  ${row.name} (already seeded)`);
      continue;
    }

    const { error } = await supabase.from('service_providers').insert({
      ...row,
      organization_id: organizationId,
    });

    if (error) {
      throw new Error(`${orgLabel}: failed to insert ${row.name}: ${error.message}`);
    }

    inserted++;
    console.log(`  add   ${row.name}`);
  }

  return { inserted, skipped };
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const { orgId, allOrgs } = parseArgs(process.argv.slice(2));
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let targets = [];

  if (allOrgs) {
    targets = await listOrgIds(supabase);
    if (targets.length === 0) {
      console.error('No organizations found');
      process.exit(1);
    }
  } else if (orgId) {
    targets = [{ id: orgId, name: orgId }];
  } else {
    console.error(
      'Specify an org: PORTAL_SEED_ORG_ID=<uuid>, --org=<uuid>, or --all-orgs\n' +
        'Example: PORTAL_SEED_ORG_ID=a0000000-0000-0000-0000-000000000001 node apps/portal/scripts/seed-lab-providers.mjs',
    );
    process.exit(1);
  }

  console.log(`\nSeeding lab partners for ${targets.length} organization(s)…\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const org of targets) {
    console.log(`Org: ${org.name ?? org.id}`);
    const { inserted, skipped } = await seedOrg(supabase, org.id, org.name ?? org.id);
    totalInserted += inserted;
    totalSkipped += skipped;
    console.log('');
  }

  console.log(`Done. inserted=${totalInserted} skipped=${totalSkipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
