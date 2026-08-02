import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import { ActiveRateSetControl } from '@/components/products/ActiveRateSetControl';
import { RateQuoteCalculator } from '@/components/products/RateQuoteCalculator';
import { EntityPageHeader } from '@/components/ui/EntityPageHeader';

export default function RateSettingsPage() {
  return (
    <div className="space-y-6">
      <EntityPageHeader
        backHref="/products"
        backLabel="Products"
        title="Rate settings"
        description="Manage rate set overrides and test the rate engine"
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <ActiveRateSetControl />

          <Card className="border-[var(--adm-hairline)] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">E123 rate engine</CardTitle>
              <CardDescription>How the pricing system works</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--adm-muted)]">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--adm-hairline)] bg-[var(--adm-void)]/60 p-4">
                  <h4 className="mb-2 font-semibold text-[var(--adm-ink)]">Tiered household</h4>
                  <p>
                    One flat rate per coverage tier (Member, Member+Spouse, Member+Children, Family)
                    and age band. Simple table lookup.
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--adm-hairline)] bg-[var(--adm-void)]/60 p-4">
                  <h4 className="mb-2 font-semibold text-[var(--adm-ink)]">Additive person</h4>
                  <p>
                    Subscriber base rate + spouse adder + per-dependent adder. Each component can be
                    age-banded or flat. Total = sum of all components.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-100 bg-cyan-50/80 p-4">
                <h4 className="mb-1 font-semibold text-cyan-950">Rate set selection</h4>
                <ol className="list-inside list-decimal space-y-1 text-cyan-900">
                  <li>If admin override is set → use that rate set</li>
                  <li>Else if coverage start date ≥ Jan 1, 2026 → use 2026 rates</li>
                  <li>Otherwise → use current rates</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <RateQuoteCalculator />
        </div>
      </div>
    </div>
  );
}
