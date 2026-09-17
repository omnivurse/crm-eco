'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@crm-eco/ui';
import { toast } from 'sonner';

export interface PackageFormValues {
  id?: string;
  name: string;
  sku: string;
  description: string;
  price: string;
  tax_rate: string;
  units: string;
  unit_label: string;
  entitlement_kind: 'visits' | 'dollars' | 'months' | 'units';
  is_active: boolean;
}

const empty: PackageFormValues = {
  name: '',
  sku: '',
  description: '',
  price: '',
  tax_rate: '0',
  units: '1',
  unit_label: 'visits',
  entitlement_kind: 'visits',
  is_active: true,
};

export function PackageForm({ initial }: { initial?: Partial<PackageFormValues> }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PackageFormValues>({ ...empty, ...initial });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        tax_rate: Number(form.tax_rate) || 0,
        units: Number(form.units) || 1,
        unit_label: form.unit_label.trim() || 'units',
        entitlement_kind: form.entitlement_kind,
        is_active: form.is_active,
      };
      const res = await fetch(form.id ? `/api/packages/${form.id}` : '/api/packages', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save package');
      toast.success(form.id ? 'Package updated' : 'Package created');
      router.push(form.id ? `/products/packages/${form.id}` : `/products/packages/${json.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save package');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{form.id ? 'Edit package' : 'New package'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="pkg-name">Name</Label>
            <Input id="pkg-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-sku">SKU</Label>
            <Input id="pkg-sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-price">Price</Label>
            <Input id="pkg-price" type="number" min="0.01" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-tax">Tax rate (0–1)</Label>
            <Input id="pkg-tax" type="number" min="0" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-units">Units included</Label>
            <Input id="pkg-units" type="number" min="1" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-unit-label">Unit label</Label>
            <Input id="pkg-unit-label" value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-kind">Entitlement</Label>
            <select
              id="pkg-kind"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.entitlement_kind}
              onChange={(e) => setForm({ ...form, entitlement_kind: e.target.value as PackageFormValues['entitlement_kind'] })}
            >
              <option value="visits">Visits</option>
              <option value="units">Units</option>
              <option value="dollars">Dollars</option>
              <option value="months">Months</option>
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="pkg-desc">Description</Label>
            <Input id="pkg-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active in portal shop
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save package'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
