import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/extensions/reviews?extension_id=<uuid>
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const extensionId = request.nextUrl.searchParams.get('extension_id');
    if (!extensionId) return NextResponse.json({ error: 'Missing extension_id' }, { status: 400 });

    const { data, error } = await supabase
      .from('crm_extension_reviews')
      .select(`
        *,
        reviewer:profiles!inner(full_name, avatar_url)
      `)
      .eq('extension_id', extensionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ExtensionReviews] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    return NextResponse.json({ reviews: data || [] });
  } catch (error) {
    console.error('[ExtensionReviews] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/extensions/reviews — create or update a review
// ---------------------------------------------------------------------------
const reviewSchema = z.object({
  extension_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    // Check if extension is installed by this org (verified review)
    const { data: install } = await supabase
      .from('crm_extension_installs')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('extension_id', parsed.data.extension_id)
      .single();

    const { data, error } = await supabase
      .from('crm_extension_reviews')
      .upsert(
        {
          extension_id: parsed.data.extension_id,
          organization_id: profile.organization_id,
          reviewer_id: profile.id,
          rating: parsed.data.rating,
          title: parsed.data.title || null,
          body: parsed.data.body || null,
          is_verified: !!install,
        },
        { onConflict: 'extension_id,organization_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[ExtensionReviews] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
    }

    return NextResponse.json({ review: data }, { status: 201 });
  } catch (error) {
    console.error('[ExtensionReviews] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/extensions/reviews?extension_id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const extensionId = request.nextUrl.searchParams.get('extension_id');
    if (!extensionId) return NextResponse.json({ error: 'Missing extension_id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_extension_reviews')
      .delete()
      .eq('extension_id', extensionId)
      .eq('reviewer_id', profile.id);

    if (error) {
      console.error('[ExtensionReviews] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ExtensionReviews] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
