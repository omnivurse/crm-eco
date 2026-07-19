import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import {
  ArrowUpRight,
  Handshake,
  Stethoscope,
  VideoCamera,
  Pill,
  Baby,
  Scales,
  User,
  Users,
  UsersThree,
  UserPlus,
  ClipboardText,
  CalendarCheck,
  Question,
} from '@phosphor-icons/react/dist/ssr';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  SectionHeading,
  IconChip,
  FeatureCard,
  StatStrip,
  BrandImage,
  CTABand,
  CheckList,
} from '@/components/sections/blocks';
import { IMAGES } from '@/lib/site-images';
import { BRAND, STATS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Individuals & Families Membership | Pay It Forward Health',
  description:
    'Flexible, affordable health care sharing for individuals, couples, and families. Keep your own doctors, join any time of year, and let a caring community help carry your eligible medical costs. Not insurance.',
};

const WHO_ITS_FOR = [
  'Self-employed workers, freelancers, and gig professionals',
  'Families who want predictable costs without insurance premiums',
  'Couples and individuals between jobs or new to self-employment',
  'Early retirees bridging the gap before Medicare',
  'Healthy households tired of paying for coverage they rarely use',
  'Anyone seeking an honest, people-first alternative to insurance',
];

const INCLUDED = [
  {
    icon: Handshake,
    title: 'Medical Cost Sharing',
    body: 'The heart of your membership — eligible doctor visits, hospital stays, surgeries, and major medical needs shared by the community.',
  },
  {
    icon: Stethoscope,
    title: 'Preventive Care',
    body: 'Annual wellness visits and routine screenings to help you and your family stay ahead of problems, included in your share.',
  },
  {
    icon: VideoCamera,
    title: 'Virtual Care',
    body: 'Talk to a licensed provider by phone or video, day or night, for everyday concerns — usually at no additional cost.',
  },
  {
    icon: Pill,
    title: 'Prescription Savings',
    body: 'Meaningful discounts on everyday and specialty medications through our pharmacy savings program.',
  },
  {
    icon: Baby,
    title: 'Maternity & Family Add-Ons',
    body: 'Optional maternity sharing and family-focused benefits, so growing households are cared for through every season.',
  },
  {
    icon: Scales,
    title: 'Medical Advocacy',
    body: 'Our team reviews and negotiates large bills on your behalf, so you are never facing the system alone.',
  },
];

const HOUSEHOLDS = [
  {
    icon: User,
    label: 'Individual',
    who: 'One adult member',
    share: '$129',
    note: 'A simple, single-member share for one healthy adult.',
  },
  {
    icon: Users,
    label: 'Couple',
    who: 'Two adult members',
    share: '$258',
    note: 'Two adults sharing together — partners, spouses, or a parent and adult child.',
  },
  {
    icon: UsersThree,
    label: 'Family',
    who: 'Two adults + children',
    share: '$389',
    note: 'A whole household covered under one membership, children included.',
    featured: true,
  },
];

const STEPS = [
  {
    icon: ClipboardText,
    step: '01',
    title: 'Pick your program',
    body: 'Compare programs and choose the monthly share level that fits your household and budget. No health questionnaire to get a quote.',
  },
  {
    icon: UserPlus,
    step: '02',
    title: 'Enroll online',
    body: 'Sign up in minutes from any device. There is no open-enrollment window — you can join any time of year, no agents required.',
  },
  {
    icon: CalendarCheck,
    step: '03',
    title: 'Start sharing',
    body: 'Your membership begins the first of the following month. From there, you are part of a community that shows up when you need it.',
  },
];

const FAQS = [
  {
    q: 'Is this health insurance?',
    a: `No. ${BRAND.name} is a health care sharing community, not an insurance company, and the program is not insurance. Members voluntarily share one another's eligible medical costs.`,
  },
  {
    q: 'Can I keep my own doctor?',
    a: 'Yes. There are no provider networks and no referrals. You are free to see the doctors and hospitals you already trust.',
  },
  {
    q: 'When can I join?',
    a: 'Any time of year. There is no open-enrollment window — enroll today and your sharing begins the first of next month.',
  },
  {
    q: 'What about pre-existing conditions?',
    a: 'Pre-existing conditions are reviewed fairly, with a clear path to sharing over time. Reach out and we will walk you through the details.',
  },
];

export default function IndividualsMembershipPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white py-20 md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,rgba(14,140,154,0.12),transparent)]" />
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full bg-pif-teal-50 px-4 py-1.5 ring-1 ring-pif-teal-100">
                <Handshake className="h-4 w-4 text-pif-teal-600" />
                <span className="text-sm font-semibold text-pif-teal-700">
                  Individuals &amp; Families
                </span>
              </div>
              <h1 className="mt-6 font-heading text-[clamp(2.25rem,5.5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                Affordable care for <span className="gradient-text">your whole household</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                Whether it&apos;s just you or a houseful, {BRAND.name} brings families together to
                share medical costs — for a fraction of a typical insurance premium. Keep your own
                doctors, join any time of year, and never face a health need alone.
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-slate-600">
                It&apos;s a health care sharing community, not insurance — and that difference is the
                whole point.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href="/enroll">
                  <Button
                    size="lg"
                    className="w-full gap-2 pif-grad-care font-semibold text-white shadow-lg hover:opacity-95 sm:w-auto"
                  >
                    Become a Member
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/plans">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-pif-navy/15 bg-white font-semibold text-pif-navy-800 hover:bg-pif-mist sm:w-auto"
                  >
                    Compare Plans
                  </Button>
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.familyTogether} priority aspect="aspect-[4/3]" />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Who it's for */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 lg:order-1">
              <BrandImage image={IMAGES.parentChild} aspect="aspect-[4/3]" />
            </Reveal>
            <Reveal className="order-1 lg:order-2" delay={0.1}>
              <SectionHeading
                align="left"
                eyebrow="Who it's for"
                title="Built for real households and real budgets"
                subtitle="If traditional insurance feels too expensive — or like it just doesn't fit your life — a sharing membership may be exactly what you've been looking for."
              />
              <CheckList className="mt-8" items={WHO_ITS_FOR} />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* What's included */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What's included"
              title="A full circle of care in one membership"
              subtitle="Your membership is more than cost sharing — it's everyday support for you and the people you love, all in one place."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((item, i) => (
              <Reveal key={item.title} delay={(i % 3) * 0.07}>
                <FeatureCard
                  icon={item.icon}
                  title={item.title}
                  href="/services"
                  linkLabel="Explore services"
                >
                  {item.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Example households */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Example households"
              title="See what sharing could look like for you"
              subtitle="Every household is different, so these are illustrations — not a quote. Your actual monthly share depends on the program and options you choose."
            />
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            {HOUSEHOLDS.map((h, i) => (
              <Reveal key={h.label} delay={i * 0.08}>
                <div
                  className={
                    h.featured
                      ? 'relative h-full overflow-hidden rounded-2xl pif-grad-deep p-7 text-white shadow-xl shadow-pif-navy/20 ring-1 ring-pif-teal-400/25'
                      : 'relative h-full rounded-2xl border border-pif-navy-100 bg-white p-7 shadow-sm ring-1 ring-pif-navy/5'
                  }
                >
                  {h.featured && (
                    <span className="absolute right-5 top-5 rounded-full pif-grad-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-pif-navy-900">
                      Most chosen
                    </span>
                  )}
                  <IconChip
                    icon={h.icon}
                    variant={h.featured ? 'gold' : 'brand'}
                    className="mb-5"
                  />
                  <h3
                    className={
                      h.featured
                        ? 'font-heading text-xl font-semibold text-white'
                        : 'font-heading text-xl font-semibold text-pif-navy-800'
                    }
                  >
                    {h.label}
                  </h3>
                  <p className={h.featured ? 'mt-1 text-sm text-white/70' : 'mt-1 text-sm text-slate-500'}>
                    {h.who}
                  </p>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span
                      className={
                        h.featured
                          ? 'font-heading text-4xl font-bold text-white'
                          : 'font-heading text-4xl font-bold text-pif-navy-800'
                      }
                    >
                      {h.share}
                    </span>
                    <span className={h.featured ? 'text-sm text-white/70' : 'text-sm text-slate-500'}>
                      / month
                    </span>
                  </div>
                  <p
                    className={
                      h.featured
                        ? 'mt-1 text-xs font-semibold uppercase tracking-wide text-pif-gold-300'
                        : 'mt-1 text-xs font-semibold uppercase tracking-wide text-pif-teal-700'
                    }
                  >
                    Example monthly share
                  </p>
                  <p className={h.featured ? 'mt-4 leading-relaxed text-white/85' : 'mt-4 leading-relaxed text-slate-600'}>
                    {h.note}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.15}>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
              Figures shown are illustrative examples only — not quotes or guaranteed pricing. Visit
              our plans page for current programs, share levels, and options.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* How to join */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="How to join"
              title="Three simple steps to get started"
              subtitle="No agents, no pressure, no open-enrollment window. Joining takes minutes, and you can do it whenever life calls for it."
            />
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-5xl gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 0.08}>
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

      {/* Stats strip */}
      <section className="hub-section-muted py-16 md:py-20">
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

      {/* Pricing teaser — dark */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                align="left"
                tone="light"
                eyebrowTone="light"
                eyebrow="Plans & pricing"
                title="Find the share that fits your family"
              />
              <p className="mt-5 text-lg leading-relaxed text-white/80">
                We offer a handful of straightforward programs with different share levels and
                Initial Unshareable Amounts, so you can balance your monthly budget with your
                comfort level. No fine print, no surprise increases mid-year.
              </p>
              <CheckList
                tone="light"
                className="mt-8"
                items={[
                  'Transparent monthly shares — a fraction of typical premiums',
                  'No deductibles to satisfy and no networks to navigate',
                  'Add household members or maternity options as life changes',
                  'Cancel any time — no long-term contracts',
                ]}
              />
              <div className="mt-9">
                <Link href="/plans">
                  <Button
                    size="lg"
                    className="gap-2 bg-white font-semibold text-pif-navy-800 shadow-lg hover:bg-pif-mist"
                  >
                    Compare Plans &amp; Pricing
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
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

      {/* FAQ teaser */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Common questions"
              title="Answers before you decide"
              subtitle="A few of the things households ask us most. For everything else, our team is just a phone call away."
            />
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
            {FAQS.map((item, i) => (
              <Reveal key={item.q} delay={(i % 2) * 0.08}>
                <div className="h-full rounded-2xl border border-pif-navy-100 bg-white p-7 shadow-sm ring-1 ring-pif-navy/5">
                  <h3 className="font-heading text-lg font-semibold text-pif-navy-800">{item.q}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{item.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1}>
            <div className="mt-12 text-center">
              <Link
                href="/faq"
                className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
              >
                <Question className="h-4 w-4" />
                Read all frequently asked questions
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Ready to bring your household into the community?"
        subtitle="Enroll any time of year and start sharing the first of next month. Keep your doctors, lower your costs, and join a community that pays it forward."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'Compare Plans', href: '/plans' }}
      />
    </>
  );
}
