import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';

/**
 * GET /api/inbox/drafts/[id]
 * Get a single draft
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('inbox_drafts')
      .select('*')
      .eq('id', id)
      .eq('author_id', profile.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ draft: data });
  } catch (error) {
    console.error('Error in GET /api/inbox/drafts/[id]:', error);
    return NextResponse.json({ error: 'Failed to get draft' }, { status: 500 });
  }
}

/**
 * PUT /api/inbox/drafts/[id]
 * Update a draft (auto-save)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    if (body.to_addresses !== undefined) updates.to_addresses = body.to_addresses;
    if (body.cc_addresses !== undefined) updates.cc_addresses = body.cc_addresses;
    if (body.bcc_addresses !== undefined) updates.bcc_addresses = body.bcc_addresses;
    if (body.subject !== undefined) updates.subject = body.subject;
    if (body.body_html !== undefined) updates.body_html = body.body_html;
    if (body.body_text !== undefined) updates.body_text = body.body_text;
    if (body.signature_id !== undefined) updates.signature_id = body.signature_id;
    if (body.attachments !== undefined) updates.attachments = body.attachments;
    if (body.scheduled_at !== undefined) updates.scheduled_at = body.scheduled_at;

    const { data, error } = await supabase
      .from('inbox_drafts')
      .update(updates)
      .eq('id', id)
      .eq('author_id', profile.id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Draft not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ draft: data });
  } catch (error) {
    console.error('Error in PUT /api/inbox/drafts/[id]:', error);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
}

/**
 * DELETE /api/inbox/drafts/[id]
 * Delete a draft
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('inbox_drafts')
      .delete()
      .eq('id', id)
      .eq('author_id', profile.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/inbox/drafts/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}
