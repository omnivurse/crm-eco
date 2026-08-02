/**
 * GET /api/cron/activate-pending-members
 *
 * Thin adapter: daily cron that auto-transitions Pending contacts/members to
 * Active when their coverage start date has arrived, then emails the assigned
 * rep. Activation logic lives in `@/lib/crm/member-activation`.
 *
 * `?dry_run=1` returns counts only and mutates nothing.
 *
 * Schedule: daily at 06:00 UTC (via Vercel cron).
 * Auth: Vercel cron sends `x-vercel-cron`; manual calls use `Bearer CRON_SECRET`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { activateCrmRecordsDue } from '@/lib/crm/member-activation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

type ActivatedRecord = {
  record_id: string;
  org_id: string;
  member_name: string | null;
  member_email: string | null;
  activation_date: string;
  new_status: string;
  owner_id: string | null;
};

interface ActivationOutboxRow {
  id: string;
  org_id: string;
  record_id: string;
  member_name: string | null;
  member_email: string | null;
  activation_date: string;
  new_status: string | null;
  rep_user_id: string | null;
  rep_email: string | null;
  rep_name: string | null;
}

function buildEmail(row: ActivationOutboxRow): { subject: string; html: string; text: string } {
  const name = row.member_name || 'A contact';
  const date = new Date(row.activation_date + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const status = row.new_status || 'Active';
  const subject = `Now active: ${name} — coverage started ${date}`;
  const text = [
    `${name} has automatically moved to "${status}" because their coverage start`,
    `date (${date}) has arrived.`,
    ``,
    `This is an automated notification — no action required.`,
  ].join('\n');
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.6">
      <h2 style="color:#0f172a;margin:0 0 12px">Now active: ${name}</h2>
      <p>This contact has automatically moved to <strong>${status}</strong> because their
         coverage start date has arrived.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 12px;color:#64748b">Coverage start</td>
            <td style="padding:6px 12px;font-weight:600">${date}</td></tr>
        <tr><td style="padding:6px 12px;color:#64748b">New status</td>
            <td style="padding:6px 12px">${status}</td></tr>
      </table>
      <p style="color:#64748b;font-size:13px">
        This is an automated notification — no action required.
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
    return NextResponse.json({ error: 'Service role unavailable' }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const today = new Date().toISOString().slice(0, 10);
  const dryRun = request.nextUrl.searchParams.get('dry_run') === '1';

  const result = await activateCrmRecordsDue(supabase, today, { dryRun });

  if (result.error && result.pending_scanned === 0 && result.would_activate === 0) {
    if (result.error === 'No contacts/members modules found') {
      return NextResponse.json({ activated: 0, message: result.error });
    }
    console.error('[activate-pending-members] activation error:', result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      today,
      pending_scanned: result.pending_scanned,
      would_activate: result.would_activate,
      sample: result.sample,
    });
  }

  const activated: ActivatedRecord[] = result.activated
    .filter((a) => a.activated && a.record_id && a.start_date && a.new_status && a.org_id)
    .map((a) => ({
      record_id: a.record_id!,
      org_id: a.org_id!,
      member_name: a.member_name ?? null,
      member_email: a.member_email ?? null,
      activation_date: a.start_date!,
      new_status: a.new_status!,
      owner_id: a.owner_id ?? null,
    }));
  const errors = result.errors;
  const scanned = result.pending_scanned;
  const eligible = result.would_activate;

  // ── Enqueue notification rows for newly-activated records ──
  if (activated.length > 0) {
    const ownerIds = Array.from(
      new Set(activated.map((a) => a.owner_id).filter((id): id is string => Boolean(id))),
    );
    const ownerMap = new Map<string, { email: string | null; full_name: string | null }>();
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', ownerIds);
      for (const o of owners ?? []) {
        ownerMap.set(o.id as string, {
          email: (o.email as string | null) ?? null,
          full_name: (o.full_name as string | null) ?? null,
        });
      }
    }

    const outboxRows = activated.map((a) => {
      const owner = a.owner_id ? ownerMap.get(a.owner_id) : null;
      return {
        org_id: a.org_id,
        record_id: a.record_id,
        member_name: a.member_name,
        member_email: a.member_email,
        activation_date: a.activation_date,
        new_status: a.new_status,
        rep_user_id: a.owner_id,
        rep_email: owner?.email ?? null,
        rep_name: owner?.full_name ?? null,
      };
    });

    const { error: insertErr } = await supabase
      .from('crm_activation_outbox')
      .upsert(outboxRows, { onConflict: 'record_id,activation_date', ignoreDuplicates: true });
    if (insertErr) {
      console.error('[activate-pending-members] outbox upsert error:', insertErr.message);
    }
  }

  // ── Drain unsent outbox rows by emailing the assigned rep via Resend ──
  const { data: unsent, error: outboxErr } = await supabase
    .from('crm_activation_outbox')
    .select(
      'id, org_id, record_id, member_name, member_email, activation_date, new_status, rep_user_id, rep_email, rep_name',
    )
    .is('notified_at', null)
    .order('created_at', { ascending: true })
    .limit(100);

  if (outboxErr) {
    console.error('[activate-pending-members] outbox fetch error:', outboxErr.message);
    return NextResponse.json(
      { activated: activated.length, eligible, error: outboxErr.message },
      { status: 500 },
    );
  }

  const rows = (unsent || []) as ActivationOutboxRow[];
  const resendKey = process.env.RESEND_API_KEY;
  const fromName = process.env.RESEND_FROM_NAME || 'Pay It Forward Health';
  const fromAddress =
    process.env.ACTIVATION_NOTIFICATION_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.FROM_EMAIL ||
    'notifications@payitforwardhealth.com';
  const fromEmail = `${fromName} <${fromAddress}>`;

  // Recipient hard-lock (pilot): route every email to override when set.
  const toOverride = (
    process.env.ACTIVATION_NOTIFICATION_TO_OVERRIDE ?? 'wendy@payitforwardstrategies.com'
  ).trim();

  if (!resendKey && rows.length > 0) {
    console.warn('[activate-pending-members] RESEND_API_KEY not set — skipping email send');
    return NextResponse.json({
      activated: activated.length,
      eligible,
      pending_scanned: scanned,
      outboxPending: rows.length,
      sent: 0,
      skipped: rows.length,
      failed: 0,
      warning: 'RESEND_API_KEY not configured',
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  const resend = resendKey ? new Resend(resendKey) : null;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.rep_email) {
      skipped++;
      await supabase
        .from('crm_activation_outbox')
        .update({
          notified_at: new Date().toISOString(),
          notification_error: 'Rep email missing — record has no owner with a profile',
        })
        .eq('id', row.id);
      continue;
    }

    const recipient = toOverride || row.rep_email;
    const { subject, html, text } = buildEmail(row);
    try {
      const resultSend = await resend!.emails.send({
        from: fromEmail,
        to: recipient,
        subject,
        html,
        text,
      });
      if (resultSend.error) throw new Error(resultSend.error.message);

      await supabase
        .from('crm_activation_outbox')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', row.id);
      sent++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from('crm_activation_outbox')
        .update({ notified_at: new Date().toISOString(), notification_error: msg.slice(0, 500) })
        .eq('id', row.id);
      console.error('[activate-pending-members] send failed for', row.record_id, msg);
    }
  }

  console.log(
    `[activate-pending-members] activated ${activated.length}/${eligible} eligible ` +
      `(${scanned} pending scanned); emails sent ${sent}, skipped ${skipped}, failed ${failed}`,
  );

  return NextResponse.json({
    activated: activated.length,
    eligible,
    pending_scanned: scanned,
    sent,
    skipped,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
