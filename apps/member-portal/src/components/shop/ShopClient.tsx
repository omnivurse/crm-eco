'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { toast } from 'sonner';

type CatalogPlan = {
  id: string;
  name: string;
  code: string;
  monthly_share: number | null;
  description: string | null;
  frequency: string;
};
type CatalogPackage = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  units: number;
  unit_label: string;
};
type CartItem = {
  item_type: 'plan' | 'package';
  plan_id?: string | null;
  package_id?: string | null;
  quantity?: number;
};

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

export function ShopClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  const [packages, setPackages] = useState<CatalogPackage[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [catalogRes, cartRes] = await Promise.all([fetch('/api/shop/catalog'), fetch('/api/shop/cart')]);
        const catalog = await catalogRes.json();
        const cart = await cartRes.json();
        if (!catalogRes.ok) throw new Error(catalog.error || 'Could not load shop');
        setPlans(catalog.plans ?? []);
        setPackages(catalog.packages ?? []);
        setSchemaMissing(catalog.schemaMissing === true);
        if (Array.isArray(cart.items) && cart.items.length > 0) {
          setItems(
            cart.items.map((row: CartItem) => ({
              item_type: row.item_type,
              plan_id: row.plan_id,
              package_id: row.package_id,
              quantity: row.quantity ?? 1,
            })),
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load shop');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const cartLabel = useMemo(() => {
    return items.map((item) => {
      if (item.item_type === 'plan') {
        const plan = plans.find((p) => p.id === item.plan_id);
        return plan ? `${plan.name} · ${money(plan.monthly_share)}/${plan.frequency}` : 'Add-on plan';
      }
      const pack = packages.find((p) => p.id === item.package_id);
      return pack ? `${pack.name} · ${money(pack.price)}` : 'Package';
    });
  }, [items, plans, packages]);

  function addPlan(plan: CatalogPlan) {
    setItems((prev) => (prev.some((i) => i.plan_id === plan.id) ? prev : [...prev, { item_type: 'plan', plan_id: plan.id, quantity: 1 }]));
  }

  function addPackage(pack: CatalogPackage) {
    setItems((prev) => (prev.some((i) => i.package_id === pack.id) ? prev : [...prev, { item_type: 'package', package_id: pack.id, quantity: 1 }]));
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function checkout() {
    if (items.length === 0) return toast.error('Add something to the cart first');
    setCheckingOut(true);
    try {
      await fetch('/api/shop/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replace', items }),
      });
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed');
      const addOnCount = json.memberships?.length ?? 0;
      const packageCount = json.packages?.length ?? 0;
      toast.success(
        `Added ${addOnCount} add-on${addOnCount === 1 ? '' : 's'}${packageCount ? ` and ${packageCount} package invoice${packageCount === 1 ? '' : 's'}` : ''}.`,
      );
      setItems([]);
      if (packageCount > 0) router.push('/billing/invoices');
      else router.push('/plan');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading shop…</p>;

  return (
    <div className="space-y-6">
      {schemaMissing && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            Prepaid packages are not available on this database yet. Add-on plans still checkout.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add-on memberships</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plans.length === 0 ? (
            <p className="text-sm text-slate-500">
              No add-on plans are listed yet. Staff can mark a plan purchasable on the product pricing page.
            </p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-slate-900">{plan.name}</p>
                  <p className="text-xs text-slate-500">{plan.code}</p>
                  {plan.description && <p className="mt-1 text-sm text-slate-600">{plan.description}</p>}
                  <p className="mt-1 text-sm">{money(plan.monthly_share)} / {plan.frequency}</p>
                </div>
                <Button size="sm" onClick={() => addPlan(plan)}>Add</Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {packages.length === 0 ? (
            <p className="text-sm text-slate-500">No prepaid packages are listed yet.</p>
          ) : (
            packages.map((pack) => (
              <div key={pack.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium text-slate-900">{pack.name}</p>
                  <p className="text-xs text-slate-500">
                    {pack.units} {pack.unit_label}
                    {pack.sku ? ` · ${pack.sku}` : ''}
                  </p>
                  {pack.description && <p className="mt-1 text-sm text-slate-600">{pack.description}</p>}
                  <p className="mt-1 text-sm">{money(pack.price)}</p>
                </div>
                <Button size="sm" onClick={() => addPackage(pack)}>Add</Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">Your cart is empty.</p>
          ) : (
            <ul className="space-y-2">
              {cartLabel.map((label, index) => (
                <li key={`${label}-${index}`} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <Button size="sm" variant="outline" onClick={() => removeAt(index)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button onClick={() => void checkout()} disabled={checkingOut || items.length === 0}>
            {checkingOut ? 'Checking out…' : 'Checkout'}
          </Button>
          <p className="text-xs text-slate-500">
            Checkout charges your saved payment method first. A declined card does not create a
            membership or package.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
