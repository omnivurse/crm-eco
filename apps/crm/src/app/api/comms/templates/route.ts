import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

/**
 * GET /api/comms/templates
 * List all email templates for the current organization
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active') === 'true';

    let query = supabase
      .from('email_templates')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Get templates error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(templates || []);
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createTemplateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().optional(),
  category: z.string().default('general'),
  subject: z.string().min(1),
  body_html: z.string().min(1),
  body_text: z.string().optional(),
  from_name: z.string().optional(),
  from_email: z.string().email().optional(),
  reply_to: z.string().email().optional(),
  variables: z.array(z.object({
    key: z.string(),
    label: z.string(),
    default_value: z.string().optional(),
  })).optional(),
  is_active: z.boolean().optional().default(true),
});

/**
 * POST /api/comms/templates
 * Create a new email template
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get role for permission check
    const { data: profileWithRole } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', profile.id)
      .single();

    // Only allow admins/owners to create templates
    if (!['owner', 'admin'].includes(profileWithRole?.role || '') &&
        !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    // Check if slug is unique
    const { data: existing } = await supabase
      .from('email_templates')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('slug', parsed.data.slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Template slug already exists' }, { status: 400 });
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .insert({
        organization_id: profile.organization_id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description || null,
        category: parsed.data.category,
        subject: parsed.data.subject,
        body_html: parsed.data.body_html,
        body_text: parsed.data.body_text || null,
        from_name: parsed.data.from_name || null,
        from_email: parsed.data.from_email || null,
        reply_to: parsed.data.reply_to || null,
        variables: parsed.data.variables || [],
        is_active: parsed.data.is_active,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Create template error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
