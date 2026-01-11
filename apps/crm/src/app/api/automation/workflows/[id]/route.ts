import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getWorkflowById, updateWorkflow, deleteWorkflow } from '@/lib/automation';

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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/automation/workflows/[id]
 * Get a single workflow by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const workflow = await getWorkflowById(id);

    if (!workflow || workflow.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error('Get workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  trigger_type: z.enum(['on_create', 'on_update', 'scheduled', 'webform']).optional(),
  trigger_config: z.record(z.unknown()).optional(),
  conditions: z.unknown().optional(),
  actions: z.array(z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
  priority: z.number().optional(),
});

/**
 * PATCH /api/automation/workflows/[id]
 * Update a workflow
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify workflow belongs to org
    const existing = await getWorkflowById(id);
    if (!existing || existing.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const workflow = await updateWorkflow(id, parsed.data as any);

    return NextResponse.json(workflow);
  } catch (error) {
    console.error('Update workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/automation/workflows/[id]
 * Delete a workflow
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify workflow belongs to org
    const existing = await getWorkflowById(id);
    if (!existing || existing.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await deleteWorkflow(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
