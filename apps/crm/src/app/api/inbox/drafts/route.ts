import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';

/**
 * GET /api/inbox/drafts
 * List drafts for the current user
 */
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('inbox_drafts')
      .select('*')
      .eq('author_id', profile.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('List drafts error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ drafts: data || [] });
  } catch (error) {
    console.error('Error in GET /api/inbox/drafts:', error);
    return NextResponse.json({ error: 'Failed to list drafts' }, { status: 500 });
  }
}

/**
 * POST /api/inbox/drafts
 * Create a new draft
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('inbox_drafts')
      .insert({
        org_id: profile.organization_id,
        author_id: profile.id,
        conversation_id: body.conversation_id || null,
        to_addresses: body.to_addresses || [],
        cc_addresses: body.cc_addresses || [],
        bcc_addresses: body.bcc_addresses || [],
        subject: body.subject || null,
        body_html: body.body_html || null,
        body_text: body.body_text || null,
        signature_id: body.signature_id || null,
        attachments: body.attachments || [],
        scheduled_at: body.scheduled_at || null,
        is_reply: body.is_reply || false,
        reply_mode: body.reply_mode || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Create draft error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ draft: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/inbox/drafts:', error);
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
  }
}
