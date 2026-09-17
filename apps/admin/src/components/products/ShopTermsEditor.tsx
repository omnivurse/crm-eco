'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@crm-eco/ui';
import { toast } from 'sonner';

export function ShopTermsEditor({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<'core' | 'addon'>('core');
  const [purchasable, setPurchasable] = useState(false);
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/plans/${planId}/shop`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load shop settings');
        if (cancelled) return;
        setKind(json.shop?.kind === 'addon' ? 'addon' : 'core');
        setPurchasable(json.shop?.purchasable === true);
        setFrequency(json.shop?.frequency === 'quarterly' || json.shop?.frequency === 'annual' ? json.shop.frequency : 'monthly');
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Could not load shop settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/plans/${planId}/shop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, purchasable, frequency }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save');
      toast.success('Shop settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal shop</CardTitle>
        <CardDescription>
          Mark this plan as a purchasable add-on. Core plans stay on the household membership;
          add-ons get their own bill schedule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading shop settings…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="shop-kind">Layer</Label>
              <select
                id="shop-kind"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value === 'addon' ? 'addon' : 'core')}
              >
                <option value="core">Core membership</option>
                <option value="addon">Add-on</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shop-frequency">Billing frequency</Label>
              <select
                id="shop-frequency"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={frequency}
                onChange={(e) =>
                  setFrequency(
                    e.target.value === 'quarterly' || e.target.value === 'annual'
                      ? e.target.value
                      : 'monthly',
                  )
                }
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={purchasable}
                onChange={(e) => setPurchasable(e.target.checked)}
              />
              Show in member portal shop
            </label>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save shop settings'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
