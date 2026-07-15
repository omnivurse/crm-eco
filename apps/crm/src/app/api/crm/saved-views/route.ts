import { NextRequest, NextResponse } from 'next/server';
import {
  createClient,
  getAuthProfile,
  getAuthUser,
} from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/saved-views?page_key=contacts
 * List saved views for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const pageKey = searchParams.get('page_key') || 'contacts';

    const { data, error } = await supabase
      .from('saved_views' as any)
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('page_key', pageKey)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('[SavedViews GET]', error);
      return NextResponse.json(
        { error: 'Failed to fetch saved views' },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('[SavedViews GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// `filters` is a free-form JSONB blob — we accept either the legacy
// `Record<string, unknown>` shape or the newer "view state" object
// ({ filters: ViewFilter[], sort?, columns?, scope?, viewMode?, search? })
// used by the V2 saved-views menu. Either way the storage is JSONB so
// we only need to validate the outer type.
const createViewSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.union([z.record(z.unknown()), z.array(z.unknown())]),
  page_key: z.string().default('contacts'),
  is_default: z.boolean().default(false),
});

/**
 * POST /api/crm/saved-views
 * Create a new saved view
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createViewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { user } = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If setting as default, unset other defaults first
    if (parsed.data.is_default) {
      await supabase
        .from('saved_views' as any)
        .update({ is_default: false })
        .eq('organization_id', profile.organization_id)
        .eq('user_id', user.id)
        .eq('page_key', parsed.data.page_key);
    }

    const { data, error } = await supabase
      .from('saved_views' as any)
      .insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      console.error('[SavedViews POST]', error);
      return NextResponse.json(
        { error: 'Failed to create view' },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[SavedViews POST]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

const patchViewSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  filters: z.union([z.record(z.unknown()), z.array(z.unknown())]).optional(),
  is_default: z.boolean().optional(),
});

/**
 * PATCH /api/crm/saved-views
 * Rename, overwrite state, or toggle is_default on a saved view.
 */
export async function PATCH(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = patchViewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { user } = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, ...patch } = parsed.data;

    // Look up the view first so we know its page_key when swapping defaults.
    const { data: existing, error: loadError } = await supabase
      .from('saved_views' as any)
      .select('id, page_key, user_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (loadError || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Clear prior defaults within the same page_key when marking this as default.
    if (patch.is_default === true) {
      await supabase
        .from('saved_views' as any)
        .update({ is_default: false })
        .eq('organization_id', profile.organization_id)
        .eq('user_id', user.id)
        .eq('page_key', existing.page_key);
    }

    const { data, error } = await supabase
      .from('saved_views' as any)
      .update(patch)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[SavedViews PATCH]', error);
      return NextResponse.json(
        { error: 'Failed to update view' },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[SavedViews PATCH]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/crm/saved-views?id=<uuid>
 * Delete a saved view
 */
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: 'Missing view id' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Soft-delete (move to Trash) so a removed view can be restored via Undo.
    const { data: updated, error } = await (supabase as any)
      .from('saved_views')
      .update({ deleted_at: new Date().toISOString(), deleted_origin: 'user' })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      console.error('[SavedViews DELETE]', error);
      return NextResponse.json(
        { error: 'Failed to delete view' },
        { status: 500 },
      );
    }

    // 0 rows = not found / not the owner (RLS) — don't report a false success.
    if (!updated || (updated as unknown[]).length === 0) {
      return NextResponse.json(
        { error: 'View not found or not permitted' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SavedViews DELETE]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
