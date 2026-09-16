/**
 * GET /api/crm/comms/dead-letters
 * PATCH /api/crm/comms/dead-letters
 *
 * Parked inbound mail queue for System Health. crm_admin only. RLS still
 * scopes rows (org admins see their tenant; unroutable/null-org rows need
 * is_super_admin). Never returns `payload` — that can hold message bodies.
 *
 * PATCH marks one row reviewed (`resolved_at`). It does not deliver the mail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIST_COLUMNS =
  'id, source, error_category, error, created_at, organization_id, org_id, resolved_at';

const resolveBody = z.object({
  id: z.string().regex(UUID_RE),
  resolved: z.literal(true),
});

function forbidIfNotAdmin(profile: { crm_role?: string | null } | null) {
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (profile.crm_role !== 'crm_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const profile = await getAuthProfile();
    const denied = forbidIfNotAdmin(profile);
    if (denied) return denied;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('comms_dead_letters')
      .select(LIST_COLUMNS)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[dead-letters] list failed:', error.message);
      return NextResponse.json({ error: 'Failed to load parked mail' }, { status: 500 });
    }

    return NextResponse.json({
      items: data ?? [],
      total: data?.length ?? 0,
    });
  } catch (err) {
    console.error('[dead-letters] GET', err);
    return NextResponse.json({ error: 'Failed to load parked mail' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    const denied = forbidIfNotAdmin(profile);
    if (denied) return denied;

    const parsed = resolveBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const supabase = await createClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('comms_dead_letters')
      .update({
        resolved_at: now,
        resolved_by: profile!.user_id,
      })
      .eq('id', parsed.data.id)
      .is('resolved_at', null)
      .select('id, resolved_at')
      .maybeSingle();

    if (error) {
      console.error('[dead-letters] resolve failed:', error.message);
      return NextResponse.json({ error: 'Failed to mark reviewed' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found or already reviewed' }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (err) {
    console.error('[dead-letters] PATCH', err);
    return NextResponse.json({ error: 'Failed to mark reviewed' }, { status: 500 });
  }
}
