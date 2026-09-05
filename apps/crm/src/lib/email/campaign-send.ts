import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { enqueueOutbox, createOutboxAdminClient } from '@/lib/email/outbox';
import { processEmailOutbox } from '@/lib/email/outbox-process';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { campaignTrackingId, injectCampaignTracking } from '@/lib/email/campaign-tracking';
import { generateRfc822MessageId, domainFromEmail } from '@/lib/email/rfc822';

/**
 * Campaign send engine, shared by POST /api/campaigns/[id]/send and the
 * scheduled-campaign cron. It lived inside the route handler, which meant the
 * cron had no way to reach it without duplicating the batching, suppression and
 * idempotency logic.
 */

/** Structural type so both a request-scoped client and a service-role client fit. */
type LooseClient = {
  from: (table: string) => any;
};

/** Recipients pulled per page. Keeps large campaigns off the heap. */
const MAX_RECIPIENTS_PER_BATCH = 500;
/** Recipients enqueued in parallel inside a page. */
const BATCH_SIZE = 50;
/** Pause between parallel batches so the provider is not hammered. */
const THROTTLE_MS = 200;

/**
 * The outbox processor reaches into Storage to attach files, so it needs a full
 * client rather than the narrow `from`-only shape used elsewhere here.
 */
export function createOutboxProcessorClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to process the email outbox');
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface CampaignSendResult {
  sent: number;
  failed: number;
  /** Set when the operator paused or cancelled the campaign mid-run. */
  haltedBy?: 'paused' | 'cancelled';
}

/**
 * `email_campaigns.status` is constrained to
 * draft/scheduled/sending/paused/sent/cancelled/failed. Anything outside that
 * set is rejected by the CHECK, which previously left a broken campaign parked
 * in `sending` forever because the failure write was silently discarded.
 */
async function setCampaignStatus(
  supabase: LooseClient,
  campaignId: string,
  orgId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('email_campaigns')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('org_id', orgId);

  if (error) {
    // Loud on purpose: a swallowed error here is what hid the stuck-in-sending bug.
    console.error(`[campaign-send] failed to update campaign ${campaignId}:`, error);
  }
}

/** Reads the live status so a pause taken mid-send is actually honoured. */
async function currentStatus(
  supabase: LooseClient,
  campaignId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('email_campaigns')
    .select('status')
    .eq('id', campaignId)
    .maybeSingle();
  return (data?.status as string) ?? null;
}

export async function processCampaignEmails(
  supabase: LooseClient,
  campaign: Record<string, unknown>,
  orgId: string,
): Promise<CampaignSendResult> {
  const campaignId = campaign.id as string;

  try {
    let totalSent = 0;
    let totalFailed = 0;
    let offset = 0;
    let hasMore = true;
    let haltedBy: 'paused' | 'cancelled' | undefined;

    while (hasMore && !haltedBy) {
      const { data: recipients, error: recipientError } = await supabase
        .from('email_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('id', { ascending: true })
        .range(offset, offset + MAX_RECIPIENTS_PER_BATCH - 1);

      if (recipientError) throw new Error('Failed to fetch recipients');
      if (!recipients || recipients.length === 0) break;

      hasMore = recipients.length === MAX_RECIPIENTS_PER_BATCH;
      offset += recipients.length;

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        // Check between batches so Pause stops the run rather than only
        // relabelling a campaign that keeps sending.
        const live = await currentStatus(supabase, campaignId);
        if (live === 'paused' || live === 'cancelled') {
          haltedBy = live;
          break;
        }

        if (i > 0) await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS));
        const batch = recipients.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (recipient: Record<string, unknown>) => {
            const success = await enqueueCampaignEmail(supabase, campaign, recipient, orgId);
            return { id: recipient.id as string, success };
          }),
        );

        const sentIds: string[] = [];
        const failedIds: string[] = [];

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            sentIds.push(result.value.id);
            totalSent++;
          } else {
            const id = result.status === 'fulfilled' ? result.value.id : '';
            if (id) failedIds.push(id);
            totalFailed++;
          }
        }

        if (sentIds.length > 0) {
          await supabase
            .from('email_campaign_recipients')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .in('id', sentIds);
        }

        if (failedIds.length > 0) {
          await supabase
            .from('email_campaign_recipients')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              error_message: 'Failed to enqueue email',
            })
            .in('id', failedIds);
        }
      }
    }

    // Drain what we just queued. The every-minute outbox cron would get there
    // anyway; this makes an interactive send feel immediate.
    const service = createOutboxProcessorClient();
    for (let i = 0; i < 20; i += 1) {
      const processed = await processEmailOutbox(service, 50);
      if (processed.claimed === 0) break;
    }

    if (haltedBy) {
      await setCampaignStatus(supabase, campaignId, orgId, {
        sent_count: totalSent,
        failed_count: totalFailed,
      });
      return { sent: totalSent, failed: totalFailed, haltedBy };
    }

    await setCampaignStatus(supabase, campaignId, orgId, {
      status: 'sent',
      sent_count: totalSent,
      failed_count: totalFailed,
      completed_at: new Date().toISOString(),
    });

    return { sent: totalSent, failed: totalFailed };
  } catch (error) {
    await setCampaignStatus(supabase, campaignId, orgId, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

export async function enqueueCampaignEmail(
  supabase: LooseClient,
  campaign: Record<string, unknown>,
  recipient: Record<string, unknown>,
  orgId: string,
): Promise<boolean> {
  const email = recipient.email as string;
  if (!email) return false;

  const suppressed = await isEmailSuppressed(async (addr) => {
    const { data } = await supabase
      .from('email_unsubscribes')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', addr)
      .maybeSingle();
    return Boolean(data);
  }, email);
  if (suppressed) return false;

  const fromEmail = (campaign.from_email as string) || process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.error('RESEND_FROM_EMAIL environment variable is required');
    return false;
  }
  const fromName = (campaign.from_name as string) || process.env.RESEND_FROM_NAME || 'Double Helix Hub';
  const trackingId = campaignTrackingId(String(campaign.id), String(recipient.id));
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://crm.doublehelixhub.com');
  const html = injectCampaignTracking((campaign.body_html as string) || '', origin, trackingId);
  const rfc822MessageId = generateRfc822MessageId(domainFromEmail(fromEmail));

  await enqueueOutbox(createOutboxAdminClient(), {
    organizationId: orgId,
    idempotencyKey: `campaign/${campaign.id}/${recipient.id}`,
    senderAddress: fromEmail,
    fromName,
    toAddresses: [email],
    subject: (campaign.subject as string) || 'No Subject',
    bodyHtml: html,
    bodyText: (campaign.body_text as string) || undefined,
    payload: {
      rfc822_message_id: rfc822MessageId,
      persist_inbox: false,
      email_type: 'campaign',
      source: 'campaign',
      campaign_id: String(campaign.id),
      recipient_id: String(recipient.id),
      tracking_id: trackingId,
    },
  });
  return true;
}
