import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { DEFAULT_DUNNING_SCHEDULE, parseDunningSchedule } from '@crm-eco/lib';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const KEY = 'dunning_schedule';

export async function GET() {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient);
  if (error || !profile) return error;

  const supabase = createServiceRoleClient() as any;
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('organization_id', profile.organization_id)
    .eq('setting_key', KEY)
    .maybeSingle();

  return NextResponse.json({
    schedule: parseDunningSchedule(data?.setting_value ?? DEFAULT_DUNNING_SCHEDULE),
  });
}

export async function POST(request: Request) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;

  const body = (await request.json().catch(() => null)) as { schedule?: unknown } | null;
  const schedule = parseDunningSchedule(body?.schedule);
  const supabase = createServiceRoleClient() as any;

  const { error: upsertErr } = await supabase.from('system_settings').upsert(
    {
      organization_id: profile.organization_id,
      setting_key: KEY,
      setting_value: schedule,
      setting_type: 'json',
      category: 'billing',
      label: 'Dunning schedule',
      is_active: true,
      is_sensitive: false,
      last_changed_by: profile.id,
      last_changed_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,setting_key' }
  );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ schedule });
}
