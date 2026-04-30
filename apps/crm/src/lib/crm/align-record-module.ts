import { createClient } from '@supabase/supabase-js';

/**
 * When `crm_records.org_id` matches the authenticated tenant but `module_id`
 * references a row in another org, RLS hides the embed and downstream
 * crm_fields/crm_layouts queries — the UI looks like “Record not found”.
 *
 * Repairs `module_id` in-place using the canonical module at the SAME `key`
 * for `record.org_id`, falling back to `contacts`, then first enabled module.
 * Only updates when admin read proves `records.org_id === actorTenantOrgId`.
 */
export async function alignMisalignedRecordModule(
  actorTenantOrgId: string,
  recordId: string
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !recordId?.trim()) return;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: rec, error: recErr } = await admin
    .from('crm_records')
    .select('id, org_id, module_id')
    .eq('id', recordId.trim())
    .maybeSingle();

  if (recErr || !rec?.org_id || !rec.module_id) return;
  if (rec.org_id !== actorTenantOrgId) return;

  const { data: mod } = await admin
    .from('crm_modules')
    .select('id, org_id, key')
    .eq('id', rec.module_id)
    .maybeSingle();

  if (!mod || mod.org_id === rec.org_id) return;

  let targetModuleId: string | null = null;

  const { data: keyed } = await admin
    .from('crm_modules')
    .select('id')
    .eq('org_id', rec.org_id)
    .eq('key', mod.key ?? '')
    .eq('is_enabled', true)
    .limit(1)
    .maybeSingle();

  if (keyed?.id) targetModuleId = keyed.id;

  if (!targetModuleId) {
    const { data: fb } = await admin
      .from('crm_modules')
      .select('id')
      .eq('org_id', rec.org_id)
      .eq('key', 'contacts')
      .eq('is_enabled', true)
      .limit(1)
      .maybeSingle();
    if (fb?.id) targetModuleId = fb.id;
  }

  if (!targetModuleId) {
    const { data: anyEl } = await admin
      .from('crm_modules')
      .select('id')
      .eq('org_id', rec.org_id)
      .eq('is_enabled', true)
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (anyEl?.id) targetModuleId = anyEl.id;
  }

  if (!targetModuleId || targetModuleId === rec.module_id) return;

  await admin.from('crm_records').update({ module_id: targetModuleId }).eq('id', recordId.trim());
}
