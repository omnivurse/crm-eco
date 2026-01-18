import { Card, CardContent, Button } from '@crm-eco/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { PricingMatrixEditor } from '@/components/products/PricingMatrixEditor';

async function getProduct(id: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const { data: product } = await (supabase
    .from('plans')
    .select('id, name, code')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single() as any);

  return { product, organizationId: profile.organization_id };
}

export default async function ProductPricingPage({ params }: { params: { id: string } }) {
  const result = await getProduct(params.id);

  if (!result?.product) {
    notFound();
  }

  const { product, organizationId } = result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/products/${product.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pricing Matrix</h1>
          <p className="text-slate-500">
            {product.name} <span className="font-mono">({product.code})</span>
          </p>
        </div>
      </div>

      {/* Pricing Matrix Editor */}
      <PricingMatrixEditor productId={params.id} organizationId={organizationId} />
    </div>
  );
}
