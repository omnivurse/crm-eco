import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing | Double Helix Software',
  description: 'Simple per-tenant pricing for CRM Core and Admin Enrollment. Subscribe to one or both.',
};

const tiers = [
  {
    name: 'CRM Core',
    description: 'For benefits advisors and small agencies.',
    price: 'Custom',
    period: 'per tenant org',
    cta: 'Request a quote',
    features: [
      'Unlimited records & modules',
      'Email & SMS sync',
      'Embeddable lead forms',
      'Automations engine',
      'HIPAA-aware audit logs',
    ],
  },
  {
    name: 'Admin Enrollment',
    description: 'For agencies running their own enrollment.',
    price: 'Custom',
    period: 'per tenant org',
    cta: 'Request a quote',
    features: [
      'Plan & rate engines',
      'Member management + portal',
      'Multi-gateway billing',
      'Commissions & payouts',
      'Tenant landing-page builder',
    ],
    highlighted: true,
  },
  {
    name: 'Suite',
    description: 'CRM Core + Admin Enrollment, bundled.',
    price: 'Custom',
    period: 'per tenant org',
    cta: 'Talk to sales',
    features: [
      'Everything in both products',
      'Unified identity & RLS',
      'Cross-product automations',
      'Dedicated onboarding manager',
      'Priority support',
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="container-page py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Pricing</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Pricing scales with your tenancy.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          We&rsquo;re onboarding manually during phase 1 — every customer gets a hands-on
          implementation. Final pricing is custom while we calibrate seats, volume tiers, and
          gateway-specific fees.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className={`rounded-2xl border bg-card p-8 shadow-sm transition ${
              tier.highlighted
                ? 'border-primary shadow-md ring-2 ring-primary/20'
                : 'border-border hover:border-foreground/20 hover:shadow-md'
            }`}
          >
            <h2 className="text-2xl font-bold text-foreground">{tier.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight text-foreground">
                {tier.price}
              </span>
              <span className="text-sm text-muted-foreground">{tier.period}</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-2 text-foreground/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/#request-access"
              className={`mt-8 inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-semibold shadow-sm transition ${
                tier.highlighted
                  ? 'gradient-helix text-white hover:opacity-95'
                  : 'border border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              {tier.cta} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </article>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Volume, multi-tenant, and partner agreements available — talk to us.
      </p>
    </main>
  );
}
