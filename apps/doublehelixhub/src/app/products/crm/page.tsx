import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  FlowArrow,
  EnvelopeSimple,
  Plugs,
  FileText,
  Lightning,
  ShieldCheck,
  Kanban,
  UsersThree,
  ChartLineUp,
} from '@phosphor-icons/react/dist/ssr';

export const metadata: Metadata = {
  title: 'CRM Core | Double Helix Software',
  description:
    'The CRM built for health benefits — pipelines, modules, automations, and document workflows tuned for advisors and agencies.',
};

const capabilities = [
  {
    icon: Kanban,
    title: 'Modular records',
    body: 'Leads, deals, accounts, plans, custom modules — define your own fields and stages per tenant org.',
  },
  {
    icon: EnvelopeSimple,
    title: 'Email & SMS sync',
    body: 'Two-way Gmail/Outlook + Twilio threading attached to records, with sequences and automations.',
  },
  {
    icon: Plugs,
    title: 'Embeddable forms',
    body: 'Drop quote forms onto any tenant marketing site. Anonymous submissions land scoped to the right org.',
  },
  {
    icon: FileText,
    title: 'Documents & e-sign',
    body: 'Generate proposals from templates, send for signature, archive against the deal record.',
  },
  {
    icon: Lightning,
    title: 'Automation engine',
    body: 'Event-driven workflows with conditions, queues, and retries. Trigger on stage change, time, or webhook.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit + HIPAA-aware',
    body: 'Row-level security, immutable audit logs, and PHI guardrails baked into the data model.',
  },
];

const workflow = [
  {
    step: '01',
    title: 'Capture',
    body: 'Inbound forms, imports, and advisor-entered leads land in the right org with source attribution intact.',
  },
  {
    step: '02',
    title: 'Qualify',
    body: 'Stage gates, required fields, and workqueues keep every book moving — Medicare, ACA, group, or healthshare.',
  },
  {
    step: '03',
    title: 'Close',
    body: 'Proposals, e-sign, and handoff into Admin Enrollment when you run the full stack.',
  },
];

const audiences = [
  { icon: UsersThree, label: 'Independent advisors' },
  { icon: FlowArrow, label: 'Growing agencies' },
  { icon: ChartLineUp, label: 'Enrollment teams' },
];

export default function CrmProductPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page">
          <div className="grid items-end gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-24">
            <div>
              <span className="dh-eyebrow mb-7">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_0_3px_rgba(6,182,212,0.2)]" />
                Product 01 · CRM Core
              </span>
              <h1 className="mt-7 max-w-[14ch] font-heading text-[clamp(2.6rem,5.5vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.04em] text-white">
                The CRM that already knows{' '}
                <span className="gradient-text-helix">benefits</span>
              </h1>
              <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-white/55">
                Pipelines, modules, and automations purpose-built for Medicare, ACA, group, and
                healthshare advisors. Stop bending a generic CRM into shape.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/#request-access" className="group dh-btn-island dh-btn-white">
                  Request access
                  <span className="dh-btn-ico">
                    <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
                  </span>
                </Link>
                <Link href="/products/admin" className="dh-btn-ghost">
                  See Admin Enrollment
                </Link>
              </div>
            </div>

            <div className="dh-bezel dh-bezel-suite">
              <div className="dh-bezel-inner p-7 sm:p-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/90">
                  Built for
                </p>
                <ul className="mt-5 space-y-4">
                  {audiences.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-3 text-sm font-medium text-white/80">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400 ring-1 ring-cyan-400/20">
                        <Icon weight="light" className="h-5 w-5" />
                      </span>
                      {label}
                    </li>
                  ))}
                </ul>
                <div className="mt-7 border-t border-white/[0.06] pt-5">
                  <p className="text-sm leading-relaxed text-white/45">
                    One tenancy-aware spine — every lead, deal, and sequence stays inside your org.
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
            <h2 className="mt-5 font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em] text-white">
              Capture → qualify → close
            </h2>
            <p className="mt-4 text-white/50">
              A motion tuned for benefits sales — not a generic opportunity object with a health
              sticker on it.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {workflow.map((item) => (
              <div key={item.step} className="dh-bezel h-full">
                <div className="dh-bezel-inner flex h-full flex-col p-7">
                  <span className="font-heading text-3xl font-bold tracking-[-0.04em] text-cyan-400/80">
                    {item.step}
                  </span>
                  <h3 className="mt-4 font-heading text-xl font-semibold tracking-[-0.02em] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{item.body}</p>
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
            <h2 className="mt-5 font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold tracking-[-0.03em] text-white">
              Everything a benefits book needs
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, body }) => (
              <div key={title} className="dh-bezel h-full">
                <div className="dh-bezel-inner flex h-full flex-col p-6">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400 ring-1 ring-cyan-400/20">
                    <Icon weight="light" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-heading text-base font-semibold tracking-[-0.02em] text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why not Salesforce */}
      <section className="pb-20 md:pb-28">
        <div className="container-page">
          <div className="dh-bezel">
            <div className="dh-bezel-inner grid gap-10 p-8 sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-14">
              <div>
                <span className="dh-eyebrow">Why CRM Core</span>
                <h2 className="mt-5 font-heading text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-[-0.03em] text-white">
                  Purpose-built beats bolted-on
                </h2>
                <p className="mt-4 text-white/50">
                  Generic platforms force you to invent Medicare stages, ACA households, and
                  commission handoffs. We ship them.
                </p>
              </div>
              <ul className="space-y-4">
                {[
                  'Org-level isolation with shared infrastructure',
                  'Modules and stages that match benefits vocabulary',
                  'Sequences that respect compliance-sensitive outreach',
                  'Clean handoff into Admin Enrollment when you need ops',
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-white/70">
                    <Check weight="light" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/90">
                Pair with
              </p>
              <h3 className="mt-3 font-heading text-2xl font-bold tracking-[-0.03em] text-white">
                Admin Enrollment
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-white/50">
                Close in CRM, enroll in Admin — same identity layer, same tenancy model, no CSV
                ping-pong between sales and ops.
              </p>
              <Link
                href="/products/admin"
                className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:gap-3"
              >
                Explore Admin
                <ArrowUpRight weight="light" className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="dh-bezel dh-bezel-suite h-full">
            <div className="dh-bezel-inner flex h-full flex-col p-8 sm:p-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/90">
                Early access
              </p>
              <h3 className="mt-3 font-heading text-2xl font-bold tracking-[-0.03em] text-white">
                Ready to run your book here?
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-white/50">
                We&rsquo;re onboarding agencies in waves. Tell us what you&rsquo;re running today —
                we&rsquo;ll get back within a business day.
              </p>
              <Link href="/#request-access" className="group mt-8 inline-flex dh-btn-island dh-btn-white w-fit">
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
