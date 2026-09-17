import { NextResponse } from 'next/server';
import { parseShopTerms } from '@crm-eco/lib';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { ADMIN_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, ADMIN_TENANT_ROLES);
  if (error || !profile) return error;

  const { id } = await params;
  const supabase = createServiceRoleClient() as any;
  const { data, error: qErr } = await supabase
    .from('plans')
    .select('id, metadata')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ shop: parseShopTerms(data.metadata) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, ADMIN_TENANT_ROLES);
  if (error || !profile) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    kind?: 'core' | 'addon';
    purchasable?: boolean;
    frequency?: 'monthly' | 'quarterly' | 'annual';
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const supabase = createServiceRoleClient() as any;
  const { data, error: qErr } = await supabase
    .from('plans')
    .select('id, metadata')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (qErr || !data) return NextResponse.json({ error: qErr?.message ?? 'Not found' }, { status: 404 });

  const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
  const shop = parseShopTerms({
    shop: {
      kind: body.kind ?? 'core',
      purchasable: body.purchasable === true,
      frequency: body.frequency ?? 'monthly',
    },
  });

  const { error: updErr } = await supabase
    .from('plans')
    .update({ metadata: { ...metadata, shop }, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', profile.organization_id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ shop });
}
