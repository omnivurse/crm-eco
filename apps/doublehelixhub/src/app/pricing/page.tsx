import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';

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
    <main className="container-page py-20 md:py-28">
      <div className="max-w-2xl">
        <span className="dh-eyebrow">Pricing</span>
        <h1 className="mt-5 font-heading text-[clamp(2.25rem,5vw,3.5rem)] font-bold tracking-[-0.04em] text-white">
          Pricing scales with your tenancy.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-white/50">
          We&rsquo;re onboarding manually during phase 1 — every customer gets a hands-on
          implementation. Final pricing is custom while we calibrate seats, volume tiers, and
          gateway-specific fees.
        </p>
      </div>

      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => (
          <article
            key={tier.name}
            className={`dh-bezel h-full ${tier.highlighted ? 'dh-bezel-suite lg:-translate-y-2' : ''}`}
          >
            <div className="dh-bezel-inner flex h-full flex-col p-7 sm:p-8">
              {tier.highlighted && (
                <span className="mb-3 inline-flex w-fit rounded-full bg-cyan-400/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300 ring-1 ring-cyan-400/25">
                  Most popular
                </span>
              )}
              <h2 className="font-heading text-2xl font-bold tracking-[-0.03em] text-white">{tier.name}</h2>
              <p className="mt-1 text-sm text-white/45">{tier.description}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-heading text-4xl font-bold tracking-[-0.03em] text-white">
                  {tier.price}
                </span>
                <span className="text-sm text-white/40">{tier.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2 text-white/65">
                    <Check weight="light" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/#request-access"
                className={`group mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
                  tier.highlighted
                    ? 'bg-white text-[#050505]'
                    : 'border border-white/15 text-white hover:bg-white/5'
                }`}
              >
                {tier.cta}
                <ArrowUpRight weight="light" className="h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px" />
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-white/40">
        Volume, multi-tenant, and partner agreements available — talk to us.
      </p>
    </main>
  );
}
