import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  HeartHandshake,
  Stethoscope,
  Pill,
  Video,
  Scale,
  Gift,
  Baby,
  Activity,
} from 'lucide-react';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  SectionHeading,
  Eyebrow,
  FeatureCard,
  IconChip,
  StatStrip,
  BrandImage,
  CTABand,
  CheckList,
} from '@/components/sections/blocks';
import { IMAGES } from '@/lib/site-images';
import { BRAND, STATS } from '@/lib/site';

export const metadata: Metadata = {
  title: `Member Services | ${BRAND.name}`,
  description:
    'Every Pay It Forward Health membership is more than cost sharing. Explore the services that surround you and your family — medical cost sharing, preventive care, prescription savings, virtual care, medical advocacy, the Giving Fund, maternity sharing, and wellness.',
};

const SERVICES = [
  {
    icon: HeartHandshake,
    title: 'Medical Cost Sharing',
    body: 'The heart of your membership. Eligible doctor visits, hospital stays, surgeries and emergencies are shared by the community — so you never carry a major medical need alone.',
    iconVariant: 'brand' as const,
  },
  {
    icon: Stethoscope,
    title: 'Preventive Care',
    body: 'Annual wellness visits, routine screenings and immunizations that help you stay ahead of problems — built into your membership so staying healthy is the easy choice.',
  },
  {
    icon: Pill,
    title: 'Prescription Savings',
    body: 'Meaningful discounts on everyday and specialty medications through our pharmacy savings program, accepted at thousands of pharmacies nationwide.',
  },
  {
    icon: Video,
    title: 'Virtual Care & Telehealth',
    body: 'Talk to a licensed provider by phone or video, day or night — for colds, prescriptions, and quick questions — usually at no additional cost to you.',
  },
  {
    icon: Scale,
    title: 'Medical Advocacy',
    body: 'Our team reviews and negotiates large bills on your behalf, catching errors and lowering balances so you are never facing the system by yourself.',
    href: '/medical-advocacy',
    linkLabel: 'See how advocacy works',
  },
  {
    icon: Gift,
    title: 'Giving Fund',
    body: 'A way for our community to come alongside members with needs that fall outside the guidelines — generosity in action, the way "pay it forward" was meant to work.',
    href: '/giving-fund',
    linkLabel: 'Learn about the Giving Fund',
    iconVariant: 'gold' as const,
  },
  {
    icon: Baby,
    title: 'Maternity Sharing',
    body: 'Prenatal visits, delivery and newborn care are eligible for sharing — so growing families can welcome a new arrival with support, not financial worry.',
  },
  {
    icon: Activity,
    title: 'Wellness',
    body: 'Resources, tools and incentives to help you build healthy habits that last — because caring for the whole person is what community is all about.',
  },
];

const ADVANTAGES = [
  'Keep the doctors and hospitals you already know — no networks, no referrals',
  'No open-enrollment window — join any time and start the first of the next month',
  'Open to people of every background and belief — everyone is welcome',
  'Transparent, predictable monthly shares with no hidden fees',
  'A real team advocating for you on the bills that matter most',
];

export default function ServicesPage() {
  return (
    <>
      {/* Intro hero */}
      <section className="relative overflow-hidden bg-white py-20 md:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 pif-grad-brand opacity-[0.06]" />
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <Eyebrow tone="teal">Member Services</Eyebrow>
              <h1 className="mt-4 font-heading text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                A whole circle of care, in{' '}
                <span className="gradient-text">one membership</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                Pay It Forward Health is an affordable alternative to insurance — and your
                membership goes far beyond cost sharing. From everyday virtual visits to
                advocacy on a major bill, here is everything our community surrounds you with.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/enroll"
                  className="inline-flex items-center justify-center gap-2 rounded-full pif-grad-care px-7 py-3.5 font-semibold text-white shadow-lg shadow-pif-teal/25 transition-transform hover:-translate-y-0.5"
                >
                  Become a Member
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-pif-navy-200 bg-white px-7 py-3.5 font-semibold text-pif-navy-800 transition-colors hover:bg-pif-mist"
                >
                  Compare Plans
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.heroDoctorPatient} aspect="aspect-[5/4]" priority />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Services grid */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Everything included"
              title="The services behind your membership"
              subtitle="Each membership wraps you in a community of support — practical help for everyday care and the big moments alike."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={(i % 4) * 0.06}>
                <FeatureCard
                  icon={s.icon}
                  title={s.title}
                  href={s.href}
                  linkLabel={s.linkLabel}
                  iconVariant={s.iconVariant}
                >
                  {s.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Image + advantages */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 md:order-1">
              <BrandImage image={IMAGES.familyTogether} aspect="aspect-[4/3]" />
            </Reveal>
            <Reveal className="order-1 md:order-2" delay={0.1}>
              <SectionHeading
                align="left"
                eyebrow="Why it works"
                title="Care that fits your life — not the other way around"
                subtitle="These services come together to make membership simple, flexible, and genuinely affordable."
              />
              <CheckList className="mt-8" items={ADVANTAGES} />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Always-there support — dark */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                align="left"
                tone="light"
                eyebrowTone="light"
                eyebrow="A team in your corner"
                title="Real people, ready when you need them"
              />
              <p className="mt-5 text-lg leading-relaxed text-white/80">
                Behind every service is a person who picks up the phone. Whether you are
                booking a virtual visit, filling a prescription, or facing an unexpected
                hospital bill, you have a member care team and a community that shows up for
                you — that&apos;s what it means to pay it forward.
              </p>
              <div className="mt-9 grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Video, label: '24/7 virtual care' },
                  { icon: Scale, label: 'Bill advocacy' },
                  { icon: HeartHandshake, label: 'Member care team' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10"
                  >
                    <IconChip icon={item.icon} variant="brand" className="mb-4" />
                    <p className="font-medium text-white/90">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <Reveal delay={0.1}>
              <BrandImage
                image={IMAGES.telehealth}
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

      {/* Final CTA */}
      <CTABand
        title="Ready to put these services to work for your family?"
        subtitle="Join a community built on generosity. Become a member today, or compare programs to find the right fit."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'Compare Plans', href: '/plans' }}
      />
    </>
  );
}
