import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { ProductForm } from '@/components/products/ProductForm';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { getActiveTenant } from '@/lib/tenant';

async function getProduct(id: string) {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const { data: product } = await (supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single() as any);

  return product;
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <EntityPageHeader
        backHref={`/products/${id}`}
        backLabel={product.name}
        title="Edit product"
        subtitle={
          <span>
            {product.name}{' '}
            <span className="font-mono text-[var(--adm-ink)]/80">({product.code})</span>
          </span>
        }
        badges={
          product.status ? (
            <Badge variant="outline" className="text-xs font-normal capitalize">
              {product.status}
            </Badge>
          ) : undefined
        }
      />

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
          <CardDescription>
            Update the product details, pricing, and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm initialData={product} />
        </CardContent>
      </Card>
    </div>
  );
}
