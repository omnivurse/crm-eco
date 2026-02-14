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
  const r1 = await fetch(`${URL}/rest/v1/organizations?select=id,name&limit=5`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  console.log('Organizations:', JSON.stringify(await r1.json(), null, 2));

  const r2 = await fetch(`${URL}/rest/v1/crm_modules?select=id,key,name`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  console.log('CRM Modules:', JSON.stringify(await r2.json(), null, 2));
}

main();
