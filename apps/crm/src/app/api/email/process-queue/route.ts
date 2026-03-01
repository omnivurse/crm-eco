import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Resend } from 'resend';
import { timingSafeEqual } from 'crypto';

function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}

const BATCH_SIZE = 50;

// Warn at startup if CRON_SECRET is missing — all cron-triggered processing will fail
if (!process.env.CRON_SECRET) {
  console.warn('[email/process-queue] CRON_SECRET is not set — cron requests will be rejected');
}

/**
 * POST /api/email/process-queue
 * Process pending email notifications from the notification_queue table.
 * Should be called by a cron job (e.g., every minute).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[email/process-queue] CRON_SECRET env var is not configured — rejecting request');
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    const expected = Buffer.from(`Bearer ${cronSecret}`);
    const actual = Buffer.from(authHeader);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;
    const resend = new Resend(apiKey);

    // Recover stale 'sending' items that were orphaned by a crashed worker.
    // If an item has been in 'sending' for > 5 minutes, it's stuck — reset to 'pending'.
    await supabase
      .from('notification_queue')
      .update({ status: 'pending' })
      .eq('status', 'sending')
      .lt('updated_at', new Date(Date.now() - 5 * 60_000).toISOString());

    // Atomically claim pending emails using FOR UPDATE SKIP LOCKED
    // This prevents duplicate sends when multiple cron workers run concurrently
    const { data: queuedEmails, error: fetchError } = await supabase
      .rpc('claim_pending_emails', { batch_size: BATCH_SIZE });

    if (fetchError) {
      console.error('Error claiming notification queue:', fetchError);
      return NextResponse.json(
        { error: 'Failed to claim queue items' },
        { status: 500 }
      );
    }

    if (!queuedEmails || queuedEmails.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        sent: 0,
        failed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    let sent = 0;
    let failed = 0;

    for (const item of queuedEmails) {
      // attempts already incremented by claim_pending_emails RPC
      const attempts = item.attempts || 1;

      try {
        const meta = item.metadata || {};
        const fromEmail = meta.from_email || process.env.RESEND_FROM_EMAIL;
        if (!fromEmail) {
          throw new Error('RESEND_FROM_EMAIL environment variable is required');
        }
        const fromName = meta.from_name || process.env.RESEND_FROM_NAME || 'Pay It Forward Health';
        const toEmail = item.email_address;

        if (!toEmail) {
          throw new Error('No recipient email address');
        }

        const { data: sendResult, error: sendError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [toEmail],
          subject: item.subject || 'Notification',
          html: item.body_html || item.body || '',
          text: meta.body_text || undefined,
          replyTo: meta.reply_to || undefined,
        });

        if (sendError) {
          throw new Error(sendError.message);
        }

        // Log to sent_emails and mark queue item as sent
        const { data: sentEmail, error: insertError } = await supabase
          .from('sent_emails')
          .insert({
            organization_id: item.organization_id,
            email_type: item.notification_type || 'system',
            recipient_email: toEmail,
            subject: item.subject || 'Notification',
            body_html: item.body_html || item.body,
            from_email: fromEmail,
            from_name: fromName,
            reply_to: meta.reply_to,
            provider: 'resend',
            provider_message_id: sendResult?.id,
            status: 'sent',
            sent_at: new Date().toISOString(),
            template_id: item.template_id,
            metadata: { queue_id: item.id, ...meta },
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`Sent email ${item.id} but failed to record:`, insertError.message);
          await supabase
            .from('notification_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              sent_email_id: null,
              error_message: `Sent via Resend (${sendResult?.id}) but tracking insert failed: ${insertError.message}`,
            })
            .eq('id', item.id);
          failed++;
          continue;
        }

        await supabase
          .from('notification_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_email_id: sentEmail.id,
          })
          .eq('id', item.id);

        sent++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to send queued email ${item.id}:`, errorMessage);

        const maxAttempts = item.max_attempts || 3;
        const isPermanentFailure = attempts >= maxAttempts;
        const newStatus = isPermanentFailure ? 'failed' : 'pending';
        const nextAttemptAt = newStatus === 'pending'
          ? new Date(Date.now() + Math.pow(2, attempts) * 60000).toISOString()
          : null;

        await supabase
          .from('notification_queue')
          .update({
            status: newStatus,
            error_message: errorMessage,
            next_attempt_at: nextAttemptAt,
          })
          .eq('id', item.id);

        if (isPermanentFailure) {
          console.error(
            `[EMAIL QUEUE] PERMANENT FAILURE: email to ${item.email_address} ` +
            `(type: ${item.notification_type || 'unknown'}, queue_id: ${item.id}) ` +
            `failed after ${attempts} attempts. Last error: ${errorMessage}`
          );

          // Alert org admins via in-app notification
          if (item.organization_id) {
            try {
              const { data: admins } = await supabase
                .from('profiles')
                .select('id')
                .eq('organization_id', item.organization_id)
                .in('role', ['admin', 'super_admin'])
                .limit(10);

              if (admins && admins.length > 0) {
                await supabase.from('admin_notifications').insert(
                  admins.map((admin: { id: string }) => ({
                    user_id: admin.id,
                    organization_id: item.organization_id,
                    type: 'email_failure',
                    title: 'Email delivery failed',
                    message: `Email to ${item.email_address} (${item.notification_type || 'notification'}) permanently failed after ${attempts} attempts: ${errorMessage}`,
                  }))
                );
              }
            } catch (alertErr) {
              console.error('[EMAIL QUEUE] Failed to insert admin alert:', alertErr);
            }
          }
        }

        failed++;
      }
    }

    const allFailed = sent === 0 && failed > 0;
    return NextResponse.json({
      success: !allFailed,
      processed: queuedEmails.length,
      sent,
      failed,
      timestamp: new Date().toISOString(),
    }, allFailed ? { status: 500 } : {});
  } catch (error) {
    console.error('Error processing email queue:', error);
    return NextResponse.json(
      { error: 'Failed to process email queue' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'email-queue-processor',
    timestamp: new Date().toISOString(),
  });
}
