import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimitDurable, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';
import { getClientIp } from '@crm-eco/lib/security/captcha';

export const dynamic = 'force-dynamic';

/**
 * Public RSVP endpoints — no auth required. Each attendee row carries an
 * unguessable `rsvp_token` (uuid, unique) that acts as the bearer credential;
 * RLS denies anon everything on the calendar tables, so both handlers use the
 * service-role client and scope every query by that token.
 *
 * `crm_calendar_events` / `crm_calendar_event_attendees` are new tables whose
 * migration is still in flight, so they are not in the generated Database
 * types yet — rows are typed with the local interfaces below (same approach
 * as the email outbox ledger in `src/lib/email/outbox.ts`).
 */

function getSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for RSVP routes');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface RsvpEventRow {
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string | null;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

interface RsvpAttendeeRow {
  id: string;
  event_id: string;
  email: string;
  name: string | null;
  rsvp_status: 'needs_action' | 'accepted' | 'declined' | 'tentative';
}

const EVENT_COLUMNS =
  'title, description, location, meeting_url, start_at, end_at, all_day, timezone, status';

// rsvp_token is a uuid column — validate before querying so a malformed token
// 404s instead of surfacing a Postgres cast error.
const tokenSchema = z.string().uuid();

const respondSchema = z.object({
  response: z.enum(['accepted', 'declined', 'tentative']),
});

async function loadInvite(
  supabase: ReturnType<typeof getSupabaseClient>,
  token: string,
): Promise<{ attendee: RsvpAttendeeRow; event: RsvpEventRow } | null> {
  const { data: attendeeData, error: attendeeError } = await supabase
    .from('crm_calendar_event_attendees')
    .select('id, event_id, email, name, rsvp_status')
    .eq('rsvp_token', token)
    .maybeSingle();

  if (attendeeError || !attendeeData) return null;
  const attendee = attendeeData as RsvpAttendeeRow;

  const { data: eventData, error: eventError } = await supabase
    .from('crm_calendar_events')
    .select(EVENT_COLUMNS)
    .eq('id', attendee.event_id)
    .maybeSingle();

  if (eventError || !eventData) return null;

  return { attendee, event: eventData as RsvpEventRow };
}

/**
 * GET /api/rsvp/[token]
 *
 * Read-only invite lookup for the public RSVP page. Mail scanners prefetch
 * links from invite emails, so GET must NEVER mutate the attendee row — the
 * response is only recorded by an explicit POST from the page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!tokenSchema.safeParse(token).success) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const supabase = getSupabaseClient();
    const invite = await loadInvite(supabase, token);

    if (!invite) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({
      event: invite.event,
      attendee: {
        email: invite.attendee.email,
        name: invite.attendee.name,
        rsvp_status: invite.attendee.rsvp_status,
      },
    });
  } catch (error) {
    console.error('Failed to load RSVP invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/rsvp/[token]
 *
 * Records the attendee's response. Public but defended in layers, matching
 * /api/scheduling/book:
 *   1. Durable per-IP+token rate limit — blunts script floods and token scans.
 *   2. The token itself is an unguessable per-attendee uuid credential.
 *   3. Zod-validated body; cancelled events are rejected with 409.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const clientIp = getClientIp(request) ?? 'unknown';

  // Layer 1: rate-limit before doing any expensive work.
  const rl = await rateLimitDurable(`rsvp-respond:${clientIp}:${token}`, {
    limit: 5,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  if (!tokenSchema.safeParse(token).success) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = respondSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const invite = await loadInvite(supabase, token);

    if (!invite) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (invite.event.status === 'cancelled') {
      return NextResponse.json({ error: 'event_cancelled' }, { status: 409 });
    }

    const { error: updateError } = await supabase
      .from('crm_calendar_event_attendees')
      .update({
        rsvp_status: parsed.data.response,
        rsvp_at: new Date().toISOString(),
        response_source: 'link',
      })
      .eq('id', invite.attendee.id)
      .eq('rsvp_token', token);

    if (updateError) {
      console.error('Failed to record RSVP:', updateError);
      return NextResponse.json({ error: 'Failed to record RSVP' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rsvp_status: parsed.data.response });
  } catch (error) {
    console.error('Failed to record RSVP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
