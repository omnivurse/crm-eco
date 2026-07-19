import Link from 'next/link';
import {
  ArrowUpRight,
  ShieldCheck,
  Lightning,
  Users,
  FlowArrow,
  CreditCard,
  Buildings,
  Check,
} from '@phosphor-icons/react/dist/ssr';
import { LeadForm } from '@/components/lead-form';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <WhyDoubleHelix />
      <RequestAccess />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="container-page">
        <div className="grid items-center gap-12 py-16 sm:py-20 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-2 lg:gap-14 lg:py-24">
          {/* Editorial left */}
          <div>
            <span className="dh-eyebrow mb-7">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_0_3px_rgba(6,182,212,0.2)]" />
              Multi-tenant SaaS
            </span>
            <h1 className="mt-7 max-w-[11ch] font-heading text-[clamp(2.85rem,6.5vw,5rem)] font-bold leading-[0.98] tracking-[-0.04em] text-white">
              The OS for <span className="gradient-text-helix">health benefits</span>
            </h1>
            <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-white/55">
              CRM and enrollment for advisors, agencies, and TPAs — one backbone for contacts,
              deals, plans, billing, and commissions. Licensed. Isolated. Built to scale.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="#request-access" className="group dh-btn-island dh-btn-white">
                Request access
                <span className="dh-btn-ico">
                  <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
                </span>
              </Link>
              <Link href="#products" className="dh-btn-ghost">
                See the products
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-white/50">
              <li className="inline-flex items-center gap-2">
                <ShieldCheck weight="light" className="h-4 w-4 text-cyan-400" />
                Org-level isolation
              </li>
              <li className="inline-flex items-center gap-2">
                <FlowArrow weight="light" className="h-4 w-4 text-cyan-400" />
                CRM + Admin suite
              </li>
              <li className="inline-flex items-center gap-2">
                <Lightning weight="light" className="h-4 w-4 text-cyan-400" />
                Early access pricing
              </li>
            </ul>
          </div>

          {/* Editorial right — product stack */}
          <div id="products" className="flex flex-col gap-4 scroll-mt-28">
            <ProductCard
              kicker="Product 01"
              title="CRM Core"
              body="Pipelines, modules, and automations purpose-built for Medicare, ACA, group, and healthshare advisors."
              chips={['Leads', 'Deals', 'Sequences']}
              href="/products/crm"
            />
            <ProductCard
              kicker="Product 02"
              title="Admin Enrollment"
              body="Plans, members, billing, commissions, and ops — multi-tenant isolation for every agency and TPA."
              chips={['Billing', 'Commissions', 'Portal']}
              href="/products/admin"
            />
            <div className="dh-bezel dh-bezel-suite">
              <div className="dh-bezel-inner p-6 sm:p-7">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/90">Suite</p>
                <h3 className="font-heading text-xl font-bold tracking-[-0.03em] text-white">Run the whole stack</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  One identity layer. One data backbone. Subscribe to either product — or both.
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                  <span className="dh-chip">Shared core</span>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:gap-2.5"
                  >
                    Pricing
                    <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  kicker,
  title,
  body,
  chips,
  href,
}: {
  kicker: string;
  title: string;
  body: string;
  chips: string[];
  href: string;
}) {
  return (
    <div className="dh-bezel">
      <div className="dh-bezel-inner p-6 sm:p-7">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/90">{kicker}</p>
        <h3 className="font-heading text-xl font-bold tracking-[-0.03em] text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/50">{body}</p>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="dh-chip">{c}</span>
            ))}
          </div>
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-white transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:gap-2.5"
          >
            Explore
            <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    icon: FlowArrow,
    title: 'Multi-tenant by design',
    body: 'Every agency, TPA, or advisor group is its own org. Strict data isolation with shared infrastructure.',
  },
  {
    icon: ShieldCheck,
    title: 'HIPAA-aware foundations',
    body: 'Audit logging, RLS at the database, and encryption controls baked into the core schema.',
  },
  {
    icon: CreditCard,
    title: 'Billing engine inside',
    body: 'Multi-gateway support for member premiums, subscription billing, advisor commissions, and vendor payables.',
  },
  {
    icon: Users,
    title: 'Members, advisors, agents — one model',
    body: 'No bolted-on identity. Roles flow from a single membership table so portals, permissions, and pay flows align.',
  },
  {
    icon: Lightning,
    title: 'Embed anywhere',
    body: 'Drop quote forms and pricing widgets into any tenant’s WordPress, custom site, or landing page builder.',
  },
  {
    icon: Buildings,
    title: 'Built for the licensee',
    body: 'White-labeled landing pages, branding, and domains for every tenant org. Your customers see your brand.',
  },
];

function WhyDoubleHelix() {
  return (
    <section className="py-24 md:py-32">
      <div className="container-page">
        <div className="max-w-2xl">
          <span className="dh-eyebrow">Why Double Helix</span>
          <h2 className="mt-5 font-heading text-[clamp(1.875rem,3.5vw,2.75rem)] font-bold tracking-[-0.03em] text-white">
            Built for benefits — not bent into shape
          </h2>
          <p className="mt-4 text-white/50">
            Most CRMs and enrollment systems weren&rsquo;t built for benefits. We started from the
            specifics of this industry — multi-carrier plans, commissions, member portals — and
            wrapped a clean SaaS platform around them.
          </p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="dh-bezel h-full">
              <div className="dh-bezel-inner flex h-full flex-col p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400 ring-1 ring-cyan-400/20">
                  <Icon weight="light" className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold tracking-[-0.02em] text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RequestAccess() {
  return (
    <section id="request-access" className="scroll-mt-28 py-24 md:py-32">
      <div className="container-page grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="lg:pr-4">
          <span className="dh-eyebrow">Early access</span>
          <h2 className="mt-5 font-heading text-[clamp(1.875rem,3.5vw,2.75rem)] font-bold tracking-[-0.03em] text-white">
            Get early access.
          </h2>
          <p className="mt-4 text-white/50">
            We&rsquo;re onboarding agencies and TPAs in waves. Tell us what you&rsquo;re running today
            and what you&rsquo;d like Double Helix to take over — we&rsquo;ll get back within a
            business day.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/60">
            {[
              'No card required to evaluate.',
              'Migration help included for early customers.',
              'White-labeled landing pages and tenant branding throughout.',
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check weight="light" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="dh-bezel">
          <div className="dh-bezel-inner p-7 sm:p-8">
            <LeadForm />
          </div>
        </div>
      </div>
    </section>
  );
}
