import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Resend } from 'resend';

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

/**
 * POST /api/email/process-queue
 * Process pending email notifications from the notification_queue table.
 * Should be called by a cron job (e.g., every minute).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

    // Fetch pending email notifications that are due
    const { data: queuedEmails, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('channel', 'email')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching notification queue:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch queue' },
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
      // Update attempt count
      const attempts = (item.attempts || 0) + 1;
      await supabase
        .from('notification_queue')
        .update({ status: 'sending', attempts, last_attempt_at: new Date().toISOString() })
        .eq('id', item.id);

      try {
        const meta = item.metadata || {};
        const fromEmail = meta.from_email || process.env.RESEND_FROM_EMAIL || 'noreply@mail.payitforwardhealth.com';
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
        const { data: sentEmail } = await supabase
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

        await supabase
          .from('notification_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_email_id: sentEmail?.id || null,
          })
          .eq('id', item.id);

        sent++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to send queued email ${item.id}:`, errorMessage);

        const maxAttempts = item.max_attempts || 3;
        const newStatus = attempts >= maxAttempts ? 'failed' : 'pending';
        const nextAttemptAt = newStatus === 'pending'
          ? new Date(Date.now() + attempts * 60000).toISOString()
          : null;

        await supabase
          .from('notification_queue')
          .update({
            status: newStatus,
            error_message: errorMessage,
            next_attempt_at: nextAttemptAt,
          })
          .eq('id', item.id);

        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: queuedEmails.length,
      sent,
      failed,
      timestamp: new Date().toISOString(),
    });
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
