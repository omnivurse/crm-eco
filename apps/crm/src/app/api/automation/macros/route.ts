import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createMacro, getMacros } from '@/lib/automation';

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

const createMacroSchema = z.object({
  module_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  actions: z.array(z.object({
    id: z.string(),
    type: actionTypeSchema,
    config: z.record(z.unknown()),
    order: z.number(),
  })),
  is_enabled: z.boolean().optional(),
  display_order: z.number().optional(),
  allowed_roles: z.array(crmRoleSchema).optional(),
});

/**
 * GET /api/automation/macros
 * List all macros for the current organization
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
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('module_id') || undefined;

    const macros = await getMacros(profile.organization_id, moduleId);
    return NextResponse.json(macros);
  } catch (error) {
    console.error('Failed to fetch macros:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automation/macros
 * Create a new macro
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
    const parsed = createMacroSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const macro = await createMacro({
      org_id: profile.organization_id,
      module_id: parsed.data.module_id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      icon: parsed.data.icon || 'zap',
      color: parsed.data.color || 'teal',
      actions: parsed.data.actions,
      is_enabled: parsed.data.is_enabled ?? true,
      display_order: parsed.data.display_order || 100,
      allowed_roles: (parsed.data.allowed_roles || ['crm_admin', 'crm_manager', 'crm_agent']) as ('crm_admin' | 'crm_manager' | 'crm_agent' | 'crm_viewer')[],
      created_by: profile.id,
    });

    return NextResponse.json(macro, { status: 201 });
  } catch (error) {
    console.error('Failed to create macro:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
