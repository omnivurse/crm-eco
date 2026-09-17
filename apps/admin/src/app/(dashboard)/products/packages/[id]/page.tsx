'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@crm-eco/ui';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';
import { PackageForm } from '@/components/packages/PackageForm';
import { toast } from 'sonner';

export default function PackageDetailPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [pack, setPack] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [redeemId, setRedeemId] = useState('');
  const [units, setUnits] = useState('1');

  async function load() {
    const res = await fetch(`/api/packages/${params.id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not load package');
    setPack(json.package);
    setPurchases(json.purchases ?? []);
  }

  useEffect(() => {
    load()
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not load'))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function redeem() {
    if (!redeemId) return toast.error('Choose a purchase');
    const res = await fetch(`/api/packages/${params.id}/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberPackageId: redeemId, units: Number(units) }),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json.error || 'Could not redeem');
    toast.success(`Redeemed. ${json.remaining} remaining.`);
    await load();
  }

  if (loading) return <p className="p-6 text-sm text-slate-500">Loading package…</p>;
  if (!pack) return <p className="p-6 text-sm text-slate-500">Package not found.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <EntityPageHeader
        backHref="/products/packages"
        backLabel="Packages"
        title={pack.name}
        description="Catalog price, remaining units, and redemptions"
      />
      <PackageForm
        initial={{
          id: pack.id,
          name: pack.name,
          sku: pack.sku ?? '',
          description: pack.description ?? '',
          price: String(pack.price ?? ''),
          tax_rate: String(pack.tax_rate ?? 0),
          units: String(pack.units ?? 1),
          unit_label: pack.unit_label ?? 'units',
          entitlement_kind: pack.entitlement_kind ?? 'units',
          is_active: pack.is_active !== false,
        }}
      />
      <Card>
        <CardHeader>
          <CardTitle>Purchases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {purchases.length === 0 ? (
            <p className="text-sm text-slate-500">No member purchases yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {purchases.map((row) => (
                <li key={row.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{row.status}</p>
                    <p className="text-slate-500">
                      {row.units_remaining} / {row.units_purchased} remaining · member {String(row.member_id).slice(0, 8)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setRedeemId(row.id)}>
                    Select
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="w-28"
              type="number"
              min="1"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              aria-label="Units to redeem"
            />
            <Button onClick={() => void redeem()} disabled={!redeemId}>
              Redeem selected
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
