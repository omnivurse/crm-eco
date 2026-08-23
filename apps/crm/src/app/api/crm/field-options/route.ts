import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { isCrmManagerOrAdminRole } from '@/lib/crm/nav-profile';
import {
  FieldOption,
  OPTION_TEXT_MAX,
  applyOptionPatches,
  normalizeOptions,
  sortOptions,
  validateOptions,
} from '@/lib/crm/field-options';

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
 * The normalize/sort/validate/merge logic lives in the pure module
 * `@/lib/crm/field-options` so the curation UI shares ONE implementation.
 *
 * Permissions: GET is open to any authenticated CRM user (pickers need the
 * list); every write (POST/PUT/PATCH/DELETE) is gated by the same
 * manager-or-admin predicate the rest of the app uses
 * (`isCrmManagerOrAdminRole`) — agents and viewers get 403.
 *
 * Curation rules:
 *  - options are NEVER hard-deleted — records may hold the value, so
 *    "delete" and "merge" both mean deactivate (is_active=false)
 *  - a MERGE only curates the option list (deactivate the loser, keep the
 *    winner); it must NOT and does NOT rewrite any crm_records values
 *  - a write may never leave the field with no active option
 */

/** Fetch crm_fields row + its normalized options. Org-scoped: the query is
 * pinned to the caller's profile.organization_id, so a field belonging to
 * another org resolves to "not found" — cross-org reads and writes both
 * dead-end here. */
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

/** Persist a normalized array back onto crm_fields.options (org-scoped).
 * `.select('id')` makes RLS failures loud: if row-level security (or a stale
 * id) filters the update down to zero rows, we report an error instead of
 * silently succeeding. */
async function saveOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fieldId: string,
  orgId: string,
  options: FieldOption[]
) {
  const { data, error } = await supabase
    .from('crm_fields')
    .update({ options: sortOptions(options) })
    .eq('id', fieldId)
    .eq('org_id', orgId)
    .select('id');
  if (error) return { error };
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return { error: new Error('Update matched no rows (blocked by row-level security?)') };
  }
  return { error: null };
}

/** Shared auth gate for the write handlers (POST/PUT/PATCH/DELETE). */
async function requireWriteAccess() {
  const profile = await getAuthProfile();
  if (!profile) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!isCrmManagerOrAdminRole(profile.crm_role)) {
    return { response: NextResponse.json({ error: 'Forbidden — manager or admin only' }, { status: 403 }) };
  }
  return { profile };
}

/** Owner-safe reason for a stale/unknown option id. The internal message is
 * "Option not found: <uuid>" — the uuid means nothing to the owner and must
 * never reach a toast, so it is mapped to plain words here. The UI wraps it
 * as "Couldn't rename the option — it isn't on this list any more, reload
 * the page to see the latest. Try again." */
const STALE_OPTION_REASON = "it isn't on this list any more, reload the page to see the latest";

/** Map a pure-module error message onto an HTTP status + owner-safe copy. */
function optionsErrorResponse(message: string) {
  if (message.startsWith('Option not found')) {
    return NextResponse.json({ error: STALE_OPTION_REASON }, { status: 404 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

// ---------------------------------------------------------------------------
// GET /api/crm/field-options?field_id=<uuid>&active_only=true|false
// Any authenticated CRM user — pickers everywhere need the list.
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
// POST /api/crm/field-options — append one option to a field
// ---------------------------------------------------------------------------
const createSchema = z.object({
  field_id: z.string().uuid(),
  value: z.string().min(1).max(OPTION_TEXT_MAX),
  label: z.string().min(1).max(OPTION_TEXT_MAX),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  is_default: z.boolean().optional(),
  display_order: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireWriteAccess();
    if ('response' in auth) return auth.response;
    const { profile } = auth;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const loaded = await loadField(supabase, parsed.data.field_id, profile.organization_id);
    if ('error' in loaded) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    // Case-insensitive, trimmed — "Silver PPO" and "silver ppo" collide.
    const newKey = parsed.data.value.trim().toLowerCase();
    if (loaded.options.some((o) => o.value.trim().toLowerCase() === newKey)) {
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

    const nextOptions = [...loaded.options, next];
    const invalid = validateOptions(nextOptions);
    if (invalid) return optionsErrorResponse(invalid);

    const { error } = await saveOptions(supabase, parsed.data.field_id, profile.organization_id, nextOptions);
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
// PATCH /api/crm/field-options — idempotent bulk update
// Body: { field_id, updates: [{ id, label?, is_active?, display_order?,
//                               color?, icon?, is_default?, metadata? }] }
// Covers RENAME (label), DEACTIVATE/REACTIVATE (is_active), REORDER
// (display_order) — one or more options per call. `value` is deliberately
// not patchable: records store the value; renames touch only the label.
// A MERGE from the UI is `[{ id: loser, is_active: false }]` (winner kept) —
// the option list only; crm_records values are never rewritten here.
// ---------------------------------------------------------------------------
const patchSchema = z.object({
  field_id: z.string().uuid(),
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).max(OPTION_TEXT_MAX).optional(),
        is_active: z.boolean().optional(),
        display_order: z.number().int().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        icon: z.string().max(50).optional().nullable(),
        is_default: z.boolean().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .min(1)
    .max(200),
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireWriteAccess();
    if ('response' in auth) return auth.response;
    const { profile } = auth;

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const loaded = await loadField(supabase, parsed.data.field_id, profile.organization_id);
    if ('error' in loaded) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    const result = applyOptionPatches(loaded.options, parsed.data.updates);
    if (result.error !== undefined) return optionsErrorResponse(result.error);

    const { error } = await saveOptions(supabase, parsed.data.field_id, profile.organization_id, result.options);
    if (error) {
      console.error('[FieldOptions] PATCH save error:', error);
      return NextResponse.json({ error: 'Failed to update options' }, { status: 500 });
    }

    return NextResponse.json({ options: sortOptions(result.options) });
  } catch (error) {
    console.error('[FieldOptions] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/field-options — patch ONE option in-place (legacy shape;
// PATCH is the bulk form). Body: { field_id, id, ...updates }
// ---------------------------------------------------------------------------
const updateSchema = z.object({
  field_id: z.string().uuid(),
  id: z.string().uuid(),
  label: z.string().min(1).max(OPTION_TEXT_MAX).optional(),
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
    const auth = await requireWriteAccess();
    if ('response' in auth) return auth.response;
    const { profile } = auth;

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const loaded = await loadField(supabase, parsed.data.field_id, profile.organization_id);
    if ('error' in loaded) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    const { field_id: _fieldId, ...patch } = parsed.data;
    const result = applyOptionPatches(loaded.options, [patch]);
    if (result.error !== undefined) return optionsErrorResponse(result.error);

    const { error } = await saveOptions(supabase, parsed.data.field_id, profile.organization_id, result.options);
    if (error) {
      console.error('[FieldOptions] PUT save error:', error);
      return NextResponse.json({ error: 'Failed to update option' }, { status: 500 });
    }

    const option = result.options.find((o) => o.id === parsed.data.id);
    return NextResponse.json({ option });
  } catch (error) {
    console.error('[FieldOptions] PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/field-options?field_id=<uuid>&id=<uuid>
// SOFT delete: the option is DEACTIVATED, never removed — records may hold
// its value, and a hard delete would strand them with an unknown value.
// Idempotent: deleting an already-inactive option succeeds unchanged.
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireWriteAccess();
    if ('response' in auth) return auth.response;
    const { profile } = auth;

    const fieldId = request.nextUrl.searchParams.get('field_id');
    const id = request.nextUrl.searchParams.get('id');
    if (!fieldId || !id) {
      return NextResponse.json({ error: 'Missing field_id or id' }, { status: 400 });
    }

    const loaded = await loadField(supabase, fieldId, profile.organization_id);
    if ('error' in loaded) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    const result = applyOptionPatches(loaded.options, [{ id, is_active: false, is_default: false }]);
    if (result.error !== undefined) return optionsErrorResponse(result.error);

    const { error } = await saveOptions(supabase, fieldId, profile.organization_id, result.options);
    if (error) {
      console.error('[FieldOptions] DELETE save error:', error);
      return NextResponse.json({ error: 'Failed to deactivate option' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deactivated: id });
  } catch (error) {
    console.error('[FieldOptions] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
