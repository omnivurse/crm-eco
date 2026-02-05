import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { getMacroById, updateMacro, deleteMacro } from '@/lib/automation';

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
    const profile = await getAuthProfile();
    if (!profile) {
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
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
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
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
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
