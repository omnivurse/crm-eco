import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Resend } from 'resend';

/**
 * Creates a service role client for queue processing
 */
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
 * Process pending emails from the email_queue table.
 * Should be called by a cron job (e.g., every minute).
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
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

    const supabase = createServiceClient();
    const resend = new Resend(apiKey);

    // Fetch pending emails that are due
    const { data: queuedEmails, error: fetchError } = await (supabase as any)
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching email queue:', fetchError);
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

    for (const email of queuedEmails) {
      // Mark as sending
      await (supabase as any)
        .from('email_queue')
        .update({ status: 'sending' })
        .eq('id', email.id);

      try {
        const fromEmail = email.from_email || process.env.RESEND_FROM_EMAIL || 'noreply@mail.payitforwardhealth.com';
        const fromName = email.from_name || process.env.RESEND_FROM_NAME || 'Pay It Forward Health';

        const { data: sendResult, error: sendError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [email.to_email],
          subject: email.subject || 'No Subject',
          html: email.body_html || '',
          text: email.body_text || undefined,
          replyTo: email.reply_to || undefined,
        });

        if (sendError) {
          throw new Error(sendError.message);
        }

        // Mark as sent
        await (supabase as any)
          .from('email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: sendResult?.id,
          })
          .eq('id', email.id);

        sent++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to send queued email ${email.id}:`, errorMessage);

        // Mark as failed
        await (supabase as any)
          .from('email_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            failed_at: new Date().toISOString(),
          })
          .eq('id', email.id);

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

/**
 * GET /api/email/process-queue
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'email-queue-processor',
    timestamp: new Date().toISOString(),
  });
}
