import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { CRM_RECORD_ROW_COLUMN_KEYS } from '@/lib/crm/record-field-registry';

/**
 * Indexed business columns a clone should inherit verbatim from its source so
 * the copy displays/filters identically (carrier, market_type, dates,
 * group_name, advisor + normalization fields, …). We copy the already-correct
 * values from the source row rather than re-deriving from JSONB so
 * owner-derived fields (normalized_advisor_name, canonical_advisor_id) are not
 * lost. `title`/`status`/`stage`/`owner_id` are handled explicitly below, and
 * generated/trigger columns (id, timestamps, search_vector, stage_updated_at)
 * are intentionally excluded.
 *
 * `email` is intentionally NOT inherited: the partial unique index
 * `idx_crm_records_unique_email (org_id, module_id, lower(email),
 * lower(first_name), lower(last_name))` treats a same-email + same-name row as a
 * duplicate, and a clone copies the source's name verbatim — so inheriting the
 * email (or leaving it in JSONB for the BEFORE-INSERT email-mirror trigger to
 * copy up) makes every clone of an emailed contact collide (23505). The clone
 * is a "duplicate as template"; the rep supplies a fresh email.
 */
const CLONE_INHERITED_COLUMNS = [
  ...CRM_RECORD_ROW_COLUMN_KEYS.filter(
    (k) => !['title', 'status', 'stage', 'owner_id'].includes(k),
  ),
  'phone',
] as const;

/**
 * POST /api/crm/records/[id]/clone
 * Clone a CRM record (duplicates data, resets ownership to current user)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the source record (org-scoped)
    const { data: source, error: fetchError } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (fetchError || !source) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Clone: copy data + all indexed business columns so the copy displays and
    // filters exactly like the source. Ownership/title/timestamps are reset.
    const inheritedColumns: Record<string, unknown> = {};
    const sourceRow = source as Record<string, unknown>;
    for (const key of CLONE_INHERITED_COLUMNS) {
      if (sourceRow[key] !== undefined) inheritedColumns[key] = sourceRow[key];
    }

    // Strip email from the cloned JSONB too, so the BEFORE-INSERT trigger that
    // mirrors data->>'email' into the (unique-indexed) email column can't
    // re-introduce the duplicate we deliberately avoid above.
    const clonedData =
      source.data && typeof source.data === 'object' && !Array.isArray(source.data)
        ? { ...(source.data as Record<string, unknown>) }
        : source.data;
    if (clonedData && typeof clonedData === 'object' && !Array.isArray(clonedData)) {
      delete (clonedData as Record<string, unknown>).email;
    }

    const insertRow = {
      ...inheritedColumns,
      org_id: source.org_id,
      module_id: source.module_id,
      owner_id: profile.id,
      title: source.title ? `${source.title} (Copy)` : null,
      data: clonedData,
      status: source.status,
      stage: source.stage,
      created_by: profile.id,
    };
    let { data: cloned, error: insertError } = await supabase
      .from('crm_records')
      .insert(insertRow)
      .select()
      .single();

    // A source still on a legacy status: the vocabulary guard refuses it on a
    // NEW record (23514). Clone without the status rather than fail the clone.
    if (insertError && (insertError as { code?: string }).code === '23514') {
      ({ data: cloned, error: insertError } = await supabase
        .from('crm_records')
        .insert({ ...insertRow, status: null })
        .select()
        .single());
    }

    if (insertError) {
      console.error('Clone insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ id: cloned.id, ...cloned });
  } catch (error) {
    console.error('Error in POST /api/crm/records/[id]/clone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
