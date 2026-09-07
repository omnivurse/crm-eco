import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronSecret } from '@/lib/security/verify-cron-secret';
import { COMMS_FLAGS, isCommsFlagEnabled } from '@/lib/email/comms-flags';
import { processCampaignEmails } from '@/lib/email/campaign-send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** A due campaign can hold thousands of recipients. */
export const maxDuration = 300;

/** Campaigns promoted per tick, so one huge backlog cannot monopolise a run. */
const MAX_CAMPAIGNS_PER_RUN = 3;
/**
 * Longer than this route's five-minute max duration. A `sending` campaign
 * older than the threshold cannot still belong to a healthy invocation.
 */
const STALE_SENDING_MS = 10 * 60_000;

/**
 * POST /api/cron/send-scheduled-campaigns
 *
 * Scheduling a campaign used to be a dead end: both the UI and the send API
 * could park a row in `scheduled`, but nothing ever picked it back up, so the
 * mail was never delivered. This is the missing worker.
 */
export async function POST(request: NextRequest) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[scheduled-campaigns] Supabase service credentials are not configured');
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const nowIso = new Date().toISOString();
    const staleBeforeIso = new Date(Date.now() - STALE_SENDING_MS).toISOString();

    const [
      { data: scheduled, error: scheduledError },
      { data: staleSending, error: staleError },
    ] = await Promise.all([
      supabase
        .from('email_campaigns')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_at', nowIso)
        .order('scheduled_at', { ascending: true })
        .limit(MAX_CAMPAIGNS_PER_RUN),
      // Recover a send whose request/after callback timed out or crashed.
      // Recipient/outbox idempotency means processing can safely continue from
      // the rows that are still pending.
      supabase
        .from('email_campaigns')
        .select('*')
        .eq('status', 'sending')
        .lt('updated_at', staleBeforeIso)
        .order('updated_at', { ascending: true })
        .limit(MAX_CAMPAIGNS_PER_RUN),
    ]);

    if (scheduledError) throw scheduledError;
    if (staleError) throw staleError;

    const due = [...(staleSending ?? []), ...(scheduled ?? [])]
      .slice(0, MAX_CAMPAIGNS_PER_RUN);
    if (!due || due.length === 0) {
      return NextResponse.json({ success: true, processed: 0, timestamp: nowIso });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const campaign of due) {
      const orgId = campaign.org_id as string;

      // Both gates are re-read per campaign: a scheduled send can sit for days,
      // and the operator may have closed things down in the meantime.
      const killed = await isCommsFlagEnabled(supabase, COMMS_FLAGS.killSwitch, orgId, false);
      const bulkAllowed = await isCommsFlagEnabled(supabase, COMMS_FLAGS.campaignSend, orgId, false);

      if (killed || !bulkAllowed) {
        // Leave it scheduled rather than failing it, so enabling the flag lets
        // the campaign resume on the next tick instead of needing a rebuild.
        results.push({ id: campaign.id, skipped: killed ? 'kill_switch' : 'campaign_send_disabled' });
        continue;
      }

      // Claim it before doing any work. For recovery, compare updated_at too:
      // another invocation that made progress after our read wins the race.
      let claim = supabase
        .from('email_campaigns')
        .update({
          status: 'sending',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id)
        .eq('status', campaign.status);

      if (campaign.status === 'sending') {
        claim = claim.eq('updated_at', campaign.updated_at);
      }

      const { data: claimed, error: claimError } = await claim
        .select('id')
        .maybeSingle();

      if (claimError || !claimed) {
        results.push({ id: campaign.id, skipped: 'already_claimed' });
        continue;
      }

      try {
        const outcome = await processCampaignEmails(supabase, campaign, orgId);
        results.push({ id: campaign.id, ...outcome });
      } catch (err) {
        // processCampaignEmails already marked it failed with the message.
        results.push({
          id: campaign.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      timestamp: nowIso,
    });
  } catch (err) {
    console.error('[scheduled-campaigns] run failed:', err);
    return NextResponse.json({ error: 'Failed to process scheduled campaigns' }, { status: 500 });
  }
}

// Vercel crons issue GET. Same delegation as /api/sequences/process.
export async function GET(request: NextRequest) {
  return POST(request);
}
