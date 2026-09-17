import { NextResponse } from 'next/server';
import { checkoutShopItems, normalizeCartItems } from '@crm-eco/lib';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const ctx = await requireActiveMembership();
  const body = (await request.json().catch(() => null)) as {
    items?: Array<{ item_type: 'plan' | 'package'; plan_id?: string; package_id?: string; quantity?: number }>;
  } | null;

  const supabase = createServiceRoleClient() as any;
  let items = normalizeCartItems(body?.items ?? []);

  try {
    if (items.length === 0) {
      const { data: cart } = await supabase
        .from('shop_carts')
        .select('id')
        .eq('organization_id', ctx.member.organization_id)
        .eq('member_id', ctx.member.id)
        .eq('status', 'draft')
        .maybeSingle();
      if (cart?.id) {
        const { data: rows } = await supabase
          .from('shop_cart_items')
          .select('item_type, plan_id, package_id, quantity')
          .eq('cart_id', cart.id);
        items = normalizeCartItems(rows ?? []);
      }
    }

    const result = await checkoutShopItems(supabase, {
      organizationId: ctx.member.organization_id,
      memberId: ctx.member.id,
      items,
      source: 'portal_shop',
    });

    const { data: cart } = await supabase
      .from('shop_carts')
      .select('id')
      .eq('organization_id', ctx.member.organization_id)
      .eq('member_id', ctx.member.id)
      .eq('status', 'draft')
      .maybeSingle();
    if (cart?.id) {
      await supabase
        .from('shop_carts')
        .update({ status: 'checked_out', updated_at: new Date().toISOString() })
        .eq('id', cart.id);
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout failed' },
      { status: 400 },
    );
  }
}
