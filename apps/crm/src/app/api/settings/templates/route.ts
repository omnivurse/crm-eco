import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthUser, getAuthProfile } from '@/lib/supabase-server';

// GET /api/settings/templates - List templates
export async function GET(request: NextRequest) {
  try {
    // Use cached auth to prevent concurrent token refresh conflicts
    const { user } = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const channel = searchParams.get('channel');
    const category = searchParams.get('category');
    const productType = searchParams.get('product_type');

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

    // Filter by product_type: show templates matching the type OR general (null) templates
    if (productType) {
      query = query.or(`product_type.eq.${productType},product_type.is.null`);
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
    const body = await request.json();
    const { name, subject, body: templateBody, channel, category, moduleId, product_type } = body;

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

    // Use cached auth to prevent concurrent token refresh conflicts
    const { user } = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const supabase = await createClient();

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
        product_type: product_type || null,
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
