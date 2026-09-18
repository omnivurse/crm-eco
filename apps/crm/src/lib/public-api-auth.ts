import { createHash } from 'crypto';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { hasCrmApiScope, type PublicApiAccess } from './public-api-scopes';

export type { PublicApiAccess };

function normalizeIp(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
}

/**
 * Resolve the originating address supplied by the trusted deployment proxy.
 * A missing address intentionally fails closed when an allowlist is configured.
 */
export function getPublicApiClientIp(request: Request): string | null {
  const forwarded = (
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-forwarded-for')
  )
    ?.split(',')[0]
    ?.trim();
  const value =
    forwarded ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim();
  return value ? normalizeIp(value) : null;
}

export function isPublicApiIpAllowed(
  allowedIps: string[] | null | undefined,
  clientIp: string | null,
): boolean {
  const allowlist = (allowedIps ?? []).map(normalizeIp).filter(Boolean);
  if (allowlist.length === 0) return true;
  if (!clientIp) return false;
  return allowlist.includes(normalizeIp(clientIp));
}

export function isPublicApiKeyExpired(
  expiresAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}

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
    .select('id, organization_id, scopes, status, environment, usage_count, expires_at, allowed_ips')
    .eq('key_hash', hash)
    .maybeSingle();

  if (error || !key || key.status !== 'active' || isPublicApiKeyExpired(key.expires_at)) {
    return { error: Response.json({ error: 'Invalid API key' }, { status: 401 }) };
  }

  const clientIp = getPublicApiClientIp(request);
  if (!isPublicApiIpAllowed(key.allowed_ips, clientIp)) {
    return { error: Response.json({ error: 'API key is not allowed from this IP' }, { status: 403 }) };
  }

  const scopes = Array.isArray(key.scopes) ? (key.scopes as string[]) : [];
  if (!hasCrmApiScope(scopes, access)) {
    return { error: Response.json({ error: 'Missing scope' }, { status: 403 }) };
  }

  await supabase
    .from('crm_api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      last_used_ip: clientIp,
      usage_count: (key.usage_count ?? 0) + 1,
    })
    .eq('id', key.id);

  return { key, supabase, scopes };
}
