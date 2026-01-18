/**
 * OAuth Provider Configurations
 * Defines OAuth URLs, scopes, and settings for each provider
 */

export interface OAuthProviderConfig {
  providerId: string;
  name: string;
  authType: 'oauth2' | 'oauth1' | 'api_key';

  // OAuth2 specific
  authorizationUrl?: string;
  tokenUrl?: string;
  revokeUrl?: string;
  userInfoUrl?: string;

  // Scopes
  defaultScopes?: string[];
  optionalScopes?: string[];

  // OAuth settings
  usePKCE?: boolean;
  tokenEndpointAuthMethod?: 'client_secret_basic' | 'client_secret_post';

  // Environment variable names for credentials
  clientIdEnvVar?: string;
  clientSecretEnvVar?: string;

  // Token behavior
  accessTokenLifetime?: number; // in seconds
  supportsRefreshToken?: boolean;

  // Additional settings
  additionalAuthParams?: Record<string, string>;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  // === CALENDAR ===
  google_calendar: {
    providerId: 'google_calendar',
    name: 'Google Calendar',
    authType: 'oauth2',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    defaultScopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    usePKCE: true,
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'GOOGLE_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    supportsRefreshToken: true,
    additionalAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },

  microsoft_outlook: {
    providerId: 'microsoft_outlook',
    name: 'Microsoft Outlook',
    authType: 'oauth2',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    revokeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    defaultScopes: [
      'Calendars.ReadWrite',
      'User.Read',
      'offline_access',
    ],
    usePKCE: true,
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'MICROSOFT_CLIENT_ID',
    clientSecretEnvVar: 'MICROSOFT_CLIENT_SECRET',
    supportsRefreshToken: true,
  },

  // === VIDEO ===
  zoom: {
    providerId: 'zoom',
    name: 'Zoom',
    authType: 'oauth2',
    authorizationUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    revokeUrl: 'https://zoom.us/oauth/revoke',
    userInfoUrl: 'https://api.zoom.us/v2/users/me',
    defaultScopes: [
      'meeting:write:admin',
      'meeting:read:admin',
      'user:read:admin',
    ],
    tokenEndpointAuthMethod: 'client_secret_basic',
    clientIdEnvVar: 'ZOOM_CLIENT_ID',
    clientSecretEnvVar: 'ZOOM_CLIENT_SECRET',
    supportsRefreshToken: true,
  },

  google_meet: {
    providerId: 'google_meet',
    name: 'Google Meet',
    authType: 'oauth2',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    defaultScopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    usePKCE: true,
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'GOOGLE_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    supportsRefreshToken: true,
    additionalAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },

  microsoft_teams: {
    providerId: 'microsoft_teams',
    name: 'Microsoft Teams',
    authType: 'oauth2',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    defaultScopes: [
      'OnlineMeetings.ReadWrite',
      'User.Read',
      'offline_access',
    ],
    usePKCE: true,
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'MICROSOFT_CLIENT_ID',
    clientSecretEnvVar: 'MICROSOFT_CLIENT_SECRET',
    supportsRefreshToken: true,
  },

  // === CHAT ===
  slack: {
    providerId: 'slack',
    name: 'Slack',
    authType: 'oauth2',
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    revokeUrl: 'https://slack.com/api/auth.revoke',
    userInfoUrl: 'https://slack.com/api/auth.test',
    defaultScopes: [
      'chat:write',
      'channels:read',
      'users:read',
      'incoming-webhook',
    ],
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'SLACK_CLIENT_ID',
    clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
    supportsRefreshToken: false, // Slack tokens don't expire by default
  },

  // === E-SIGNATURE ===
  docusign: {
    providerId: 'docusign',
    name: 'DocuSign',
    authType: 'oauth2',
    authorizationUrl: 'https://account-d.docusign.com/oauth/auth', // Demo, use account.docusign.com for production
    tokenUrl: 'https://account-d.docusign.com/oauth/token',
    userInfoUrl: 'https://account-d.docusign.com/oauth/userinfo',
    defaultScopes: [
      'signature',
      'extended',
    ],
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'DOCUSIGN_CLIENT_ID',
    clientSecretEnvVar: 'DOCUSIGN_CLIENT_SECRET',
    supportsRefreshToken: true,
  },

  pandadoc: {
    providerId: 'pandadoc',
    name: 'PandaDoc',
    authType: 'oauth2',
    authorizationUrl: 'https://app.pandadoc.com/oauth2/authorize',
    tokenUrl: 'https://api.pandadoc.com/oauth2/access_token',
    userInfoUrl: 'https://api.pandadoc.com/public/v1/members/current',
    defaultScopes: [
      'read+write',
    ],
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'PANDADOC_CLIENT_ID',
    clientSecretEnvVar: 'PANDADOC_CLIENT_SECRET',
    supportsRefreshToken: true,
  },

  // === CRM SYNC ===
  salesforce: {
    providerId: 'salesforce',
    name: 'Salesforce',
    authType: 'oauth2',
    authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    revokeUrl: 'https://login.salesforce.com/services/oauth2/revoke',
    userInfoUrl: 'https://login.salesforce.com/services/oauth2/userinfo',
    defaultScopes: [
      'api',
      'refresh_token',
      'offline_access',
    ],
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'SALESFORCE_CLIENT_ID',
    clientSecretEnvVar: 'SALESFORCE_CLIENT_SECRET',
    supportsRefreshToken: true,
  },

  hubspot: {
    providerId: 'hubspot',
    name: 'HubSpot',
    authType: 'oauth2',
    authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    userInfoUrl: 'https://api.hubapi.com/oauth/v1/access-tokens',
    defaultScopes: [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
    ],
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'HUBSPOT_CLIENT_ID',
    clientSecretEnvVar: 'HUBSPOT_CLIENT_SECRET',
    supportsRefreshToken: true,
  },

  zoho: {
    providerId: 'zoho',
    name: 'Zoho CRM',
    authType: 'oauth2',
    authorizationUrl: 'https://accounts.zoho.com/oauth/v2/auth',
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    revokeUrl: 'https://accounts.zoho.com/oauth/v2/token/revoke',
    userInfoUrl: 'https://www.zohoapis.com/crm/v2/users?type=CurrentUser',
    defaultScopes: [
      'ZohoCRM.modules.ALL',
      'ZohoCRM.settings.ALL',
      'ZohoCRM.users.READ',
    ],
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'ZOHO_CLIENT_ID',
    clientSecretEnvVar: 'ZOHO_CLIENT_SECRET',
    supportsRefreshToken: true,
    additionalAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },

  // === CLOUD STORAGE ===
  google_drive: {
    providerId: 'google_drive',
    name: 'Google Drive',
    authType: 'oauth2',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    defaultScopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    usePKCE: true,
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'GOOGLE_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    supportsRefreshToken: true,
    additionalAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },

  dropbox: {
    providerId: 'dropbox',
    name: 'Dropbox',
    authType: 'oauth2',
    authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    revokeUrl: 'https://api.dropboxapi.com/2/auth/token/revoke',
    userInfoUrl: 'https://api.dropboxapi.com/2/users/get_current_account',
    defaultScopes: [],
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'DROPBOX_CLIENT_ID',
    clientSecretEnvVar: 'DROPBOX_CLIENT_SECRET',
    supportsRefreshToken: true,
    additionalAuthParams: {
      token_access_type: 'offline',
    },
  },

  onedrive: {
    providerId: 'onedrive',
    name: 'OneDrive',
    authType: 'oauth2',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    defaultScopes: [
      'Files.ReadWrite',
      'User.Read',
      'offline_access',
    ],
    usePKCE: true,
    tokenEndpointAuthMethod: 'client_secret_post',
    clientIdEnvVar: 'MICROSOFT_CLIENT_ID',
    clientSecretEnvVar: 'MICROSOFT_CLIENT_SECRET',
    supportsRefreshToken: true,
  },

  // === ACCOUNTING ===
  quickbooks: {
    providerId: 'quickbooks',
    name: 'QuickBooks',
    authType: 'oauth2',
    authorizationUrl: 'https://appcenter.intuit.com/connect/oauth2',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
    userInfoUrl: 'https://accounts.platform.intuit.com/v1/openid_connect/userinfo',
    defaultScopes: [
      'com.intuit.quickbooks.accounting',
      'openid',
      'profile',
      'email',
    ],
    tokenEndpointAuthMethod: 'client_secret_basic',
    clientIdEnvVar: 'QUICKBOOKS_CLIENT_ID',
    clientSecretEnvVar: 'QUICKBOOKS_CLIENT_SECRET',
    supportsRefreshToken: true,
  },

  xero: {
    providerId: 'xero',
    name: 'Xero',
    authType: 'oauth2',
    authorizationUrl: 'https://login.xero.com/identity/connect/authorize',
    tokenUrl: 'https://identity.xero.com/connect/token',
    revokeUrl: 'https://identity.xero.com/connect/revocation',
    userInfoUrl: 'https://api.xero.com/connections',
    defaultScopes: [
      'openid',
      'profile',
      'email',
      'accounting.transactions',
      'accounting.contacts',
      'offline_access',
    ],
    tokenEndpointAuthMethod: 'client_secret_basic',
    clientIdEnvVar: 'XERO_CLIENT_ID',
    clientSecretEnvVar: 'XERO_CLIENT_SECRET',
    supportsRefreshToken: true,
  },
};

// API Key based providers (simpler auth)
export const API_KEY_PROVIDERS: Record<string, { providerId: string; name: string; apiKeyEnvVar?: string }> = {
  stripe: {
    providerId: 'stripe',
    name: 'Stripe',
    apiKeyEnvVar: 'STRIPE_SECRET_KEY',
  },
  sendgrid: {
    providerId: 'sendgrid',
    name: 'SendGrid',
    apiKeyEnvVar: 'SENDGRID_API_KEY',
  },
  resend: {
    providerId: 'resend',
    name: 'Resend',
    apiKeyEnvVar: 'RESEND_API_KEY',
  },
  mailgun: {
    providerId: 'mailgun',
    name: 'Mailgun',
    apiKeyEnvVar: 'MAILGUN_API_KEY',
  },
  twilio: {
    providerId: 'twilio',
    name: 'Twilio',
    apiKeyEnvVar: 'TWILIO_AUTH_TOKEN',
  },
  openai: {
    providerId: 'openai',
    name: 'OpenAI',
    apiKeyEnvVar: 'OPENAI_API_KEY',
  },
  anthropic: {
    providerId: 'anthropic',
    name: 'Anthropic Claude',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  },
};

/**
 * Get OAuth provider config by ID
 */
export function getOAuthProvider(providerId: string): OAuthProviderConfig | undefined {
  return OAUTH_PROVIDERS[providerId];
}

/**
 * Check if provider uses OAuth
 */
export function isOAuthProvider(providerId: string): boolean {
  return providerId in OAUTH_PROVIDERS;
}

/**
 * Check if provider uses API Key
 */
export function isApiKeyProvider(providerId: string): boolean {
  return providerId in API_KEY_PROVIDERS;
}

/**
 * Get client credentials from environment variables
 */
export function getOAuthCredentials(providerId: string): { clientId: string; clientSecret: string } | null {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider || !provider.clientIdEnvVar || !provider.clientSecretEnvVar) {
    return null;
  }

  const clientId = process.env[provider.clientIdEnvVar];
  const clientSecret = process.env[provider.clientSecretEnvVar];

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

/**
 * Build OAuth authorization URL
 */
export function buildAuthorizationUrl(
  providerId: string,
  redirectUri: string,
  state: string,
  codeVerifier?: string
): string | null {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider || !provider.authorizationUrl) {
    return null;
  }

  const credentials = getOAuthCredentials(providerId);
  if (!credentials) {
    return null;
  }

  const url = new URL(provider.authorizationUrl);
  url.searchParams.set('client_id', credentials.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  if (provider.defaultScopes && provider.defaultScopes.length > 0) {
    url.searchParams.set('scope', provider.defaultScopes.join(' '));
  }

  // PKCE support
  if (provider.usePKCE && codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    // Note: In actual implementation, compute SHA-256 hash and base64url encode
    url.searchParams.set('code_challenge_method', 'S256');
    // code_challenge would be computed from codeVerifier
  }

  // Additional params
  if (provider.additionalAuthParams) {
    Object.entries(provider.additionalAuthParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
}
