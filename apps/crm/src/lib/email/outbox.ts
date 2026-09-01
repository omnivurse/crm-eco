import { createClient } from '@supabase/supabase-js';
import type { OutboxAttachmentMeta } from './outbound-attachments';

export const OUTBOX_STATUSES = [
  'queued',
  'leased',
  'provider_submitting',
  'provider_accepted',
  'sent',
  'failed',
  'cancelled',
  'dead_letter',
] as const;

export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export type OutboxPayload = {
  rfc822_message_id?: string;
  in_reply_to?: string | null;
  references?: string[];
  /** Durable storage locators; display-only metadata is never safe to retry. */
  attachments?: OutboxAttachmentMeta[];
  /** iTIP part for meeting invites — full ICS text so worker retries rebuild it byte-identically. */
  calendar?: { method: 'REQUEST' | 'CANCEL'; ics: string; filename?: string } | null;
  calendar_event_id?: string | null;
  unsubscribe_url?: string | null;
  conversation_id?: string | null;
  persist_inbox?: boolean;
  to_name?: string | null;
  email_type?: string;
  source?: string;
  campaign_id?: string;
  recipient_id?: string;
  sequence_id?: string;
  enrollment_id?: string;
  step_id?: string;
  tracking_id?: string;
};

export type EnqueueOutboxInput = {
  organizationId: string;
  idempotencyKey: string;
  senderAddress: string;
  fromName?: string | null;
  replyTo?: string | null;
  toAddresses: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  conversationId?: string | null;
  linkedContactId?: string | null;
  linkedLeadId?: string | null;
  linkedDealId?: string | null;
  createdBy?: string | null;
  payload?: OutboxPayload;
};

export type OutboxRow = {
  id: string;
  organization_id: string;
  idempotency_key: string;
  sender_address: string | null;
  from_name: string | null;
  reply_to: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  body_html: string | null;
  body_text: string | null;
  conversation_id: string | null;
  status: OutboxStatus;
  attempt_count: number;
  provider: string | null;
  provider_message_id: string | null;
  last_error: string | null;
  payload: OutboxPayload;
  linked_contact_id: string | null;
  linked_lead_id: string | null;
  linked_deal_id: string | null;
  updated_at: string;
};

type LooseClient = {
  from: (table: string) => any;
};

/**
 * Outbox mutations run as service role because live `is_staff_or_admin()`
 * omits `owner`. Isolation stays on the user JWT path; this client is only
 * for the command ledger after the caller has already authenticated and
 * supplied organization_id from the server-side profile.
 */
export function createOutboxAdminClient(): LooseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for the email outbox');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function classifyProviderError(status: number | null, message?: string): 'transient' | 'permanent' {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return 'transient';
  }
  const text = (message ?? '').toLowerCase();
  if (text.includes('timeout') || text.includes('temporar') || text.includes('rate limit')) {
    return 'transient';
  }
  return 'permanent';
}

export function nextAttemptAt(attemptCount: number, now = Date.now()): string {
  const delaysMs = [60_000, 300_000, 900_000];
  const delay = delaysMs[Math.min(attemptCount, delaysMs.length - 1)] ?? 900_000;
  return new Date(now + delay).toISOString();
}

export async function enqueueOutbox(
  supabase: LooseClient,
  input: EnqueueOutboxInput,
): Promise<{ row: OutboxRow; reused: boolean }> {
  const insert = {
    organization_id: input.organizationId,
    org_id: input.organizationId,
    idempotency_key: input.idempotencyKey,
    sender_address: input.senderAddress,
    from_name: input.fromName ?? null,
    reply_to: input.replyTo ?? null,
    to_addresses: input.toAddresses,
    cc_addresses: input.ccAddresses ?? [],
    bcc_addresses: input.bccAddresses ?? [],
    subject: input.subject,
    body_html: input.bodyHtml ?? null,
    body_text: input.bodyText ?? null,
    conversation_id: input.conversationId ?? null,
    linked_contact_id: input.linkedContactId ?? null,
    linked_lead_id: input.linkedLeadId ?? null,
    linked_deal_id: input.linkedDealId ?? null,
    created_by: input.createdBy ?? null,
    status: 'queued',
    payload: input.payload ?? {},
  };

  const { data, error } = await supabase
    .from('email_send_outbox')
    .insert(insert)
    .select('*')
    .single();

  if (!error && data) {
    return { row: data as OutboxRow, reused: false };
  }

  const isConflict =
    error?.code === '23505' ||
    String(error?.message ?? '').toLowerCase().includes('duplicate') ||
    String(error?.message ?? '').toLowerCase().includes('unique');

  if (!isConflict) {
    throw new Error(error?.message || 'Failed to enqueue email outbox');
  }

  const { data: existing, error: readError } = await supabase
    .from('email_send_outbox')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (readError || !existing) {
    throw new Error(readError?.message || 'Outbox idempotency conflict and existing row missing');
  }

  return { row: existing as OutboxRow, reused: true };
}

export async function markOutboxSubmitting(
  supabase: LooseClient,
  id: string,
  organizationId: string,
  provider?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('email_send_outbox')
    .update({
      status: 'provider_submitting',
      ...(provider ? { provider } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message || 'Failed to persist outbox submitting state');
  }
}

export async function markOutboxAccepted(
  supabase: LooseClient,
  id: string,
  organizationId: string,
  provider: string,
  providerMessageId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('email_send_outbox')
    .update({
      status: 'sent',
      provider,
      provider_message_id: providerMessageId,
      provider_accepted_at: now,
      last_error: null,
      error_category: null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message || 'Failed to persist provider acceptance');
  }
}

export async function markOutboxFailed(
  supabase: LooseClient,
  id: string,
  organizationId: string,
  error: string,
  category: 'transient' | 'permanent',
  attemptCount: number,
): Promise<void> {
  const dead = category === 'permanent' || attemptCount >= 3;
  await supabase
    .from('email_send_outbox')
    .update({
      status: dead ? 'dead_letter' : 'failed',
      last_error: error,
      error_category: category,
      attempt_count: attemptCount,
      next_attempt_at: dead ? new Date().toISOString() : nextAttemptAt(attemptCount),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', organizationId);
}

export async function claimOutboxBatch(
  supabase: LooseClient,
  limit = 25,
  workerId = 'outbox-worker',
): Promise<OutboxRow[]> {
  const now = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + 2 * 60_000).toISOString();
  // A stale lease is safe to reclaim because provider submission has not
  // started. A stale provider_submitting row is ambiguous and may be retried
  // automatically only for Resend, where the stable idempotency key prevents
  // a second delivery. SendGrid ambiguity requires manual reconciliation.
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();

  const [
    { data: readyCandidates },
    { data: staleLeasedCandidates },
    { data: staleResendCandidates },
  ] = await Promise.all([
    supabase
      .from('email_send_outbox')
      .select('*')
      .in('status', ['queued', 'failed'])
      .lte('next_attempt_at', now)
      .order('next_attempt_at', { ascending: true })
      .limit(limit),
    supabase
      .from('email_send_outbox')
      .select('*')
      .eq('status', 'leased')
      .lt('updated_at', staleBefore)
      .order('updated_at', { ascending: true })
      .limit(limit),
    supabase
      .from('email_send_outbox')
      .select('*')
      .eq('status', 'provider_submitting')
      .eq('provider', 'resend')
      .lt('updated_at', staleBefore)
      .order('updated_at', { ascending: true })
      .limit(limit),
  ]);

  const rows = [
    ...((readyCandidates ?? []) as OutboxRow[]),
    ...((staleLeasedCandidates ?? []) as OutboxRow[]),
    ...((staleResendCandidates ?? []) as OutboxRow[]),
  ].slice(0, limit);
  const claimed: OutboxRow[] = [];

  for (const row of rows) {
    const wasStale = row.status === 'leased' || row.status === 'provider_submitting';
    let query = supabase
      .from('email_send_outbox')
      .update({
        status: 'leased',
        leased_until: leaseUntil,
        leased_by: workerId,
        updated_at: now,
      })
      .eq('id', row.id)
      .in('status', wasStale ? ['leased', 'provider_submitting'] : ['queued', 'failed']);
    if (wasStale) {
      // Compare-and-swap on the timestamp so two workers reaping the same
      // stale row cannot both claim it, and a row that just made progress
      // (updated_at moved) is left alone.
      query = query.eq('updated_at', row.updated_at);
      if (row.status === 'provider_submitting') {
        query = query.eq('provider', 'resend');
      }
    }
    const { data } = await query.select('*').maybeSingle();
    if (data) claimed.push(data as OutboxRow);
  }

  return claimed;
}

export function outboxAlreadyAccepted(row: OutboxRow): boolean {
  return (row.status === 'sent' || row.status === 'provider_accepted') && Boolean(row.provider_message_id);
}
