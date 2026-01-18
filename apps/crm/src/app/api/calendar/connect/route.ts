/**
 * Calendar Connect API Route
 * Initiates OAuth flow for calendar providers
 *
 * POST /api/calendar/connect - Start OAuth flow for a calendar provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { OAUTH_PROVIDERS, getOAuthCredentials, buildAuthorizationUrl } from '@/lib/integrations/oauth/providers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // Ignore
          }
        },
      },
    }
  );
}

// Generate a random string for state/code verifier
function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('base64url').substring(0, length);
}

// Generate PKCE code challenge from verifier
function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { provider } = body;

    // Validate provider
    if (!provider || !['google_calendar', 'microsoft_outlook'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Supported: google_calendar, microsoft_outlook' },
        { status: 400 }
      );
    }

    // Get provider config
    const providerConfig = OAUTH_PROVIDERS[provider];
    if (!providerConfig) {
      return NextResponse.json({ error: 'Provider not configured' }, { status: 400 });
    }

    // Check if credentials are configured
    const credentials = getOAuthCredentials(provider);
    if (!credentials) {
      return NextResponse.json(
        { error: `${providerConfig.name} OAuth credentials not configured` },
        { status: 500 }
      );
    }

    // Generate state and code verifier for PKCE
    const state = generateRandomString(32);
    const codeVerifier = providerConfig.usePKCE ? generateRandomString(64) : null;
    const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : null;

    // Build redirect URI
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${origin}/api/integrations/oauth/callback`;

    // Store OAuth state in database
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const { error: stateError } = await supabase.from('oauth_states').insert({
      state,
      provider,
      org_id: profile.organization_id,
      connection_type: 'calendar',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      created_by: profile.id,
      expires_at: expiresAt.toISOString(),
    });

    if (stateError) {
      console.error('Failed to store OAuth state:', stateError);
      return NextResponse.json({ error: 'Failed to initialize OAuth' }, { status: 500 });
    }

    // Build authorization URL
    const authUrl = new URL(providerConfig.authorizationUrl!);
    authUrl.searchParams.set('client_id', credentials.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    if (providerConfig.defaultScopes && providerConfig.defaultScopes.length > 0) {
      authUrl.searchParams.set('scope', providerConfig.defaultScopes.join(' '));
    }

    // PKCE support
    if (providerConfig.usePKCE && codeChallenge) {
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    // Additional provider-specific params
    if (providerConfig.additionalAuthParams) {
      Object.entries(providerConfig.additionalAuthParams).forEach(([key, value]) => {
        authUrl.searchParams.set(key, value);
      });
    }

    return NextResponse.json({
      authorizationUrl: authUrl.toString(),
    });
  } catch (error) {
    console.error('Calendar connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect' },
      { status: 500 }
    );
  }
}
