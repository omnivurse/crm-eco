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

interface AppliedRecord {
  record_id: string;
  org_id: string;
  member_name: string | null;
  member_email: string | null;
  cancellation_date: string;
  owner_id: string | null;
}

interface ApplyResult {
  count: number;
  cancelled: AppliedRecord[];
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

  // Dry-run mode: read-only — return counts so we can debug without mutating.
  if (request.nextUrl.searchParams.get('dry_run') === '1') {
    const [
      { count: recordsTotal },
      { count: healthshareTotal },
      { count: jsonbHealthshareTotal },
      { count: jsonbHealthshareWithDob },
      { count: cancelledTotal },
      { count: agedOutTotal },
      { count: outboxTotalDry },
      { count: outboxUnsentDry },
      { data: marketTypeSamples },
    ] = await Promise.all([
      supabase.from('crm_records').select('id', { count: 'exact', head: true }),
      supabase
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .eq('market_type', 'healthshare'),
      supabase
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .filter('data->>market_type', 'eq', 'healthshare'),
      supabase
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .filter('data->>market_type', 'eq', 'healthshare')
        .not('data->>date_of_birth', 'is', null),
      supabase
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Cancelled'),
      supabase
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .filter('data->>cancellation_reason', 'eq', 'Aged out at 65'),
      supabase
        .from('crm_age_65_cancellation_outbox')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('crm_age_65_cancellation_outbox')
        .select('id', { count: 'exact', head: true })
        .is('notified_at', null),
      // Sample 5 distinct market_type column values to verify what's actually stored
      supabase.from('crm_records').select('market_type').limit(50),
    ]);

    const marketTypeSet = new Set(
      (marketTypeSamples ?? []).map((r) => (r as { market_type: string | null }).market_type),
    );

    // Of the aged-out records, count which "rep" field is populated.
    const [
      { count: agedOutWithOwnerId },
      { count: agedOutWithAdvisorId },
      { count: agedOutWithNormAdvName },
      { count: agedOutWithNormAgentName },
    ] = await Promise.all([
      supabase
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .eq('market_type', 'healthshare')
        .filter('data->>cancellation_reason', 'eq', 'Aged out at 65')
        .not('owner_id', 'is', null),
      supabase
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .eq('market_type', 'healthshare')
        .filter('data->>cancellation_reason', 'eq', 'Aged out at 65')
        .not('advisor_id', 'is', null),
      supabase
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .eq('market_type', 'healthshare')
        .filter('data->>cancellation_reason', 'eq', 'Aged out at 65')
        .not('normalized_advisor_name', 'is', null),
      supabase
        .from('crm_records')
        .select('id', { count: 'exact', head: true })
        .eq('market_type', 'healthshare')
        .filter('data->>cancellation_reason', 'eq', 'Aged out at 65')
        .not('normalized_agent_name', 'is', null),
    ]);

    return NextResponse.json({
      dryRun: true,
      recordsTotal,
      healthshareTotal_column: healthshareTotal,
      healthshareTotal_jsonb: jsonbHealthshareTotal,
      healthshareWithDob_jsonb: jsonbHealthshareWithDob,
      cancelledTotal,
      agedOutTotal,
      agedOut_withOwnerId: agedOutWithOwnerId,
      agedOut_withAdvisorId: agedOutWithAdvisorId,
      agedOut_withNormAdvName: agedOutWithNormAdvName,
      agedOut_withNormAgentName: agedOutWithNormAgentName,
      outboxTotal: outboxTotalDry,
      outboxUnsent: outboxUnsentDry,
      marketTypeSamples: Array.from(marketTypeSet).slice(0, 10),
    });
  }

  // ── 1. Apply cancellations ────────────────────────────────────────────────
  const { data: appliedRaw, error: applyErr } = await supabase.rpc(
    'apply_age_65_auto_cancellation',
    { p_record_id: null },
  );
  if (applyErr) {
    console.error('[age-65 cron] apply error:', applyErr.message);
    return NextResponse.json({ error: applyErr.message }, { status: 500 });
  }
  const applied = (appliedRaw ?? { count: 0, cancelled: [] }) as ApplyResult;

  // ── 2. Insert outbox rows for newly-cancelled records (if any) ────────────
  // Look up the rep email/name for each cancelled record's owner in one batch.
  if (applied.cancelled.length > 0) {
    const ownerIds = Array.from(
      new Set(applied.cancelled.map((c) => c.owner_id).filter((id): id is string => Boolean(id))),
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

    const outboxRows = applied.cancelled.map((c) => {
      const owner = c.owner_id ? ownerMap.get(c.owner_id) : null;
      return {
        org_id: c.org_id,
        record_id: c.record_id,
        member_name: c.member_name,
        member_email: c.member_email,
        cancellation_date: c.cancellation_date,
        rep_user_id: c.owner_id,
        rep_email: owner?.email ?? null,
        rep_name: owner?.full_name ?? null,
      };
    });

    const { error: insertErr } = await supabase
      .from('crm_age_65_cancellation_outbox')
      .upsert(outboxRows, {
        onConflict: 'record_id,cancellation_date',
        ignoreDuplicates: true,
      });
    if (insertErr) {
      console.error('[age-65 cron] outbox upsert error:', insertErr.message);
    }
  }

  // ── 2.5 Optional retry: query param `?retry_missing_rep=1` resets rows
  // previously marked "Rep email missing" so the lookup logic below can have
  // another shot at resolving them. Without this opt-in, those rows stay
  // settled — re-runs would otherwise re-skip them on every call.
  if (request.nextUrl.searchParams.get('retry_missing_rep') === '1') {
    await supabase
      .from('crm_age_65_cancellation_outbox')
      .update({ notified_at: null, notification_error: null })
      .ilike('notification_error', '%Rep email missing%');
  }

  // ── 3. Resolve missing rep emails for unsent outbox rows ───────────────────
  // Strategy in priority order, per record:
  //   1. rep_user_id → profiles.email (already populated by step 2 when owner_id was set)
  //   2. crm_records.advisor_id → crm_advisors.user_id → profiles.email
  //   3. crm_records.normalized_advisor_name → crm_advisors.advisor_name → user_id → profiles.email
  //   4. crm_records.normalized_advisor_name → profiles.full_name → email (case-insensitive)
  const { data: missingEmailRows } = await supabase
    .from('crm_age_65_cancellation_outbox')
    .select('id, record_id, org_id, rep_user_id, rep_email')
    .is('notified_at', null)
    .is('rep_email', null)
    .limit(200);

  if (missingEmailRows && missingEmailRows.length > 0) {
    const recordIds = missingEmailRows.map((r) => r.record_id as string);
    const { data: records } = await supabase
      .from('crm_records')
      .select('id, advisor_id, normalized_advisor_name')
      .in('id', recordIds);

    const recordMap = new Map<
      string,
      { advisor_id: string | null; normalized_advisor_name: string | null }
    >();
    for (const r of records ?? []) {
      recordMap.set(r.id as string, {
        advisor_id: (r.advisor_id as string | null) ?? null,
        normalized_advisor_name: (r.normalized_advisor_name as string | null) ?? null,
      });
    }

    const advisorIds = Array.from(
      new Set(
        Array.from(recordMap.values())
          .map((r) => r.advisor_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const advisorNames = Array.from(
      new Set(
        Array.from(recordMap.values())
          .map((r) => r.normalized_advisor_name)
          .filter((n): n is string => Boolean(n)),
      ),
    );

    // Look up crm_advisors by id and by name in one shot each
    const { data: advisorsById } = advisorIds.length
      ? await supabase
          .from('crm_advisors')
          .select('id, user_id, advisor_name')
          .in('id', advisorIds)
      : { data: [] };

    const { data: advisorsByName } = advisorNames.length
      ? await supabase
          .from('crm_advisors')
          .select('id, user_id, advisor_name')
          .in('advisor_name', advisorNames)
      : { data: [] };

    // Collect all user_ids we'll need profile data for
    const userIds = Array.from(
      new Set(
        [...(advisorsById ?? []), ...(advisorsByName ?? [])]
          .map((a) => (a as { user_id: string | null }).user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const profileByUserId = new Map<string, { email: string | null; full_name: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', userIds);
      for (const p of profiles ?? []) {
        profileByUserId.set(p.user_id as string, {
          email: (p.email as string | null) ?? null,
          full_name: (p.full_name as string | null) ?? null,
        });
      }
    }

    // Also fall back to profiles.full_name match
    const profileByName = new Map<string, { email: string | null; full_name: string | null }>();
    if (advisorNames.length > 0) {
      const { data: profilesByName } = await supabase
        .from('profiles')
        .select('email, full_name')
        .in('full_name', advisorNames);
      for (const p of profilesByName ?? []) {
        const name = (p.full_name as string | null) ?? '';
        if (name && !profileByName.has(name)) {
          profileByName.set(name, {
            email: (p.email as string | null) ?? null,
            full_name: name,
          });
        }
      }
    }

    const advisorByIdMap = new Map((advisorsById ?? []).map((a) => [a.id as string, a]));
    const advisorByNameMap = new Map(
      (advisorsByName ?? []).map((a) => [a.advisor_name as string, a]),
    );

    // Update each outbox row with the best email we found
    for (const row of missingEmailRows) {
      const rec = recordMap.get(row.record_id as string);
      if (!rec) continue;

      let resolvedEmail: string | null = null;
      let resolvedName: string | null = null;
      let resolvedUserId: string | null = (row.rep_user_id as string | null) ?? null;

      // Try advisor_id path
      if (rec.advisor_id) {
        const adv = advisorByIdMap.get(rec.advisor_id) as
          | { user_id: string | null; advisor_name: string | null }
          | undefined;
        if (adv?.user_id) {
          const prof = profileByUserId.get(adv.user_id);
          if (prof?.email) {
            resolvedEmail = prof.email;
            resolvedName = prof.full_name ?? adv.advisor_name ?? null;
            resolvedUserId = adv.user_id;
          }
        }
      }

      // Try normalized_advisor_name path via crm_advisors
      if (!resolvedEmail && rec.normalized_advisor_name) {
        const adv = advisorByNameMap.get(rec.normalized_advisor_name) as
          | { user_id: string | null; advisor_name: string | null }
          | undefined;
        if (adv?.user_id) {
          const prof = profileByUserId.get(adv.user_id);
          if (prof?.email) {
            resolvedEmail = prof.email;
            resolvedName = prof.full_name ?? adv.advisor_name ?? null;
            resolvedUserId = adv.user_id;
          }
        }
      }

      // Try direct profiles.full_name match
      if (!resolvedEmail && rec.normalized_advisor_name) {
        const prof = profileByName.get(rec.normalized_advisor_name);
        if (prof?.email) {
          resolvedEmail = prof.email;
          resolvedName = prof.full_name ?? rec.normalized_advisor_name;
        }
      }

      if (resolvedEmail) {
        await supabase
          .from('crm_age_65_cancellation_outbox')
          .update({
            rep_email: resolvedEmail,
            rep_name: resolvedName,
            rep_user_id: resolvedUserId,
          })
          .eq('id', row.id as string);
      }
    }
  }

  // ── 4. Drain unsent outbox rows ───────────────────────────────────────────
  const { count: outboxTotal } = await supabase
    .from('crm_age_65_cancellation_outbox')
    .select('id', { count: 'exact', head: true });
  const { count: outboxUnsent } = await supabase
    .from('crm_age_65_cancellation_outbox')
    .select('id', { count: 'exact', head: true })
    .is('notified_at', null);

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

  return NextResponse.json({
    applied,
    outboxTotal,
    outboxUnsent,
    sent,
    skipped,
    failed,
  });
}
