import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/contact-groups
 * List contact groups with member counts
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const groupType = searchParams.get('group_type');
    const activeOnly = searchParams.get('active_only') === 'true';

    let query = supabase
      .from('group_contact_counts')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('display_order', { ascending: true })
      .order('group_name', { ascending: true });

    if (groupType) {
      query = query.eq('group_type', groupType);
    }
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ContactGroups GET]', error);
      return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
    }

    // Normalize shape for clients: view historically used `group_id` only; UI expects `id`.
    const rows = data || [];
    const normalized = rows.map((row: Record<string, unknown>) => {
      const id = (row.id ?? row.group_id) as string;
      return { ...row, id, group_id: (row.group_id ?? row.id) as string };
    });

    return NextResponse.json({ data: normalized });
  } catch (error) {
    console.error('[ContactGroups GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const createGroupSchema = z.object({
  group_name: z.string().min(1).max(255),
  group_type: z.enum(['status', 'product', 'source', 'custom']).default('custom'),
  description: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  display_order: z.number().int().min(0).optional(),
});

/**
 * POST /api/crm/contact-groups
 * Create a new contact group
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crm_contact_groups')
      .insert({
        organization_id: profile.organization_id,
        created_by: profile.id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        return NextResponse.json(
          { error: 'A group with this name already exists' },
          { status: 409 }
        );
      }
      console.error('[ContactGroups POST]', error);
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[ContactGroups POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
