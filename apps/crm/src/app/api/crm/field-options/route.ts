import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Field options for a CRM custom field. Stored as a JSONB array on
 * `crm_fields.options` so we don't need a second physical table —
 * the master `crm_fields` row already exists per (org, module, field).
 *
 * Wire shape (returned to the UI):
 *   { id, value, label, color, icon, is_default, is_active,
 *     display_order, metadata }
 *
 * Legacy storage shapes we normalize on read:
 *   - "[]" (the literal string)  → []
 *   - ["Foo","Bar"] (plain strings) → reshape into FieldOption objects
 */

interface FieldOption {
  id: string;
  value: string;
  label: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  metadata: Record<string, unknown>;
}

/** Coerce whatever currently sits in crm_fields.options into a clean array. */
function normalizeOptions(raw: unknown): FieldOption[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.map((entry, idx): FieldOption => {
    if (typeof entry === 'string') {
      return {
        id: randomUUID(),
        value: entry,
        label: entry,
        color: null,
        icon: null,
        is_default: false,
        is_active: true,
        display_order: idx,
        metadata: {},
      };
    }
    const obj = (entry ?? {}) as Record<string, unknown>;
    return {
      id: (obj.id as string) || randomUUID(),
      value: String(obj.value ?? obj.label ?? ''),
      label: String(obj.label ?? obj.value ?? ''),
      color: (obj.color as string | null | undefined) ?? null,
      icon: (obj.icon as string | null | undefined) ?? null,
      is_default: Boolean(obj.is_default),
      is_active: obj.is_active === undefined ? true : Boolean(obj.is_active),
      display_order: typeof obj.display_order === 'number' ? obj.display_order : idx,
      metadata: (obj.metadata as Record<string, unknown> | undefined) ?? {},
    };
  });
}

/** Sort by display_order then label so the wire order is stable. */
function sortOptions(opts: FieldOption[]): FieldOption[] {
  return [...opts].sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return a.label.localeCompare(b.label);
  });
}

/** Fetch crm_fields row + its normalized options. Org-scoped. */
async function loadField(supabase: Awaited<ReturnType<typeof createClient>>, fieldId: string, orgId: string) {
  const { data, error } = await supabase
    .from('crm_fields')
    .select('id, org_id, options')
    .eq('id', fieldId)
    .eq('org_id', orgId)
    .single();
  if (error || !data) return { error: error || new Error('Field not found') };
  return { field: data, options: normalizeOptions((data as { options: unknown }).options) };
}

/** Persist a normalized array back onto crm_fields.options. */
async function saveOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fieldId: string,
  orgId: string,
  options: FieldOption[]
) {
  return supabase
    .from('crm_fields')
    .update({ options: sortOptions(options) })
    .eq('id', fieldId)
    .eq('org_id', orgId);
}

// ---------------------------------------------------------------------------
// GET /api/crm/field-options?field_id=<uuid>&active_only=true|false
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const fieldId = request.nextUrl.searchParams.get('field_id');
    if (!fieldId) return NextResponse.json({ error: 'Missing field_id' }, { status: 400 });

    const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';

    const loaded = await loadField(supabase, fieldId, profile.organization_id);
    if ('error' in loaded) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    let options = sortOptions(loaded.options);
    if (activeOnly) options = options.filter((o) => o.is_active);

    return NextResponse.json({ options });
  } catch (error) {
    console.error('[FieldOptions] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/field-options — append an option to a field
// ---------------------------------------------------------------------------
const createSchema = z.object({
  field_id: z.string().uuid(),
  value: z.string().min(1).max(255),
  label: z.string().min(1).max(255),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  is_default: z.boolean().optional(),
  display_order: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const loaded = await loadField(supabase, parsed.data.field_id, profile.organization_id);
    if ('error' in loaded) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    if (loaded.options.some((o) => o.value === parsed.data.value)) {
      return NextResponse.json({ error: 'Option value already exists for this field' }, { status: 409 });
    }

    const next: FieldOption = {
      id: randomUUID(),
      value: parsed.data.value,
      label: parsed.data.label,
      color: parsed.data.color ?? null,
      icon: parsed.data.icon ?? null,
      is_default: parsed.data.is_default ?? false,
      is_active: true,
      display_order: parsed.data.display_order ?? loaded.options.length,
      metadata: parsed.data.metadata ?? {},
    };

    const { error } = await saveOptions(
      supabase,
      parsed.data.field_id,
      profile.organization_id,
      [...loaded.options, next]
    );
    if (error) {
      console.error('[FieldOptions] POST save error:', error);
      return NextResponse.json({ error: 'Failed to create option' }, { status: 500 });
    }

    return NextResponse.json({ option: next }, { status: 201 });
  } catch (error) {
    console.error('[FieldOptions] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/field-options — patch one option in-place
// Body: { field_id, id, ...updates }
// ---------------------------------------------------------------------------
const updateSchema = z.object({
  field_id: z.string().uuid(),
  id: z.string().uuid(),
  label: z.string().min(1).max(255).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const loaded = await loadField(supabase, parsed.data.field_id, profile.organization_id);
    if ('error' in loaded) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    const idx = loaded.options.findIndex((o) => o.id === parsed.data.id);
    if (idx === -1) return NextResponse.json({ error: 'Option not found' }, { status: 404 });

    const merged: FieldOption = {
      ...loaded.options[idx],
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
      ...(parsed.data.color !== undefined && { color: parsed.data.color ?? null }),
      ...(parsed.data.icon !== undefined && { icon: parsed.data.icon ?? null }),
      ...(parsed.data.is_default !== undefined && { is_default: parsed.data.is_default }),
      ...(parsed.data.is_active !== undefined && { is_active: parsed.data.is_active }),
      ...(parsed.data.display_order !== undefined && { display_order: parsed.data.display_order }),
      ...(parsed.data.metadata !== undefined && { metadata: parsed.data.metadata }),
    };

    const nextOptions = [...loaded.options];
    nextOptions[idx] = merged;

    const { error } = await saveOptions(
      supabase,
      parsed.data.field_id,
      profile.organization_id,
      nextOptions
    );
    if (error) {
      console.error('[FieldOptions] PUT save error:', error);
      return NextResponse.json({ error: 'Failed to update option' }, { status: 500 });
    }

    return NextResponse.json({ option: merged });
  } catch (error) {
    console.error('[FieldOptions] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/field-options?field_id=<uuid>&id=<uuid>
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const fieldId = request.nextUrl.searchParams.get('field_id');
    const id = request.nextUrl.searchParams.get('id');
    if (!fieldId || !id) {
      return NextResponse.json({ error: 'Missing field_id or id' }, { status: 400 });
    }

    const loaded = await loadField(supabase, fieldId, profile.organization_id);
    if ('error' in loaded) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    const next = loaded.options.filter((o) => o.id !== id);
    if (next.length === loaded.options.length) {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }

    const { error } = await saveOptions(supabase, fieldId, profile.organization_id, next);
    if (error) {
      console.error('[FieldOptions] DELETE save error:', error);
      return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FieldOptions] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/crm/field-options — bulk reorder
// Body: { field_id, items: [{ id, display_order }] }
// ---------------------------------------------------------------------------
const reorderSchema = z.object({
  field_id: z.string().uuid(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      display_order: z.number().int(),
    })
  ),
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const parsed = reorderSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const loaded = await loadField(supabase, parsed.data.field_id, profile.organization_id);
    if ('error' in loaded) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    const orderMap = new Map(parsed.data.items.map((it) => [it.id, it.display_order]));
    const nextOptions = loaded.options.map((o) =>
      orderMap.has(o.id) ? { ...o, display_order: orderMap.get(o.id)! } : o
    );

    const { error } = await saveOptions(
      supabase,
      parsed.data.field_id,
      profile.organization_id,
      nextOptions
    );
    if (error) {
      console.error('[FieldOptions] PATCH save error:', error);
      return NextResponse.json({ error: 'Failed to reorder options' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FieldOptions] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
