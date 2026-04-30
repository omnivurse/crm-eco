/**
 * GET /api/crm/records/:id/diagnose
 *
 * Last-mile triage for "Record not found" on the edit screen. Compares the
 * caller's auth/profile to the record's storage state via service role so we
 * can tell apart: missing row, RLS hiding it, module/org drift, or a stale
 * id with no merge tombstone. The response is intentionally read-only and
 * returns nothing the caller doesn't already see in their own row.
 */
import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getAuthProfile, createClient } from '@/lib/supabase-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Service role unavailable' },
      { status: 500 }
    );
  }

  const cookieClient = await createClient();
  const admin = createServiceClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const trimmed = id.trim();

  const [recordRlsRes, recordAdminRes] = await Promise.all([
    cookieClient
      .from('crm_records')
      .select('id, org_id, module_id')
      .eq('id', trimmed)
      .maybeSingle(),
    admin
      .from('crm_records')
      .select('id, org_id, module_id, title, created_at, updated_at')
      .eq('id', trimmed)
      .maybeSingle(),
  ]);

  const visibleViaRls = !!recordRlsRes.data?.id;
  const existsAnywhere = !!recordAdminRes.data?.id;

  let moduleOrgId: string | null = null;
  let moduleKey: string | null = null;
  if (recordAdminRes.data?.module_id) {
    const { data: mod } = await admin
      .from('crm_modules')
      .select('id, org_id, key')
      .eq('id', recordAdminRes.data.module_id)
      .maybeSingle();
    moduleOrgId = (mod?.org_id as string | undefined) ?? null;
    moduleKey = (mod?.key as string | undefined) ?? null;
  }

  let mergeTombstone: { keeperId: string; mergedAt: string | null } | null = null;
  if (!existsAnywhere) {
    const { data: audit } = await admin
      .from('crm_audit_log')
      .select('diff, created_at')
      .in('entity', ['record', 'crm_records'])
      .eq('action', 'merge')
      .eq('diff->>deleted_id', trimmed)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const keptId =
      audit && audit.diff && typeof (audit.diff as Record<string, unknown>).kept_id === 'string'
        ? ((audit.diff as Record<string, unknown>).kept_id as string)
        : null;
    if (keptId) {
      mergeTombstone = {
        keeperId: keptId,
        mergedAt: (audit?.created_at as string | undefined) ?? null,
      };
    }
  }

  const recordOrgMatchesProfile =
    !!recordAdminRes.data?.org_id &&
    recordAdminRes.data.org_id === profile.organization_id;
  const moduleOrgMatchesRecord =
    !!moduleOrgId &&
    !!recordAdminRes.data?.org_id &&
    moduleOrgId === recordAdminRes.data.org_id;

  let likelyCause = 'unknown';
  if (!existsAnywhere) {
    likelyCause = mergeTombstone ? 'merged_with_tombstone' : 'no_such_record';
  } else if (!recordOrgMatchesProfile) {
    likelyCause = 'wrong_org_for_user';
  } else if (!moduleOrgMatchesRecord) {
    likelyCause = 'module_org_drift';
  } else if (!visibleViaRls) {
    likelyCause = 'rls_hidden_other_reason';
  } else {
    likelyCause = 'visible_should_load';
  }

  return NextResponse.json({
    recordId: trimmed,
    profile: {
      organization_id: profile.organization_id,
      crm_role: profile.crm_role,
      user_id: profile.user_id,
    },
    record: {
      existsAnywhere,
      visibleViaRls,
      org_id: recordAdminRes.data?.org_id ?? null,
      module_id: recordAdminRes.data?.module_id ?? null,
      title: recordAdminRes.data?.title ?? null,
      updated_at: recordAdminRes.data?.updated_at ?? null,
    },
    module: {
      org_id: moduleOrgId,
      key: moduleKey,
    },
    mergeTombstone,
    flags: {
      recordOrgMatchesProfile,
      moduleOrgMatchesRecord,
    },
    likelyCause,
    rlsError: recordRlsRes.error?.message ?? null,
    adminError: recordAdminRes.error?.message ?? null,
  });
}
