import { NextResponse } from 'next/server';
import { getAuthProfile, createClient } from '@/lib/supabase-server';
import { alignMisalignedRecordModule } from '@/lib/crm/align-record-module';
import { getTwinDataForRecord } from '@/lib/crm/queries';
import type { CrmRecord } from '@/lib/crm/types';

/**
 * GET /api/crm/records/:id/bootstrap-edit
 *
 * One round-trip for the edit page: heals stray module_id FK under RLS, then
 * returns the merged module embed shape the UI expects.
 *
 * Also resolves the cross-module twin (`twinData`) exactly like the record
 * detail page does, so Edit seeds the same blank-fill overlay the detail view
 * shows — otherwise a member whose sharing/coverage keys were filled from the
 * linked Contact appears populated on the detail page and blank on Edit
 * ("the update made it vanish"). Blank-fill only; nothing is written.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recordId } = await params;
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await alignMisalignedRecordModule(profile.organization_id, recordId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('crm_records')
    .select(`
      *,
      module:crm_modules!crm_records_module_id_fkey(id, key, name, name_plural)
    `)
    .eq('id', recordId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ record: null }, { status: 200 });
  }

  const moduleRaw = Array.isArray(data.module) ? data.module[0] : data.module;
  if (!moduleRaw?.id) {
    return NextResponse.json({ record: null }, { status: 200 });
  }

  // Same call + module-key gate as `app/crm/r/[recordId]/page.tsx`; the helper
  // is members-only and RLS-scoped. A failed lookup degrades to null rather
  // than failing the edit bootstrap.
  let twinData: Record<string, unknown> | null = null;
  try {
    twinData = await getTwinDataForRecord(data as unknown as CrmRecord, moduleRaw.key);
  } catch {
    twinData = null;
  }

  return NextResponse.json({
    record: {
      ...data,
      module: moduleRaw,
    },
    twinData,
  });
}
