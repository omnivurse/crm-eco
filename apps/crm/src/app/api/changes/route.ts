import { NextRequest, NextResponse } from 'next/server';
import { broadcastChangeEvent } from '@crm-eco/lib/realtime';
import { createClient, verifyCrmAccess } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/changes
 * Get change events for the current user's organization
 */
export async function GET(request: NextRequest) {
  try {
    // Use cached auth to prevent concurrent token refresh conflicts
    const { profile, isAuthorized, error: authError } = await verifyCrmAccess();

    if (!isAuthorized || !profile) {
      const status = authError === 'Not authenticated' ? 401 : 403;
      return NextResponse.json({ error: authError || 'Forbidden' }, { status });
    }

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const entityTypes = searchParams.get('entityTypes')?.split(',').filter(Boolean) || [];
    const sourceTypes = searchParams.get('sourceTypes')?.split(',').filter(Boolean) || [];
    const minSeverity = searchParams.get('minSeverity') || 'info';

    // Build query using the change_feed_view
    let query = supabase
      .from('change_feed_view')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply entity type filter (CRM-relevant entities)
    if (entityTypes.length > 0) {
      query = query.in('entity_type', entityTypes);
    } else {
      // Default CRM entity types
      query = query.in('entity_type', [
        'record', 'lead', 'member', 'enrollment', 'deal',
        'task', 'note', 'activity', 'quote', 'invoice'
      ]);
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

    const { data: events, error: queryError } = await query;

    if (queryError) {
      console.error('Error fetching changes:', queryError);
      return NextResponse.json({ error: 'Failed to fetch changes' }, { status: 500 });
    }

    return NextResponse.json({ events: events || [] });
  } catch (err) {
    console.error('Get changes error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/changes
 * Record a new change event (internal use)
 */
export async function POST(request: NextRequest) {
  try {
    // Use cached auth to prevent concurrent token refresh conflicts
    const { profile, isAuthorized, error: authError } = await verifyCrmAccess();

    if (!isAuthorized || !profile) {
      const status = authError === 'Not authenticated' ? 401 : 403;
      return NextResponse.json({ error: authError || 'Forbidden' }, { status });
    }

    const supabase = await createClient();

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

    const { data: event, error: insertError } = await supabase
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

    if (insertError) {
      console.error('Error creating change event:', insertError);
      return NextResponse.json({ error: 'Failed to create change event' }, { status: 500 });
    }

    // Broadcast the event via Realtime (non-blocking)
    broadcastChangeEvent({
      id: event.id,
      org_id: event.org_id,
      source_type: event.source_type,
      source_name: event.source_name,
      change_type: event.change_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      entity_title: event.entity_title,
      severity: event.severity,
      requires_review: event.requires_review,
      title: event.title,
      description: event.description,
      sync_status: event.sync_status,
      actor_id: event.actor_id,
      actor_name: event.actor_name,
      created_at: event.created_at,
    }).catch(() => {}); // Fire and forget

    return NextResponse.json({ event });
  } catch (err) {
    console.error('Create change error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
