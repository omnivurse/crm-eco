import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - Get single signature
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: signature, error } = await supabase
      .from('email_signatures')
      .select('*')
      .eq('id', id)
      .eq('profile_id', profile.id)
      .single();

    if (error || !signature) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    return NextResponse.json(signature);
  } catch (error) {
    console.error('Error in GET /api/email/signatures/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update signature
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('email_signatures')
      .select('id')
      .eq('id', id)
      .eq('profile_id', profile.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      content_html,
      content_text,
      logo_url,
      photo_url,
      social_links,
      is_default,
      include_in_replies,
      include_in_new,
    } = body;

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('email_signatures')
        .update({ is_default: false })
        .eq('profile_id', profile.id)
        .eq('is_default', true)
        .neq('id', id);
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (content_html !== undefined) updateData.content_html = content_html;
    if (content_text !== undefined) updateData.content_text = content_text;
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (photo_url !== undefined) updateData.photo_url = photo_url;
    if (social_links !== undefined) updateData.social_links = social_links;
    if (is_default !== undefined) updateData.is_default = is_default;
    if (include_in_replies !== undefined) updateData.include_in_replies = include_in_replies;
    if (include_in_new !== undefined) updateData.include_in_new = include_in_new;

    const { data: signature, error } = await supabase
      .from('email_signatures')
      .update(updateData)
      .eq('id', id)
      .eq('profile_id', profile.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating signature:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A signature with this name already exists' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Failed to update signature' }, { status: 500 });
    }

    return NextResponse.json(signature);
  } catch (error) {
    console.error('Error in PUT /api/email/signatures/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete signature
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('email_signatures')
      .select('id')
      .eq('id', id)
      .eq('profile_id', profile.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('email_signatures')
      .delete()
      .eq('id', id)
      .eq('profile_id', profile.id);

    if (error) {
      console.error('Error deleting signature:', error);
      return NextResponse.json({ error: 'Failed to delete signature' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/email/signatures/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
