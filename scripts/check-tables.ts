import { readFileSync } from 'fs';
import { resolve } from 'path';

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

const envFile = loadEnv(resolve(__dirname, '..', '.env.local'));
const URL = envFile['NEXT_PUBLIC_SUPABASE_URL'];
const KEY = envFile['SUPABASE_SERVICE_ROLE_KEY'];

async function main() {
  // Try inserting a module directly
  const testInsert = await fetch(`${URL}/rest/v1/crm_modules`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      org_id: '00000000-0000-0000-0000-000000000001',
      key: 'contacts',
      name: 'Contact',
      name_plural: 'Contacts',
      icon: 'user',
      description: 'Manage all your contacts and customers',
      is_system: true,
      is_enabled: true,
      display_order: 1,
    }),
  });
  const insertBody = await testInsert.text();
  console.log(`Insert contacts module: ${testInsert.status}`, insertBody.slice(0, 500));

  // Insert leads module
  const leadsInsert = await fetch(`${URL}/rest/v1/crm_modules`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      org_id: '00000000-0000-0000-0000-000000000001',
      key: 'leads',
      name: 'Lead',
      name_plural: 'Leads',
      icon: 'user-plus',
      description: 'Track and nurture potential customers',
      is_system: true,
      is_enabled: true,
      display_order: 2,
    }),
  });
  const leadsBody = await leadsInsert.text();
  console.log(`Insert leads module: ${leadsInsert.status}`, leadsBody.slice(0, 500));

  // Verify
  const r = await fetch(`${URL}/rest/v1/crm_modules?select=id,key,name`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  console.log('\nModules now:', JSON.stringify(await r.json(), null, 2));
}

main();
