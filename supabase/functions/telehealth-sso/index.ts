// supabase/functions/telehealth-sso/index.ts
//
// Provider-agnostic telehealth SSO dispatcher.
//
// POST body: { provider_id?: string, member_id?: string }
// Headers:   Authorization: Bearer <user JWT>  (required)
//
// Behavior:
//   1. Verify the user's JWT
//   2. Resolve their member context for the request org
//   3. Verify the active membership
//   4. Load the requested service_providers row (active only)
//   5. Dispatch to the provider per sso_kind:
//        - 'mytelemedicine' → POST to MyTelemedicine SSO endpoint
//        - 'custom'         → POST signed payload to sso_config.url
//        - 'none'           → return external_url with member ctx in query
//   6. Return { sso_url, provider_name, expires_at }
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//   MYTELEMEDICINE_API_KEY (for sso_kind='mytelemedicine')
//
// Errors: 400/401/403/404/502/504

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY           = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY              = Deno.env.get('SUPABASE_ANON_KEY')!;
const MYTELEMEDICINE_KEY    = Deno.env.get('MYTELEMEDICINE_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  provider_id?: string;
  member_id?: string;
}

interface MemberContextPayload {
  member_id: string;
  primary_member_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  date_of_birth: string | null;
  phone: string | null;
  plan_code: string | null;
  dependent_number: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function formatDob(input: string | null): string {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

async function dispatchMyTelemedicine(payload: MemberContextPayload, ssoConfig: Record<string, unknown>): Promise<string> {
  const endpoint = (ssoConfig.endpoint as string) ??
    'https://apis-x7onwxgyhq-uc.a.run.app/api/sso/lyric-url';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MYTELEMEDICINE_KEY}`,
    },
    body: JSON.stringify({
      memberID: payload.member_id,
      birthday: payload.date_of_birth,
      firstName: payload.first_name,
      lastName: payload.last_name,
      email: payload.email,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MyTelemedicine ${res.status}: ${txt}`);
  }
  const body = await res.json() as { sso_url?: string; url?: string };
  const url = body.sso_url ?? body.url;
  if (!url) throw new Error('Provider returned no URL');
  return url;
}

async function dispatchCustom(payload: MemberContextPayload, ssoConfig: Record<string, unknown>): Promise<string> {
  const url = ssoConfig.url as string | undefined;
  if (!url) throw new Error('Custom provider missing sso_config.url');

  const secretEnvVar = ssoConfig.secret_env_var as string | undefined;
  const secret = secretEnvVar ? Deno.env.get(secretEnvVar) ?? '' : '';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['Authorization'] = `Bearer ${secret}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Custom provider ${res.status}: ${txt}`);
  }

  const body = await res.json() as { sso_url?: string; url?: string };
  const ssoUrl = body.sso_url ?? body.url;
  if (!ssoUrl) throw new Error('Custom provider returned no URL');
  return ssoUrl;
}

function dispatchNone(payload: MemberContextPayload, externalUrl: string): string {
  const u = new URL(externalUrl);
  u.searchParams.set('memberId', payload.member_id);
  if (payload.date_of_birth) u.searchParams.set('dob', payload.date_of_birth);
  if (payload.email) u.searchParams.set('email', payload.email);
  return u.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // 1. Verify JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'no_jwt' }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResult, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResult.user) return json({ error: 'invalid_jwt' }, 401);
  const userId = userResult.user.id;

  // 2. Service-role client for the rest
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: RequestBody = {};
  try { body = await req.json() as RequestBody; } catch { /* default */ }

  // 3. Resolve profile + member
  const { data: profile } = await admin
    .from('profiles')
    .select('id, organization_id, email')
    .eq('user_id', userId)
    .single();
  if (!profile) return json({ error: 'no_profile' }, 403);

  const { data: member } = await admin
    .from('members')
    .select('id, member_number, first_name, last_name, email, date_of_birth, phone, plan_id, organization_id')
    .eq('organization_id', profile.organization_id)
    .eq('email', profile.email)
    .single();
  if (!member) return json({ error: 'no_member' }, 403);

  // 4. Verify active membership
  const { data: membership } = await admin
    .from('memberships')
    .select('id, status')
    .eq('member_id', member.id)
    .eq('organization_id', member.organization_id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!membership) return json({ error: 'no_active_membership' }, 403);

  // 5. Load provider
  const providerId = body.provider_id ?? Deno.env.get('DEFAULT_TELEHEALTH_PROVIDER_ID') ?? '';
  if (!providerId) return json({ error: 'missing_provider_id' }, 400);

  const { data: provider } = await admin
    .from('service_providers')
    .select('id, name, sso_kind, sso_config, external_url, is_active')
    .eq('id', providerId)
    .eq('organization_id', member.organization_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!provider) return json({ error: 'provider_not_found' }, 404);

  // 6. Resolve plan code
  let planCode: string | null = null;
  if (member.plan_id) {
    const { data: plan } = await admin
      .from('plans')
      .select('code')
      .eq('id', member.plan_id)
      .maybeSingle();
    planCode = plan?.code ?? null;
  }

  const payload: MemberContextPayload = {
    member_id: member.member_number ?? member.id,
    primary_member_id: member.id,
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    date_of_birth: formatDob(member.date_of_birth),
    phone: member.phone,
    plan_code: planCode,
    dependent_number: '01', // primary; expand for dependents in v2
  };

  // 7. Dispatch
  let ssoUrl: string;
  try {
    if (provider.sso_kind === 'mytelemedicine') {
      ssoUrl = await dispatchMyTelemedicine(payload, (provider.sso_config ?? {}) as Record<string, unknown>);
    } else if (provider.sso_kind === 'custom') {
      ssoUrl = await dispatchCustom(payload, (provider.sso_config ?? {}) as Record<string, unknown>);
    } else {
      ssoUrl = dispatchNone(payload, provider.external_url);
    }
  } catch (err) {
    console.error('[telehealth-sso] dispatch failed:', err);
    const message = err instanceof Error ? err.message : 'unknown';
    return json({ error: 'provider_failed', message }, 502);
  }

  return json({
    sso_url: ssoUrl,
    provider_name: provider.name,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
});
