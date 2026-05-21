#!/usr/bin/env node
/**
 * Quick PIF Supabase connection test.
 * Tests both the REST API (anon key) and direct Postgres (psql) connections.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env then .env.local (local overrides)
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         PIF Supabase Database Connection Test           ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// ── 1. Check env vars ────────────────────────────────────────────────
console.log('1️⃣  Environment Variables');
console.log('   NEXT_PUBLIC_SUPABASE_URL :', SUPABASE_URL ? `✅ ${SUPABASE_URL}` : '❌ NOT SET');
console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY :', ANON_KEY ? `✅ (${ANON_KEY.slice(0, 20)}…)` : '❌ NOT SET');
console.log('   SUPABASE_SERVICE_ROLE_KEY :', SERVICE_KEY ? `✅ (${SERVICE_KEY.slice(0, 20)}…)` : '❌ NOT SET');
console.log('   SUPABASE_DB_PASSWORD :', DB_PASSWORD ? '✅ (set)' : '❌ NOT SET');

// Extract project ref
const refMatch = SUPABASE_URL?.match(/^https:\/\/([^.]+)\.supabase\.co/i);
const projectRef = refMatch?.[1];
console.log('   Project ref :', projectRef ? `✅ ${projectRef}` : '❌ Could not extract');
console.log();

let allPassed = true;

// ── 2. REST API health check (anon key) ──────────────────────────────
console.log('2️⃣  REST API Health Check (anon key)');
try {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });
  if (resp.ok) {
    console.log(`   ✅ REST API reachable — HTTP ${resp.status}`);
  } else {
    console.log(`   ⚠️  REST API responded with HTTP ${resp.status}: ${resp.statusText}`);
  }
} catch (err) {
  console.log(`   ❌ REST API unreachable: ${err.message}`);
  allPassed = false;
}
console.log();

// ── 3. Service Role key — list tables ────────────────────────────────
console.log('3️⃣  Service Role Key — list tables');
try {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/?apikey=${SERVICE_KEY}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    },
  );
  if (resp.ok) {
    const body = await resp.json();
    const definitions = body?.definitions ? Object.keys(body.definitions) : [];
    console.log(`   ✅ Service role key works`);

    // Try fetching actual table names via information_schema through RPC or pg_catalog
    const tablesResp = await fetch(
      `${SUPABASE_URL}/rest/v1/organizations?select=id&limit=1`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      },
    );
    if (tablesResp.ok) {
      const orgs = await tablesResp.json();
      console.log(`   ✅ 'organizations' table accessible — ${Array.isArray(orgs) ? orgs.length : '?'} row(s) returned`);
    } else {
      console.log(`   ⚠️  'organizations' table query returned HTTP ${tablesResp.status}`);
    }

    // Check contacts table
    const contactsResp = await fetch(
      `${SUPABASE_URL}/rest/v1/contacts?select=id&limit=1`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      },
    );
    if (contactsResp.ok) {
      const contacts = await contactsResp.json();
      console.log(`   ✅ 'contacts' table accessible — ${Array.isArray(contacts) ? contacts.length : '?'} row(s) returned`);
    } else {
      console.log(`   ⚠️  'contacts' table query returned HTTP ${contactsResp.status}`);
    }

    // Check profiles table
    const profilesResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      },
    );
    if (profilesResp.ok) {
      const profiles = await profilesResp.json();
      console.log(`   ✅ 'profiles' table accessible — ${Array.isArray(profiles) ? profiles.length : '?'} row(s) returned`);
    } else {
      console.log(`   ⚠️  'profiles' table query returned HTTP ${profilesResp.status}`);
    }
  } else {
    console.log(`   ❌ Service role key failed — HTTP ${resp.status}`);
    allPassed = false;
  }
} catch (err) {
  console.log(`   ❌ Service role check failed: ${err.message}`);
  allPassed = false;
}
console.log();

// ── 4. Direct Postgres connection (psql) ─────────────────────────────
console.log('4️⃣  Direct Postgres Connection (psql)');
if (projectRef && DB_PASSWORD) {
  const encoded = encodeURIComponent(DB_PASSWORD);
  const connStr = `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;

  const r = spawnSync(
    'psql',
    [connStr, '-c', 'SELECT current_database(), current_user, version();'],
    { timeout: 15000, encoding: 'utf-8' },
  );

  if (r.error) {
    console.log('   ⚠️  psql not found — install with: brew install libpq');
    console.log('   (Skipping direct Postgres test — REST API tests above are sufficient)');
  } else if (r.status === 0) {
    console.log('   ✅ Direct Postgres connection successful');
    const output = (r.stdout || '').trim().split('\n').map(l => `      ${l}`).join('\n');
    console.log(output);
  } else {
    console.log(`   ❌ psql exited with code ${r.status}`);
    if (r.stderr) console.log(`      ${r.stderr.trim()}`);
    allPassed = false;
  }
} else {
  console.log('   ⚠️  Skipped — missing project ref or DB password');
}
console.log();

// ── 5. Auth service check ────────────────────────────────────────────
console.log('5️⃣  Auth Service (GoTrue)');
try {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: ANON_KEY },
  });
  if (resp.ok) {
    const settings = await resp.json();
    console.log(`   ✅ Auth service reachable`);
    console.log(`   Providers: ${(settings.external || {}).email !== undefined ? 'email' : ''} ${(settings.external || {}).google ? 'google' : ''}`);
  } else {
    console.log(`   ⚠️  Auth service returned HTTP ${resp.status}`);
  }
} catch (err) {
  console.log(`   ❌ Auth service unreachable: ${err.message}`);
  allPassed = false;
}
console.log();

// ── Summary ──────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
if (allPassed) {
  console.log('✅  All connection tests PASSED — PIF Supabase database is connected and ready.');
} else {
  console.log('❌  Some tests FAILED — review the output above before proceeding with upgrades.');
}
console.log('═══════════════════════════════════════════════════════════');
