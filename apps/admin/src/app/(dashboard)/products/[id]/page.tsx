import { Calendar, ChartBar, CurrencyDollar, GearSix, List, PencilSimple } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { ProductDetailActions } from '@/components/products/ProductDetailActions';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';
import { buildMatrixPreview } from '@crm-eco/rates';
import type { RateConfig } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';
import { getActiveTenant } from '@/lib/tenant';

async function getProduct(id: string) {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const { data: product } = await (supabase
    .from('plans')
    .select('*, rating_model')
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single() as any);

  return { product, organizationId: tenant.organizationId };
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

function MetaField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--adm-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[var(--adm-ink)] break-words">{value}</dd>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--adm-hairline)] bg-[var(--adm-void)]/60 px-3 py-3">
      <p className="text-xs font-medium text-[var(--adm-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-[var(--adm-ink)]">
        {value}
      </p>
    </div>
  );
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getProduct(id);

  if (!result?.product) {
    notFound();
  }

  const { product, organizationId } = result;

  const [iuaLevelsResult, ageBracketsResult, benefitsResult, extraCostsResult] = await Promise.allSettled([
    getProductIuaLevels(id),
    getProductAgeBrackets(id),
    getProductBenefits(id),
    getProductExtraCosts(id),
  ]);
  const iuaLevels = iuaLevelsResult.status === 'fulfilled' ? iuaLevelsResult.value : [];
  const ageBrackets = ageBracketsResult.status === 'fulfilled' ? ageBracketsResult.value : [];
  const benefits = benefitsResult.status === 'fulfilled' ? benefitsResult.value : [];
  const extraCosts = extraCostsResult.status === 'fulfilled' ? extraCostsResult.value : [];

  const rateConfig = seedConfig as unknown as RateConfig;
  const preview = buildMatrixPreview(rateConfig, product.code, 'current');
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const metaFields = [
    { label: 'Product line', value: product.product_line as string | null },
    { label: 'Category', value: product.coverage_category as string | null },
    { label: 'Provider', value: product.provider as string | null },
    { label: 'Tier', value: product.tier as string | null },
  ].filter((f) => Boolean(f.value));

  return (
    <div className="space-y-6">
      <EntityPageHeader
        backHref="/products"
        backLabel="Products"
        title={product.name}
        subtitle={<span className="font-mono text-[var(--adm-ink)]/80">{product.code}</span>}
        description={product.description || undefined}
        badges={
          <>
            <Badge variant="outline" className="text-xs font-normal">
              {product.rating_model === 'additive_person' ? 'Additive person' : 'Tiered household'}
            </Badge>
            <Badge variant={product.is_active ? 'default' : 'secondary'} className="text-xs">
              {product.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </>
        }
        secondaryActions={
          <ProductDetailActions
            productId={product.id}
            productName={product.name}
            organizationId={organizationId}
          />
        }
        primaryAction={
          <Link href={`/products/${product.id}/edit`}>
            <Button size="sm">
              <PencilSimple weight="light" className="mr-1.5 h-4 w-4" aria-hidden />
              Edit product
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overview</CardTitle>
              <CardDescription>Core product identity and classification</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--adm-muted)]">
                    Name
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--adm-ink)]">{product.name}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-[var(--adm-muted)]">
                    Code
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-medium text-[var(--adm-ink)]">
                    {product.code}
                  </dd>
                </div>
                {metaFields.map((field) => (
                  <MetaField key={field.label} label={field.label} value={field.value} />
                ))}
              </dl>
              {metaFields.length === 0 && !product.description && (
                <p className="mt-2 text-sm text-[var(--adm-muted)]">
                  No line, category, provider, or tier set yet.{' '}
                  <Link
                    href={`/products/${product.id}/edit`}
                    className="font-medium text-[var(--adm-teal)] underline-offset-2 hover:underline"
                  >
                    Edit product
                  </Link>{' '}
                  to fill these in.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CurrencyDollar weight="light" className="h-4 w-4 text-[var(--adm-teal)]" aria-hidden />
                Pricing snapshot
              </CardTitle>
              <CardDescription>Headline amounts stored on the product record</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCell label="Monthly share" value={formatCurrency(product.monthly_share)} />
                <MetricCell label="Enrollment fee" value={formatCurrency(product.enrollment_fee)} />
                <MetricCell label="IUA amount" value={formatCurrency(product.iua_amount)} />
                <MetricCell label="Max annual share" value={formatCurrency(product.max_annual_share)} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">IUA levels</CardTitle>
              <CardDescription>Initial Unshared Amount options for this product</CardDescription>
            </CardHeader>
            <CardContent>
              {iuaLevels.length === 0 ? (
                <p className="py-2 text-sm text-[var(--adm-muted)]">
                  No IUA levels configured.{' '}
                  <Link
                    href={`/products/${product.id}/pricing`}
                    className="font-medium text-[var(--adm-teal)] underline-offset-2 hover:underline"
                  >
                    Open pricing matrix
                  </Link>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {iuaLevels.map((level: { id: string; amount: number; label?: string | null }) => (
                    <div
                      key={level.id}
                      className="rounded-xl border border-[var(--adm-hairline)] bg-[var(--adm-void)]/60 px-3 py-3 text-center"
                    >
                      <p className="text-base font-semibold tabular-nums">
                        {formatCurrency(level.amount)}
                      </p>
                      {level.label && (
                        <p className="mt-0.5 text-xs text-[var(--adm-muted)]">{level.label}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Age brackets</CardTitle>
              <CardDescription>Age-based pricing tiers</CardDescription>
            </CardHeader>
            <CardContent>
              {ageBrackets.length === 0 ? (
                <p className="py-2 text-sm text-[var(--adm-muted)]">No age brackets configured</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {ageBrackets.map(
                    (bracket: {
                      id: string;
                      min_age: number;
                      max_age: number;
                      label?: string | null;
                    }) => (
                      <div
                        key={bracket.id}
                        className="rounded-xl border border-[var(--adm-hairline)] bg-[var(--adm-void)]/60 px-3 py-3"
                      >
                        <p className="text-sm font-semibold tabular-nums">
                          {bracket.min_age}–{bracket.max_age} years
                        </p>
                        {bracket.label && (
                          <p className="mt-0.5 text-xs text-[var(--adm-muted)]">{bracket.label}</p>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <List weight="light" className="h-4 w-4 text-[var(--adm-teal)]" aria-hidden />
                Benefits
              </CardTitle>
              <CardDescription>Features included with this product</CardDescription>
            </CardHeader>
            <CardContent>
              {benefits.length === 0 ? (
                <p className="py-2 text-sm text-[var(--adm-muted)]">No benefits configured</p>
              ) : (
                <ul className="space-y-3">
                  {benefits.map(
                    (benefit: {
                      id: string;
                      benefit_name: string;
                      description?: string | null;
                    }) => (
                      <li key={benefit.id} className="flex gap-3">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--adm-teal)]"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--adm-ink)]">
                            {benefit.benefit_name}
                          </p>
                          {benefit.description && (
                            <p className="mt-0.5 text-sm text-[var(--adm-muted)]">
                              {benefit.description}
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar weight="light" className="h-4 w-4 text-[var(--adm-teal)]" aria-hidden />
                Effective dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--adm-muted)]">
                  Start
                </p>
                <p className="mt-1 text-sm font-medium">
                  {product.effective_start_date
                    ? format(new Date(product.effective_start_date), 'MMMM d, yyyy')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--adm-muted)]">
                  End
                </p>
                <p className="mt-1 text-sm font-medium">
                  {product.effective_end_date
                    ? format(new Date(product.effective_end_date), 'MMMM d, yyyy')
                    : 'No end date'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <GearSix weight="light" className="h-4 w-4 text-[var(--adm-teal)]" aria-hidden />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--adm-ink)]">Requires dependent info</span>
                <Badge variant={product.require_dependent_info ? 'default' : 'outline'}>
                  {product.require_dependent_info ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--adm-ink)]">Hidden from public</span>
                <Badge variant={product.hide_from_public ? 'destructive' : 'outline'}>
                  {product.hide_from_public ? 'Yes' : 'No'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Extra costs</CardTitle>
              <CardDescription>Additional fees and surcharges</CardDescription>
            </CardHeader>
            <CardContent>
              {extraCosts.length === 0 ? (
                <p className="text-sm text-[var(--adm-muted)]">No extra costs configured</p>
              ) : (
                <ul className="space-y-2">
                  {extraCosts.map((cost) => (
                      <li
                        key={cost.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--adm-hairline)] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{cost.name}</p>
                          <p className="text-xs text-[var(--adm-muted)]">{cost.frequency ?? '—'}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatCurrency(cost.amount)}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {preview && (
            <Card className="border-[var(--adm-hairline)] shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ChartBar weight="light" className="h-4 w-4 text-[var(--adm-teal)]" aria-hidden />
                  Rate preview
                </CardTitle>
                <CardDescription>Member-only rates from the current rate set</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {preview.ageBands.map((band) => (
                    <div key={band.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-[var(--adm-muted)]">{band.label}</span>
                      <span className="font-semibold tabular-nums">
                        {fmt(preview.matrix.member?.[band.id] ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-[var(--adm-hairline)] pt-3">
                  <Link href={`/products/${product.id}/pricing`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <CurrencyDollar weight="light" className="mr-2 h-4 w-4" aria-hidden />
                      Full pricing matrix
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Record info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[var(--adm-muted)]">
                <Calendar weight="light" className="h-4 w-4 shrink-0" aria-hidden />
                <span>Created {format(new Date(product.created_at), 'MMM d, yyyy')}</span>
              </div>
              <p className="break-all font-mono text-xs text-[var(--adm-muted)]/80">{product.id}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
