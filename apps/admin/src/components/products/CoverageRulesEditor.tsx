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
import { CORE_MEMBERSHIP_CODE, parseCoverageConfig } from '@crm-eco/rates';
import type { ChargeCategory, CoveragePayer, CoverageTreatment } from '@crm-eco/rates';
import { toast } from 'sonner';

const TREATMENTS: { value: CoverageTreatment; label: string }[] = [
  { value: 'pass_through', label: 'Pass through' },
  { value: 'included', label: 'Included' },
  { value: 'included_under', label: 'Included under $' },
  { value: 'quantity_limit', label: 'Quantity limit' },
  { value: 'percent_discount', label: 'Percent discount' },
  { value: 'flat_amount', label: 'Flat amount off' },
  { value: 'not_covered', label: 'Not covered' },
];

const CATEGORIES: ChargeCategory[] = ['membership', 'registration', 'visit', 'lab', 'other'];

type ItemRow = { code: string; name: string; category: ChargeCategory; list_amount: string };
type RuleRow = {
  charge_item_code: string;
  treatment: CoverageTreatment;
  who_pays: CoveragePayer;
  threshold_amount: string;
  quantity_limit: string;
  percent: string;
  flat_amount: string;
};

function emptyItem(): ItemRow {
  return { code: '', name: '', category: 'other', list_amount: '' };
}

function emptyRule(): RuleRow {
  return {
    charge_item_code: CORE_MEMBERSHIP_CODE,
    treatment: 'pass_through',
    who_pays: 'member',
    threshold_amount: '',
    quantity_limit: '',
    percent: '',
    flat_amount: '',
  };
}

export function CoverageRulesEditor({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/plans/${planId}/coverage`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load coverage');
        if (cancelled) return;
        const parsed = parseCoverageConfig(json.coverage);
        setItems(
          parsed?.items.length
            ? parsed.items.map((item) => ({
                code: item.code,
                name: item.name,
                category: item.category,
                list_amount: String(item.list_amount),
              }))
            : []
        );
        setRules(
          parsed?.rules.length
            ? parsed.rules.map((rule) => ({
                charge_item_code: rule.charge_item_code,
                treatment: rule.treatment,
                who_pays: rule.who_pays,
                threshold_amount: rule.threshold_amount != null ? String(rule.threshold_amount) : '',
                quantity_limit: rule.quantity_limit != null ? String(rule.quantity_limit) : '',
                percent: rule.percent != null ? String(rule.percent) : '',
                flat_amount: rule.flat_amount != null ? String(rule.flat_amount) : '',
              }))
            : []
        );
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Could not load coverage');
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
      const res = await fetch(`/api/plans/${planId}/coverage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverage: {
            items: items.map((item) => ({
              ...item,
              list_amount: item.list_amount === '' ? undefined : Number(item.list_amount),
            })),
            rules: rules.map((rule) => ({
              charge_item_code: rule.charge_item_code,
              treatment: rule.treatment,
              who_pays: rule.who_pays,
              threshold_amount: rule.threshold_amount === '' ? undefined : Number(rule.threshold_amount),
              quantity_limit: rule.quantity_limit === '' ? undefined : Number(rule.quantity_limit),
              percent: rule.percent === '' ? undefined : Number(rule.percent),
              flat_amount: rule.flat_amount === '' ? undefined : Number(rule.flat_amount),
            })),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save coverage');
      toast.success('Coverage rules saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save coverage');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage rules</CardTitle>
        <CardDescription>
          Charge items and who pays. No rule keeps quotes on the member and sponsor invoices
          at the full membership amount.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading coverage…</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Charge items</Label>
              {items.length === 0 && (
                <p className="text-sm text-slate-500">No extra charge items. Membership share uses code {CORE_MEMBERSHIP_CODE}.</p>
              )}
              {items.map((item, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-4">
                  <Input
                    placeholder="Code"
                    value={item.code}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...item, code: e.target.value };
                      setItems(next);
                    }}
                  />
                  <Input
                    placeholder="Name"
                    value={item.name}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...item, name: e.target.value };
                      setItems(next);
                    }}
                  />
                  <select
                    className="h-10 w-full rounded-md border px-3 text-sm"
                    value={item.category}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...item, category: e.target.value as ChargeCategory };
                      setItems(next);
                    }}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    placeholder="List amount"
                    value={item.list_amount}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...item, list_amount: e.target.value };
                      setItems(next);
                    }}
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, emptyItem()])}>
                Add charge item
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Who pays</Label>
              {rules.map((rule, index) => (
                <div key={index} className="space-y-2 rounded-md border p-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <Input
                      placeholder="Charge item code"
                      value={rule.charge_item_code}
                      onChange={(e) => {
                        const next = [...rules];
                        next[index] = { ...rule, charge_item_code: e.target.value };
                        setRules(next);
                      }}
                    />
                    <select
                      className="h-10 w-full rounded-md border px-3 text-sm"
                      value={rule.treatment}
                      onChange={(e) => {
                        const next = [...rules];
                        next[index] = { ...rule, treatment: e.target.value as CoverageTreatment };
                        setRules(next);
                      }}
                    >
                      {TREATMENTS.map((treatment) => (
                        <option key={treatment.value} value={treatment.value}>
                          {treatment.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-10 w-full rounded-md border px-3 text-sm"
                      value={rule.who_pays}
                      onChange={(e) => {
                        const next = [...rules];
                        next[index] = { ...rule, who_pays: e.target.value as CoveragePayer };
                        setRules(next);
                      }}
                    >
                      <option value="member">Member pays</option>
                      <option value="sponsor">Sponsor pays</option>
                    </select>
                  </div>
                  {rule.treatment === 'included_under' && (
                    <Input
                      type="number"
                      min={0}
                      placeholder="Threshold amount"
                      value={rule.threshold_amount}
                      onChange={(e) => {
                        const next = [...rules];
                        next[index] = { ...rule, threshold_amount: e.target.value };
                        setRules(next);
                      }}
                    />
                  )}
                  {rule.treatment === 'quantity_limit' && (
                    <Input
                      type="number"
                      min={0}
                      placeholder="Quantity included"
                      value={rule.quantity_limit}
                      onChange={(e) => {
                        const next = [...rules];
                        next[index] = { ...rule, quantity_limit: e.target.value };
                        setRules(next);
                      }}
                    />
                  )}
                  {rule.treatment === 'percent_discount' && (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Percent off"
                      value={rule.percent}
                      onChange={(e) => {
                        const next = [...rules];
                        next[index] = { ...rule, percent: e.target.value };
                        setRules(next);
                      }}
                    />
                  )}
                  {rule.treatment === 'flat_amount' && (
                    <Input
                      type="number"
                      min={0}
                      placeholder="Flat amount off"
                      value={rule.flat_amount}
                      onChange={(e) => {
                        const next = [...rules];
                        next[index] = { ...rule, flat_amount: e.target.value };
                        setRules(next);
                      }}
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRules(rules.filter((_, i) => i !== index))}
                  >
                    Remove rule
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setRules([...rules, emptyRule()])}>
                  Add rule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRules([
                      ...rules,
                      { ...emptyRule(), who_pays: 'sponsor', charge_item_code: CORE_MEMBERSHIP_CODE },
                    ])
                  }
                >
                  Sponsor pays membership
                </Button>
              </div>
            </div>

            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save coverage rules'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
