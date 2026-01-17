import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Use service role for public access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const bookingSchema = z.object({
  link_id: z.string().uuid(),
  invitee_name: z.string().min(1),
  invitee_email: z.string().email(),
  invitee_phone: z.string().optional(),
  invitee_timezone: z.string().optional(),
  start_time: z.string().datetime(),
  notes: z.string().optional(),
  custom_answers: z.record(z.string()).optional(),
});

/**
 * POST /api/scheduling/book
 * Create a new booking (public, no auth required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
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
