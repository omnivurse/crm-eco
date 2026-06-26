import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export const dynamic = 'force-dynamic';

/**
 * POST /api/member/services/[id]/sso
 *
 * Invokes the `telehealth-sso` Supabase Edge Function for the given provider id
 * and either redirects (when the request is form-submitted from a server-rendered
 * page) or returns the SSO URL as JSON.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: providerId } = await params;
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();

  const { data: provider } = await supabase
    .from('service_providers')
    .select('id, name, sso_kind, external_url')
    .eq('id', providerId)
    .eq('organization_id', ctx.member.organization_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!provider) return NextResponse.json({ error: 'provider_not_found' }, { status: 404 });

  // For 'none' providers, just route to external_url (no SSO).
  if (provider.sso_kind === 'none' || !provider.sso_kind) {
    return NextResponse.redirect(provider.external_url, 302);
  }

  const { data, error } = await supabase.functions.invoke('telehealth-sso', {
    body: {
      provider_id: providerId,
      member_id: ctx.member.id,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: 'sso_failed', message: error.message },
      { status: 502 },
    );
  }

  const ssoUrl = (data as { sso_url?: string } | null)?.sso_url;
  if (!ssoUrl) {
    return NextResponse.json({ error: 'no_sso_url_returned' }, { status: 502 });
  }

  // If the client accepts JSON, return JSON. Otherwise (form post), redirect.
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('application/json')) {
    return NextResponse.json({ sso_url: ssoUrl, provider_name: provider.name });
  }
  return NextResponse.redirect(ssoUrl, 302);
}
