import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { enqueueOutbox, createOutboxAdminClient } from '@/lib/email/outbox';
import { processEmailOutbox } from '@/lib/email/outbox-process';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { campaignTrackingId, injectCampaignTracking } from '@/lib/email/campaign-tracking';
import { generateRfc822MessageId, domainFromEmail } from '@/lib/email/rfc822';

const sendCampaignSchema = z.object({
  scheduled_at: z.string().datetime().optional(),
});

/**
 * POST /api/campaigns/[id]/send
 * Send or schedule a campaign
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Get user profile using cached utility
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const parsed = sendCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Get campaign
    const { data: campaign, error: fetchError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Validate campaign can be sent
    if (campaign.status === 'sent') {
      return NextResponse.json({ error: 'Campaign has already been sent' }, { status: 400 });
    }

    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Campaign is currently being sent' }, { status: 400 });
    }

    // Get recipient count
    const { count: recipientCount } = await supabase
      .from('email_campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id);

    if (!recipientCount || recipientCount === 0) {
      return NextResponse.json({ error: 'Campaign has no recipients' }, { status: 400 });
    }

    const isScheduled = !!parsed.data.scheduled_at;
    const scheduledAt = parsed.data.scheduled_at ? new Date(parsed.data.scheduled_at) : null;

    // Validate scheduled time is in the future
    if (scheduledAt && scheduledAt <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
    }

    if (isScheduled) {
      // Schedule the campaign
      const { data: updatedCampaign, error: updateError } = await supabase
        .from('email_campaigns')
        .update({
          status: 'scheduled',
          scheduled_at: scheduledAt!.toISOString(),
          total_recipients: recipientCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('org_id', profile.organization_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error scheduling campaign:', updateError);
        return NextResponse.json({ error: 'Failed to schedule campaign' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        campaign: updatedCampaign,
        message: `Campaign scheduled for ${scheduledAt!.toISOString()}`,
      });
    } else {
      // Send immediately - mark as sending. The table tracks send
      // lifecycle via `started_at` / `completed_at` (no `sent_at` column).
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({
          status: 'sending',
          started_at: new Date().toISOString(),
          total_recipients: recipientCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('org_id', profile.organization_id);

      if (updateError) {
        console.error('Error updating campaign status:', updateError);
        return NextResponse.json({ error: 'Failed to start campaign' }, { status: 500 });
      }

      // Trigger async email sending (in production, this would queue emails)
      // For now, we'll process in the background
      processCampaignEmails(supabase, campaign, profile.organization_id).catch((err) => {
        console.error('Error processing campaign emails:', err);
      });

      return NextResponse.json({
        success: true,
        message: 'Campaign sending started',
        total_recipients: recipientCount,
      });
    }
  } catch (error) {
    console.error('Error in POST /api/campaigns/[id]/send:', error);
    return NextResponse.json({ error: 'Failed to send campaign' }, { status: 500 });
  }
}

/**
 * Process campaign emails (runs asynchronously)
 * 
 * OPTIMIZED: Uses paginated batching to handle large campaigns.
 * Fetches recipients in pages of MAX_RECIPIENTS_PER_BATCH to avoid
 * loading all recipients into memory at once.
 */
async function processCampaignEmails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaign: Record<string, unknown>,
  orgId: string
) {
  const campaignId = campaign.id as string;
  
  // Maximum recipients to process per batch to prevent memory issues
  const MAX_RECIPIENTS_PER_BATCH = 500;

  try {
    // Track totals across all batches
    let totalSent = 0;
    let totalFailed = 0;
    let offset = 0;
    let hasMore = true;

    // Process recipients in paginated batches
    while (hasMore) {
      // Fetch next batch of recipients with limit
      const { data: recipients, error: recipientError } = await supabase
        .from('email_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('id', { ascending: true })
        .range(offset, offset + MAX_RECIPIENTS_PER_BATCH - 1);

      if (recipientError) {
        throw new Error('Failed to fetch recipients');
      }

      if (!recipients || recipients.length === 0) {
        hasMore = false;
        break;
      }

      // Check if we've fetched less than the batch size (last page)
      hasMore = recipients.length === MAX_RECIPIENTS_PER_BATCH;
      offset += recipients.length;

      // Process this batch of recipients
      const BATCH_SIZE = 50;
      const sentIds: string[] = [];
      const failedRecipients: { id: string; error: string }[] = [];

      // Process recipients in smaller parallel batches with throttle delay
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        // Throttle between batches to avoid provider rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        const batch = recipients.slice(i, i + BATCH_SIZE);

        // Send emails in parallel for this batch
        const results = await Promise.allSettled(
          batch.map(async (recipient) => {
            const success = await enqueueCampaignEmail(supabase, campaign, recipient, orgId);
            return { id: recipient.id as string, success };
          })
        );
        
        // Collect results
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            sentIds.push(result.value.id);
            totalSent++;
          } else {
            const id = result.status === 'fulfilled' ? result.value.id : '';
            const error = result.status === 'rejected' 
              ? (result.reason instanceof Error ? result.reason.message : 'Unknown error')
              : 'Failed to send email';
            if (id) failedRecipients.push({ id, error });
            totalFailed++;
          }
        }
        
        // Batch update sent recipients
        if (sentIds.length > 0) {
          await supabase
            .from('email_campaign_recipients')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .in('id', sentIds);
          sentIds.length = 0; // Clear for next batch
        }
        
        // Batch update failed recipients
        if (failedRecipients.length > 0) {
          const failedIds = failedRecipients.map(r => r.id);
          await supabase
            .from('email_campaign_recipients')
            .update({
              status: 'failed',
              error_message: 'Failed to send email',
            })
            .in('id', failedIds);
          failedRecipients.length = 0; // Clear for next batch
        }
      }
    } // End of while loop

    const service = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return []; }, setAll() {} } },
    );
    for (let i = 0; i < 20; i += 1) {
      const processed = await processEmailOutbox(service, 50);
      if (processed.claimed === 0) break;
    }

    // Update campaign with final stats
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sent',
        sent_count: totalSent,
        failed_count: totalFailed,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .eq('org_id', orgId);

  } catch (error) {
    console.error('Error processing campaign emails:', error);

    // Mark campaign as failed
    await supabase
      .from('email_campaigns')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .eq('org_id', orgId);
  }
}

async function enqueueCampaignEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
  const html = injectCampaignTracking(
    (campaign.body_html as string) || '',
    origin,
    trackingId,
  );
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
