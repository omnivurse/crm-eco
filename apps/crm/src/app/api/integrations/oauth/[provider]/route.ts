/**
 * OAuth Initiate Route
 * Starts the OAuth flow by redirecting to the provider's authorization page
 *
 * GET /api/integrations/oauth/[provider]?connection_type=default
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { OAUTH_PROVIDERS, getOAuthCredentials } from '@/lib/integrations/oauth/providers';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{ provider: string }>;
}

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore cookie errors in edge runtime
          }
        },
      },
    }
  );
}

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { provider: providerId } = await params;
  const { searchParams } = new URL(request.url);
  const connectionType = searchParams.get('connection_type') || 'default';

  // Check if provider exists
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider) {
    return NextResponse.redirect(
      new URL(`/crm/integrations?error=unknown_provider&provider=${providerId}`, request.url)
    );
  }

  // Check if credentials are configured
  const credentials = getOAuthCredentials(providerId);
  if (!credentials) {
    return NextResponse.redirect(
      new URL(`/crm/integrations?error=provider_not_configured&provider=${providerId}`, request.url)
    );
  }

  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(
        new URL('/crm-login?redirect=/crm/integrations', request.url)
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.redirect(
        new URL('/crm/integrations?error=profile_not_found', request.url)
      );
    }

    // Only admins can connect integrations
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.redirect(
        new URL('/crm/integrations?error=admin_only', request.url)
      );
    }

    // Generate OAuth state for CSRF protection
    const state = crypto.randomUUID();

    // Generate PKCE if provider supports it
    let codeVerifier: string | null = null;
    let codeChallenge: string | null = null;
    if (provider.usePKCE) {
      const pkce = generatePKCE();
      codeVerifier = pkce.codeVerifier;
      codeChallenge = pkce.codeChallenge;
    }

    // Build redirect URI
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/callback`;

    // Store OAuth state in database
    const { error: stateError } = await supabase.from('oauth_states').insert({
      state,
      org_id: profile.organization_id,
      provider: providerId,
      connection_type: connectionType,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      created_by: profile.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    if (stateError) {
      console.error('Failed to store OAuth state:', stateError);
      return NextResponse.redirect(
        new URL('/crm/integrations?error=state_storage_failed', request.url)
      );
    }

    // Build authorization URL
    const authUrl = new URL(provider.authorizationUrl!);
    authUrl.searchParams.set('client_id', credentials.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    // Add scopes
    if (provider.defaultScopes && provider.defaultScopes.length > 0) {
      authUrl.searchParams.set('scope', provider.defaultScopes.join(' '));
    }

    // Add PKCE challenge
    if (provider.usePKCE && codeChallenge) {
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    // Add provider-specific params
    if (provider.additionalAuthParams) {
      Object.entries(provider.additionalAuthParams).forEach(([key, value]) => {
        authUrl.searchParams.set(key, value);
      });
    }

    // Redirect to provider's authorization page
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('OAuth initiate error:', error);
    return NextResponse.redirect(
      new URL(`/crm/integrations?error=oauth_initiate_failed&provider=${providerId}`, request.url)
    );
  }
}
