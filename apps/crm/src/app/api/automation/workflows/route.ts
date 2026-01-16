import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getWorkflows, createWorkflow } from '@/lib/automation';

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

/**
 * GET /api/automation/workflows
 * List all workflows for the current organization
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.crm_role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('moduleId');

    const workflows = await getWorkflows(
      profile.organization_id,
      moduleId || undefined
    );

    return NextResponse.json(workflows);
  } catch (error) {
    console.error('Get workflows error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createWorkflowSchema = z.object({
  module_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  trigger_type: z.enum(['on_create', 'on_update', 'scheduled', 'webform']),
  trigger_config: z.record(z.unknown()).optional(),
  conditions: z.unknown(),
  actions: z.array(z.unknown()),
  is_enabled: z.boolean().optional(),
  priority: z.number().optional(),
});

/**
 * POST /api/automation/workflows
 * Create a new workflow
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
    const parsed = createWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const workflow = await createWorkflow({
      org_id: profile.organization_id,
      module_id: parsed.data.module_id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      trigger_type: parsed.data.trigger_type,
      trigger_config: parsed.data.trigger_config || {},
      conditions: parsed.data.conditions as any,
      actions: parsed.data.actions as any,
      is_enabled: parsed.data.is_enabled ?? true,
      priority: parsed.data.priority || 100,
      webhook_secret: null,
      created_by: profile.id,
    });

    return NextResponse.json(workflow);
  } catch (error) {
    console.error('Create workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
