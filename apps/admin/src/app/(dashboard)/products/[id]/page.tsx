import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { ArrowLeft, Edit, Calendar, DollarSign, List, Settings, Sparkles, Shield, Upload } from 'lucide-react';
import { ProductDetailActions } from '@/components/products/ProductDetailActions';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';

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
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single() as any);

  return { product, organizationId: profile.organization_id };
}

async function getProductIuaLevels(productId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('product_iua')
    .select('*')
    .eq('plan_id', productId)
    .order('amount', { ascending: true });

  return data ?? [];
}

async function getProductAgeBrackets(productId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('product_age_brackets')
    .select('*')
    .eq('plan_id', productId)
    .order('min_age', { ascending: true });

  return data ?? [];
}

async function getProductBenefits(productId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('product_benefits')
    .select('*')
    .eq('plan_id', productId)
    .order('sort_order', { ascending: true });

  return data ?? [];
}

async function getProductExtraCosts(productId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('product_extra_costs')
    .select('*')
    .eq('plan_id', productId)
    .order('name', { ascending: true });

  return data ?? [];
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const result = await getProduct(params.id);

  if (!result?.product) {
    notFound();
  }

  const { product, organizationId } = result;

  const [iuaLevels, ageBrackets, benefits, extraCosts] = await Promise.all([
    getProductIuaLevels(params.id),
    getProductAgeBrackets(params.id),
    getProductBenefits(params.id),
    getProductExtraCosts(params.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
            <p className="text-slate-500 font-mono">{product.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={product.is_active ? 'default' : 'secondary'}>
            {product.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <ProductDetailActions
            productId={product.id}
            productName={product.name}
            organizationId={organizationId}
          />
          <Link href={`/products/${product.id}/pricing`}>
            <Button variant="outline">
              <DollarSign className="h-4 w-4 mr-2" />
              Pricing Matrix
            </Button>
          </Link>
          <Link href={`/products/${product.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Product
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Name</p>
                <p className="font-medium">{product.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Code</p>
                <p className="font-mono font-medium">{product.code}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Product Line</p>
                <p className="font-medium">{product.product_line || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Category</p>
                <p className="font-medium">{product.coverage_category || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Provider</p>
                <p className="font-medium">{product.provider || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Tier</p>
                <p className="font-medium">{product.tier || '—'}</p>
              </div>
              {product.description && (
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">Description</p>
                  <p className="font-medium">{product.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-500">Monthly Share</p>
                <p className="text-xl font-bold">{formatCurrency(product.monthly_share)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Enrollment Fee</p>
                <p className="text-xl font-bold">{formatCurrency(product.enrollment_fee)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">IUA Amount</p>
                <p className="text-xl font-bold">{formatCurrency(product.iua_amount)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Max Annual Share</p>
                <p className="text-xl font-bold">{formatCurrency(product.max_annual_share)}</p>
              </div>
            </CardContent>
          </Card>

          {/* IUA Levels */}
          <Card>
            <CardHeader>
              <CardTitle>IUA Levels</CardTitle>
              <CardDescription>
                Initial Unshared Amount options for this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              {iuaLevels.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No IUA levels configured
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {iuaLevels.map((level: any) => (
                    <div
                      key={level.id}
                      className="p-3 rounded-lg border bg-slate-50 text-center"
                    >
                      <p className="text-lg font-bold">{formatCurrency(level.amount)}</p>
                      {level.label && (
                        <p className="text-xs text-slate-500">{level.label}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Age Brackets */}
          <Card>
            <CardHeader>
              <CardTitle>Age Brackets</CardTitle>
              <CardDescription>
                Age-based pricing tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ageBrackets.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No age brackets configured
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ageBrackets.map((bracket: any) => (
                    <div
                      key={bracket.id}
                      className="p-3 rounded-lg border bg-slate-50"
                    >
                      <p className="font-bold">
                        {bracket.min_age} - {bracket.max_age} years
                      </p>
                      {bracket.label && (
                        <p className="text-xs text-slate-500">{bracket.label}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Product Benefits
              </CardTitle>
              <CardDescription>
                Features and benefits included in this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              {benefits.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No benefits configured
                </p>
              ) : (
                <div className="space-y-3">
                  {benefits.map((benefit: any) => (
                    <div key={benefit.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 shrink-0" />
                      <div>
                        <p className="font-medium">{benefit.benefit_name}</p>
                        {benefit.description && (
                          <p className="text-sm text-slate-500">{benefit.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Effective Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Effective Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Start Date</p>
                <p className="font-medium">
                  {product.effective_start_date
                    ? format(new Date(product.effective_start_date), 'MMMM d, yyyy')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">End Date</p>
                <p className="font-medium">
                  {product.effective_end_date
                    ? format(new Date(product.effective_end_date), 'MMMM d, yyyy')
                    : 'No end date'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Requires Dependent Info</span>
                <Badge variant={product.require_dependent_info ? 'default' : 'outline'}>
                  {product.require_dependent_info ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Hidden from Public</span>
                <Badge variant={product.hide_from_public ? 'destructive' : 'outline'}>
                  {product.hide_from_public ? 'Yes' : 'No'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Extra Costs */}
          <Card>
            <CardHeader>
              <CardTitle>Extra Costs</CardTitle>
              <CardDescription>
                Additional fees and surcharges
              </CardDescription>
            </CardHeader>
            <CardContent>
              {extraCosts.length === 0 ? (
                <p className="text-sm text-slate-500">No extra costs configured</p>
              ) : (
                <div className="space-y-2">
                  {extraCosts.map((cost: any) => (
                    <div
                      key={cost.id}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div>
                        <p className="font-medium text-sm">{cost.name}</p>
                        <p className="text-xs text-slate-500">{cost.frequency}</p>
                      </div>
                      <p className="font-bold text-sm">{formatCurrency(cost.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Record Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="h-4 w-4" />
                <span>
                  Created {format(new Date(product.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <p className="text-slate-400 font-mono text-xs">{product.id}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
