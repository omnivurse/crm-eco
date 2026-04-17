/**
 * Per-Advisor Carrier List
 * ----------------------------------------------------------------------------
 * The org maintains a shared `insurance_carriers` directory; each advisor
 * curates their own personal subset of those carriers via
 * `crm_advisor_carriers`. This route is the single endpoint that powers:
 *
 *   - GET    `?carrier_type=…`  → list the current user's active carriers,
 *                                  joined with their `insurance_carriers` row,
 *                                  optionally filtered by carrier_type.
 *   - POST   `{ carrier_id }`   → upsert (re-activates a previously removed
 *                                  carrier instead of duplicating).
 *   - PATCH  `{ carrier_id, sort_order? , notes? }` → update ordering / notes.
 *   - DELETE `?carrier_id=…`    → soft-remove (sets is_active = false).
 *
 * RLS on `crm_advisor_carriers` already enforces user_id = auth.uid(); we
 * verify CRM membership server-side as a defense-in-depth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import type { FieldCarrierType } from '@/lib/crm/types';

export const dynamic = 'force-dynamic';

const ALLOWED_CARRIER_TYPES = [
  'insurance',
  'healthshare',
  'medicaid',
  'short_term',
  'dental',
  'vision',
  'life',
  'other',
] as const satisfies readonly FieldCarrierType[];

const carrierTypeSchema = z.enum(ALLOWED_CARRIER_TYPES);

// ---------------------------------------------------------------------------
// GET /api/crm/advisor-carriers?carrier_type=insurance|healthshare|...
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get('carrier_type');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let carrierType: FieldCarrierType | null = null;
    if (rawType) {
      const parsed = carrierTypeSchema.safeParse(rawType);
      if (!parsed.success) {
        return NextResponse.json(
          { error: `Invalid carrier_type. Must be one of ${ALLOWED_CARRIER_TYPES.join(', ')}` },
          { status: 400 },
        );
      }
      carrierType = parsed.data;
    }

    const supabase = await createClient();
    let query = supabase
      .from('crm_advisor_carriers')
      .select(
        `
          id,
          organization_id,
          user_id,
          carrier_id,
          is_active,
          sort_order,
          notes,
          created_at,
          updated_at,
          carrier:insurance_carriers!inner (
            id,
            carrier_name,
            carrier_type,
            logo_url,
            is_active
          )
        `,
      )
      .eq('user_id', profile.user_id)
      .eq('organization_id', profile.organization_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (carrierType) {
      // Filter the joined carrier by type. PostgREST exposes the embedded
      // table on the dotted path.
      query = query.eq('carrier.carrier_type', carrierType);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[advisor-carriers GET]', error);
      return NextResponse.json({ error: 'Failed to load carriers' }, { status: 500 });
    }

    // PostgREST returns `carrier` as an array when the relationship is
    // ambiguous; flatten to a single object for consumers.
    const rows = (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      carrier: Array.isArray(row.carrier) ? row.carrier[0] : row.carrier,
    }));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[advisor-carriers GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/advisor-carriers   { carrier_id, sort_order?, notes? }
// ---------------------------------------------------------------------------
const postSchema = z.object({
  carrier_id: z.string().uuid(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify the carrier belongs to this org (RLS would reject otherwise; this
    // gives us a clearer error message).
    const { data: carrier, error: carrierError } = await supabase
      .from('insurance_carriers')
      .select('id, carrier_type, is_active')
      .eq('id', parsed.data.carrier_id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (carrierError) {
      console.error('[advisor-carriers POST] carrier lookup', carrierError);
      return NextResponse.json({ error: 'Failed to verify carrier' }, { status: 500 });
    }
    if (!carrier) {
      return NextResponse.json({ error: 'Carrier not found' }, { status: 404 });
    }

    // Upsert against the unique (organization_id, user_id, carrier_id) so
    // re-adding a previously soft-removed entry simply re-activates it.
    const { data, error } = await supabase
      .from('crm_advisor_carriers')
      .upsert(
        {
          organization_id: profile.organization_id,
          user_id: profile.user_id,
          carrier_id: parsed.data.carrier_id,
          is_active: true,
          sort_order: parsed.data.sort_order ?? 0,
          notes: parsed.data.notes ?? null,
        },
        { onConflict: 'organization_id,user_id,carrier_id' },
      )
      .select(
        `
          id,
          carrier_id,
          is_active,
          sort_order,
          notes,
          carrier:insurance_carriers!inner (
            id,
            carrier_name,
            carrier_type,
            logo_url,
            is_active
          )
        `,
      )
      .single();

    if (error) {
      console.error('[advisor-carriers POST]', error);
      return NextResponse.json({ error: 'Failed to add carrier' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error('[advisor-carriers POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/crm/advisor-carriers   { carrier_id, sort_order?, notes?, is_active? }
// ---------------------------------------------------------------------------
const patchSchema = z.object({
  carrier_id: z.string().uuid(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.sort_order !== undefined) update.sort_order = parsed.data.sort_order;
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
    if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_advisor_carriers')
      .update(update)
      .eq('user_id', profile.user_id)
      .eq('organization_id', profile.organization_id)
      .eq('carrier_id', parsed.data.carrier_id)
      .select('id, carrier_id, is_active, sort_order, notes')
      .maybeSingle();

    if (error) {
      console.error('[advisor-carriers PATCH]', error);
      return NextResponse.json({ error: 'Failed to update carrier' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Carrier not in your list' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[advisor-carriers PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/advisor-carriers?carrier_id=…
// (Soft-removes by setting is_active = false. Pass ?hard=true for hard delete.)
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const carrierId = searchParams.get('carrier_id');
    const hard = searchParams.get('hard') === 'true';

    if (!carrierId) {
      return NextResponse.json({ error: 'carrier_id is required' }, { status: 400 });
    }
    const parsed = z.string().uuid().safeParse(carrierId);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid carrier_id' }, { status: 400 });
    }

    const supabase = await createClient();

    if (hard) {
      const { error } = await supabase
        .from('crm_advisor_carriers')
        .delete()
        .eq('user_id', profile.user_id)
        .eq('organization_id', profile.organization_id)
        .eq('carrier_id', carrierId);

      if (error) {
        console.error('[advisor-carriers DELETE hard]', error);
        return NextResponse.json({ error: 'Failed to remove carrier' }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from('crm_advisor_carriers')
      .update({ is_active: false })
      .eq('user_id', profile.user_id)
      .eq('organization_id', profile.organization_id)
      .eq('carrier_id', carrierId);

    if (error) {
      console.error('[advisor-carriers DELETE soft]', error);
      return NextResponse.json({ error: 'Failed to remove carrier' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[advisor-carriers DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
