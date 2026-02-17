import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

const updateNoteSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  color: z.string().optional(),
  record_id: z.string().uuid().optional().nullable(),
  record_type: z.string().optional().nullable(),
  is_pinned: z.boolean().optional(),
  is_private: z.boolean().optional(),
  folder: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

/**
 * PATCH /api/crm/sticky-notes/[id]
 * Update a sticky note.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify ownership and organization
    const { data: existing, error: fetchError } = await supabase
      .from('notes')
      .select('id, owner_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (existing.owner_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
    if (parsed.data.color !== undefined) updateData.color = parsed.data.color;
    if (parsed.data.is_pinned !== undefined) updateData.is_pinned = parsed.data.is_pinned;
    if (parsed.data.is_private !== undefined) updateData.is_private = parsed.data.is_private;
    if (parsed.data.folder !== undefined) updateData.folder = parsed.data.folder;
    if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
    if (parsed.data.record_id !== undefined) updateData.record_id = parsed.data.record_id;
    if (parsed.data.record_type !== undefined) updateData.record_type = parsed.data.record_type;

    const { data: note, error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating sticky note:', error);
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error('Error in PATCH /api/crm/sticky-notes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/sticky-notes/[id]
 * Delete a sticky note. Only the owner can delete.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    // Verify ownership and organization
    const { data: existing, error: fetchError } = await supabase
      .from('notes')
      .select('id, owner_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (existing.owner_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden: only the owner can delete this note' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting sticky note:', deleteError);
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error in DELETE /api/crm/sticky-notes/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
