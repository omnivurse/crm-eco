'use client';

import { useState, useEffect } from 'react';
import {
  Scale,
  Plus,
  Loader2,
  RefreshCw,
  Calculator,
  Trash2,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

interface ComparisonItem {
  id: string;
  label: string;
  plan_type: string;
  full_premium: number;
  tax_credit: number;
  deductible: number | null;
  max_oop: number | null;
  metal_level: string | null;
  display_order: number;
}

interface Comparison {
  id: string;
  comparison_name: string;
  notes: string | null;
  record_id: string | null;
  created_at: string;
  created_by: string;
  item_count: number;
  items: ComparisonItem[] | null;
  min_premium: number | null;
  max_premium: number | null;
  avg_premium: number | null;
}

interface CalculateResult {
  gross_premium: number;
  tax_credit: number;
  net_premium: number;
}

export default function PremiumCompare() {
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick calculator state
  const [showCalc, setShowCalc] = useState(false);
  const [calcPremium, setCalcPremium] = useState('');
  const [calcCredit, setCalcCredit] = useState('');
  const [calcResult, setCalcResult] = useState<CalculateResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  // New comparison form
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<
    Array<{
      label: string;
      plan_type: string;
      full_premium: string;
      tax_credit: string;
      deductible: string;
      max_oop: string;
      metal_level: string;
    }>
  >([
    { label: '', plan_type: 'insurance', full_premium: '', tax_credit: '0', deductible: '', max_oop: '', metal_level: '' },
    { label: '', plan_type: 'insurance', full_premium: '', tax_credit: '0', deductible: '', max_oop: '', metal_level: '' },
  ]);

  async function fetchComparisons() {
    try {
      const res = await fetch('/api/crm/premium-comparisons');
      if (res.ok) {
        const json = await res.json();
        setComparisons(json.data || []);
      } else {
        toast.error('Failed to load comparisons');
      }
    } catch {
      toast.error('Failed to load comparisons');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchComparisons();
  }, []);

  async function handleCalculate() {
    const premium = parseFloat(calcPremium);
    const credit = parseFloat(calcCredit || '0');
    if (isNaN(premium) || premium < 0) {
      toast.error('Enter a valid premium amount');
      return;
    }
    setCalculating(true);
    try {
      const res = await fetch('/api/crm/premium-comparisons/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_premium: premium, tax_credit: credit }),
      });
      if (res.ok) {
        setCalcResult(await res.json());
      } else {
        toast.error('Calculation failed');
      }
    } catch {
      toast.error('Calculation failed');
    } finally {
      setCalculating(false);
    }
  }

  function addFormItem() {
    setFormItems((prev) => [
      ...prev,
      { label: '', plan_type: 'insurance', full_premium: '', tax_credit: '0', deductible: '', max_oop: '', metal_level: '' },
    ]);
  }

  function removeFormItem(idx: number) {
    if (formItems.length <= 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateFormItem(idx: number, field: string, value: string) {
    setFormItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  async function handleCreate() {
    if (!formName.trim()) {
      toast.error('Comparison name is required');
      return;
    }
    const items = formItems
      .filter((item) => item.label.trim() && item.full_premium)
      .map((item) => ({
        label: item.label.trim(),
        plan_type: item.plan_type as 'insurance' | 'healthshare' | 'medicaid' | 'short_term',
        full_premium: parseFloat(item.full_premium) || 0,
        tax_credit: parseFloat(item.tax_credit) || 0,
        deductible: item.deductible ? parseFloat(item.deductible) : undefined,
        max_oop: item.max_oop ? parseFloat(item.max_oop) : undefined,
        metal_level: item.metal_level || undefined,
      }));

    if (items.length < 1) {
      toast.error('At least one plan item is required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/crm/premium-comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparison_name: formName.trim(),
          notes: formNotes.trim() || undefined,
          items,
        }),
      });
      if (res.ok) {
        toast.success('Comparison created');
        setFormName('');
        setFormNotes('');
        setFormItems([
          { label: '', plan_type: 'insurance', full_premium: '', tax_credit: '0', deductible: '', max_oop: '', metal_level: '' },
          { label: '', plan_type: 'insurance', full_premium: '', tax_credit: '0', deductible: '', max_oop: '', metal_level: '' },
        ]);
        setShowForm(false);
        setLoading(true);
        fetchComparisons();
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to create comparison');
      }
    } catch {
      toast.error('Failed to create comparison');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Premium Comparisons</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Compare plan premiums, deductibles, and out-of-pocket costs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCalc(!showCalc)} variant="outline" size="sm">
            <Calculator className="w-4 h-4 mr-2" /> Quick Calc
          </Button>
          <Button
            onClick={() => { setLoading(true); fetchComparisons(); }}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setShowForm(!showForm)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> New Comparison
          </Button>
        </div>
      </div>

      {/* Quick Calculator */}
      {showCalc && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Quick Net Premium Calculator</CardTitle>
            <CardDescription>Calculate net premium after tax credit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Gross Premium
                </label>
                <input
                  type="number"
                  value={calcPremium}
                  onChange={(e) => setCalcPremium(e.target.value)}
                  className="w-40 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="$0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tax Credit
                </label>
                <input
                  type="number"
                  value={calcCredit}
                  onChange={(e) => setCalcCredit(e.target.value)}
                  className="w-40 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="$0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <Button onClick={handleCalculate} disabled={calculating} size="sm">
                {calculating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Calculator className="w-4 h-4 mr-2" />
                )}
                Calculate
              </Button>
              {calcResult && (
                <div className="ml-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <p className="text-sm text-emerald-800 dark:text-emerald-300">
                    Net Premium:{' '}
                    <span className="text-lg font-bold">
                      ${calcResult.net_premium.toFixed(2)}
                    </span>
                    /mo
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Comparison Form */}
      {showForm && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">New Comparison</CardTitle>
            <CardDescription>Add plans to compare premiums side by side</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Comparison Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., John Smith - 2026 ACA Options"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            {/* Plan Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Plan Items</h4>
                <Button variant="outline" size="sm" onClick={addFormItem} disabled={formItems.length >= 10}>
                  <Plus className="w-3 h-3 mr-1" /> Add Plan
                </Button>
              </div>
              {formItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-white/5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Plan {idx + 1}
                    </span>
                    {formItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFormItem(idx)}
                        className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Label</label>
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => updateFormItem(idx, 'label', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Plan name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Type</label>
                      <select
                        value={item.plan_type}
                        onChange={(e) => updateFormItem(idx, 'plan_type', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="insurance">Insurance</option>
                        <option value="healthshare">Healthshare</option>
                        <option value="medicaid">Medicaid</option>
                        <option value="short_term">Short-Term</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Premium</label>
                      <input
                        type="number"
                        value={item.full_premium}
                        onChange={(e) => updateFormItem(idx, 'full_premium', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="$0"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Tax Credit</label>
                      <input
                        type="number"
                        value={item.tax_credit}
                        onChange={(e) => updateFormItem(idx, 'tax_credit', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="$0"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Deductible</label>
                      <input
                        type="number"
                        value={item.deductible}
                        onChange={(e) => updateFormItem(idx, 'deductible', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="$0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Max OOP</label>
                      <input
                        type="number"
                        value={item.max_oop}
                        onChange={(e) => updateFormItem(idx, 'max_oop', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="$0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Metal Level</label>
                      <select
                        value={item.metal_level}
                        onChange={(e) => updateFormItem(idx, 'metal_level', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">N/A</option>
                        <option value="catastrophic">Catastrophic</option>
                        <option value="bronze">Bronze</option>
                        <option value="silver">Silver</option>
                        <option value="gold">Gold</option>
                        <option value="platinum">Platinum</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Comparison
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Comparisons */}
      {comparisons.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Scale className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No premium comparisons yet</p>
          <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4">
            Create Your First Comparison
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {comparisons.map((comp) => (
            <Card
              key={comp.id}
              className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-300 dark:hover:border-teal-500/30 transition-colors"
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {comp.comparison_name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(comp.created_at).toLocaleDateString()}
                      </span>
                      <span>{comp.item_count || 0} plans compared</span>
                    </div>
                  </div>
                  {comp.avg_premium != null && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        ${comp.avg_premium.toFixed(0)}/mo
                      </p>
                      <p className="text-xs text-slate-500">avg premium</p>
                    </div>
                  )}
                </div>

                {comp.notes && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{comp.notes}</p>
                )}

                {/* Premium range bar */}
                {comp.min_premium != null && comp.max_premium != null && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                    <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>${comp.min_premium.toFixed(0)}/mo</span>
                        <span>${comp.max_premium.toFixed(0)}/mo</span>
                      </div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
