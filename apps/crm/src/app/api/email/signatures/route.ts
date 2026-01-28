import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - List user's signatures
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's org and profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get signatures - user's own signatures
    const { data: signatures, error } = await supabase
      .from('email_signatures')
      .select('*')
      .eq('profile_id', profile.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching signatures:', error);
      return NextResponse.json({ error: 'Failed to fetch signatures' }, { status: 500 });
    }

    return NextResponse.json({ signatures });
  } catch (error) {
    console.error('Error in GET /api/email/signatures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new signature
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's org and profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
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

    if (!name || !content_html) {
      return NextResponse.json(
        { error: 'Name and content_html are required' },
        { status: 400 }
      );
    }

    // If this is set as default, unset other defaults first
    if (is_default) {
      await supabase
        .from('email_signatures')
        .update({ is_default: false })
        .eq('profile_id', profile.id)
        .eq('is_default', true);
    }

    // Create signature
    const { data: signature, error } = await supabase
      .from('email_signatures')
      .insert({
        org_id: profile.organization_id,
        profile_id: profile.id,
        name,
        content_html,
        content_text,
        logo_url,
        photo_url,
        social_links: social_links || {},
        is_default: is_default ?? false,
        include_in_replies: include_in_replies ?? true,
        include_in_new: include_in_new ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating signature:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A signature with this name already exists' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Failed to create signature' }, { status: 500 });
    }

    return NextResponse.json(signature, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/email/signatures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
