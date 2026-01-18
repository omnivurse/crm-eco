/**
 * Adapter Registry
 * Central factory for getting provider adapters
 */

import type {
  BaseProviderAdapter,
  EmailAdapter,
  SmsAdapter,
  VideoAdapter,
  CalendarAdapter,
  PaymentAdapter,
  ESignAdapter,
  CRMSyncAdapter,
  ChatAdapter,
  StorageAdapter,
  AdapterConfig,
  IntegrationConnection,
} from './base';

// ============================================================================
// Adapter Type Registry
// ============================================================================

type AdapterType =
  | 'email'
  | 'sms'
  | 'video'
  | 'calendar'
  | 'payment'
  | 'esign'
  | 'crm_sync'
  | 'chat'
  | 'storage';

type AdapterFactory<T extends BaseProviderAdapter> = () => T;

// Map of provider ID to adapter factory
const adapterFactories = new Map<string, AdapterFactory<BaseProviderAdapter>>();

// Map of provider ID to adapter type
const adapterTypes = new Map<string, AdapterType>();

// ============================================================================
// Registration Functions
// ============================================================================

/**
 * Register an adapter factory
 */
export function registerAdapter<T extends BaseProviderAdapter>(
  providerId: string,
  adapterType: AdapterType,
  factory: AdapterFactory<T>
): void {
  adapterFactories.set(providerId, factory as AdapterFactory<BaseProviderAdapter>);
  adapterTypes.set(providerId, adapterType);
}

/**
 * Check if an adapter is registered for a provider
 */
export function hasAdapter(providerId: string): boolean {
  return adapterFactories.has(providerId);
}

/**
 * Get the adapter type for a provider
 */
export function getAdapterType(providerId: string): AdapterType | undefined {
  return adapterTypes.get(providerId);
}

/**
 * Get list of all registered providers
 */
export function getRegisteredProviders(): string[] {
  return Array.from(adapterFactories.keys());
}

/**
 * Get providers by adapter type
 */
export function getProvidersByType(type: AdapterType): string[] {
  const providers: string[] = [];
  adapterTypes.forEach((adapterType, providerId) => {
    if (adapterType === type) {
      providers.push(providerId);
    }
  });
  return providers;
}

// ============================================================================
// Adapter Retrieval
// ============================================================================

/**
 * Get an adapter instance for a provider
 */
export function getAdapter(providerId: string): BaseProviderAdapter | null {
  const factory = adapterFactories.get(providerId);
  if (!factory) {
    return null;
  }
  return factory();
}

/**
 * Get an initialized adapter for a connection
 */
export function getInitializedAdapter(
  connection: IntegrationConnection,
  decryptedCredentials: { accessToken?: string; apiKey?: string; apiSecret?: string }
): BaseProviderAdapter | null {
  const adapter = getAdapter(connection.provider);
  if (!adapter) {
    return null;
  }

  const config: AdapterConfig = {
    connection,
    accessToken: decryptedCredentials.accessToken,
    apiKey: decryptedCredentials.apiKey,
    apiSecret: decryptedCredentials.apiSecret,
  };

  adapter.initialize(config);
  return adapter;
}

/**
 * Type-safe adapter getters
 */
export function getEmailAdapter(providerId: string): EmailAdapter | null {
  const type = adapterTypes.get(providerId);
  if (type !== 'email') {
    return null;
  }
  return getAdapter(providerId) as EmailAdapter | null;
}

export function getSmsAdapter(providerId: string): SmsAdapter | null {
  const type = adapterTypes.get(providerId);
  if (type !== 'sms') {
    return null;
  }
  return getAdapter(providerId) as SmsAdapter | null;
}

export function getVideoAdapter(providerId: string): VideoAdapter | null {
  const type = adapterTypes.get(providerId);
  if (type !== 'video') {
    return null;
  }
  return getAdapter(providerId) as VideoAdapter | null;
}

export function getCalendarAdapter(providerId: string): CalendarAdapter | null {
  const type = adapterTypes.get(providerId);
  if (type !== 'calendar') {
    return null;
  }
  return getAdapter(providerId) as CalendarAdapter | null;
}

export function getPaymentAdapter(providerId: string): PaymentAdapter | null {
  const type = adapterTypes.get(providerId);
  if (type !== 'payment') {
    return null;
  }
  return getAdapter(providerId) as PaymentAdapter | null;
}

export function getESignAdapter(providerId: string): ESignAdapter | null {
  const type = adapterTypes.get(providerId);
  if (type !== 'esign') {
    return null;
  }
  return getAdapter(providerId) as ESignAdapter | null;
}

export function getCRMSyncAdapter(providerId: string): CRMSyncAdapter | null {
  const type = adapterTypes.get(providerId);
  if (type !== 'crm_sync') {
    return null;
  }
  return getAdapter(providerId) as CRMSyncAdapter | null;
}

export function getChatAdapter(providerId: string): ChatAdapter | null {
  const type = adapterTypes.get(providerId);
  if (type !== 'chat') {
    return null;
  }
  return getAdapter(providerId) as ChatAdapter | null;
}

export function getStorageAdapter(providerId: string): StorageAdapter | null {
  const type = adapterTypes.get(providerId);
  if (type !== 'storage') {
    return null;
  }
  return getAdapter(providerId) as StorageAdapter | null;
}

// ============================================================================
// Auto-registration of adapters
// ============================================================================

// This will be populated as adapters are implemented
// Each adapter file should call registerAdapter when imported

// Example registration (to be done in each adapter file):
// registerAdapter('sendgrid', 'email', () => new SendGridAdapter());
// registerAdapter('stripe', 'payment', () => new StripeAdapter());
// registerAdapter('zoom', 'video', () => new ZoomAdapter());

// For now, we'll define placeholder registrations that will be replaced
// when actual adapters are implemented

const PLANNED_ADAPTERS: Array<{ providerId: string; type: AdapterType }> = [
  // Email
  { providerId: 'sendgrid', type: 'email' },
  { providerId: 'resend', type: 'email' },
  { providerId: 'mailgun', type: 'email' },

  // SMS
  { providerId: 'twilio', type: 'sms' },

  // Video
  { providerId: 'zoom', type: 'video' },
  { providerId: 'google_meet', type: 'video' },
  { providerId: 'microsoft_teams', type: 'video' },

  // Calendar
  { providerId: 'google_calendar', type: 'calendar' },
  { providerId: 'microsoft_outlook', type: 'calendar' },

  // Payment
  { providerId: 'stripe', type: 'payment' },
  { providerId: 'square', type: 'payment' },

  // E-Sign
  { providerId: 'docusign', type: 'esign' },
  { providerId: 'pandadoc', type: 'esign' },

  // CRM Sync
  { providerId: 'salesforce', type: 'crm_sync' },
  { providerId: 'hubspot', type: 'crm_sync' },
  { providerId: 'zoho', type: 'crm_sync' },

  // Chat
  { providerId: 'slack', type: 'chat' },

  // Storage
  { providerId: 'google_drive', type: 'storage' },
  { providerId: 'dropbox', type: 'storage' },
  { providerId: 'onedrive', type: 'storage' },
];

// Register planned adapter types (factories will be added as adapters are built)
PLANNED_ADAPTERS.forEach(({ providerId, type }) => {
  adapterTypes.set(providerId, type);
});

// ============================================================================
// Register Implemented Adapters
// ============================================================================

// Calendar Adapters
import { GoogleCalendarAdapter } from './calendar/google-calendar';
import { MicrosoftOutlookAdapter } from './calendar/microsoft-outlook';

registerAdapter('google_calendar', 'calendar', () => new GoogleCalendarAdapter());
registerAdapter('microsoft_outlook', 'calendar', () => new MicrosoftOutlookAdapter());

export { PLANNED_ADAPTERS };
