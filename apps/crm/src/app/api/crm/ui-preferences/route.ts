import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import type { CrmUiPreferences } from '@/lib/crm/types';

/**
 * Per-user UI preferences bag stored in `profiles.ui_preferences` JSONB.
 *
 * Kept deliberately permissive — we never want a schema mismatch here to
 * block a user from toggling their own layout. Unknown keys are preserved
 * untouched on PATCH so future flags just work.
 */

const patchSchema = z
  .object({
    crm_layout_v2: z.boolean().optional(),
    collapsed_sections: z.record(z.string(), z.boolean()).optional(),
    related_list_order: z.record(z.string(), z.array(z.string())).optional(),
  })
  .passthrough();

/** GET /api/crm/ui-preferences — returns the current user's preferences object. */
export async function GET(_request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createCrmClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('ui_preferences')
      .eq('id', profile.id)
      .single();

    if (error) {
      if (error.code === '42703') {
        // Column doesn't exist yet (migration not applied) — return empty.
        return NextResponse.json({ preferences: {} });
      }
      console.error('[ui-preferences] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preferences: (data?.ui_preferences as CrmUiPreferences) || {} });
  } catch (err) {
    console.error('[ui-preferences] GET unexpected error:', err);
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

/**
 * PATCH /api/crm/ui-preferences — merges the supplied partial object into
 * the existing preferences. Unknown keys survive untouched.
 */
export async function PATCH(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid preferences', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const supabase = await createCrmClient();

    const { data: current, error: readErr } = await supabase
      .from('profiles')
      .select('ui_preferences')
      .eq('id', profile.id)
      .single();

    if (readErr && readErr.code !== 'PGRST116') {
      console.error('[ui-preferences] read error:', readErr);
      return NextResponse.json({ error: readErr.message }, { status: 500 });
    }

    const existing = ((current?.ui_preferences as CrmUiPreferences) || {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...existing, ...parsed.data };

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ ui_preferences: merged })
      .eq('id', profile.id);

    if (updateErr) {
      console.error('[ui-preferences] update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ preferences: merged });
  } catch (err) {
    console.error('[ui-preferences] PATCH unexpected error:', err);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
