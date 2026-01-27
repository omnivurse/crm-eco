import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { Plus, Package, DollarSign, Tag, Activity, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { ProductsClient } from '@/components/products/ProductsClient';

async function getProducts() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { products: [], organizationId: '' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return { products: [], organizationId: '' };

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
      created_at
    `)
    .eq('organization_id', profile.organization_id)
    .order('name', { ascending: true }) as any);

  return { products: products ?? [], organizationId: profile.organization_id };
}

export default async function ProductsPage() {
  const { products, organizationId } = await getProducts();

  const activeProducts = products.filter((p: { is_active: boolean }) => p.is_active);
  const categories = [...new Set(products.map((p: { coverage_category: string | null }) => p.coverage_category).filter(Boolean))];
  const totalMonthlyValue = products.reduce((sum: number, p: { monthly_share: number | null }) => sum + (p.monthly_share || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-slate-500">Manage health plans, pricing, and features</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/products/features">
            <Button variant="outline">
              <Sparkles className="h-4 w-4 mr-2" />
              Features Library
            </Button>
          </Link>
          <Link href="/products/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-sm text-muted-foreground">Total Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeProducts.length}</p>
                <p className="text-sm text-muted-foreground">Active Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Tag className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{categories.length}</p>
                <p className="text-sm text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ${(totalMonthlyValue / products.length || 0).toFixed(0)}
                </p>
                <p className="text-sm text-muted-foreground">Avg Monthly</p>
              </div>
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
