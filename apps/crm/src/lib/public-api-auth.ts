import { createHash } from 'crypto';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { hasCrmApiScope, type PublicApiAccess } from './public-api-scopes';

export type { PublicApiAccess };

export async function requireCrmApiKey(request: Request, access: PublicApiAccess = 'read') {
  const header = request.headers.get('authorization') || request.headers.get('x-api-key') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!token.startsWith('dhh_k_')) {
    return { error: Response.json({ error: 'API key required' }, { status: 401 }) };
  }

  const hash = createHash('sha256').update(token).digest('hex');
  const supabase = createServiceRoleClient();
  const { data: key, error } = await supabase
    .from('crm_api_keys')
    .select('id, organization_id, scopes, status, environment, usage_count')
    .eq('key_hash', hash)
    .maybeSingle();

  if (error || !key || key.status !== 'active') {
    return { error: Response.json({ error: 'Invalid API key' }, { status: 401 }) };
  }

  const scopes = Array.isArray(key.scopes) ? (key.scopes as string[]) : [];
  if (!hasCrmApiScope(scopes, access)) {
    return { error: Response.json({ error: 'Missing scope' }, { status: 403 }) };
  }

  await supabase
    .from('crm_api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      usage_count: (key.usage_count ?? 0) + 1,
    })
    .eq('id', key.id);

  return { key, supabase, scopes };
}
