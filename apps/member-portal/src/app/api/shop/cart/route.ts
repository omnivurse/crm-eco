import { NextResponse } from 'next/server';
import { normalizeCartItems } from '@crm-eco/lib';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export const dynamic = 'force-dynamic';

function missingSchema(error: { message?: string; code?: string } | null | undefined) {
  return error?.code === '42P01' || (error?.message ?? '').includes('does not exist');
}

async function getDraftCart(supabase: any, organizationId: string, memberId: string) {
  const existing = await supabase
    .from('shop_carts')
    .select('id, status')
    .eq('organization_id', organizationId)
    .eq('member_id', memberId)
    .eq('status', 'draft')
    .maybeSingle();
  if (missingSchema(existing.error)) return { schemaMissing: true as const, cart: null, items: [] };
  if (existing.error) throw new Error(existing.error.message);

  let cart = existing.data;
  if (!cart) {
    const created = await supabase
      .from('shop_carts')
      .insert({ organization_id: organizationId, member_id: memberId, status: 'draft' })
      .select('id, status')
      .single();
    if (created.error) throw new Error(created.error.message);
    cart = created.data;
  }

  const { data: items, error } = await supabase
    .from('shop_cart_items')
    .select('id, item_type, plan_id, package_id, quantity')
    .eq('cart_id', cart.id);
  if (error) throw new Error(error.message);
  return { schemaMissing: false as const, cart, items: items ?? [] };
}

export async function GET() {
  const ctx = await requireActiveMembership();
  try {
    const result = await getDraftCart(
      createServiceRoleClient() as any,
      ctx.member.organization_id,
      ctx.member.id,
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load cart' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await requireActiveMembership();
  const body = (await request.json().catch(() => null)) as {
    action?: 'replace' | 'clear';
    items?: Array<{ item_type: 'plan' | 'package'; plan_id?: string; package_id?: string; quantity?: number }>;
  } | null;

  const supabase = createServiceRoleClient() as any;
  try {
    const draft = await getDraftCart(supabase, ctx.member.organization_id, ctx.member.id);
    if (draft.schemaMissing) {
      return NextResponse.json({ schemaMissing: true, items: normalizeCartItems(body?.items ?? []) });
    }
    if (body?.action === 'clear' || body?.action === 'replace') {
      await supabase.from('shop_cart_items').delete().eq('cart_id', draft.cart.id);
    }
    if (body?.action === 'replace') {
      const items = normalizeCartItems(body.items ?? []);
      if (items.length > 0) {
        const { error } = await supabase.from('shop_cart_items').insert(
          items.map((item) => ({
            organization_id: ctx.member.organization_id,
            cart_id: draft.cart.id,
            item_type: item.item_type,
            plan_id: item.plan_id ?? null,
            package_id: item.package_id ?? null,
            quantity: item.quantity ?? 1,
          })),
        );
        if (error) throw new Error(error.message);
      }
    }
    return NextResponse.json(await getDraftCart(supabase, ctx.member.organization_id, ctx.member.id));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not update cart' }, { status: 500 });
  }
}
