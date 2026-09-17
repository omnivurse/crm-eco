import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { ADMIN_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function missingSchema(error: { message?: string; code?: string } | null) {
  return error?.code === '42P01' || (error?.message ?? '').includes('does not exist');
}

export async function GET() {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, ADMIN_TENANT_ROLES);
  if (error || !profile) return error;

  const supabase = createServiceRoleClient() as any;
  const { data, error: qErr } = await supabase
    .from('packages')
    .select('id, name, sku, description, price, tax_rate, units, unit_label, entitlement_kind, is_active, created_at')
    .eq('organization_id', profile.organization_id)
    .order('name');

  if (missingSchema(qErr)) {
    return NextResponse.json({ packages: [], schemaMissing: true });
  }
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  return NextResponse.json({ packages: data ?? [], schemaMissing: false });
}

export async function POST(request: Request) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, ADMIN_TENANT_ROLES);
  if (error || !profile) return error;

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    sku?: string;
    description?: string;
    price?: number;
    tax_rate?: number;
    units?: number;
    unit_label?: string;
    entitlement_kind?: string;
    is_active?: boolean;
  } | null;

  if (!body?.name?.trim() || !(Number(body.price) > 0)) {
    return NextResponse.json({ error: 'Name and a price greater than zero are required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient() as any;
  const { data, error: insErr } = await supabase
    .from('packages')
    .insert({
      organization_id: profile.organization_id,
      name: body.name.trim(),
      sku: body.sku?.trim() || null,
      description: body.description?.trim() || null,
      price: Number(body.price),
      tax_rate: Number(body.tax_rate) || 0,
      units: Math.max(1, Math.floor(Number(body.units) || 1)),
      unit_label: body.unit_label?.trim() || 'units',
      entitlement_kind: body.entitlement_kind || 'units',
      is_active: body.is_active !== false,
    })
    .select('id')
    .single();

  if (missingSchema(insErr)) {
    return NextResponse.json({ error: 'Package tables are not applied yet' }, { status: 409 });
  }
  if (insErr || !data) return NextResponse.json({ error: insErr?.message ?? 'Could not create package' }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
