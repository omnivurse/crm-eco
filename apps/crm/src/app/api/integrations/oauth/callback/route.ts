/**
 * OAuth Callback Route
 * Handles the redirect from OAuth provider after user authorization
 *
 * GET /api/integrations/oauth/callback?code=...&state=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exchangeCodeForTokens, calculateTokenExpiry } from '@/lib/integrations/oauth/token-manager';
import { OAUTH_PROVIDERS } from '@/lib/integrations/oauth/providers';

// Use service role for callback processing (user may not have session cookie yet)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error from provider:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/crm/integrations?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`, request.url)
    );
  }

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/crm/integrations?error=missing_params', request.url)
    );
  }

  try {
    // Look up OAuth state
    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (stateError || !oauthState) {
      console.error('Invalid or expired OAuth state:', stateError);
      return NextResponse.redirect(
        new URL('/crm/integrations?error=invalid_state', request.url)
      );
    }

    const { provider, org_id, connection_type, redirect_uri, code_verifier, created_by } = oauthState;

    // Get provider config
    const providerConfig = OAUTH_PROVIDERS[provider];
    if (!providerConfig) {
      return NextResponse.redirect(
        new URL(`/crm/integrations?error=unknown_provider&provider=${provider}`, request.url)
      );
    }

    // Exchange code for tokens
    const tokenResult = await exchangeCodeForTokens(
      provider,
      code,
      redirect_uri,
      code_verifier || undefined
    );

    if (!tokenResult.success || !tokenResult.tokens) {
      console.error('Token exchange failed:', tokenResult.error);
      return NextResponse.redirect(
        new URL(`/crm/integrations?error=token_exchange_failed&provider=${provider}`, request.url)
      );
    }

    const { tokens, userInfo } = tokenResult;

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('integration_connections')
      .select('id')
      .eq('org_id', org_id)
      .eq('provider', provider)
      .eq('connection_type', connection_type)
      .single();

    // Prepare connection data
    const connectionData = {
      org_id,
      provider,
      connection_type,
      name: providerConfig.name,
      status: 'connected',
      access_token_enc: tokens.access_token, // TODO: Encrypt
      refresh_token_enc: tokens.refresh_token || null, // TODO: Encrypt
      token_expires_at: tokens.expires_in ? calculateTokenExpiry(tokens.expires_in)?.toISOString() : null,
      scopes: tokens.scope ? tokens.scope.split(' ') : providerConfig.defaultScopes,
      external_account_id: userInfo?.id || null,
      external_account_email: userInfo?.email || null,
      external_account_name: userInfo?.name || null,
      health_status: 'healthy',
      error_count: 0,
      last_error_at: null,
      last_error_message: null,
      updated_by: created_by,
    };

    if (existingConnection) {
      // Update existing connection
      const { error: updateError } = await supabase
        .from('integration_connections')
        .update({
          ...connectionData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('Failed to update connection:', updateError);
        return NextResponse.redirect(
          new URL(`/crm/integrations?error=update_failed&provider=${provider}`, request.url)
        );
      }
    } else {
      // Create new connection
      const { error: insertError } = await supabase
        .from('integration_connections')
        .insert({
          ...connectionData,
          created_by,
        });

      if (insertError) {
        console.error('Failed to create connection:', insertError);
        return NextResponse.redirect(
          new URL(`/crm/integrations?error=create_failed&provider=${provider}`, request.url)
        );
      }
    }

    // Log successful connection
    await supabase.from('integration_logs').insert({
      org_id,
      connection_id: existingConnection?.id, // May be null for new connections
      provider,
      event_type: 'auth_refresh',
      event_type_detail: 'oauth_connected',
      direction: 'internal',
      status: 'success',
      metadata: {
        user_email: userInfo?.email,
        scopes: connectionData.scopes,
      },
    });

    // Clean up OAuth state
    await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state);

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/crm/integrations?connected=${provider}`, request.url)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/crm/integrations?error=callback_failed', request.url)
    );
  }
}
