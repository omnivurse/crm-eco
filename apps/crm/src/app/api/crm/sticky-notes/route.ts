import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createNoteSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().optional().default(''),
  color: z.string().optional().default('yellow'),
  record_id: z.string().uuid().optional().nullable(),
  record_type: z.string().optional().nullable(),
  is_pinned: z.boolean().optional().default(false),
  is_private: z.boolean().optional().default(true),
  folder: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

/**
 * GET /api/crm/sticky-notes
 * Fetch sticky notes for the current user.
 * Query params: record_type, record_id, is_pinned, folder, limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const recordType = searchParams.get('record_type');
    const recordId = searchParams.get('record_id');
    const isPinned = searchParams.get('is_pinned');
    const folder = searchParams.get('folder');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('notes')
      .select('*', { count: 'exact' })
      .eq('owner_id', profile.id)
      .eq('organization_id', profile.organization_id)
      .is('deleted_at' as never, null)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (recordType) {
      query = query.eq('record_type', recordType);
    }

    if (recordId) {
      query = query.eq('record_id', recordId);
    }

    if (isPinned === 'true') {
      query = query.eq('is_pinned', true);
    }

    if (folder) {
      query = query.eq('folder', folder);
    }

    const { data: notes, error, count } = await query;

    if (error) {
      console.error('Error fetching sticky notes:', error);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json({
      notes: notes || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('Error in GET /api/crm/sticky-notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/sticky-notes
 * Create a new sticky note.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        title: parsed.data.title,
        content: parsed.data.content,
        color: parsed.data.color,
        record_id: parsed.data.record_id || null,
        record_type: parsed.data.record_type || null,
        is_pinned: parsed.data.is_pinned,
        is_private: parsed.data.is_private,
        folder: parsed.data.folder || null,
        tags: parsed.data.tags || null,
        owner_id: profile.id,
        user_id: profile.user_id,
        organization_id: profile.organization_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sticky note:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/crm/sticky-notes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
