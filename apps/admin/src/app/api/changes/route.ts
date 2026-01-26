import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

/**
 * GET /api/changes
 * Get all change events for the organization (admin view - sees all changes)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if user has admin role
    const adminRoles = ['super_admin', 'admin', 'manager'];
    if (!profile.role || !adminRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const entityTypes = searchParams.get('entityTypes')?.split(',').filter(Boolean) || [];
    const sourceTypes = searchParams.get('sourceTypes')?.split(',').filter(Boolean) || [];
    const minSeverity = searchParams.get('minSeverity') || 'info';
    const requiresReviewOnly = searchParams.get('requiresReview') === 'true';

    // Build query using the change_feed_view
    let query = supabase
      .from('change_feed_view')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply entity type filter
    if (entityTypes.length > 0) {
      query = query.in('entity_type', entityTypes);
    }

    // Apply source type filter
    if (sourceTypes.length > 0) {
      query = query.in('source_type', sourceTypes);
    }

    // Apply severity filter
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const minIndex = severityOrder.indexOf(minSeverity);
    if (minIndex >= 0) {
      const allowedSeverities = severityOrder.slice(0, minIndex + 1);
      query = query.in('severity', allowedSeverities);
    }

    // Apply requires review filter
    if (requiresReviewOnly) {
      query = query.eq('requires_review', true);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching changes:', error);
      return NextResponse.json({ error: 'Failed to fetch changes' }, { status: 500 });
    }

    return NextResponse.json({ events: events || [] });
  } catch (error) {
    console.error('Get changes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/changes
 * Record a new change event
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
      .select('id, organization_id, full_name, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      source_type = 'user',
      source_name,
      change_type,
      entity_type,
      entity_id,
      entity_title,
      severity = 'info',
      requires_review = false,
      title,
      description,
      diff,
      payload,
    } = body;

    if (!change_type || !entity_type || !entity_id || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: change_type, entity_type, entity_id, title' },
        { status: 400 }
      );
    }

    const { data: event, error } = await supabase
      .from('change_events')
      .insert({
        org_id: profile.organization_id,
        source_type,
        source_name,
        change_type,
        entity_type,
        entity_id,
        entity_title,
        severity,
        requires_review,
        title,
        description,
        diff,
        payload,
        actor_id: profile.id,
        actor_name: profile.full_name,
        actor_type: 'user',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating change event:', error);
      return NextResponse.json({ error: 'Failed to create change event' }, { status: 500 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Create change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
