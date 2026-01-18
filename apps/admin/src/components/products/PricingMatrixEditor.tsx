'use client';

import { useState, useCallback, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@crm-eco/ui';
import { Plus, Trash2, Edit, Save, X, Loader2, DollarSign, Users, Calendar } from 'lucide-react';

interface IuaLevel {
  id: string;
  plan_id: string;
  amount: number;
  label: string | null;
  monthly_premium_adjustment: number | null;
  is_default: boolean;
  sort_order: number;
}

interface AgeBracket {
  id: string;
  plan_id: string;
  min_age: number;
  max_age: number;
  label: string | null;
  rate_multiplier: number | null;
  sort_order: number;
}

interface BenefitType {
  id: string;
  plan_id: string;
  benefit_name: string;
  benefit_key: string;
  description: string | null;
  coverage_limit: number | null;
  copay_amount: number | null;
  is_included: boolean;
  sort_order: number;
}

interface PricingTier {
  id: string;
  product_id: string;
  iua_level_id: string;
  age_bracket_id: string;
  household_size: number;
  monthly_amount: number;
  enrollment_fee: number | null;
}

interface PricingMatrixEditorProps {
  productId: string;
  organizationId: string;
}

export function PricingMatrixEditor({ productId, organizationId }: PricingMatrixEditorProps) {
  const [iuaLevels, setIuaLevels] = useState<IuaLevel[]>([]);
  const [ageBrackets, setAgeBrackets] = useState<AgeBracket[]>([]);
  const [benefitTypes, setBenefitTypes] = useState<BenefitType[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'iua' | 'age' | 'benefits' | 'matrix'>('iua');

  // Edit states
  const [editingIua, setEditingIua] = useState<IuaLevel | null>(null);
  const [editingAge, setEditingAge] = useState<AgeBracket | null>(null);
  const [editingBenefit, setEditingBenefit] = useState<BenefitType | null>(null);

  // New item states
  const [showNewIua, setShowNewIua] = useState(false);
  const [showNewAge, setShowNewAge] = useState(false);
  const [showNewBenefit, setShowNewBenefit] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [iuaRes, ageRes, benefitRes, pricingRes] = await Promise.all([
        supabase.from('product_iua').select('*').eq('plan_id', productId).order('sort_order'),
        supabase.from('product_age_brackets').select('*').eq('plan_id', productId).order('sort_order'),
        supabase.from('product_benefit_types').select('*').eq('plan_id', productId).order('sort_order'),
        supabase.from('pricing_tiers').select('*').eq('product_id', productId),
      ]);

      setIuaLevels(iuaRes.data || []);
      setAgeBrackets(ageRes.data || []);
      setBenefitTypes(benefitRes.data || []);
      setPricingTiers(pricingRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [supabase, productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // IUA Level CRUD
  const saveIuaLevel = async (data: Partial<IuaLevel>) => {
    setSaving(true);
    try {
      if (data.id) {
        await supabase.from('product_iua').update(data).eq('id', data.id);
      } else {
        await supabase.from('product_iua').insert({
          ...data,
          plan_id: productId,
          sort_order: iuaLevels.length,
        });
      }
      await loadData();
      setEditingIua(null);
      setShowNewIua(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save IUA level');
    } finally {
      setSaving(false);
    }
  };

  const deleteIuaLevel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this IUA level?')) return;
    setSaving(true);
    try {
      await supabase.from('product_iua').delete().eq('id', id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete IUA level');
    } finally {
      setSaving(false);
    }
  };

  // Age Bracket CRUD
  const saveAgeBracket = async (data: Partial<AgeBracket>) => {
    setSaving(true);
    try {
      if (data.id) {
        await supabase.from('product_age_brackets').update(data).eq('id', data.id);
      } else {
        await supabase.from('product_age_brackets').insert({
          ...data,
          plan_id: productId,
          sort_order: ageBrackets.length,
        });
      }
      await loadData();
      setEditingAge(null);
      setShowNewAge(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save age bracket');
    } finally {
      setSaving(false);
    }
  };

  const deleteAgeBracket = async (id: string) => {
    if (!confirm('Are you sure you want to delete this age bracket?')) return;
    setSaving(true);
    try {
      await supabase.from('product_age_brackets').delete().eq('id', id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete age bracket');
    } finally {
      setSaving(false);
    }
  };

  // Benefit Type CRUD
  const saveBenefitType = async (data: Partial<BenefitType>) => {
    setSaving(true);
    try {
      if (data.id) {
        await supabase.from('product_benefit_types').update(data).eq('id', data.id);
      } else {
        await supabase.from('product_benefit_types').insert({
          ...data,
          plan_id: productId,
          sort_order: benefitTypes.length,
        });
      }
      await loadData();
      setEditingBenefit(null);
      setShowNewBenefit(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save benefit type');
    } finally {
      setSaving(false);
    }
  };

  const deleteBenefitType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this benefit type?')) return;
    setSaving(true);
    try {
      await supabase.from('product_benefit_types').delete().eq('id', id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete benefit type');
    } finally {
      setSaving(false);
    }
  };

  // Pricing tier update
  const updatePricingTier = async (
    iuaId: string,
    ageId: string,
    householdSize: number,
    monthlyAmount: number
  ) => {
    setSaving(true);
    try {
      const existing = pricingTiers.find(
        (p) => p.iua_level_id === iuaId && p.age_bracket_id === ageId && p.household_size === householdSize
      );

      if (existing) {
        await supabase
          .from('pricing_tiers')
          .update({ monthly_amount: monthlyAmount })
          .eq('id', existing.id);
      } else {
        await supabase.from('pricing_tiers').insert({
          product_id: productId,
          iua_level_id: iuaId,
          age_bracket_id: ageId,
          household_size: householdSize,
          monthly_amount: monthlyAmount,
        });
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        {[
          { key: 'iua', label: 'IUA Levels', icon: DollarSign },
          { key: 'age', label: 'Age Brackets', icon: Calendar },
          { key: 'benefits', label: 'Benefits', icon: Users },
          { key: 'matrix', label: 'Pricing Matrix', icon: DollarSign },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* IUA Levels Tab */}
      {activeTab === 'iua' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>IUA Levels</CardTitle>
              <CardDescription>
                Initial Unshareable Amount options for this product
              </CardDescription>
            </div>
            <Button onClick={() => setShowNewIua(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add IUA Level
            </Button>
          </CardHeader>
          <CardContent>
            {iuaLevels.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No IUA levels configured</p>
            ) : (
              <div className="space-y-2">
                {iuaLevels.map((level) => (
                  <div
                    key={level.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold">{formatCurrency(level.amount)}</div>
                      {level.label && (
                        <Badge variant="secondary">{level.label}</Badge>
                      )}
                      {level.is_default && (
                        <Badge variant="default">Default</Badge>
                      )}
                      {level.monthly_premium_adjustment !== null && level.monthly_premium_adjustment !== 0 && (
                        <span className="text-sm text-slate-500">
                          {level.monthly_premium_adjustment > 0 ? '+' : ''}
                          {formatCurrency(level.monthly_premium_adjustment)}/mo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingIua(level)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteIuaLevel(level.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Age Brackets Tab */}
      {activeTab === 'age' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Age Brackets</CardTitle>
              <CardDescription>
                Age-based pricing tiers
              </CardDescription>
            </div>
            <Button onClick={() => setShowNewAge(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Age Bracket
            </Button>
          </CardHeader>
          <CardContent>
            {ageBrackets.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No age brackets configured</p>
            ) : (
              <div className="space-y-2">
                {ageBrackets.map((bracket) => (
                  <div
                    key={bracket.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="font-bold">
                        {bracket.min_age} - {bracket.max_age} years
                      </div>
                      {bracket.label && (
                        <Badge variant="secondary">{bracket.label}</Badge>
                      )}
                      {bracket.rate_multiplier !== null && bracket.rate_multiplier !== 1 && (
                        <span className="text-sm text-slate-500">
                          {bracket.rate_multiplier}x rate
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingAge(bracket)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAgeBracket(bracket.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Benefits Tab */}
      {activeTab === 'benefits' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Benefit Types</CardTitle>
              <CardDescription>
                Coverage benefits included in this product
              </CardDescription>
            </div>
            <Button onClick={() => setShowNewBenefit(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Benefit
            </Button>
          </CardHeader>
          <CardContent>
            {benefitTypes.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No benefits configured</p>
            ) : (
              <div className="space-y-2">
                {benefitTypes.map((benefit) => (
                  <div
                    key={benefit.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-slate-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{benefit.benefit_name}</span>
                        <Badge variant={benefit.is_included ? 'default' : 'secondary'}>
                          {benefit.is_included ? 'Included' : 'Optional'}
                        </Badge>
                      </div>
                      {benefit.description && (
                        <p className="text-sm text-slate-500 mt-1">{benefit.description}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-sm text-slate-600">
                        {benefit.coverage_limit !== null && (
                          <span>Limit: {formatCurrency(benefit.coverage_limit)}</span>
                        )}
                        {benefit.copay_amount !== null && (
                          <span>Copay: {formatCurrency(benefit.copay_amount)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingBenefit(benefit)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteBenefitType(benefit.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pricing Matrix Tab */}
      {activeTab === 'matrix' && (
        <Card>
          <CardHeader>
            <CardTitle>Pricing Matrix</CardTitle>
            <CardDescription>
              Monthly pricing by IUA level and age bracket
            </CardDescription>
          </CardHeader>
          <CardContent>
            {iuaLevels.length === 0 || ageBrackets.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                Configure IUA levels and age brackets first to set up the pricing matrix
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-slate-100 text-left">IUA / Age</th>
                      {ageBrackets.map((bracket) => (
                        <th key={bracket.id} className="border p-2 bg-slate-100 text-center">
                          {bracket.min_age}-{bracket.max_age}
                          {bracket.label && <div className="text-xs font-normal">{bracket.label}</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {iuaLevels.map((iua) => (
                      <tr key={iua.id}>
                        <td className="border p-2 bg-slate-50 font-medium">
                          {formatCurrency(iua.amount)}
                          {iua.label && <div className="text-xs font-normal text-slate-500">{iua.label}</div>}
                        </td>
                        {ageBrackets.map((bracket) => {
                          const tier = pricingTiers.find(
                            (p) =>
                              p.iua_level_id === iua.id &&
                              p.age_bracket_id === bracket.id &&
                              p.household_size === 1
                          );
                          return (
                            <td key={bracket.id} className="border p-2 text-center">
                              <Input
                                type="number"
                                step="0.01"
                                className="w-24 mx-auto text-center"
                                defaultValue={tier?.monthly_amount || ''}
                                placeholder="0.00"
                                onBlur={(e) => {
                                  const value = parseFloat(e.target.value);
                                  if (!isNaN(value)) {
                                    updatePricingTier(iua.id, bracket.id, 1, value);
                                  }
                                }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* IUA Level Dialog */}
      <IuaLevelDialog
        open={showNewIua || !!editingIua}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewIua(false);
            setEditingIua(null);
          }
        }}
        level={editingIua}
        onSave={saveIuaLevel}
        saving={saving}
      />

      {/* Age Bracket Dialog */}
      <AgeBracketDialog
        open={showNewAge || !!editingAge}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewAge(false);
            setEditingAge(null);
          }
        }}
        bracket={editingAge}
        onSave={saveAgeBracket}
        saving={saving}
      />

      {/* Benefit Type Dialog */}
      <BenefitTypeDialog
        open={showNewBenefit || !!editingBenefit}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewBenefit(false);
            setEditingBenefit(null);
          }
        }}
        benefit={editingBenefit}
        onSave={saveBenefitType}
        saving={saving}
      />
    </div>
  );
}

// IUA Level Dialog Component
function IuaLevelDialog({
  open,
  onOpenChange,
  level,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: IuaLevel | null;
  onSave: (data: Partial<IuaLevel>) => Promise<void>;
  saving: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (level) {
      setAmount(level.amount.toString());
      setLabel(level.label || '');
      setAdjustment(level.monthly_premium_adjustment?.toString() || '');
      setIsDefault(level.is_default);
    } else {
      setAmount('');
      setLabel('');
      setAdjustment('');
      setIsDefault(false);
    }
  }, [level]);

  const handleSubmit = () => {
    onSave({
      id: level?.id,
      amount: parseFloat(amount),
      label: label || null,
      monthly_premium_adjustment: adjustment ? parseFloat(adjustment) : null,
      is_default: isDefault,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{level ? 'Edit IUA Level' : 'Add IUA Level'}</DialogTitle>
          <DialogDescription>
            Configure the Initial Unshareable Amount option
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Amount ($) *</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Standard, Premium"
            />
          </div>
          <div className="space-y-2">
            <Label>Monthly Premium Adjustment ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-slate-500">
              Amount to add/subtract from base monthly premium
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isDefault">Set as default option</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !amount}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Age Bracket Dialog Component
function AgeBracketDialog({
  open,
  onOpenChange,
  bracket,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bracket: AgeBracket | null;
  onSave: (data: Partial<AgeBracket>) => Promise<void>;
  saving: boolean;
}) {
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [label, setLabel] = useState('');
  const [multiplier, setMultiplier] = useState('');

  useEffect(() => {
    if (bracket) {
      setMinAge(bracket.min_age.toString());
      setMaxAge(bracket.max_age.toString());
      setLabel(bracket.label || '');
      setMultiplier(bracket.rate_multiplier?.toString() || '');
    } else {
      setMinAge('');
      setMaxAge('');
      setLabel('');
      setMultiplier('');
    }
  }, [bracket]);

  const handleSubmit = () => {
    onSave({
      id: bracket?.id,
      min_age: parseInt(minAge),
      max_age: parseInt(maxAge),
      label: label || null,
      rate_multiplier: multiplier ? parseFloat(multiplier) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bracket ? 'Edit Age Bracket' : 'Add Age Bracket'}</DialogTitle>
          <DialogDescription>
            Configure age-based pricing tier
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Age *</Label>
              <Input
                type="number"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Age *</Label>
              <Input
                type="number"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                placeholder="64"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Young Adult, Senior"
            />
          </div>
          <div className="space-y-2">
            <Label>Rate Multiplier</Label>
            <Input
              type="number"
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              placeholder="1.0"
            />
            <p className="text-xs text-slate-500">
              Multiplier applied to base rate (1.0 = no change)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !minAge || !maxAge}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Benefit Type Dialog Component
function BenefitTypeDialog({
  open,
  onOpenChange,
  benefit,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  benefit: BenefitType | null;
  onSave: (data: Partial<BenefitType>) => Promise<void>;
  saving: boolean;
}) {
  const [benefitName, setBenefitName] = useState('');
  const [benefitKey, setBenefitKey] = useState('');
  const [description, setDescription] = useState('');
  const [coverageLimit, setCoverageLimit] = useState('');
  const [copayAmount, setCopayAmount] = useState('');
  const [isIncluded, setIsIncluded] = useState(true);

  useEffect(() => {
    if (benefit) {
      setBenefitName(benefit.benefit_name);
      setBenefitKey(benefit.benefit_key);
      setDescription(benefit.description || '');
      setCoverageLimit(benefit.coverage_limit?.toString() || '');
      setCopayAmount(benefit.copay_amount?.toString() || '');
      setIsIncluded(benefit.is_included);
    } else {
      setBenefitName('');
      setBenefitKey('');
      setDescription('');
      setCoverageLimit('');
      setCopayAmount('');
      setIsIncluded(true);
    }
  }, [benefit]);

  const handleSubmit = () => {
    onSave({
      id: benefit?.id,
      benefit_name: benefitName,
      benefit_key: benefitKey || benefitName.toLowerCase().replace(/\s+/g, '_'),
      description: description || null,
      coverage_limit: coverageLimit ? parseFloat(coverageLimit) : null,
      copay_amount: copayAmount ? parseFloat(copayAmount) : null,
      is_included: isIncluded,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{benefit ? 'Edit Benefit' : 'Add Benefit'}</DialogTitle>
          <DialogDescription>
            Configure product benefit coverage
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Benefit Name *</Label>
            <Input
              value={benefitName}
              onChange={(e) => setBenefitName(e.target.value)}
              placeholder="e.g., Primary Care Visit"
            />
          </div>
          <div className="space-y-2">
            <Label>Benefit Key</Label>
            <Input
              value={benefitKey}
              onChange={(e) => setBenefitKey(e.target.value)}
              placeholder="e.g., primary_care"
            />
            <p className="text-xs text-slate-500">
              Unique identifier (auto-generated if empty)
            </p>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the benefit coverage..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Coverage Limit ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={coverageLimit}
                onChange={(e) => setCoverageLimit(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Copay Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={copayAmount}
                onChange={(e) => setCopayAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isIncluded"
              checked={isIncluded}
              onChange={(e) => setIsIncluded(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isIncluded">Included in base plan</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !benefitName}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
