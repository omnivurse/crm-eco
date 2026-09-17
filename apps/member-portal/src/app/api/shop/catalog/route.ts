import { NextResponse } from 'next/server';
import { buildShopCatalog } from '@crm-eco/lib';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireActiveMembership();
  const supabase = createServiceRoleClient() as any;

  const [{ data: plans }, { data: packages, error: packErr }, { data: memberships }] = await Promise.all([
    supabase
      .from('plans')
      .select('id, name, code, monthly_share, description, is_active, metadata')
      .eq('organization_id', ctx.member.organization_id)
      .eq('is_active', true),
    supabase
      .from('packages')
      .select('id, name, sku, description, price, tax_rate, units, unit_label, entitlement_kind, is_active')
      .eq('organization_id', ctx.member.organization_id)
      .eq('is_active', true),
    supabase
      .from('memberships')
      .select('id, status, plan_id, sponsor_id, custom_fields')
      .eq('organization_id', ctx.member.organization_id)
      .eq('member_id', ctx.member.id)
      .in('status', ['active', 'pending']),
  ]);

  const schemaMissing = packErr?.code === '42P01' || (packErr?.message ?? '').includes('does not exist');
  const catalog = buildShopCatalog({
    plans: plans ?? [],
    packages: schemaMissing ? [] : packages ?? [],
    existing: memberships ?? [],
  });

  return NextResponse.json({ ...catalog, schemaMissing });
}
