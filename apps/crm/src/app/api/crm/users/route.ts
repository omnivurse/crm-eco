import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/crm/users?search=<term>
 *
 * Org-scoped user/profile lookup used by `user`-type fields
 * (see InlineLookupField). The `search` param serves two callers:
 *   1. Autocomplete — a typed fragment matched against name/email.
 *   2. Label resolution — the stored UUID is passed back as `search`
 *      so the read view can show a name instead of a raw id.
 *
 * Returns `{ users: [{ id, full_name, email }] }`, the shape the
 * component consumes (it reads `json.users`, then `u.full_name ||
 * u.email`).
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || '10', 10) || 10,
      50,
    );

    const supabase = await createClient();

    let query = supabase
      .from('profiles')
      .select('id, full_name, display_name, email')
      .eq('organization_id', profile.organization_id)
      .order('full_name', { ascending: true })
      .limit(limit);

    if (search && UUID_RE.test(search)) {
      // Label-resolution path: the component passes the stored UUID back
      // as `search` so the read view can render a name. Resolve it even if
      // the user is now inactive, otherwise the field would show a raw id.
      query = query.eq('id', search);
    } else {
      // Autocomplete path: only surface active users as pickable options.
      query = query.eq('is_active', true);
      if (search) {
        const safe = search.replace(/[%_,().\\]/g, '\\$&');
        query = query.or(
          `full_name.ilike.%${safe}%,display_name.ilike.%${safe}%,email.ilike.%${safe}%`,
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Users GET]', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 },
      );
    }

    const users = (data || []).map((u) => ({
      id: u.id,
      full_name: u.full_name || u.display_name || null,
      email: u.email,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[Users GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
