import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { COMMS_FLAGS, isCommsFlagEnabled } from '@/lib/email/comms-flags';
import { processEmailOutbox } from '@/lib/email/outbox-process';
import {
  processCampaignEmails,
  enqueueCampaignEmail,
  createOutboxProcessorClient,
} from '@/lib/email/campaign-send';

const sendCampaignSchema = z.object({
  scheduled_at: z.string().datetime().optional(),
  /** Sends a single copy to this address instead of the recipient list. */
  test_email: z.string().email().optional(),
});

/**
 * POST /api/campaigns/[id]/send
 * Send, schedule, or test-send a campaign.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = sendCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { data: campaign, error: fetchError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // The org-wide stop applies to everything, test sends included.
    const killed = await isCommsFlagEnabled(
      supabase,
      COMMS_FLAGS.killSwitch,
      profile.organization_id,
      false,
    );
    if (killed) {
      return NextResponse.json(
        { error: 'Outbound email is disabled by the comms kill switch' },
        { status: 503 },
      );
    }

    // ---------------------------------------------------------------- test send
    // Deliberately ahead of the bulk gate: proving one email renders and lands
    // is how you earn the right to turn bulk on.
    if (parsed.data.test_email) {
      const ok = await enqueueCampaignEmail(
        supabase,
        campaign,
        { id: `test-${Date.now()}`, email: parsed.data.test_email },
        profile.organization_id,
      );

      if (!ok) {
        return NextResponse.json(
          { error: 'Test send was suppressed or the campaign has no from address' },
          { status: 400 },
        );
      }

      await processEmailOutbox(createOutboxProcessorClient(), 5);

      return NextResponse.json({
        success: true,
        test: true,
        message: `Test email sent to ${parsed.data.test_email}`,
      });
    }

    if (campaign.status === 'sent') {
      return NextResponse.json({ error: 'Campaign has already been sent' }, { status: 400 });
    }

    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Campaign is currently being sent' }, { status: 400 });
    }

    const { count: recipientCount } = await supabase
      .from('email_campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', id);

    if (!recipientCount || recipientCount === 0) {
      return NextResponse.json({ error: 'Campaign has no recipients' }, { status: 400 });
    }

    // ---------------------------------------------------------------- bulk gate
    // Fails closed. Campaigns have never sent from this system, so bulk delivery
    // stays off until someone enables the flag deliberately.
    const bulkAllowed = await isCommsFlagEnabled(
      supabase,
      COMMS_FLAGS.campaignSend,
      profile.organization_id,
      false,
    );
    if (!bulkAllowed) {
      return NextResponse.json(
        {
          error: 'Bulk campaign sending is disabled',
          detail:
            `Send a test first with { "test_email": "you@example.com" }. To enable bulk delivery, ` +
            `set the ${COMMS_FLAGS.campaignSend} feature flag for this organization.`,
          recipients: recipientCount,
        },
        { status: 503 },
      );
    }

    const isScheduled = !!parsed.data.scheduled_at;
    const scheduledAt = parsed.data.scheduled_at ? new Date(parsed.data.scheduled_at) : null;

    if (scheduledAt && scheduledAt <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
    }

    if (isScheduled) {
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
    }

    // Send immediately. The table tracks lifecycle via started_at/completed_at.
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

    processCampaignEmails(supabase, campaign, profile.organization_id).catch((err) => {
      console.error('Error processing campaign emails:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Campaign sending started',
      total_recipients: recipientCount,
    });
  } catch (error) {
    console.error('Error in POST /api/campaigns/[id]/send:', error);
    return NextResponse.json({ error: 'Failed to send campaign' }, { status: 500 });
  }
}
