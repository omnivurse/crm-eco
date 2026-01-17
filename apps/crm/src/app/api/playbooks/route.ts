import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

const playbookItemSchema = z.object({
  type: z.enum(['task', 'question', 'resource', 'milestone']),
  title: z.string().min(1),
  description: z.string().optional(),
});

const playbookSectionSchema = z.object({
  section: z.string().min(1),
  items: z.array(playbookItemSchema),
});

const createPlaybookSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  content: z.array(playbookSectionSchema),
  target_modules: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

/**
 * GET /api/playbooks
 * List all playbooks for the current organization
 */
export async function GET() {
  try {
    const supabase = await createClient();
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

    const { data: playbooks, error } = await supabase
      .from('playbooks')
      .select('*')
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch playbooks:', error);
      return NextResponse.json({ error: 'Failed to fetch playbooks' }, { status: 500 });
    }

    return NextResponse.json(playbooks || []);
  } catch (error) {
    console.error('Failed to fetch playbooks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/playbooks
 * Create a new playbook
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPlaybookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { data: playbook, error } = await supabase
      .from('playbooks')
      .insert({
        org_id: profile.organization_id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        content: parsed.data.content,
        target_modules: parsed.data.target_modules || ['Deals'],
        is_active: parsed.data.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create playbook:', error);
      return NextResponse.json({ error: 'Failed to create playbook' }, { status: 500 });
    }

    return NextResponse.json(playbook, { status: 201 });
  } catch (error) {
    console.error('Failed to create playbook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
