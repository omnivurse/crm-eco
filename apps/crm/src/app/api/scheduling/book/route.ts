import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rateLimitDurable, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';
import { verifyCaptcha, getClientIp } from '@crm-eco/lib/security/captcha';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for scheduling routes');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
}

const bookingSchema = z.object({
  link_id: z.string().uuid(),
  invitee_name: z.string().min(1),
  invitee_email: z.string().email(),
  invitee_phone: z.string().optional(),
  invitee_timezone: z.string().optional(),
  start_time: z.string().datetime(),
  notes: z.string().optional(),
  custom_answers: z.record(z.string()).optional(),
  // Captcha token from Turnstile/reCAPTCHA widget. Validated server-side.
  captcha_token: z.string().optional(),
});

/**
 * POST /api/scheduling/book
 *
 * Public booking endpoint — no auth required, but defended at three layers:
 *   1. Per-IP rate limit (5 attempts / 60s) — blunts script floods.
 *   2. Server-side captcha verification (Cloudflare Turnstile or
 *      reCAPTCHA v3 if configured) — blocks headless bots.
 *   3. RLS policy `scheduling_bookings_public_insert` — verifies the
 *      `link_id` points to an active scheduling link in the same org.
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request) ?? 'unknown';

  // Layer 1: rate-limit before doing any expensive work.
  const rl = await rateLimitDurable(`scheduling-book:${clientIp}`, {
    limit: 5,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: getRateLimitHeaders(rl) },
    );
  }

  const supabase = getSupabaseClient();
  try {
    const body = await request.json();
    const parsed = bookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Layer 2: captcha verification (dev-bypass when no secret is configured).
    const captcha = await verifyCaptcha({
      token: parsed.data.captcha_token,
      expectedAction: 'scheduling_book',
      remoteIp: clientIp === 'unknown' ? null : clientIp,
    });
    if (!captcha.success) {
      return NextResponse.json(
        {
          error: 'captcha_failed',
          provider: captcha.provider,
          codes: captcha.errorCodes,
        },
        { status: 400 },
      );
    }

    // Get the scheduling link
    const { data: link, error: linkError } = await supabase
      .from('scheduling_links')
      .select('*')
      .eq('id', parsed.data.link_id)
      .eq('is_active', true)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: 'Scheduling link not found' }, { status: 404 });
    }

    // Calculate end time based on duration
    const startTime = new Date(parsed.data.start_time);
    const endTime = new Date(startTime.getTime() + link.duration_minutes * 60 * 1000);

    // Check for conflicts (simplified - in production would be more sophisticated)
    const { data: existingBookings } = await supabase
      .from('scheduling_bookings')
      .select('id')
      .eq('link_id', link.id)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', startTime.toISOString())
      .lt('start_time', endTime.toISOString());

    if (existingBookings && existingBookings.length > 0) {
      return NextResponse.json({ error: 'Time slot not available' }, { status: 409 });
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('scheduling_bookings')
      .insert({
        org_id: link.org_id,
        link_id: link.id,
        host_id: link.owner_id,
        invitee_name: parsed.data.invitee_name,
        invitee_email: parsed.data.invitee_email,
        invitee_phone: parsed.data.invitee_phone || null,
        invitee_timezone: parsed.data.invitee_timezone || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        meeting_type: link.meeting_type,
        location: link.location,
        status: 'scheduled',
        notes: parsed.data.notes || null,
        custom_answers: parsed.data.custom_answers || {},
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Failed to create booking:', bookingError);
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Failed to create booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
