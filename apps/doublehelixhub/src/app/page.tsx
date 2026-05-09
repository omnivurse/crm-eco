import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, Users, Workflow, CreditCard, Building2 } from 'lucide-react';
import { LeadForm } from '@/components/lead-form';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Products />
      <WhyDoubleHelix />
      <RequestAccess />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-background to-muted/30 pt-16 pb-24">
      <div className="container-page text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Licensed multi-tenant SaaS
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
          The operating system for{' '}
          <span className="gradient-text-helix">health benefits.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Double Helix Software is a CRM and enrollment platform purpose-built for benefits
          advisors, agencies, and TPAs. One backbone for contacts, deals, enrollments, plans,
          billing, and commissions.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="#request-access"
            className="inline-flex h-12 items-center justify-center rounded-md gradient-helix px-7 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
          >
            Request access <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href="#products"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-background px-7 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
          >
            See the products
          </Link>
        </div>
      </div>
    </section>
  );
}

const products = [
  {
    name: 'CRM Core',
    href: '/products/crm',
    tagline: 'The CRM built for health benefits.',
    description:
      'Pipelines, modules, automations, and document workflows tuned for advisors selling Medicare, ACA, group health, and healthshare.',
    bullets: ['Modular records (leads, deals, accounts, plans)', 'Email & SMS sync, sequences, automations', 'Embeddable lead forms for your marketing site'],
  },
  {
    name: 'Admin Enrollment',
    href: '/products/admin',
    tagline: 'Member management end to end.',
    description:
      'Run plans, members, billing, commissions, payouts, and ops from one place. Multi-tenant by design — every agency or TPA stays cleanly isolated.',
    bullets: ['Plan & rate engines', 'Member portal & self-service', 'Commissions, payouts, vendor payables'],
  },
];

function Products() {
  return (
    <section id="products" className="border-b border-border/60 py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Two products. One platform.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Subscribe to either CRM Core or Admin Enrollment — or both — and let the same data
            backbone, billing, and identity layer run your entire benefits operation.
          </p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {products.map((product) => (
            <article
              key={product.name}
              className="group rounded-2xl border border-border bg-card p-8 shadow-sm transition hover:border-foreground/20 hover:shadow-md"
            >
              <h3 className="text-2xl font-bold text-foreground">{product.name}</h3>
              <p className="mt-1 text-sm font-medium text-primary">{product.tagline}</p>
              <p className="mt-4 text-muted-foreground">{product.description}</p>
              <ul className="mt-6 space-y-2 text-sm text-foreground/80">
                {product.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={product.href}
                className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Learn more <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Workflow,
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
    title: 'Members, advisors, agents — all in one model',
    body: 'No bolted-on identity. Roles flow from a single membership table so portals, permissions, and pay flows align.',
  },
  {
    icon: Zap,
    title: 'Embed anywhere',
    body: 'Drop quote forms and pricing widgets into any tenant’s WordPress, custom site, or landing page builder.',
  },
  {
    icon: Building2,
    title: 'Built for the licensee',
    body: 'White-labeled landing pages, branding, and domains for every tenant org. Your customers see your brand, not ours.',
  },
];

function WhyDoubleHelix() {
  return (
    <section className="border-b border-border/60 bg-muted/30 py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Why Double Helix
          </h2>
          <p className="mt-4 text-muted-foreground">
            Most CRMs and enrollment systems weren&rsquo;t built for benefits. We started from the
            specifics of this industry — multi-carrier plans, commissions, member portals — and
            wrapped a clean SaaS platform around them.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg gradient-helix text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RequestAccess() {
  return (
    <section id="request-access" className="py-20">
      <div className="container-page grid gap-10 lg:grid-cols-2">
        <div className="lg:pr-8">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Get early access.
          </h2>
          <p className="mt-4 text-muted-foreground">
            We&rsquo;re onboarding agencies and TPAs in waves. Tell us what you&rsquo;re running today
            and what you&rsquo;d like Double Helix to take over — we&rsquo;ll get back within a
            business day.
          </p>
          <div className="mt-8 space-y-4 text-sm text-foreground/80">
            <p className="flex gap-2"><ArrowRight className="mt-0.5 h-4 w-4 text-primary" /> No card required to evaluate.</p>
            <p className="flex gap-2"><ArrowRight className="mt-0.5 h-4 w-4 text-primary" /> Migration help included for early customers.</p>
            <p className="flex gap-2"><ArrowRight className="mt-0.5 h-4 w-4 text-primary" /> White-labeled landing pages and tenant branding throughout.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <LeadForm />
        </div>
      </div>
    </section>
  );
}
