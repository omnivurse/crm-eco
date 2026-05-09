import type { Metadata } from 'next';
import { PageSection } from '@/components/page-section';

export const metadata: Metadata = {
  title: 'Admin Enrollment | Double Helix Software',
  description:
    'Run plans, members, billing, commissions, payouts, and ops from a single multi-tenant admin platform.',
};

const capabilities = [
  { title: 'Plans & rate engines', body: 'Define plans, tiers, and rate cards per carrier. Versioning + effective dating built in.' },
  { title: 'Member management', body: 'Enroll, change, terminate. Family units, dependents, and lifecycle events handled cleanly.' },
  { title: 'Member portal', body: 'Self-service for enrolled members — view plan, ID cards, billing, and submit changes.' },
  { title: 'Billing engine', body: 'Multi-gateway support for member premiums, recurring billing, refunds, and reconciliation.' },
  { title: 'Commissions & payouts', body: 'Automate advisor and agent comp from books to payable runs. ACH and check supported.' },
  { title: 'Vendor payables', body: 'Track vendor invoices, approvals, and payouts in the same financial backbone.' },
  { title: 'Tenant landing pages', body: 'Each tenant org gets a built-in landing-page builder, populated from their product catalog.' },
  { title: 'Branding per tenant', body: 'White-labeled domains, logos, and email templates so members see your brand, not ours.' },
];

export default function AdminProductPage() {
  return (
    <PageSection
      eyebrow="Product"
      title="Admin Enrollment"
      lede="The operational platform behind your agency or TPA. Members, plans, billing, commissions, payouts, vendors, and tenant marketing — all on one tenancy-aware spine."
      cta={{ href: '/#request-access', label: 'Request access' }}
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-base font-semibold text-foreground">{c.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>
    </PageSection>
  );
}
