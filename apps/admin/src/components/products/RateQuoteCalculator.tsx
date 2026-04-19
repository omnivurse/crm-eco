'use client';

import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui';
import { Calculator, Plus, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { quote, getPlanOptions } from '@crm-eco/rates';
import type {
  RateConfig,
  RateSetKey,
  QuoteInput,
  QuoteResult,
  CoverageTier,
} from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

const config = seedConfig as unknown as RateConfig;

interface RateQuoteCalculatorProps {
  defaultPlanId?: string;
  rateSetOverride?: RateSetKey | null;
}

const TIER_OPTIONS: { value: CoverageTier; label: string }[] = [
  { value: 'member', label: 'Member Only' },
  { value: 'member_spouse', label: 'Member + Spouse' },
  { value: 'member_children', label: 'Member + Children' },
  { value: 'family', label: 'Family' },
];

export function RateQuoteCalculator({ defaultPlanId, rateSetOverride }: RateQuoteCalculatorProps) {
  const plans = getPlanOptions(config);

  const [planId, setPlanId] = useState(defaultPlanId || plans[0]?.planId || '');
  const [coverageTier, setCoverageTier] = useState<CoverageTier>('member');
  const [memberAge, setMemberAge] = useState('35');
  const [spouseAge, setSpouseAge] = useState('');
  const [dependentAges, setDependentAges] = useState<string[]>([]);
  const [coverageStart, setCoverageStart] = useState('2025-06-01');
  const [memberTobacco, setMemberTobacco] = useState(false);
  const [spouseTobacco, setSpouseTobacco] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(true);

  const handleQuote = () => {
    setLoading(true);

    const input: QuoteInput = {
      planId,
      coverageTier,
      household: {
        memberAge: Number(memberAge),
        ...(spouseAge ? { spouseAge: Number(spouseAge) } : {}),
        ...(dependentAges.length > 0 ? { dependentAges: dependentAges.map(Number).filter(Boolean) } : {}),
      },
      tobacco: {
        member: memberTobacco,
        spouse: spouseTobacco,
      },
      coverageStart,
    };

    const opts = rateSetOverride ? { rateSetOverride } : undefined;
    const res = quote(config, input, opts);
    setResult(res);
    setLoading(false);
  };

  const addDependent = () => setDependentAges([...dependentAges, '']);
  const removeDependent = (i: number) => setDependentAges(dependentAges.filter((_, idx) => idx !== i));
  const updateDependent = (i: number, val: string) => {
    const next = [...dependentAges];
    next[i] = val;
    setDependentAges(next);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const needsSpouse = coverageTier === 'member_spouse' || coverageTier === 'family';
  const needsDeps = coverageTier === 'member_children' || coverageTier === 'family';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Rate Quote Calculator
        </CardTitle>
        <CardDescription>
          Enter household details to generate a live quote
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Plan</Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.planId} value={p.planId}>
                  {p.displayName}
                  <span className="ml-2 text-slate-400 text-xs">
                    ({p.ratingModel === 'tiered_household' ? 'Tiered' : 'Additive'})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Coverage Tier */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Coverage Tier</Label>
          <Select value={coverageTier} onValueChange={(v) => setCoverageTier(v as CoverageTier)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Member Age */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Member Age</Label>
          <Input
            type="number"
            value={memberAge}
            onChange={(e) => setMemberAge(e.target.value)}
            placeholder="35"
            min={0}
            max={99}
          />
        </div>

        {/* Spouse Age */}
        {needsSpouse && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Spouse Age</Label>
            <Input
              type="number"
              value={spouseAge}
              onChange={(e) => setSpouseAge(e.target.value)}
              placeholder="33"
              min={0}
              max={99}
            />
          </div>
        )}

        {/* Dependents */}
        {needsDeps && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Dependent Ages
              </Label>
              <Button variant="ghost" size="sm" onClick={addDependent} className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {dependentAges.map((age, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="number"
                  value={age}
                  onChange={(e) => updateDependent(i, e.target.value)}
                  placeholder={`Dependent ${i + 1} age`}
                  min={0}
                  max={99}
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => removeDependent(i)} className="h-8 w-8 text-red-500">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {dependentAges.length === 0 && (
              <p className="text-xs text-slate-400">Click "Add" to include dependents</p>
            )}
          </div>
        )}

        {/* Coverage Start */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Coverage Start Date</Label>
          <Input
            type="date"
            value={coverageStart}
            onChange={(e) => setCoverageStart(e.target.value)}
          />
        </div>

        {/* Tobacco */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tobacco Use</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={memberTobacco}
                onChange={(e) => setMemberTobacco(e.target.checked)}
                className="rounded"
              />
              Member
            </label>
            {needsSpouse && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={spouseTobacco}
                  onChange={(e) => setSpouseTobacco(e.target.checked)}
                  className="rounded"
                />
                Spouse
              </label>
            )}
          </div>
        </div>

        {/* Quote Button */}
        <Button onClick={handleQuote} className="w-full" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Calculate Quote
        </Button>

        {/* Result */}
        {result && (
          <div className="mt-4 space-y-3">
            {/* Errors */}
            {result.errors && result.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i}>
                    <span className="font-mono text-xs">[{e.code}]</span> {e.message}
                  </p>
                ))}
              </div>
            )}

            {/* Summary */}
            {(!result.errors || result.errors.length === 0) && (
              <>
                <div className="p-4 rounded-xl bg-gradient-to-br from-[#0f172a] to-[#002848] text-white">
                  <p className="text-xs uppercase tracking-wider text-white/60 mb-1">Total Monthly</p>
                  <p className="text-3xl font-bold">{formatCurrency(result.totalMonthly)}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-white/70">
                    <span>Premium: {formatCurrency(result.monthlyPremium)}</span>
                    {result.monthlyFees.length > 0 && (
                      <span>
                        + Fees: {formatCurrency(result.monthlyFees.reduce((s, f) => s + f.amount, 0))}
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    {result.metadata.rateSetLabel}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {result.metadata.ratingModel === 'tiered_household' ? 'Tiered' : 'Additive'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Effective: {result.metadata.effectiveDate}
                  </Badge>
                  {result.metadata.bandsUsed.memberBand && (
                    <Badge variant="secondary" className="text-xs">
                      Band: {result.metadata.bandsUsed.memberBand}
                    </Badge>
                  )}
                </div>

                {/* Breakdown Toggle */}
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Breakdown
                </button>

                {showBreakdown && (
                  <div className="space-y-1">
                    {result.breakdown.map((line, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm odd:bg-slate-50">
                        <span className="text-slate-600">{line.label}</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(line.amount)}</span>
                      </div>
                    ))}
                    {result.monthlyFees.map((fee, i) => (
                      <div key={`fee-${i}`} className="flex items-center justify-between py-1.5 px-2 rounded text-sm odd:bg-slate-50">
                        <span className="text-slate-600">{fee.label} (monthly)</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(fee.amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-2 px-2 border-t font-bold text-sm">
                      <span>Total Monthly</span>
                      <span className="tabular-nums">{formatCurrency(result.totalMonthly)}</span>
                    </div>
                    {result.oneTimeFees.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">One-Time Fees</p>
                        {result.oneTimeFees.map((fee, i) => (
                          <div key={`ot-${i}`} className="flex items-center justify-between py-1 px-2 text-sm">
                            <span className="text-slate-600">{fee.label}</span>
                            <span className="font-semibold tabular-nums">{formatCurrency(fee.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
