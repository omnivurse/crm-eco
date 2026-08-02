import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  Buildings,
  CreditCard,
  Users,
  IdentificationCard,
  ChartBar,
  Receipt,
  GlobeHemisphereWest,
  PaintBrush,
  ShieldCheck,
  CurrencyCircleDollar,
} from '@phosphor-icons/react/dist/ssr';

export const metadata: Metadata = {
  title: 'Admin Enrollment | Double Helix Software',
  description:
    'Run plans, members, billing, commissions, payouts, and ops from a single multi-tenant admin platform.',
};

const capabilities = [
  {
    icon: IdentificationCard,
    title: 'Plans & rate engines',
    body: 'Define plans, tiers, and rate cards per carrier. Versioning + effective dating built in.',
  },
  {
    icon: Users,
    title: 'Member management',
    body: 'Enroll, change, terminate. Family units, dependents, and lifecycle events handled cleanly.',
  },
  {
    icon: GlobeHemisphereWest,
    title: 'Member portal',
    body: 'Self-service for enrolled members — view plan, ID cards, billing, and submit changes.',
  },
  {
    icon: CreditCard,
    title: 'Billing engine',
    body: 'Multi-gateway support for member premiums, recurring billing, refunds, and reconciliation.',
  },
  {
    icon: CurrencyCircleDollar,
    title: 'Commissions & payouts',
    body: 'Automate advisor and agent comp from books to payable runs. ACH and check supported.',
  },
  {
    icon: Receipt,
    title: 'Vendor payables',
    body: 'Track vendor invoices, approvals, and payouts in the same financial backbone.',
  },
  {
    icon: Buildings,
    title: 'Tenant landing pages',
    body: 'Each tenant org gets a built-in landing-page builder, populated from their product catalog.',
  },
  {
    icon: PaintBrush,
    title: 'Branding per tenant',
    body: 'White-labeled domains, logos, and email templates so members see your brand, not ours.',
  },
];

const workflow = [
  {
    step: '01',
    title: 'Configure',
    body: 'Stand up plans, rates, and branding for each tenant org — isolation is the default, not an afterthought.',
  },
  {
    step: '02',
    title: 'Enroll',
    body: 'Move members through enrollment, changes, and terminations with dependents and effective dates intact.',
  },
  {
    step: '03',
    title: 'Operate',
    body: 'Bill premiums, run commissions, pay vendors, and keep the member portal in sync — one spine.',
  },
];

const pillars = [
  { icon: ShieldCheck, label: 'Multi-tenant RLS' },
  { icon: CreditCard, label: 'Billing + commissions' },
  { icon: ChartBar, label: 'Ops dashboards' },
];

export default function AdminProductPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page">
          <div className="grid items-end gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-24">
            <div>
              <span className="dh-eyebrow mb-7">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(5,150,105,0.25)]" />
                Product 02 · Admin Enrollment
              </span>
              <h1 className="mt-7 max-w-[15ch] font-heading text-[clamp(2.6rem,5.5vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.04em] text-foreground">
                Enrollment ops on one{' '}
                <span className="gradient-text-helix">tenancy spine</span>
              </h1>
              <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-muted-foreground">
                Plans, members, billing, commissions, payouts, and portals — multi-tenant isolation
                for every agency and TPA. The operational half of Double Helix.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/#request-access" className="group dh-btn-island dh-btn-primary">
                  Request access
                  <span className="dh-btn-ico">
                    <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
                  </span>
                </Link>
                <Link href="/products/crm" className="dh-btn-ghost">
                  See CRM Core
                </Link>
              </div>
            </div>

            <div className="dh-bezel dh-bezel-suite">
              <div className="dh-bezel-inner p-7 sm:p-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400/90">
                  Built for
                </p>
                <ul className="mt-5 space-y-4">
                  {pillars.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-3 text-sm font-medium text-foreground/80">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-400/20">
                        <Icon weight="light" className="h-5 w-5" />
                      </span>
                      {label}
                    </li>
                  ))}
                </ul>
                <div className="mt-7 border-t border-border pt-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Every agency and TPA runs in its own isolated partition — shared platform, private data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="py-20 md:py-28">
        <div className="container-page">
          <div className="max-w-2xl">
            <span className="dh-eyebrow">How it runs</span>
            <h2 className="mt-5 font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em] text-foreground">
              Configure → enroll → operate
            </h2>
            <p className="mt-4 text-muted-foreground">
              From rate cards to ACH payouts — the full member lifecycle lives on one backbone.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {workflow.map((item) => (
              <div key={item.step} className="dh-bezel h-full">
                <div className="dh-bezel-inner flex h-full flex-col p-7">
                  <span className="font-heading text-3xl font-bold tracking-[-0.04em] text-emerald-600 dark:text-emerald-400/80">
                    {item.step}
                  </span>
                  <h3 className="mt-4 font-heading text-xl font-semibold tracking-[-0.02em] text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="pb-20 md:pb-28">
        <div className="container-page">
          <div className="max-w-2xl">
            <span className="dh-eyebrow">Capabilities</span>
            <h2 className="mt-5 font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em] text-foreground">
              The ops platform behind your agency
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ icon: Icon, title, body }) => (
              <div key={title} className="dh-bezel h-full">
                <div className="dh-bezel-inner flex h-full flex-col p-6">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-400/20">
                    <Icon weight="light" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-heading text-base font-semibold tracking-[-0.02em] text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Isolation callout */}
      <section className="pb-20 md:pb-28">
        <div className="container-page">
          <div className="dh-bezel">
            <div className="dh-bezel-inner grid gap-10 p-8 sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-14">
              <div>
                <span className="dh-eyebrow">Multi-tenant by design</span>
                <h2 className="mt-5 font-heading text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-[-0.03em] text-foreground">
                  Isolation is the product
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Agencies and TPAs share infrastructure — never data. RLS, branding, domains, and
                  billing all resolve at the org boundary.
                </p>
              </div>
              <ul className="space-y-4">
                {[
                  'Row-level security on every member and financial table',
                  'White-labeled portals and email per tenant',
                  'Gateway credentials scoped to the org that owns them',
                  'Commission books that never leak across agencies',
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                    <Check weight="light" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Cross-sell + CTA */}
      <section className="pb-24 md:pb-32">
        <div className="container-page grid gap-4 lg:grid-cols-2">
          <div className="dh-bezel h-full">
            <div className="dh-bezel-inner flex h-full flex-col p-8 sm:p-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400/90">
                Pair with
              </p>
              <h3 className="mt-3 font-heading text-2xl font-bold tracking-[-0.03em] text-foreground">
                CRM Core
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                Advisors close in CRM; ops enrolls in Admin. Same identity, same tenancy — no
                reconciliation tax between sales and membership.
              </p>
              <Link
                href="/products/crm"
                className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:gap-3"
              >
                Explore CRM Core
                <ArrowUpRight weight="light" className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="dh-bezel dh-bezel-suite h-full">
            <div className="dh-bezel-inner flex h-full flex-col p-8 sm:p-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400/90">
                Early access
              </p>
              <h3 className="mt-3 font-heading text-2xl font-bold tracking-[-0.03em] text-foreground">
                Ready to run enrollment here?
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                We&rsquo;re onboarding agencies and TPAs in waves. Tell us your stack — we&rsquo;ll
                respond within a business day.
              </p>
              <Link href="/#request-access" className="group mt-8 inline-flex dh-btn-island dh-btn-primary w-fit">
                Request access
                <span className="dh-btn-ico">
                  <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
