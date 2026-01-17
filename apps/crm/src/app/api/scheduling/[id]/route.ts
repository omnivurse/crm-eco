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

const updateSchedulingLinkSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().nullable().optional(),
  duration_minutes: z.number().min(5).max(480).optional(),
  buffer_minutes: z.number().min(0).max(120).optional(),
  meeting_type: z.enum(['call', 'video', 'in_person']).optional(),
  video_provider: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  availability: availabilitySchema.optional(),
  timezone: z.string().optional(),
  min_notice_hours: z.number().min(0).optional(),
  max_days_in_advance: z.number().min(1).max(365).optional(),
  is_active: z.boolean().optional(),
});

/**
 * GET /api/scheduling/[id]
 * Get a single scheduling link by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: link, error } = await supabase
      .from('scheduling_links')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (error || !link) {
      return NextResponse.json({ error: 'Scheduling link not found' }, { status: 404 });
    }

    return NextResponse.json(link);
  } catch (error) {
    console.error('Failed to fetch scheduling link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/scheduling/[id]
 * Update a scheduling link
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const parsed = updateSchedulingLinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // If updating slug, check uniqueness
    if (parsed.data.slug) {
      const { data: existing } = await supabase
        .from('scheduling_links')
        .select('id')
        .eq('org_id', profile.organization_id)
        .eq('slug', parsed.data.slug)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Slug already exists' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.slug !== undefined) updateData.slug = parsed.data.slug;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.duration_minutes !== undefined) updateData.duration_minutes = parsed.data.duration_minutes;
    if (parsed.data.buffer_minutes !== undefined) updateData.buffer_minutes = parsed.data.buffer_minutes;
    if (parsed.data.meeting_type !== undefined) updateData.meeting_type = parsed.data.meeting_type;
    if (parsed.data.video_provider !== undefined) updateData.video_provider = parsed.data.video_provider;
    if (parsed.data.location !== undefined) updateData.location = parsed.data.location;
    if (parsed.data.availability !== undefined) updateData.availability = parsed.data.availability;
    if (parsed.data.timezone !== undefined) updateData.timezone = parsed.data.timezone;
    if (parsed.data.min_notice_hours !== undefined) updateData.min_notice_hours = parsed.data.min_notice_hours;
    if (parsed.data.max_days_in_advance !== undefined) updateData.max_days_in_advance = parsed.data.max_days_in_advance;
    if (parsed.data.is_active !== undefined) updateData.is_active = parsed.data.is_active;
    updateData.updated_at = new Date().toISOString();

    const { data: link, error } = await supabase
      .from('scheduling_links')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error || !link) {
      console.error('Failed to update scheduling link:', error);
      return NextResponse.json({ error: 'Failed to update scheduling link' }, { status: 500 });
    }

    return NextResponse.json(link);
  } catch (error) {
    console.error('Failed to update scheduling link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scheduling/[id]
 * Delete a scheduling link
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { error } = await supabase
      .from('scheduling_links')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id);

    if (error) {
      console.error('Failed to delete scheduling link:', error);
      return NextResponse.json({ error: 'Failed to delete scheduling link' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete scheduling link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
