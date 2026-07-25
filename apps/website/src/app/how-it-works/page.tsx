import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import {
  ArrowRight,
  FileText,
  BookOpen,
  Wallet,
  UserPlus,
  Compass,
  PiggyBank,
  Send,
  HeartPulse,
  Check,
  X,
  HelpCircle,
} from 'lucide-react';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  SectionHeading,
  IconChip,
  StatStrip,
  BrandImage,
  CTABand,
  CheckList,
} from '@/components/sections/blocks';
import { IMAGES } from '@/lib/site-images';
import { BRAND, STATS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'How Health Care Sharing Works | Pay It Forward Health',
  description:
    'A plain-language guide to community health care sharing — what a sharing request is, what the Member Guidelines cover, how the Initial Unshareable Amount (IUA) works, and the simple monthly rhythm of members caring for members. Not insurance.',
};

const TERMS = [
  {
    icon: FileText,
    term: 'Sharing Request',
    body: 'When you have an eligible medical need, you submit a sharing request through your member portal. Our team reviews it against the guidelines, and the community shares the eligible amount with you — no claim forms or denial letters.',
  },
  {
    icon: BookOpen,
    term: 'Member Guidelines',
    body: 'A clear, published document that spells out exactly what is eligible for sharing and what is not. Because everyone agrees to the same guidelines, sharing stays fair, transparent, and predictable for the whole community.',
  },
  {
    icon: Wallet,
    term: 'Initial Unshareable Amount (IUA)',
    body: 'A set amount you pay toward each separate medical need before the community shares the rest. Unlike an insurance deductible, the IUA applies per need and does not reset every January — so a healthy year is never wasted.',
  },
];

const STEPS = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Join the community',
    body: 'Choose the program that fits your household and enroll online in minutes. There is no open-enrollment window and no health questionnaire to get a quote — you can join any time of year.',
  },
  {
    icon: Compass,
    step: '02',
    title: 'Learn the guidelines',
    body: 'Get to know the Member Guidelines so you know what is eligible, how the IUA works, and what to expect. Everything is published in plain language, with our team a phone call away.',
  },
  {
    icon: PiggyBank,
    step: '03',
    title: 'Share each month',
    body: 'Your affordable monthly share goes to support fellow members with eligible needs — a fraction of a typical insurance premium, and a direct act of community care.',
  },
  {
    icon: Send,
    step: '04',
    title: 'Submit a sharing request',
    body: 'When a medical need arises, pay your IUA, see the doctor you choose, and submit a sharing request. The community shares the eligible balance, often within days.',
  },
  {
    icon: HeartPulse,
    step: '05',
    title: 'Live well',
    body: 'With preventive care, telehealth, prescription savings and advocacy included, you stay ahead of problems — and the cycle of paying it forward continues for the next member who needs it.',
  },
];

const COMPARISON = [
  {
    category: 'Monthly cost',
    sharing: 'A low, predictable monthly share',
    insurance: 'Premiums that climb most years',
  },
  {
    category: 'How costs are paid',
    sharing: 'Members share one another’s eligible needs directly',
    insurance: 'A company pays claims it approves',
  },
  {
    category: 'Up-front amount',
    sharing: 'One IUA per need — it does not reset yearly',
    insurance: 'A deductible that resets every January',
  },
  {
    category: 'Choosing your doctor',
    sharing: 'No networks — keep the doctors you trust',
    insurance: 'In-network restrictions often apply',
  },
  {
    category: 'When you can join',
    sharing: 'Join any time of year',
    insurance: 'Limited open-enrollment windows',
  },
  {
    category: 'How it feels',
    sharing: 'Neighbors helping neighbors, transparently',
    insurance: 'A transactional, often opaque, process',
  },
];

const WELCOME = [
  'Individuals and families of every size and stage of life',
  'People of all backgrounds and beliefs — no faith requirement',
  'Self-employed workers, freelancers, and small-business owners',
  'Anyone seeking an honest, affordable alternative to insurance',
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pif-grad-brand">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(255,255,255,0.16),transparent)]" />
        <Container className="relative py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[0.8125rem] font-bold uppercase tracking-[0.2em] text-pif-teal-200">
              How Sharing Works
            </p>
            <h1 className="mt-5 font-heading text-[clamp(2.25rem,5.5vw,4rem)] font-semibold leading-[1.08] text-white text-balance">
              Community health care, made simple
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/85">
              {BRAND.name} is a health care sharing community — not insurance. Members
              voluntarily share one another&apos;s eligible medical costs. Here is exactly how it
              works, in plain language.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/enroll">
                <Button
                  size="lg"
                  className="w-full gap-2 bg-white font-semibold text-pif-navy-800 shadow-lg hover:bg-pif-mist sm:w-auto"
                >
                  Become a Member
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/plans">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/50 bg-transparent font-semibold text-white hover:bg-white/10 sm:w-auto"
                >
                  Compare Plans
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Key terms */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Start with the basics"
              title="Three terms worth knowing"
              subtitle="Sharing uses a few simple ideas instead of insurance jargon. Once these click, the rest is easy."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {TERMS.map((t, i) => (
              <Reveal key={t.term} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-pif-navy-100 bg-white p-8 shadow-sm ring-1 ring-pif-navy/5">
                  <IconChip icon={t.icon} variant="brand" className="mb-5" />
                  <h3 className="font-heading text-xl font-semibold text-pif-navy-800">{t.term}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{t.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* The cyclical journey — numbered steps */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="The member journey"
              title="A simple rhythm that comes back around"
              subtitle="Sharing is a cycle, not a contract. Each member is cared for, and in turn helps care for the next — paying it forward."
            />
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={(i % 3) * 0.08}>
                <div className="relative h-full rounded-2xl border border-pif-navy-100 bg-white p-7 shadow-sm ring-1 ring-pif-navy/5">
                  <span className="absolute right-6 top-5 font-heading text-5xl font-bold text-pif-navy-50">
                    {s.step}
                  </span>
                  <IconChip icon={s.icon} variant="soft" className="mb-5" />
                  <h3 className="font-heading text-xl font-semibold text-pif-navy-800">{s.title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Image + IUA emphasis */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 md:order-1">
              <BrandImage image={IMAGES.consultation} aspect="aspect-[4/3]" priority />
            </Reveal>
            <Reveal className="order-1 md:order-2" delay={0.1}>
              <SectionHeading
                align="left"
                eyebrow="Pay it forward"
                title="You are never facing a medical need alone"
                subtitle="When something happens, you see the provider you choose, pay your IUA, and the community shares the rest. No networks to navigate, no surprise denials."
              />
              <CheckList
                className="mt-8"
                items={[
                  'Submit a sharing request right from your member portal',
                  'Eligible needs are reviewed against the published guidelines',
                  'The community shares the eligible balance, often within days',
                  'Our advocates step in to review and negotiate large bills',
                ]}
              />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Comparison: sharing vs. traditional insurance */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="A different model"
              title="Sharing vs. traditional insurance"
              subtitle="Both help with medical costs — but sharing is built around people, transparency, and care rather than policies and fine print."
            />
          </Reveal>

          <Reveal delay={0.1} className="mx-auto mt-14 max-w-5xl">
            {/* Desktop / tablet: 3-column grid */}
            <div className="hidden overflow-hidden rounded-3xl border border-pif-navy-100 bg-white shadow-sm ring-1 ring-pif-navy/5 md:block">
              <div className="grid grid-cols-3 border-b border-pif-navy-100 bg-pif-mist">
                <div className="p-5 font-heading font-semibold text-pif-navy-800">What to compare</div>
                <div className="p-5 text-center font-heading font-semibold text-pif-teal-700">
                  {BRAND.shortName} sharing
                </div>
                <div className="p-5 text-center font-heading font-semibold text-slate-500">
                  Traditional insurance
                </div>
              </div>
              {COMPARISON.map((row) => (
                <div
                  key={row.category}
                  className="grid grid-cols-3 border-b border-pif-navy-100 transition-colors last:border-b-0 hover:bg-pif-mist/60"
                >
                  <div className="p-5 font-medium text-pif-navy-800">{row.category}</div>
                  <div className="flex items-start justify-center gap-2 p-5">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-pif-green-50 text-pif-green-600">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="text-sm text-slate-700">{row.sharing}</span>
                  </div>
                  <div className="flex items-start justify-center gap-2 p-5">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="text-sm text-slate-500">{row.insurance}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile: stacked cards */}
            <div className="space-y-4 md:hidden">
              {COMPARISON.map((row) => (
                <div
                  key={row.category}
                  className="rounded-2xl border border-pif-navy-100 bg-white p-5 shadow-sm ring-1 ring-pif-navy/5"
                >
                  <p className="mb-4 font-heading font-semibold text-pif-navy-800">{row.category}</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-pif-green-50 text-pif-green-600">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                      <div>
                        <span className="block text-xs font-semibold uppercase tracking-wide text-pif-teal-700">
                          {BRAND.shortName} sharing
                        </span>
                        <span className="text-sm text-slate-700">{row.sharing}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                      <div>
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Traditional insurance
                        </span>
                        <span className="text-sm text-slate-500">{row.insurance}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
              {BRAND.name} is not an insurance company and the program is not insurance. It is a
              voluntary community of members sharing one another&apos;s eligible medical costs.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Welcoming / eligibility — dark */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                align="left"
                tone="light"
                eyebrowTone="light"
                eyebrow="Everyone is welcome"
                title="Open to people of every background"
              />
              <p className="mt-5 text-lg leading-relaxed text-white/80">
                There is no faith requirement, no health questionnaire to get a quote, and no
                open-enrollment window to wait for. If you believe in caring for your neighbor, you
                already belong here.
              </p>
              <CheckList tone="light" className="mt-8" items={WELCOME} />
              <p className="mt-7 text-sm text-white/60">
                Eligibility can vary by state. Reach out or start enrollment and we&apos;ll help you
                confirm your options.
              </p>
            </div>
            <Reveal delay={0.1}>
              <BrandImage
                image={IMAGES.familyOutdoor}
                aspect="aspect-[4/3]"
                scrim={false}
                className="ring-white/10"
              />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Stats strip */}
      <section className="bg-white py-16 md:py-20">
        <Container>
          <Reveal>
            <StatStrip
              tone="light"
              stats={[
                { value: STATS.members, label: 'Members & growing' },
                { value: STATS.shared, label: 'Shared by the community' },
                { value: STATS.satisfaction, label: 'Average member rating' },
                { value: STATS.savings, label: 'Typical savings' },
              ]}
            />
          </Reveal>
        </Container>
      </section>

      {/* FAQ teaser */}
      <section className="hub-section-muted py-20 md:py-24">
        <Container>
          <Reveal>
            <div className="mx-auto flex max-w-3xl flex-col items-center rounded-3xl border border-pif-navy-100 bg-white p-10 text-center shadow-sm ring-1 ring-pif-navy/5 md:p-14">
              <IconChip icon={HelpCircle} variant="gold" className="mb-6" />
              <h2 className="font-heading text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-tight text-pif-navy-800 text-balance">
                Still have questions?
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
                We&apos;ve answered the things members ask most — about the IUA, eligible needs,
                pre-existing conditions, joining mid-year, and more.
              </p>
              <Link
                href="/faq"
                className="mt-7 inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
              >
                Read frequently asked questions
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Ready to join a community that pays it forward?"
        subtitle="Enroll any time of year and start sharing the first of next month. No networks, no surprises — just neighbors caring for neighbors."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'Compare Plans', href: '/plans' }}
      />
    </>
  );
}
