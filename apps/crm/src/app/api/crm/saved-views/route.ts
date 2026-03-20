import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
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

const createViewSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.record(z.unknown()),
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    const { error } = await supabase
      .from('saved_views' as any)
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[SavedViews DELETE]', error);
      return NextResponse.json(
        { error: 'Failed to delete view' },
        { status: 500 },
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
