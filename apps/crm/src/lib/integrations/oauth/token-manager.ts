/**
 * OAuth Token Manager
 * Handles token exchange, refresh, and validation
 */

import { OAUTH_PROVIDERS, getOAuthCredentials, type OAuthProviderConfig } from './providers';

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  // Provider-specific fields
  [key: string]: unknown;
}

export interface TokenExchangeResult {
  success: boolean;
  tokens?: TokenResponse;
  error?: string;
  userInfo?: {
    id?: string;
    email?: string;
    name?: string;
  };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  providerId: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<TokenExchangeResult> {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider || !provider.tokenUrl) {
    return { success: false, error: 'Provider not configured for OAuth' };
  }

  const credentials = getOAuthCredentials(providerId);
  if (!credentials) {
    return { success: false, error: 'OAuth credentials not configured' };
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });

    // Add PKCE code verifier if present
    if (provider.usePKCE && codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // Some providers require Basic auth for token exchange
    if (provider.tokenEndpointAuthMethod === 'client_secret_basic') {
      const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
      body.delete('client_id');
      body.delete('client_secret');
    }

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Token exchange failed for ${providerId}:`, errorText);
      return { success: false, error: `Token exchange failed: ${response.status}` };
    }

    const tokens: TokenResponse = await response.json();

    // Fetch user info if available
    let userInfo: TokenExchangeResult['userInfo'];
    if (provider.userInfoUrl && tokens.access_token) {
      userInfo = await fetchUserInfo(provider, tokens.access_token);
    }

    return { success: true, tokens, userInfo };
  } catch (error) {
    console.error(`Token exchange error for ${providerId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Token exchange failed' };
  }
}

/**
 * Refresh expired tokens
 */
export async function refreshAccessToken(
  providerId: string,
  refreshToken: string
): Promise<TokenExchangeResult> {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider || !provider.tokenUrl) {
    return { success: false, error: 'Provider not configured for OAuth' };
  }

  if (!provider.supportsRefreshToken) {
    return { success: false, error: 'Provider does not support token refresh' };
  }

  const credentials = getOAuthCredentials(providerId);
  if (!credentials) {
    return { success: false, error: 'OAuth credentials not configured' };
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (provider.tokenEndpointAuthMethod === 'client_secret_basic') {
      const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
      body.delete('client_id');
      body.delete('client_secret');
    }

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Token refresh failed for ${providerId}:`, errorText);
      return { success: false, error: `Token refresh failed: ${response.status}` };
    }

    const tokens: TokenResponse = await response.json();
    return { success: true, tokens };
  } catch (error) {
    console.error(`Token refresh error for ${providerId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Token refresh failed' };
  }
}

/**
 * Revoke tokens
 */
export async function revokeToken(
  providerId: string,
  token: string,
  tokenType: 'access_token' | 'refresh_token' = 'access_token'
): Promise<{ success: boolean; error?: string }> {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider || !provider.revokeUrl) {
    // If no revoke URL, consider it successful (token will just expire)
    return { success: true };
  }

  const credentials = getOAuthCredentials(providerId);
  if (!credentials) {
    return { success: false, error: 'OAuth credentials not configured' };
  }

  try {
    const body = new URLSearchParams({
      token,
      token_type_hint: tokenType,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (provider.tokenEndpointAuthMethod === 'client_secret_basic') {
      const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    } else {
      body.set('client_id', credentials.clientId);
      body.set('client_secret', credentials.clientSecret);
    }

    const response = await fetch(provider.revokeUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    // Most providers return 200 OK even if token was already revoked
    if (!response.ok && response.status !== 400) {
      return { success: false, error: `Revoke failed: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error(`Token revoke error for ${providerId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Token revoke failed' };
  }
}

/**
 * Fetch user info from provider
 */
async function fetchUserInfo(
  provider: OAuthProviderConfig,
  accessToken: string
): Promise<TokenExchangeResult['userInfo'] | undefined> {
  if (!provider.userInfoUrl) {
    return undefined;
  }

  try {
    const response = await fetch(provider.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json();

    // Normalize user info based on provider
    switch (provider.providerId) {
      case 'google_calendar':
      case 'google_meet':
      case 'google_drive':
        return {
          id: data.id,
          email: data.email,
          name: data.name,
        };

      case 'microsoft_outlook':
      case 'microsoft_teams':
      case 'onedrive':
        return {
          id: data.id,
          email: data.mail || data.userPrincipalName,
          name: data.displayName,
        };

      case 'zoom':
        return {
          id: data.id,
          email: data.email,
          name: `${data.first_name} ${data.last_name}`.trim(),
        };

      case 'slack':
        return {
          id: data.user_id,
          email: data.user?.email,
          name: data.user?.name || data.user,
        };

      case 'docusign':
        return {
          id: data.sub,
          email: data.email,
          name: data.name,
        };

      case 'salesforce':
        return {
          id: data.user_id,
          email: data.email,
          name: data.name,
        };

      case 'hubspot':
        return {
          id: data.hub_id?.toString(),
          email: data.user,
          name: data.user,
        };

      case 'zoho':
        const user = data.users?.[0];
        return {
          id: user?.id,
          email: user?.email,
          name: user?.full_name,
        };

      default:
        // Try common field names
        return {
          id: data.id || data.sub || data.user_id,
          email: data.email || data.mail,
          name: data.name || data.displayName || data.full_name,
        };
    }
  } catch (error) {
    console.error(`Failed to fetch user info for ${provider.providerId}:`, error);
    return undefined;
  }
}

/**
 * Check if token is expired or about to expire
 */
export function isTokenExpired(expiresAt: Date | string | null, bufferSeconds = 300): boolean {
  if (!expiresAt) {
    return false; // Assume valid if no expiry set
  }

  const expiryDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const bufferMs = bufferSeconds * 1000;

  return expiryDate.getTime() - Date.now() < bufferMs;
}

/**
 * Calculate token expiry date
 */
export function calculateTokenExpiry(expiresIn?: number): Date | null {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000);
}
