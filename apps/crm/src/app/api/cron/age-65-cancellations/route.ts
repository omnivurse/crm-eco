/**
 * GET /api/cron/age-65-cancellations
 *
 * Vercel cron entry point for the HealthShare age-65 auto-cancellation rule.
 * Runs daily at 06:00 UTC (see apps/crm/vercel.json `crons`).
 *
 * Two passes per invocation:
 *   1. Run `apply_age_65_auto_cancellation()` to scan every HealthShare
 *      record and apply the cancellation (status='Cancelled' + cancellation_date)
 *      with notification rows queued in `crm_age_65_cancellation_outbox`.
 *   2. Drain unsent outbox rows by emailing the assigned rep via Resend.
 *      Successful sends mark `notified_at`; failures record the error message.
 *
 * Idempotency: the SQL function is idempotent (skips records already cancelled),
 * and the outbox has a `(record_id, cancellation_date)` unique index so duplicate
 * notifications cannot be enqueued. Re-running the cron is safe.
 *
 * Auth: Vercel cron sends `x-vercel-cron: 1` and the bearer secret in
 * `CRON_SECRET`. This route accepts either.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

interface OutboxRow {
  id: string;
  org_id: string;
  record_id: string;
  member_name: string | null;
  member_email: string | null;
  cancellation_date: string;
  rep_user_id: string | null;
  rep_email: string | null;
  rep_name: string | null;
}

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

function buildEmail(row: OutboxRow): { subject: string; html: string; text: string } {
  const name = row.member_name || 'A HealthShare member';
  const date = new Date(row.cancellation_date + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const subject = `Auto-cancellation: ${name} aged out at 65`;
  const text = [
    `${name} has been automatically cancelled because they reached age 65.`,
    ``,
    `Cancellation date: ${date} (1st of their birthday month).`,
    `Reason: Aged out at 65.`,
    ``,
    `This is an automated notification — no action required unless the member`,
    `is continuing on a different plan.`,
  ].join('\n');
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.6">
      <h2 style="color:#0f172a;margin:0 0 12px">Auto-cancellation: ${name}</h2>
      <p>This member has been automatically cancelled because they reached age 65.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 12px;color:#64748b">Cancellation date</td>
            <td style="padding:6px 12px;font-weight:600">${date}</td></tr>
        <tr><td style="padding:6px 12px;color:#64748b">Reason</td>
            <td style="padding:6px 12px">Aged out at 65</td></tr>
      </table>
      <p style="color:#64748b;font-size:13px">
        This is an automated notification — no action required unless the member
        is continuing on a different plan.
      </p>
    </div>
  `.trim();
  return { subject, html, text };
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Service role unavailable' },
      { status: 500 },
    );
  }

  const supabase = createServiceClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // ── 1. Apply cancellations ────────────────────────────────────────────────
  const { data: applied, error: applyErr } = await supabase.rpc(
    'apply_age_65_auto_cancellation',
    { p_record_id: null },
  );
  if (applyErr) {
    console.error('[age-65 cron] apply error:', applyErr.message);
    return NextResponse.json({ error: applyErr.message }, { status: 500 });
  }

  // ── 2. Drain unsent outbox rows ───────────────────────────────────────────
  const { data: unsent, error: outboxErr } = await supabase
    .from('crm_age_65_cancellation_outbox')
    .select(
      'id, org_id, record_id, member_name, member_email, cancellation_date, rep_user_id, rep_email, rep_name',
    )
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(100);

  if (outboxErr) {
    console.error('[age-65 cron] outbox fetch error:', outboxErr.message);
    return NextResponse.json({ applied, error: outboxErr.message }, { status: 500 });
  }

  const rows = (unsent || []) as OutboxRow[];
  const resendKey = process.env.RESEND_API_KEY;
  const fromName = process.env.RESEND_FROM_NAME || 'Double Helix CRM';
  const fromAddress =
    process.env.AGE_65_NOTIFICATION_FROM
    || process.env.RESEND_FROM_EMAIL
    || process.env.FROM_EMAIL
    || 'notifications@doublehelixhub.com';
  const fromEmail = `${fromName} <${fromAddress}>`;

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  if (!resendKey && rows.length > 0) {
    console.warn('[age-65 cron] RESEND_API_KEY not set — skipping email send');
    return NextResponse.json({
      applied,
      outboxPending: rows.length,
      sent: 0,
      skipped: rows.length,
      failed: 0,
      warning: 'RESEND_API_KEY not configured',
    });
  }

  const resend = resendKey ? new Resend(resendKey) : null;

  for (const row of rows) {
    if (!row.rep_email) {
      skipped++;
      await supabase
        .from('crm_age_65_cancellation_outbox')
        .update({
          notified_at: new Date().toISOString(),
          notification_error: 'Rep email missing — record has no owner with a profile',
        })
        .eq('id', row.id);
      continue;
    }

    const { subject, html, text } = buildEmail(row);
    try {
      const result = await resend!.emails.send({
        from: fromEmail,
        to: row.rep_email,
        subject,
        html,
        text,
      });
      if (result.error) throw new Error(result.error.message);

      await supabase
        .from('crm_age_65_cancellation_outbox')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', row.id);
      sent++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from('crm_age_65_cancellation_outbox')
        .update({
          notified_at: new Date().toISOString(),
          notification_error: msg.slice(0, 500),
        })
        .eq('id', row.id);
      console.error('[age-65 cron] send failed for', row.record_id, msg);
    }
  }

  return NextResponse.json({ applied, sent, skipped, failed });
}
