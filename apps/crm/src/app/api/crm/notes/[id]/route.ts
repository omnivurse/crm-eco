import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createCrmClient();
    const { id } = await params;

    // Fetch the note to verify ownership/permissions
    const { data: note, error: fetchError } = await supabase
      .from('crm_notes')
      .select('id, created_by, org_id')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (fetchError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Only the note creator or a crm_admin can delete
    if (note.created_by !== profile.id && profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden: only the author or an admin can delete this note' }, { status: 403 });
    }

    const { data: deleted, error: deleteError } = await supabase
      .from('crm_notes')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select('id')
      .single();

    if (deleteError) {
      if (deleteError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Note not found or already deleted' }, { status: 404 });
      }
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
