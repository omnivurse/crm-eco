import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

/**
 * POST /api/crm/trash/restore-item  { entity, id }
 *
 * Restore a single soft-deleted child entity (task / note / sticky note /
 * attachment) — powers the "Undo" toast for Phase 2 deletes. The UPDATE runs
 * through the caller's client, so each table's existing per-row RLS (owner /
 * author / admin) authorizes the restore. A 0-row result → 404.
 */

// Whitelist maps the public entity name to its table (never trust a raw table name).
const ENTITY_TABLES: Record<string, string> = {
  task: 'crm_tasks',
  note: 'crm_notes',
  sticky_note: 'notes',
  attachment: 'crm_attachments',
  record_link: 'crm_record_links',
  contact_group: 'crm_contact_groups',
  saved_view: 'saved_views',
  carrier_contact: 'carrier_contacts',
};

const schema = z.object({
  entity: z.enum([
    'task',
    'note',
    'sticky_note',
    'attachment',
    'record_link',
    'contact_group',
    'saved_view',
    'carrier_contact',
  ]),
  id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'entity and id are required' }, { status: 400 });
    }

    const table = ENTITY_TABLES[parsed.data.entity];
    const supabase = await createClient();

    const { data, error } = await (supabase as any)
      .from(table)
      .update({ deleted_at: null, deleted_by: null, deleted_origin: null })
      .eq('id', parsed.data.id)
      .not('deleted_at', 'is', null)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || (data as unknown[]).length === 0) {
      return NextResponse.json(
        { error: 'Item not found or already restored' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, restored: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
