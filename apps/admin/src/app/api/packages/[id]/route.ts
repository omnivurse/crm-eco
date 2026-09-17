import { NextResponse } from 'next/server';
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
  const [{ data: pack, error: packErr }, { data: purchases }] = await Promise.all([
    supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle(),
    supabase
      .from('member_packages')
      .select('id, member_id, units_purchased, units_remaining, status, price_paid, purchased_at, expires_at')
      .eq('package_id', id)
      .eq('organization_id', profile.organization_id)
      .order('purchased_at', { ascending: false })
      .limit(50),
  ]);

  if (packErr) return NextResponse.json({ error: packErr.message }, { status: 500 });
  if (!pack) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ package: pack, purchases: purchases ?? [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, ADMIN_TENANT_ROLES);
  if (error || !profile) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if (typeof body.sku === 'string') patch.sku = body.sku.trim() || null;
  if (typeof body.description === 'string') patch.description = body.description.trim() || null;
  if (body.price != null) patch.price = Number(body.price);
  if (body.tax_rate != null) patch.tax_rate = Number(body.tax_rate);
  if (body.units != null) patch.units = Math.max(1, Math.floor(Number(body.units)));
  if (typeof body.unit_label === 'string') patch.unit_label = body.unit_label.trim() || 'units';
  if (typeof body.entitlement_kind === 'string') patch.entitlement_kind = body.entitlement_kind;
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;

  const supabase = createServiceRoleClient() as any;
  const { error: updErr } = await supabase
    .from('packages')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', profile.organization_id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
