#!/usr/bin/env node
/**
 * Backfill insurance / health-sharing fields on contacts converted from leads.
 *
 * Usage:
 *   node scripts/backfill-converted-contact-insurance.mjs
 *   node scripts/backfill-converted-contact-insurance.mjs --contact-id=<uuid>
 *   node scripts/backfill-converted-contact-insurance.mjs --limit=100
 *   node scripts/backfill-converted-contact-insurance.mjs --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) continue;
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {
      /* optional */
    }
  }
}

function parseArgs(argv) {
  const args = { dryRun: false, limit: null, contactId: null, name: null };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length));
    else if (arg.startsWith('--contact-id=')) args.contactId = arg.slice('--contact-id='.length);
    else if (arg.startsWith('--name=')) args.name = arg.slice('--name='.length);
  }
  return args;
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findContactByName(name) {
  const { data: modules } = await supabase
    .from('crm_modules')
    .select('id')
    .eq('key', 'contacts')
    .limit(1);

  const moduleId = modules?.[0]?.id;
  if (!moduleId) throw new Error('Contacts module not found');

  const { data, error } = await supabase
    .from('crm_records')
    .select('id, title, data')
    .eq('module_id', moduleId)
    .ilike('title', `%${name}%`)
    .limit(5);

  if (error) throw error;
  return data ?? [];
}

async function main() {
  console.log('Backfill converted contact insurance data\n');

  if (args.name) {
    const matches = await findContactByName(args.name);
    if (matches.length === 0) {
      console.error(`No contact found matching name: ${args.name}`);
      process.exit(1);
    }
    console.log('Matches:');
    for (const row of matches) {
      console.log(`  ${row.id}  ${row.title}`);
    }
    if (!args.contactId && matches.length === 1) {
      args.contactId = matches[0].id;
    }
  }

  if (args.contactId) {
    if (args.dryRun) {
      console.log(`Dry run — would repair contact ${args.contactId}`);
      return;
    }
    const { data, error } = await supabase.rpc('repair_converted_contact_insurance_data', {
      p_contact_id: args.contactId,
    });
    if (error) {
      console.error('Repair failed:', error.message);
      process.exit(1);
    }
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (args.dryRun) {
    const { count, error } = await supabase
      .from('crm_records')
      .select('id', { count: 'exact', head: true })
      .not('data->converted_from_lead_id', 'is', null);
    if (error) {
      console.error('Count failed:', error.message);
      process.exit(1);
    }
    console.log(`Dry run — would backfill up to ${args.limit ?? 'all'} of ~${count ?? '?'} converted contacts`);
    return;
  }

  const { data, error } = await supabase.rpc('backfill_all_converted_contact_insurance_data', {
    p_limit: args.limit,
  });

  if (error) {
    console.error('Backfill failed:', error.message);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
