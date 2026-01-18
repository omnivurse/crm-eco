/**
 * Base Adapter Interfaces
 * Defines contracts for all integration adapters by category
 */

// ============================================================================
// Core Types
// ============================================================================

export interface IntegrationConnection {
  id: string;
  org_id: string;
  provider: string;
  connection_type: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending' | 'expired';
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  api_key_enc: string | null;
  api_secret_enc: string | null;
  settings: Record<string, unknown>;
  external_account_id: string | null;
  external_account_email: string | null;
  external_account_name: string | null;
  scopes: string[] | null;
}

export interface AdapterConfig {
  connection: IntegrationConnection;
  accessToken?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface TestResult {
  success: boolean;
  message: string;
  durationMs?: number;
  accountInfo?: {
    id?: string;
    email?: string;
    name?: string;
  };
}

export type ProviderCapability =
  | 'send_email'
  | 'receive_email'
  | 'send_sms'
  | 'receive_sms'
  | 'make_call'
  | 'receive_call'
  | 'create_meeting'
  | 'calendar_read'
  | 'calendar_write'
  | 'create_payment'
  | 'refund_payment'
  | 'create_subscription'
  | 'create_envelope'
  | 'get_signing_url'
  | 'sync_contacts'
  | 'sync_deals'
  | 'push_contacts'
  | 'push_deals'
  | 'send_message'
  | 'receive_webhook'
  | 'file_upload'
  | 'file_download';

// ============================================================================
// Base Provider Adapter
// ============================================================================

export interface BaseProviderAdapter {
  readonly providerId: string;
  readonly providerName: string;
  readonly authType: 'oauth' | 'api_key' | 'both';

  /**
   * Initialize adapter with connection details
   */
  initialize(config: AdapterConfig): void;

  /**
   * Test if the connection is valid and working
   */
  testConnection(): Promise<TestResult>;

  /**
   * Get list of capabilities this adapter supports
   */
  getCapabilities(): ProviderCapability[];

  /**
   * Validate configuration before connecting
   */
  validateConfig(config: Record<string, unknown>): ValidationResult;
}

// ============================================================================
// Email Adapter
// ============================================================================

export interface SendEmailParams {
  to: string | string[];
  from?: string;
  fromName?: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded
    contentType?: string;
  }>;
  headers?: Record<string, string>;
  tags?: string[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject?: string;
}

export interface EmailAdapter extends BaseProviderAdapter {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
  getTemplates?(): Promise<EmailTemplate[]>;
  validateEmail?(email: string): Promise<{ valid: boolean; reason?: string }>;
}

// ============================================================================
// SMS Adapter
// ============================================================================

export interface SendSmsParams {
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsAdapter extends BaseProviderAdapter {
  sendSms(params: SendSmsParams): Promise<SendSmsResult>;
  getAccountBalance?(): Promise<{ balance: number; currency: string }>;
}

// ============================================================================
// Video/Meeting Adapter
// ============================================================================

export interface CreateMeetingParams {
  topic: string;
  startTime: Date;
  duration: number; // in minutes
  timezone?: string;
  password?: string;
  hostEmail?: string;
  attendees?: string[];
  settings?: {
    joinBeforeHost?: boolean;
    muteUponEntry?: boolean;
    waitingRoom?: boolean;
    autoRecording?: 'none' | 'local' | 'cloud';
  };
}

export interface Meeting {
  id: string;
  topic: string;
  startTime: Date;
  duration: number;
  joinUrl: string;
  hostUrl?: string;
  password?: string;
  status: 'waiting' | 'started' | 'ended';
}

export interface VideoAdapter extends BaseProviderAdapter {
  createMeeting(params: CreateMeetingParams): Promise<Meeting>;
  getMeeting(meetingId: string): Promise<Meeting | null>;
  updateMeeting(meetingId: string, updates: Partial<CreateMeetingParams>): Promise<Meeting>;
  deleteMeeting(meetingId: string): Promise<{ success: boolean }>;
  listMeetings?(startDate?: Date, endDate?: Date): Promise<Meeting[]>;
}

// ============================================================================
// Calendar Adapter
// ============================================================================

export interface Calendar {
  id: string;
  name: string;
  isPrimary?: boolean;
  color?: string;
  accessRole?: 'owner' | 'writer' | 'reader';
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  attendees?: Array<{
    email: string;
    name?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  conferenceData?: {
    type: 'zoom' | 'google_meet' | 'microsoft_teams';
    joinUrl: string;
  };
  recurrence?: string[];
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CreateEventParams {
  calendarId?: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  attendees?: string[];
  addConference?: boolean;
  sendNotifications?: boolean;
}

export interface CalendarAdapter extends BaseProviderAdapter {
  listCalendars(): Promise<Calendar[]>;
  getEvents(calendarId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  createEvent(params: CreateEventParams): Promise<CalendarEvent>;
  updateEvent(eventId: string, updates: Partial<CreateEventParams>): Promise<CalendarEvent>;
  deleteEvent(eventId: string, calendarId?: string): Promise<{ success: boolean }>;
  getFreeBusy?(emails: string[], startDate: Date, endDate: Date): Promise<Record<string, Array<{ start: Date; end: Date }>>>;
}

// ============================================================================
// Payment Adapter
// ============================================================================

export interface Customer {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'processing' | 'succeeded' | 'canceled' | 'requires_action';
  clientSecret?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
  paymentMethodTypes?: string[];
}

export interface Subscription {
  id: string;
  customerId: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  priceId: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionParams {
  customerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface PaymentAdapter extends BaseProviderAdapter {
  createCustomer(params: CreateCustomerParams): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;
  updateCustomer(customerId: string, updates: Partial<CreateCustomerParams>): Promise<Customer>;

  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>;
  getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null>;
  cancelPaymentIntent(paymentIntentId: string): Promise<{ success: boolean }>;

  createSubscription?(params: CreateSubscriptionParams): Promise<Subscription>;
  cancelSubscription?(subscriptionId: string, immediately?: boolean): Promise<{ success: boolean }>;
  getSubscription?(subscriptionId: string): Promise<Subscription | null>;

  refund?(paymentIntentId: string, amount?: number): Promise<{ success: boolean; refundId: string }>;
}

// ============================================================================
// E-Signature Adapter
// ============================================================================

export interface EnvelopeRecipient {
  email: string;
  name: string;
  role?: string;
  order?: number;
}

export interface CreateEnvelopeParams {
  templateId?: string;
  subject: string;
  message?: string;
  recipients: EnvelopeRecipient[];
  documents?: Array<{
    name: string;
    content: string; // Base64 encoded
    fileExtension?: string;
  }>;
  status?: 'created' | 'sent';
}

export interface Envelope {
  id: string;
  status: 'created' | 'sent' | 'delivered' | 'completed' | 'declined' | 'voided';
  subject: string;
  createdAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  recipients: Array<{
    email: string;
    name: string;
    status: 'created' | 'sent' | 'delivered' | 'signed' | 'declined';
    signedAt?: Date;
  }>;
}

export interface ESignTemplate {
  id: string;
  name: string;
  description?: string;
  roles: string[];
}

export interface ESignAdapter extends BaseProviderAdapter {
  createEnvelope(params: CreateEnvelopeParams): Promise<Envelope>;
  getEnvelope(envelopeId: string): Promise<Envelope | null>;
  voidEnvelope(envelopeId: string, reason?: string): Promise<{ success: boolean }>;
  getSigningUrl(envelopeId: string, recipientEmail: string, returnUrl?: string): Promise<string>;
  listTemplates(): Promise<ESignTemplate[]>;
  downloadDocument?(envelopeId: string): Promise<{ content: string; filename: string }>;
}

// ============================================================================
// CRM Sync Adapter
// ============================================================================

export interface ExternalContact {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  title?: string;
  customFields?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExternalDeal {
  id: string;
  name: string;
  amount?: number;
  stage?: string;
  closeDate?: Date;
  contactId?: string;
  ownerId?: string;
  customFields?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SyncResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
  syncedAt: Date;
}

export interface PushResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface CRMSyncAdapter extends BaseProviderAdapter {
  syncContacts(cursor?: string, limit?: number): Promise<SyncResult<ExternalContact>>;
  syncDeals?(cursor?: string, limit?: number): Promise<SyncResult<ExternalDeal>>;
  pushContact(contact: Partial<ExternalContact>): Promise<PushResult>;
  pushDeal?(deal: Partial<ExternalDeal>): Promise<PushResult>;
  getContact?(externalId: string): Promise<ExternalContact | null>;
  getDeal?(externalId: string): Promise<ExternalDeal | null>;
}

// ============================================================================
// Chat/Messaging Adapter
// ============================================================================

export interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private' | 'direct';
  memberCount?: number;
}

export interface SendMessageParams {
  channelId: string;
  text: string;
  blocks?: unknown[]; // Platform-specific block format
  threadTs?: string;
  attachments?: Array<{
    title?: string;
    text?: string;
    color?: string;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
  }>;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  timestamp?: string;
  error?: string;
}

export interface ChatAdapter extends BaseProviderAdapter {
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
  listChannels?(): Promise<Channel[]>;
  getChannel?(channelId: string): Promise<Channel | null>;
  postToWebhook?(webhookUrl: string, message: SendMessageParams): Promise<SendMessageResult>;
}

// ============================================================================
// Storage Adapter
// ============================================================================

export interface StorageFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  path?: string;
  webViewLink?: string;
  downloadLink?: string;
  createdAt?: Date;
  modifiedAt?: Date;
}

export interface StorageFolder {
  id: string;
  name: string;
  path?: string;
}

export interface UploadFileParams {
  name: string;
  content: string; // Base64 encoded
  mimeType?: string;
  folderId?: string;
}

export interface StorageAdapter extends BaseProviderAdapter {
  listFiles(folderId?: string): Promise<StorageFile[]>;
  listFolders(parentId?: string): Promise<StorageFolder[]>;
  uploadFile(params: UploadFileParams): Promise<StorageFile>;
  downloadFile(fileId: string): Promise<{ content: string; filename: string; mimeType?: string }>;
  deleteFile(fileId: string): Promise<{ success: boolean }>;
  createFolder?(name: string, parentId?: string): Promise<StorageFolder>;
  getShareLink?(fileId: string): Promise<string>;
}

// ============================================================================
// Webhook Handler Interface
// ============================================================================

export interface WebhookEvent {
  provider: string;
  eventType: string;
  payload: unknown;
  signature?: string;
  timestamp?: Date;
}

export interface WebhookHandlerResult {
  success: boolean;
  eventType: string;
  entityType?: string;
  entityId?: string;
  message?: string;
  error?: string;
}

export interface WebhookHandler {
  verifySignature(payload: string, signature: string, secret: string): boolean;
  parseEvent(rawPayload: string, headers: Record<string, string>): WebhookEvent;
  handleEvent(event: WebhookEvent): Promise<WebhookHandlerResult>;
}
