import { CurrencyDollar, Package, Plus, Pulse, Sparkle, Tag } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, Button } from '@crm-eco/ui';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { ProductsClient } from '@/components/products/ProductsClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';

async function getProducts() {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return { products: [], organizationId: '' };
  const { data: products } = await (supabase
    .from('plans')
    .select(`
      id,
      name,
      code,
      product_line,
      coverage_category,
      tier,
      monthly_share,
      iua_amount,
      is_active,
      effective_start_date,
      effective_end_date,
      created_at,
      rating_model
    `)
    .eq('organization_id', tenant.organizationId)
    .order('name', { ascending: true }) as any);

  return { products: products ?? [], organizationId: tenant.organizationId };
}

export default async function ProductsPage() {
  const { products, organizationId } = await getProducts();

  const activeProducts = products.filter((p: { is_active: boolean }) => p.is_active);
  const categories = Array.from(new Set(products.map((p: { coverage_category: string | null }) => p.coverage_category).filter(Boolean)));
  const totalMonthlyValue = products.reduce((sum: number, p: { monthly_share: number | null }) => sum + (p.monthly_share || 0), 0);

  const avgMonthly =
    products.length > 0 ? Math.round(totalMonthlyValue / products.length) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage health plans, pricing, and features"
        icon={<Package weight="light" className="h-6 w-6" />}
        gradient="from-[var(--adm-teal)] to-[var(--adm-cyan)]"
        actions={
          <>
            <Link href="/products/rate-settings">
              <Button variant="outline" size="sm">
                <CurrencyDollar weight="light" className="mr-1.5 h-4 w-4" aria-hidden />
                Rate settings
              </Button>
            </Link>
            <Link href="/products/features">
              <Button variant="outline" size="sm">
                <Sparkle weight="light" className="mr-1.5 h-4 w-4" aria-hidden />
                Features
              </Button>
            </Link>
            <Link href="/products/new">
              <Button size="sm">
                <Plus weight="light" className="mr-1.5 h-4 w-4" aria-hidden />
                Add product
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-[var(--adm-hairline)] shadow-sm">
          <CardContent className="flex items-center gap-3 pt-5 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
              <Package weight="light" className="h-5 w-5 text-[var(--adm-teal)]" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums tracking-tight">{products.length}</p>
              <p className="text-xs text-[var(--adm-muted)]">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--adm-hairline)] shadow-sm">
          <CardContent className="flex items-center gap-3 pt-5 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <Pulse weight="light" className="h-5 w-5 text-emerald-600" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums tracking-tight">
                {activeProducts.length}
              </p>
              <p className="text-xs text-[var(--adm-muted)]">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--adm-hairline)] shadow-sm">
          <CardContent className="flex items-center gap-3 pt-5 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Tag weight="light" className="h-5 w-5 text-slate-600" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums tracking-tight">
                {categories.length}
              </p>
              <p className="text-xs text-[var(--adm-muted)]">Categories</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[var(--adm-hairline)] shadow-sm">
          <CardContent className="flex items-center gap-3 pt-5 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
              <CurrencyDollar weight="light" className="h-5 w-5 text-teal-700" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums tracking-tight">${avgMonthly}</p>
              <p className="text-xs text-[var(--adm-muted)]">Avg monthly</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table with Filters */}
      <ProductsClient
        products={products}
        organizationId={organizationId}
        categories={categories as string[]}
      />
    </div>
  );
}
