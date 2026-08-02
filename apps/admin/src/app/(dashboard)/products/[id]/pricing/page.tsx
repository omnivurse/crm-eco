import { Badge } from '@crm-eco/ui';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { E123PricingMatrix } from '@/components/products/E123PricingMatrix';
import { RateQuoteCalculator } from '@/components/products/RateQuoteCalculator';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { getActiveTenant } from '@/lib/tenant';

async function getProduct(id: string) {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const { data: product } = await (supabase
    .from('plans')
    .select('id, name, code, rating_model')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single() as any);

  return { product, organizationId: tenant.organizationId };
}

export default async function ProductPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getProduct(id);

  if (!result?.product) {
    notFound();
  }

  const { product, organizationId } = result;

  return (
    <div className="space-y-6">
      <EntityPageHeader
        backHref={`/products/${product.id}`}
        backLabel={product.name}
        title="Pricing matrix"
        subtitle={
          <span>
            {product.name}{' '}
            <span className="font-mono text-[var(--adm-ink)]/80">({product.code})</span>
          </span>
        }
        badges={
          <Badge variant="outline" className="text-xs font-normal">
            {product.rating_model === 'additive_person' ? 'Additive person' : 'Tiered household'}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <E123PricingMatrix
            productId={id}
            productCode={product.code}
            organizationId={organizationId}
          />
        </div>
        <div>
          <RateQuoteCalculator defaultPlanId={product.code} />
        </div>
      </div>
    </div>
  );
}
