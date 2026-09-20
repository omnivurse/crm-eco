import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  ACH_ORIGINATOR_SETTING_KEY,
  ACH_SEC_CODE,
  DEFAULT_NACHA_FILE_NAME_PATTERN,
  NachaConfigError,
  mergeAchOriginatorInput,
  missingAchOriginatorFields,
  parseAchOriginator,
  readAchOriginatorDraft,
  toPublicAchOriginator,
} from '@crm-eco/lib/billing';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const KEY = ACH_ORIGINATOR_SETTING_KEY;

async function loadRawSetting(organizationId: string): Promise<unknown> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('organization_id', organizationId)
    .eq('setting_key', KEY)
    .maybeSingle();
  return data?.setting_value ?? null;
}

function payloadFromRaw(raw: unknown) {
  const missing = missingAchOriginatorFields(raw);
  const draft = readAchOriginatorDraft(raw);
  if (missing.length) {
    return {
      complete: false as const,
      missing,
      originator: null,
      draft,
    };
  }
  const originator = toPublicAchOriginator(parseAchOriginator(raw));
  return {
    complete: true as const,
    missing: [],
    originator,
    draft: {
      ...draft,
      settlementAccountMasked: originator.settlementAccountMasked,
    },
  };
}

export async function GET() {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;

  const raw = await loadRawSetting(profile.organization_id);
  return NextResponse.json(payloadFromRaw(raw));
}

export async function PUT(request: Request) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let existing = null;
  try {
    existing = parseAchOriginator(await loadRawSetting(profile.organization_id));
  } catch {
    existing = null;
  }

  const merged = mergeAchOriginatorInput(
    {
      destinationRouting: body.destinationRouting,
      destinationName: body.destinationName,
      companyName: body.companyName,
      companyId: body.companyId,
      odfiId: body.odfiId,
      secCode: body.secCode ?? ACH_SEC_CODE,
      fileNamePattern: body.fileNamePattern ?? DEFAULT_NACHA_FILE_NAME_PATTERN,
      settlementRouting: body.settlementRouting,
      settlementAccount: body.settlementAccount,
      settlementAccountType: body.settlementAccountType,
    },
    existing,
  );

  let config;
  try {
    config = parseAchOriginator(merged);
  } catch (err) {
    if (err instanceof NachaConfigError) {
      return NextResponse.json(
        { error: err.message, complete: false, missing: err.missing },
        { status: 400 },
      );
    }
    throw err;
  }

  const supabase = createServiceRoleClient();
  const { error: upsertErr } = await supabase.from('system_settings').upsert(
    {
      organization_id: profile.organization_id,
      setting_key: KEY,
      setting_value: JSON.stringify(config),
      setting_type: 'json',
      category: 'billing',
      subcategory: 'ach',
      label: 'ACH originator (Bank of Colorado)',
      description: 'NACHA file header identity. Fail closed until every field is present.',
      is_active: true,
      is_sensitive: true,
      is_required: true,
      last_changed_by: profile.id,
      last_changed_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,setting_key' },
  );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json(payloadFromRaw(config));
}
