'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@crm-eco/ui';
import { parseCommercialTerms } from '@crm-eco/rates';
import type { BillingPeriod, BillingTiming, CommercialTerms, GroupSizeDiscount } from '@crm-eco/rates';
import type { RateConfig } from '@crm-eco/rates/types';
import { toast } from 'sonner';

const PERIODS: BillingPeriod[] = ['monthly', 'quarterly', 'semi_annual', 'annual'];

export function CommercialTermsEditor({
  planId,
  planCode,
}: {
  planId: string;
  planCode?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timing, setTiming] = useState<BillingTiming>('advance');
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [quarterlyDiscount, setQuarterlyDiscount] = useState('');
  const [semiDiscount, setSemiDiscount] = useState('');
  const [annualDiscount, setAnnualDiscount] = useState('');
  const [familyMax, setFamilyMax] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [tiers, setTiers] = useState<Array<{ min_lives: string; percent: string }>>([
    { min_lives: '', percent: '' },
  ]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/rates/config?planId=${encodeURIComponent(planId)}`);
        if (!res.ok) throw new Error('Could not load commercial terms');
        const config = (await res.json()) as RateConfig;
        const plan =
          config.rate_sets.current.plans.find((row) => row.planId === planCode) ??
          config.rate_sets.current.plans[0] ??
          config.rate_sets.rates_2026.plans[0];
        const terms = parseCommercialTerms(plan?.commercial_terms);
        if (cancelled) return;
        applyTerms(terms);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Could not load terms');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [planId, planCode]);

  function applyTerms(terms: CommercialTerms | undefined) {
    setTiming(terms?.billing_timing ?? 'advance');
    setPeriod(terms?.default_period ?? 'monthly');
    setQuarterlyDiscount(terms?.period_discounts?.quarterly != null ? String(terms.period_discounts.quarterly) : '');
    setSemiDiscount(terms?.period_discounts?.semi_annual != null ? String(terms.period_discounts.semi_annual) : '');
    setAnnualDiscount(terms?.period_discounts?.annual != null ? String(terms.period_discounts.annual) : '');
    setFamilyMax(terms?.registration_fee_family_max != null ? String(terms.registration_fee_family_max) : '');
    setMinAge(terms?.min_age_years != null ? String(terms.min_age_years) : '');
    setMaxAge(terms?.max_age_years != null ? String(terms.max_age_years) : '');
    setTiers(
      terms?.group_size_discounts?.length
        ? terms.group_size_discounts.map((row) => ({
            min_lives: String(row.min_lives),
            percent: String(row.percent ?? ''),
          }))
        : [{ min_lives: '', percent: '' }]
    );
  }

  function buildTerms(): CommercialTerms | null {
    const group_size_discounts = tiers
      .map((row) => ({
        min_lives: Number(row.min_lives),
        percent: Number(row.percent),
      }))
      .filter((row) => Number.isFinite(row.min_lives) && row.min_lives > 0 && Number.isFinite(row.percent)) as GroupSizeDiscount[];

    const period_discounts: CommercialTerms['period_discounts'] = {};
    if (quarterlyDiscount !== '') period_discounts.quarterly = Number(quarterlyDiscount);
    if (semiDiscount !== '') period_discounts.semi_annual = Number(semiDiscount);
    if (annualDiscount !== '') period_discounts.annual = Number(annualDiscount);

    return parseCommercialTerms({
      billing_timing: timing,
      default_period: period,
      period_discounts: Object.keys(period_discounts).length ? period_discounts : undefined,
      registration_fee_family_max: familyMax === '' ? undefined : Number(familyMax),
      min_age_years: minAge === '' ? undefined : Number(minAge),
      max_age_years: maxAge === '' ? undefined : Number(maxAge),
      group_size_discounts: group_size_discounts.length ? group_size_discounts : undefined,
    }) ?? null;
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/rates/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, commercialTerms: buildTerms() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save commercial terms');
      toast.success('Commercial terms saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save commercial terms');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commercial terms</CardTitle>
        <CardDescription>
          Group-size discounts, billing period, registration family max, and age limits. Applied by
          the rate engine on every quote.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading terms…</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ct-timing">Billing timing</Label>
                <select
                  id="ct-timing"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={timing}
                  onChange={(e) => setTiming(e.target.value as BillingTiming)}
                >
                  <option value="advance">Advance</option>
                  <option value="arrears">Arrears (monthly only)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-period">Default period</Label>
                <select
                  id="ct-period"
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as BillingPeriod)}
                >
                  {PERIODS.map((value) => (
                    <option key={value} value={value}>
                      {value.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-q">Quarterly discount %</Label>
                <Input id="ct-q" type="number" min={0} max={100} value={quarterlyDiscount} onChange={(e) => setQuarterlyDiscount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-s">Semi-annual discount %</Label>
                <Input id="ct-s" type="number" min={0} max={100} value={semiDiscount} onChange={(e) => setSemiDiscount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-a">Annual discount %</Label>
                <Input id="ct-a" type="number" min={0} max={100} value={annualDiscount} onChange={(e) => setAnnualDiscount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-reg">Registration fee family max</Label>
                <Input id="ct-reg" type="number" min={0} value={familyMax} onChange={(e) => setFamilyMax(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-min">Min age (subscriber/spouse)</Label>
                <Input id="ct-min" type="number" min={0} value={minAge} onChange={(e) => setMinAge(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-max">Max age (subscriber/spouse)</Label>
                <Input id="ct-max" type="number" min={0} value={maxAge} onChange={(e) => setMaxAge(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Group-size discounts</Label>
              {tiers.map((row, index) => (
                <div key={index} className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Min lives"
                    value={row.min_lives}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[index] = { ...row, min_lives: e.target.value };
                      setTiers(next);
                    }}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Percent off"
                    value={row.percent}
                    onChange={(e) => {
                      const next = [...tiers];
                      next[index] = { ...row, percent: e.target.value };
                      setTiers(next);
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTiers([...tiers, { min_lives: '', percent: '' }])}
              >
                Add tier
              </Button>
            </div>

            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save commercial terms'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
