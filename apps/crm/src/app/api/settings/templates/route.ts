import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// GET /api/settings/templates - List templates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get('channel');
    const category = searchParams.get('category');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('crm_message_templates')
      .select('*')
      .or(`org_id.eq.${profile.organization_id},is_system.eq.true`)
      .eq('is_active', true)
      .order('usage_count', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (channel) {
      query = query.eq('channel', channel);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: templates, error } = await query;

    if (error) throw error;

    return NextResponse.json({ templates: templates || [] });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST /api/settings/templates - Create template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { name, subject, body: templateBody, channel, category, moduleId } = body;

    if (!name || !templateBody || !channel) {
      return NextResponse.json({
        error: 'Name, body, and channel are required'
      }, { status: 400 });
    }

    if (!['email', 'sms'].includes(channel)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
    }

    if (channel === 'email' && !subject) {
      return NextResponse.json({ error: 'Subject is required for email templates' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Create template
    const { data: template, error } = await supabase
      .from('crm_message_templates')
      .insert({
        org_id: profile.organization_id,
        module_id: moduleId || null,
        channel,
        name,
        subject: subject || null,
        body: templateBody,
        category: category || null,
        is_system: false,
        usage_count: 0,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
