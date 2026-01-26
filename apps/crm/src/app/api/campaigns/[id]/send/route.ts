import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

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

    // Get user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
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
      // Send immediately - mark as sending
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({
          status: 'sending',
          sent_at: new Date().toISOString(),
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
 */
async function processCampaignEmails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaign: Record<string, unknown>,
  orgId: string
) {
  const campaignId = campaign.id as string;

  try {
    // Get all recipients
    const { data: recipients, error: recipientError } = await supabase
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    if (recipientError || !recipients) {
      throw new Error('Failed to fetch recipients');
    }

    let sentCount = 0;
    let failedCount = 0;

    // Process each recipient
    for (const recipient of recipients) {
      try {
        // In production, this would use the email service to send
        // For now, we'll simulate sending and update status
        const success = await sendCampaignEmail(campaign, recipient);

        if (success) {
          await supabase
            .from('email_campaign_recipients')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            .eq('id', recipient.id);
          sentCount++;
        } else {
          await supabase
            .from('email_campaign_recipients')
            .update({
              status: 'failed',
              error_message: 'Failed to send email',
            })
            .eq('id', recipient.id);
          failedCount++;
        }
      } catch (err) {
        await supabase
          .from('email_campaign_recipients')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('id', recipient.id);
        failedCount++;
      }
    }

    // Update campaign with final stats
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sent',
        sent_count: sentCount,
        failed_count: failedCount,
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

/**
 * Send a single campaign email
 * In production, this would use the configured email provider
 */
async function sendCampaignEmail(
  campaign: Record<string, unknown>,
  recipient: Record<string, unknown>
): Promise<boolean> {
  // TODO: Integrate with email service (Resend, SendGrid, etc.)
  // For now, simulate a successful send
  const email = recipient.email as string;

  if (!email) {
    return false;
  }

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // In production, call the email provider here
  // const result = await emailService.send({
  //   to: email,
  //   from: campaign.from_email,
  //   subject: campaign.subject,
  //   html: campaign.body_html,
  //   text: campaign.body_text,
  // });

  console.log(`[Campaign ${campaign.id}] Sent email to ${email}`);
  return true;
}
