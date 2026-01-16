// ============================================================================
// Integration Types
// ============================================================================

export type IntegrationProvider = 
  // Email
  | 'sendgrid' | 'resend' | 'mailgun'
  // SMS/Phone
  | 'twilio' | 'ringcentral' | 'goto'
  // Video
  | 'zoom' | 'google_meet' | 'microsoft_teams' | 'goto_meeting'
  // Calendar
  | 'google_calendar' | 'microsoft_outlook'
  // Chat
  | 'slack' | 'whatsapp'
  // Commerce
  | 'shopify' | 'woocommerce' | 'bigcommerce'
  // Payments
  | 'stripe' | 'square' | 'authorize_net'
  // E-Sign
  | 'docusign' | 'pandadoc' | 'hellosign'
  // CRM Sync
  | 'zoho' | 'salesforce' | 'hubspot';

export type ConnectionType = 
  | 'email' 
  | 'sms' 
  | 'phone' 
  | 'video' 
  | 'calendar' 
  | 'chat' 
  | 'commerce' 
  | 'payments' 
  | 'esign' 
  | 'crm_sync';

export type ConnectionStatus = 
  | 'connected' 
  | 'disconnected' 
  | 'error' 
  | 'pending' 
  | 'expired';

export type HealthStatus = 
  | 'healthy' 
  | 'degraded' 
  | 'unhealthy' 
  | 'unknown';

export type LogEventType = 
  | 'api_call' 
  | 'webhook_received' 
  | 'sync_started' 
  | 'sync_completed' 
  | 'sync_failed'
  | 'auth_refresh' 
  | 'auth_expired' 
  | 'error' 
  | 'warning' 
  | 'info';

export type LogStatus = 'success' | 'error' | 'warning' | 'pending';

export type LogDirection = 'inbound' | 'outbound' | 'internal';

export type SyncJobType = 'full_sync' | 'incremental_sync' | 'webhook_replay' | 'manual_sync';

export type SyncJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// ============================================================================
// Database Row Types
// ============================================================================

export interface IntegrationConnection {
  id: string;
  org_id: string;
  provider: IntegrationProvider;
  connection_type: ConnectionType;
  name: string;
  description: string | null;
  status: ConnectionStatus;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  api_key_enc: string | null;
  api_secret_enc: string | null;
  settings: Record<string, unknown>;
  external_account_id: string | null;
  external_account_name: string | null;
  external_account_email: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  sync_cursor: string | null;
  last_webhook_at: string | null;
  webhook_secret: string | null;
  error_count: number;
  last_error_at: string | null;
  last_error_message: string | null;
  health_status: HealthStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationLog {
  id: string;
  org_id: string;
  connection_id: string | null;
  event_type: LogEventType;
  provider: string;
  direction: LogDirection;
  method: string | null;
  endpoint: string | null;
  request_body: Record<string, unknown> | null;
  response_body: Record<string, unknown> | null;
  response_status: number | null;
  status: LogStatus;
  error_code: string | null;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}

export interface IntegrationWebhook {
  id: string;
  org_id: string;
  connection_id: string | null;
  provider: string;
  event_types: string[];
  endpoint_path: string;
  secret_key: string | null;
  is_active: boolean;
  verified_at: string | null;
  last_received_at: string | null;
  received_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface IntegrationSyncJob {
  id: string;
  org_id: string;
  connection_id: string;
  job_type: SyncJobType;
  status: SyncJobStatus;
  started_at: string | null;
  completed_at: string | null;
  progress_pct: number;
  items_processed: number;
  items_total: number | null;
  items_created: number;
  items_updated: number;
  items_failed: number;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Provider Configuration Types
// ============================================================================

export interface ProviderConfig {
  id: IntegrationProvider;
  name: string;
  description: string;
  connectionType: ConnectionType;
  icon: string;
  color: string;
  authType: 'oauth' | 'api_key' | 'both';
  oauthScopes?: string[];
  requiredSettings?: string[];
  features: string[];
  docsUrl?: string;
}

// Provider configurations
export const PROVIDER_CONFIGS: Record<IntegrationProvider, ProviderConfig> = {
  // Email providers
  sendgrid: {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Email delivery and marketing',
    connectionType: 'email',
    icon: 'mail',
    color: 'blue',
    authType: 'api_key',
    features: ['send_email', 'email_templates', 'tracking'],
    docsUrl: 'https://docs.sendgrid.com',
  },
  resend: {
    id: 'resend',
    name: 'Resend',
    description: 'Modern email API for developers',
    connectionType: 'email',
    icon: 'mail',
    color: 'violet',
    authType: 'api_key',
    features: ['send_email', 'tracking'],
    docsUrl: 'https://resend.com/docs',
  },
  mailgun: {
    id: 'mailgun',
    name: 'Mailgun',
    description: 'Email delivery service',
    connectionType: 'email',
    icon: 'mail',
    color: 'red',
    authType: 'api_key',
    features: ['send_email', 'tracking'],
    docsUrl: 'https://documentation.mailgun.com',
  },
  
  // SMS/Phone providers
  twilio: {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS, voice, and video communications',
    connectionType: 'phone',
    icon: 'phone',
    color: 'red',
    authType: 'api_key',
    requiredSettings: ['account_sid', 'auth_token', 'phone_number'],
    features: ['send_sms', 'voice_calls', 'video'],
    docsUrl: 'https://www.twilio.com/docs',
  },
  ringcentral: {
    id: 'ringcentral',
    name: 'RingCentral',
    description: 'Cloud phone and video',
    connectionType: 'phone',
    icon: 'phone',
    color: 'orange',
    authType: 'oauth',
    features: ['voice_calls', 'video', 'sms'],
    docsUrl: 'https://developers.ringcentral.com',
  },
  goto: {
    id: 'goto',
    name: 'GoTo',
    description: 'Business communications',
    connectionType: 'phone',
    icon: 'phone',
    color: 'teal',
    authType: 'oauth',
    features: ['voice_calls', 'video', 'webinars'],
    docsUrl: 'https://developer.goto.com',
  },
  
  // Video providers
  zoom: {
    id: 'zoom',
    name: 'Zoom',
    description: 'Video meetings and webinars',
    connectionType: 'video',
    icon: 'video',
    color: 'blue',
    authType: 'oauth',
    oauthScopes: ['meeting:write', 'meeting:read', 'user:read'],
    features: ['video_meetings', 'webinars', 'recordings'],
    docsUrl: 'https://marketplace.zoom.us/docs/api-reference',
  },
  google_meet: {
    id: 'google_meet',
    name: 'Google Meet',
    description: 'Google video conferencing',
    connectionType: 'video',
    icon: 'video',
    color: 'green',
    authType: 'oauth',
    oauthScopes: ['https://www.googleapis.com/auth/calendar.events'],
    features: ['video_meetings'],
    docsUrl: 'https://developers.google.com/meet',
  },
  microsoft_teams: {
    id: 'microsoft_teams',
    name: 'Microsoft Teams',
    description: 'Microsoft video and collaboration',
    connectionType: 'video',
    icon: 'video',
    color: 'indigo',
    authType: 'oauth',
    oauthScopes: ['OnlineMeetings.ReadWrite'],
    features: ['video_meetings', 'chat'],
    docsUrl: 'https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview',
  },
  goto_meeting: {
    id: 'goto_meeting',
    name: 'GoTo Meeting',
    description: 'Online meeting solution',
    connectionType: 'video',
    icon: 'video',
    color: 'teal',
    authType: 'oauth',
    features: ['video_meetings', 'recordings'],
    docsUrl: 'https://developer.goto.com/GoToMeetingV1',
  },
  
  // Calendar providers
  google_calendar: {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Google Calendar sync',
    connectionType: 'calendar',
    icon: 'calendar',
    color: 'blue',
    authType: 'oauth',
    oauthScopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'],
    features: ['calendar_sync', 'event_create'],
    docsUrl: 'https://developers.google.com/calendar',
  },
  microsoft_outlook: {
    id: 'microsoft_outlook',
    name: 'Microsoft Outlook',
    description: 'Outlook Calendar sync',
    connectionType: 'calendar',
    icon: 'calendar',
    color: 'blue',
    authType: 'oauth',
    oauthScopes: ['Calendars.ReadWrite'],
    features: ['calendar_sync', 'event_create'],
    docsUrl: 'https://learn.microsoft.com/en-us/graph/api/resources/calendar',
  },
  
  // Chat providers
  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Team messaging and notifications',
    connectionType: 'chat',
    icon: 'message-square',
    color: 'purple',
    authType: 'oauth',
    oauthScopes: ['chat:write', 'channels:read', 'users:read'],
    features: ['send_message', 'notifications'],
    docsUrl: 'https://api.slack.com',
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'WhatsApp messaging',
    connectionType: 'chat',
    icon: 'message-circle',
    color: 'green',
    authType: 'api_key',
    features: ['send_message', 'templates'],
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
  },
  
  // Commerce providers
  shopify: {
    id: 'shopify',
    name: 'Shopify',
    description: 'E-commerce platform',
    connectionType: 'commerce',
    icon: 'shopping-bag',
    color: 'green',
    authType: 'oauth',
    features: ['orders', 'products', 'customers'],
    docsUrl: 'https://shopify.dev/docs/api',
  },
  woocommerce: {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'WordPress e-commerce',
    connectionType: 'commerce',
    icon: 'shopping-cart',
    color: 'purple',
    authType: 'api_key',
    features: ['orders', 'products', 'customers'],
    docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs',
  },
  bigcommerce: {
    id: 'bigcommerce',
    name: 'BigCommerce',
    description: 'E-commerce platform',
    connectionType: 'commerce',
    icon: 'shopping-bag',
    color: 'blue',
    authType: 'oauth',
    features: ['orders', 'products', 'customers'],
    docsUrl: 'https://developer.bigcommerce.com',
  },
  
  // Payment providers
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing',
    connectionType: 'payments',
    icon: 'credit-card',
    color: 'indigo',
    authType: 'api_key',
    features: ['payments', 'subscriptions', 'invoices'],
    docsUrl: 'https://stripe.com/docs/api',
  },
  square: {
    id: 'square',
    name: 'Square',
    description: 'Payment and POS',
    connectionType: 'payments',
    icon: 'credit-card',
    color: 'slate',
    authType: 'oauth',
    features: ['payments', 'invoices'],
    docsUrl: 'https://developer.squareup.com',
  },
  authorize_net: {
    id: 'authorize_net',
    name: 'Authorize.net',
    description: 'Payment gateway',
    connectionType: 'payments',
    icon: 'credit-card',
    color: 'blue',
    authType: 'api_key',
    features: ['payments', 'recurring'],
    docsUrl: 'https://developer.authorize.net',
  },
  
  // E-Sign providers
  docusign: {
    id: 'docusign',
    name: 'DocuSign',
    description: 'Electronic signatures',
    connectionType: 'esign',
    icon: 'pen-tool',
    color: 'yellow',
    authType: 'oauth',
    features: ['esign', 'templates', 'envelopes'],
    docsUrl: 'https://developers.docusign.com',
  },
  pandadoc: {
    id: 'pandadoc',
    name: 'PandaDoc',
    description: 'Document automation',
    connectionType: 'esign',
    icon: 'file-signature',
    color: 'green',
    authType: 'oauth',
    features: ['esign', 'templates', 'proposals'],
    docsUrl: 'https://developers.pandadoc.com',
  },
  hellosign: {
    id: 'hellosign',
    name: 'HelloSign',
    description: 'E-signature solution',
    connectionType: 'esign',
    icon: 'pen-tool',
    color: 'blue',
    authType: 'oauth',
    features: ['esign', 'templates'],
    docsUrl: 'https://developers.hellosign.com',
  },
  
  // CRM Sync providers
  zoho: {
    id: 'zoho',
    name: 'Zoho CRM',
    description: 'CRM data sync',
    connectionType: 'crm_sync',
    icon: 'database',
    color: 'red',
    authType: 'oauth',
    features: ['contacts', 'leads', 'deals', 'tasks'],
    docsUrl: 'https://www.zoho.com/crm/developer/docs',
  },
  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'CRM data sync',
    connectionType: 'crm_sync',
    icon: 'cloud',
    color: 'blue',
    authType: 'oauth',
    features: ['contacts', 'leads', 'opportunities'],
    docsUrl: 'https://developer.salesforce.com',
  },
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'CRM and marketing',
    connectionType: 'crm_sync',
    icon: 'trending-up',
    color: 'orange',
    authType: 'oauth',
    features: ['contacts', 'deals', 'marketing'],
    docsUrl: 'https://developers.hubspot.com',
  },
};

// Group providers by connection type
export const PROVIDERS_BY_TYPE: Record<ConnectionType, IntegrationProvider[]> = {
  email: ['sendgrid', 'resend', 'mailgun'],
  sms: ['twilio'],
  phone: ['twilio', 'ringcentral', 'goto'],
  video: ['zoom', 'google_meet', 'microsoft_teams', 'goto_meeting'],
  calendar: ['google_calendar', 'microsoft_outlook'],
  chat: ['slack', 'whatsapp'],
  commerce: ['shopify', 'woocommerce', 'bigcommerce'],
  payments: ['stripe', 'square', 'authorize_net'],
  esign: ['docusign', 'pandadoc', 'hellosign'],
  crm_sync: ['zoho', 'salesforce', 'hubspot'],
};

// Connection type display info
export const CONNECTION_TYPE_INFO: Record<ConnectionType, { name: string; description: string; icon: string }> = {
  email: { name: 'Email', description: 'Send and sync emails', icon: 'mail' },
  sms: { name: 'SMS', description: 'Text messaging', icon: 'message-square' },
  phone: { name: 'Phone', description: 'Voice calls', icon: 'phone' },
  video: { name: 'Video', description: 'Video meetings', icon: 'video' },
  calendar: { name: 'Calendar', description: 'Calendar sync', icon: 'calendar' },
  chat: { name: 'Chat', description: 'Team messaging', icon: 'message-circle' },
  commerce: { name: 'Commerce', description: 'E-commerce', icon: 'shopping-bag' },
  payments: { name: 'Payments', description: 'Payment processing', icon: 'credit-card' },
  esign: { name: 'E-Sign', description: 'Electronic signatures', icon: 'pen-tool' },
  crm_sync: { name: 'CRM Sync', description: 'External CRM sync', icon: 'database' },
};
