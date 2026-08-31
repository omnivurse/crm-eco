import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { DEFAULT_PIFH_LOGO_PATH } from '@/lib/email/signature-html';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - List user's signatures
export async function GET(_request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const supabase = await createClient() as any;

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

    const [{ data: profileRow }, { data: org }] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, email, phone, avatar_url')
        .eq('id', profile.id)
        .maybeSingle(),
      supabase
        .from('organizations')
        .select('name, domain, branding')
        .eq('id', profile.organization_id)
        .maybeSingle(),
    ]);

    const branding =
      org?.branding && typeof org.branding === 'object' && !Array.isArray(org.branding)
        ? (org.branding as Record<string, unknown>)
        : {};
    const brandingLogo = typeof branding.logo_url === 'string' ? branding.logo_url : '';
    const brandingWebsite =
      (typeof branding.website === 'string' && branding.website) ||
      (typeof branding.company_website === 'string' && branding.company_website) ||
      '';

    return NextResponse.json({
      signatures,
      defaults: {
        full_name: profileRow?.full_name || profile.full_name || '',
        email: profileRow?.email || '',
        phone: profileRow?.phone || '',
        company_name: org?.name || '',
        website: brandingWebsite || org?.domain || '',
        logo_url: brandingLogo || DEFAULT_PIFH_LOGO_PATH,
        photo_url: profileRow?.avatar_url || '',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/email/signatures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new signature
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const supabase = await createClient() as any;

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
