'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Label, Badge } from '@crm-eco/ui';
import { Calculator, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { quote, getPlanOptions, buildMatrixPreview } from '@crm-eco/rates';
import type {
  RateConfig,
  RateSetKey,
  QuoteInput,
  QuoteResult,
  CoverageTier,
} from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

const config = seedConfig as unknown as RateConfig;

const TIER_OPTIONS: { value: CoverageTier; label: string }[] = [
  { value: 'member', label: 'Member Only' },
  { value: 'member_spouse', label: 'Member + Spouse' },
  { value: 'member_children', label: 'Member + Children' },
  { value: 'family', label: 'Family' },
];

export default function RatePlaygroundPage() {
  const plans = getPlanOptions(config);

  const [planId, setPlanId] = useState(plans[0]?.planId || '');
  const [rateSet, setRateSet] = useState<RateSetKey>('current');
  const [coverageTier, setCoverageTier] = useState<CoverageTier>('member');
  const [memberAge, setMemberAge] = useState('35');
  const [spouseAge, setSpouseAge] = useState('33');
  const [depAgesStr, setDepAgesStr] = useState('');
  const [coverageStart, setCoverageStart] = useState('2025-06-01');
  const [result, setResult] = useState<QuoteResult | null>(null);

  const handleQuote = () => {
    const depAges = depAgesStr
      .split(',')
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n));

    const input: QuoteInput = {
      planId,
      coverageTier,
      household: {
        memberAge: Number(memberAge),
        ...(spouseAge ? { spouseAge: Number(spouseAge) } : {}),
        ...(depAges.length > 0 ? { dependentAges: depAges } : {}),
      },
      coverageStart,
    };

    const res = quote(config, input, { rateSetOverride: rateSet });
    setResult(res);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (process.env.NEXT_PUBLIC_ENABLE_RATE_PLAYGROUND !== 'true') {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Rate Engine Playground</h1>
        <p className="text-slate-500">
          This page is disabled. Set <code>NEXT_PUBLIC_ENABLE_RATE_PLAYGROUND=true</code> to enable.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Rate Engine Playground</h1>
          <p className="text-slate-500">Test the E123 rate engine interactively</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Quote Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.planId} value={p.planId}>
                    {p.displayName} ({p.ratingModel})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Rate Set</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={rateSet}
                onChange={(e) => setRateSet(e.target.value as RateSetKey)}
              >
                <option value="current">Current</option>
                <option value="rates_2026">2026</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Coverage Tier</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={coverageTier}
                onChange={(e) => setCoverageTier(e.target.value as CoverageTier)}
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Member Age</Label>
                <Input value={memberAge} onChange={(e) => setMemberAge(e.target.value)} type="number" />
              </div>
              <div className="space-y-1.5">
                <Label>Spouse Age</Label>
                <Input value={spouseAge} onChange={(e) => setSpouseAge(e.target.value)} type="number" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Dependent Ages (comma-separated)</Label>
              <Input
                value={depAgesStr}
                onChange={(e) => setDepAgesStr(e.target.value)}
                placeholder="e.g., 12, 15, 18"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Coverage Start Date</Label>
              <Input type="date" value={coverageStart} onChange={(e) => setCoverageStart(e.target.value)} />
            </div>

            <Button onClick={handleQuote} className="w-full">
              Run Quote
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader>
            <CardTitle>QuoteResult</CardTitle>
            <CardDescription>Raw engine output</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <pre className="text-xs bg-slate-50 p-4 rounded-lg overflow-auto max-h-[500px] whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <p className="text-slate-400 text-center py-8">
                Click "Run Quote" to see results
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
