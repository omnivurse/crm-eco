/**
 * One-shot PIFH Test Employer shop add-on for Ada Pilot.
 * Uses a placeholder charger — no Authorize.Net, no real money.
 * Does not write payment_profiles (those wait for tomorrow's gateway).
 *
 *   PILOT_SHOP_APPLY=true npx tsx scripts/pilot-shop-addon.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { checkoutShopItems } from '@crm-eco/lib';

const ORG = '00000000-0000-0000-0000-000000000001';
const ADA = 'aaaaaaaa-0000-4000-8000-00000000e201';
const ADDON = 'aaaaaaaa-0000-4000-8000-00000000e102';

function loadEnvFile(file: string) {
  const text = readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));
process.env.PAYMENT_PROVIDER = 'placeholder';

if (process.env.PILOT_SHOP_APPLY !== 'true') {
  console.error('Refusing: set PILOT_SHOP_APPLY=true after owner approval.');
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

async function main() {
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const existing = await supabase
    .from('memberships')
    .select('id, status')
    .eq('organization_id', ORG)
    .eq('member_id', ADA)
    .eq('plan_id', ADDON)
    .in('status', ['active', 'pending'])
    .maybeSingle();

  if (existing.data?.id) {
    console.log(JSON.stringify({ skipped: true, membershipId: existing.data.id }));
    return;
  }

  const result = await checkoutShopItems(supabase, {
    organizationId: ORG,
    memberId: ADA,
    source: 'staff_addon',
    items: [{ item_type: 'plan', plan_id: ADDON, quantity: 1 }],
    charger: async (input) => ({
      success: true,
      transactionId: `PLACEHOLDER-TXN-${input.idempotencyKey}`,
    }),
  });

  console.log(JSON.stringify({ ok: true, placeholderCharge: true, result }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
