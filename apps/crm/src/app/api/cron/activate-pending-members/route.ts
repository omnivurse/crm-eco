/**
 * GET /api/cron/activate-pending-members
 *
 * Daily cron that auto-transitions Pending contacts/members to Active when
 * their coverage start date has arrived, then emails the assigned rep.
 *
 * Two passes per invocation (mirrors the age-65 cancellation cron):
 *   1. Activate — scan every contacts/members record in a pending-class status,
 *      resolve its effective coverage start date, and when that date is today
 *      or earlier flip `status` → Active (market/HS-taxonomy aware). The change
 *      is logged to `crm_stage_history` and `data.contact_status` is kept in
 *      sync for the UI.
 *   2. Notify — enqueue one `crm_activation_outbox` row per newly-activated
 *      record and drain unsent rows by emailing the assigned rep via Resend.
 *      A send failure never blocks or rolls back an activation.
 *
 * Start date resolution (first match wins): `current_year_start_date` /
 * `original_start_date` indexed columns, then JSONB keys (start_date,
 * sharing_effective_date, insurance_effective_date, health_insurance_start_date,
 * …) — see resolveEffectiveStartDate.
 *
 * Idempotent — safe to invoke repeatedly. Already-active records are skipped by
 * the pending-status filter; the outbox has a (record_id, activation_date)
 * unique index so a rep is emailed at most once per activation.
 *
 * `?dry_run=1` returns counts only and mutates nothing.
 *
 * Schedule: daily at 06:00 UTC (via Vercel cron).
 * Auth: Vercel cron sends `x-vercel-cron`; manual calls use `Bearer CRON_SECRET`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  PENDING_CONTACT_STATUSES,
  resolveActiveStatusForMarket,
  resolveEffectiveStartDate,
} from '@/lib/crm/membership-lifecycle';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAGE_SIZE = 1000;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

type PendingRecord = {
  id: string;
  status: string | null;
  market_type: string | null;
  org_id: string;
  data: Record<string, unknown> | null;
  original_start_date: string | null;
  current_year_start_date: string | null;
  title: string | null;
  email: string | null;
  owner_id: string | null;
};

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

const SELECT_COLS =
  'id, status, market_type, org_id, data, original_start_date, current_year_start_date, title, email, owner_id';

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

  const { data: modules, error: moduleError } = await supabase
    .from('crm_modules')
    .select('id')
    .in('key', ['contacts', 'members']);

  if (moduleError) {
    console.error('[activate-pending-members] module fetch error:', moduleError);
    return NextResponse.json({ error: moduleError.message }, { status: 500 });
  }

  const moduleIds = (modules ?? []).map((m) => m.id);
  if (moduleIds.length === 0) {
    return NextResponse.json({ activated: 0, message: 'No contacts/members modules found' });
  }

  // ── 1. Activation pass (paginated so >PAGE_SIZE pending records are covered) ──
  const activated: ActivatedRecord[] = [];
  const errors: string[] = [];
  let scanned = 0;
  let eligible = 0;
  const dryRunSample: Array<{ id: string; status: string | null; start_date: string }> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error: fetchError } = await supabase
      .from('crm_records')
      .select(SELECT_COLS)
      .in('module_id', moduleIds)
      .in('status', [...PENDING_CONTACT_STATUSES])
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (fetchError) {
      console.error('[activate-pending-members] fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!page || page.length === 0) break;
    scanned += page.length;

    for (const raw of page as PendingRecord[]) {
      const startDate = resolveEffectiveStartDate(raw);
      if (!startDate || startDate > today) continue;

      eligible++;
      const newStatus = resolveActiveStatusForMarket(raw.market_type, raw.status);
      const oldStatus = raw.status;

      if (dryRun) {
        if (dryRunSample.length < 25) {
          dryRunSample.push({ id: raw.id, status: oldStatus, start_date: startDate });
        }
        continue;
      }

      const existingData =
        raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : {};

      const { error: updateError } = await supabase
        .from('crm_records')
        .update({
          status: newStatus,
          data: { ...existingData, contact_status: newStatus },
          updated_at: new Date().toISOString(),
        })
        .eq('id', raw.id);

      if (updateError) {
        console.error(`[activate-pending-members] update error for ${raw.id}:`, updateError);
        errors.push(`${raw.id}: ${updateError.message}`);
        continue;
      }

      // Best-effort audit; a history failure must not undo the activation.
      const { error: histError } = await supabase.from('crm_stage_history').insert({
        record_id: raw.id,
        org_id: raw.org_id,
        from_stage: oldStatus,
        to_stage: newStatus,
        reason: `Auto-activated: start date ${startDate} has arrived`,
      });
      if (histError) {
        console.error(`[activate-pending-members] stage_history error for ${raw.id}:`, histError);
      }

      activated.push({
        record_id: raw.id,
        org_id: raw.org_id,
        member_name: raw.title,
        member_email: raw.email,
        activation_date: startDate,
        new_status: newStatus,
        owner_id: raw.owner_id,
      });
    }

    if (page.length < PAGE_SIZE) break;
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      today,
      pending_scanned: scanned,
      would_activate: eligible,
      sample: dryRunSample,
    });
  }

  // ── 2. Enqueue notification rows for newly-activated records ──
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

  // ── 3. Drain unsent outbox rows by emailing the assigned rep via Resend ──
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
  const fromName = process.env.RESEND_FROM_NAME || 'Double Helix CRM';
  const fromAddress =
    process.env.ACTIVATION_NOTIFICATION_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.FROM_EMAIL ||
    'notifications@doublehelixhub.com';
  const fromEmail = `${fromName} <${fromAddress}>`;

  // ── Recipient hard-lock (client request, 2026-06-01) ────────────────────────
  // While activation notifications are piloted, EVERY email is routed to this one
  // address regardless of the record's owner — so no other rep can receive one
  // (contacts are never recipients in any case). Records with no owner still send
  // nothing, keeping the backlog silent. To return to owner-based routing later
  // (once Wendy owns the org/tenant), set ACTIVATION_NOTIFICATION_TO_OVERRIDE=""
  // in the crm-core env and remove the literal default below.
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

    // Owner presence gates whether we notify (keeps the backlog silent); the
    // recipient is then forced to the hard-lock address when set.
    const recipient = toOverride || row.rep_email;
    const { subject, html, text } = buildEmail(row);
    try {
      const result = await resend!.emails.send({
        from: fromEmail,
        to: recipient,
        subject,
        html,
        text,
      });
      if (result.error) throw new Error(result.error.message);

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
