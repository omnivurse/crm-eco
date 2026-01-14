import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getMacroById, updateMacro, deleteMacro } from '@/lib/automation';

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

const actionTypeSchema = z.enum([
  'update_fields',
  'assign_owner',
  'create_task',
  'create_activity',
  'add_note',
  'notify',
  'move_stage',
  'start_cadence',
  'stop_cadence',
  'create_enrollment_draft',
]);

const crmRoleSchema = z.enum([
  'crm_admin',
  'crm_manager',
  'crm_agent',
  'crm_viewer',
]);

const updateMacroSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
  actions: z.array(z.object({
    id: z.string(),
    type: actionTypeSchema,
    config: z.record(z.unknown()),
    order: z.number(),
  })).optional(),
  is_enabled: z.boolean().optional(),
  display_order: z.number().optional(),
  allowed_roles: z.array(crmRoleSchema).optional(),
});

/**
 * GET /api/automation/macros/[id]
 * Get a specific macro
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const macro = await getMacroById(id);
    if (!macro) {
      return NextResponse.json({ error: 'Macro not found' }, { status: 404 });
    }

    return NextResponse.json(macro);
  } catch (error) {
    console.error('Failed to fetch macro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/automation/macros/[id]
 * Update a macro
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateMacroSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const macro = await updateMacro(id, parsed.data);
    return NextResponse.json(macro);
  } catch (error) {
    console.error('Failed to update macro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automation/macros/[id]
 * Delete a macro
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteMacro(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete macro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
