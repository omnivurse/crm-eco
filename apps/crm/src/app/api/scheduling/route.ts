import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

const availabilitySchema = z.record(z.array(z.object({
  start: z.string(),
  end: z.string(),
})));

const createSchedulingLinkSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().optional(),
  duration_minutes: z.number().min(5).max(480),
  buffer_minutes: z.number().min(0).max(120).optional(),
  meeting_type: z.enum(['call', 'video', 'in_person']),
  video_provider: z.string().optional(),
  location: z.string().optional(),
  availability: availabilitySchema.optional(),
  timezone: z.string().optional(),
  min_notice_hours: z.number().min(0).optional(),
  max_days_in_advance: z.number().min(1).max(365).optional(),
  is_active: z.boolean().optional(),
});

/**
 * GET /api/scheduling
 * List all scheduling links for the current user
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: links, error } = await supabase
      .from('scheduling_links')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch scheduling links:', error);
      return NextResponse.json({ error: 'Failed to fetch scheduling links' }, { status: 500 });
    }

    return NextResponse.json(links || []);
  } catch (error) {
    console.error('Failed to fetch scheduling links:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scheduling
 * Create a new scheduling link
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createSchedulingLinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Check if slug is unique
    const { data: existing } = await supabase
      .from('scheduling_links')
      .select('id')
      .eq('org_id', profile.organization_id)
      .eq('slug', parsed.data.slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
    }

    const defaultAvailability = {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
    };

    const { data: link, error } = await supabase
      .from('scheduling_links')
      .insert({
        org_id: profile.organization_id,
        owner_id: profile.id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description || null,
        duration_minutes: parsed.data.duration_minutes,
        buffer_minutes: parsed.data.buffer_minutes || 0,
        meeting_type: parsed.data.meeting_type,
        video_provider: parsed.data.video_provider || null,
        location: parsed.data.location || null,
        availability: parsed.data.availability || defaultAvailability,
        timezone: parsed.data.timezone || 'America/New_York',
        min_notice_hours: parsed.data.min_notice_hours || 24,
        max_days_in_advance: parsed.data.max_days_in_advance || 60,
        is_active: parsed.data.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create scheduling link:', error);
      return NextResponse.json({ error: 'Failed to create scheduling link' }, { status: 500 });
    }

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error('Failed to create scheduling link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
