import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { ActiveRateSetControl } from '@/components/products/ActiveRateSetControl';
import { RateQuoteCalculator } from '@/components/products/RateQuoteCalculator';

export default function RateSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rate Settings</h1>
          <p className="text-slate-500">
            Manage rate set overrides and test the rate engine
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Settings */}
        <div className="xl:col-span-2 space-y-6">
          <ActiveRateSetControl />

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>E123 Rate Engine</CardTitle>
              <CardDescription>
                How the pricing system works
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border">
                  <h4 className="font-semibold text-slate-900 mb-2">Tiered Household</h4>
                  <p>
                    One flat rate per coverage tier (Member, Member+Spouse, Member+Children, Family) 
                    and age band. Simple table lookup.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border">
                  <h4 className="font-semibold text-slate-900 mb-2">Additive Person</h4>
                  <p>
                    Subscriber base rate + spouse adder + per-dependent adder. 
                    Each component can be age-banded or flat. Total = sum of all components.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                <h4 className="font-semibold text-blue-900 mb-1">Rate Set Selection Logic</h4>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>If admin override is set → use that rate set</li>
                  <li>Else if coverage start date ≥ Jan 1, 2026 → use 2026 rates</li>
                  <li>Otherwise → use current rates</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Calculator */}
        <div>
          <RateQuoteCalculator />
        </div>
      </div>
    </div>
  );
}
