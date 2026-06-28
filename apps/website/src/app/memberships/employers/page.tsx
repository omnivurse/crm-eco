import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import {
  ArrowRight,
  Briefcase,
  TrendingDown,
  Smile,
  Settings2,
  UserPlus,
  ClipboardCheck,
  PhoneCall,
  HeartHandshake,
  Stethoscope,
  Pill,
  Video,
  Scale,
  Gift,
  CalendarCheck,
  Wallet,
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
import { BRAND, STATS, PHONE } from '@/lib/site';

export const metadata: Metadata = {
  title: `Companies & Teams | ${BRAND.name} for Employers`,
  description:
    'Offer your team an affordable, modern health benefit with Pay It Forward Health. Community health-sharing for businesses means lower costs, happier employees, and simple admin — not insurance, no networks, join any time.',
};

const WHY_EMPLOYERS = [
  {
    icon: TrendingDown,
    title: 'Lower, more predictable cost',
    body: 'Monthly shares run a fraction of traditional group premiums. No surprise double-digit renewals — just transparent, steady pricing your budget can count on.',
  },
  {
    icon: Smile,
    title: 'Happier, healthier teams',
    body: 'People keep the doctors they trust, with no networks or referrals to chase. Telehealth, Rx savings, and advocacy come standard, so your team feels genuinely cared for.',
  },
  {
    icon: Settings2,
    title: 'Refreshingly simple admin',
    body: 'No open-enrollment scramble and no thick benefits binder. Add or remove members any time, and let us handle onboarding, billing, and member support.',
  },
];

const STEPS = [
  {
    icon: PhoneCall,
    step: '01',
    title: 'Talk with our team',
    body: 'Tell us about your company, your headcount, and what you want a benefit to do. We will map options to your goals — no obligation, no pressure.',
  },
  {
    icon: ClipboardCheck,
    step: '02',
    title: 'Pick the right programs',
    body: 'Choose the membership levels that fit your team and your budget. Offer one program or a few, and decide how much of the monthly share you cover.',
  },
  {
    icon: UserPlus,
    step: '03',
    title: 'Enroll your team',
    body: 'We make onboarding effortless with simple sign-up and clear guides. New hires can join any time of year — there is no enrollment window to miss.',
  },
  {
    icon: HeartHandshake,
    step: '04',
    title: 'We care for them',
    body: 'Your people get telehealth, prescription savings, advocacy, and a real community behind them. You get one point of contact and predictable billing.',
  },
];

const INCLUDED = [
  {
    icon: HeartHandshake,
    title: 'Medical Cost Sharing',
    body: 'The heart of every membership — eligible doctor visits, hospital stays, and surgeries shared by a community of fellow members.',
  },
  {
    icon: Stethoscope,
    title: 'Preventive Care',
    body: 'Annual wellness visits and screenings that help your team stay ahead of problems, built right into membership.',
  },
  {
    icon: Video,
    title: 'Virtual Care',
    body: 'Talk to a licensed provider by phone or video, day or night — keeping your people healthy without the wait or the cost.',
  },
  {
    icon: Pill,
    title: 'Prescription Savings',
    body: 'Meaningful discounts on everyday and specialty medications through our pharmacy savings program.',
  },
  {
    icon: Scale,
    title: 'Medical Advocacy',
    body: 'Our team reviews and negotiates large bills on a member’s behalf, so no one on your team faces the system alone.',
  },
  {
    icon: Gift,
    title: 'A Real Community',
    body: 'Beyond benefits, your team joins a community that shows up for one another — the difference you can feel in “pay it forward.”',
  },
];

const ADMIN_BENEFITS = [
  'Predictable monthly cost with no surprise renewals',
  'Add or remove team members any time — no enrollment window',
  'No provider networks, so your team keeps their own doctors',
  'One dedicated point of contact for you and your people',
  'Simple onboarding, billing, and member support handled for you',
  'A modern benefit that helps you attract and keep great talent',
];

export default function EmployersPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white py-20 md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,rgba(14,140,154,0.12),transparent)]" />
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full bg-pif-teal-50 px-4 py-1.5 ring-1 ring-pif-teal-100">
                <Briefcase className="h-4 w-4 text-pif-teal-600" />
                <span className="text-sm font-semibold text-pif-teal-700">For Companies &amp; Teams</span>
              </div>
              <h1 className="mt-6 font-heading text-[clamp(2.25rem,5.5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                A health benefit your team can{' '}
                <span className="gradient-text">actually afford</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                {BRAND.name} gives businesses a modern, community-driven way to take care
                of their people — without the runaway premiums of traditional group
                coverage. It is not insurance. It is people helping people, at a price
                that finally makes sense.
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-slate-600">
                Lower cost, happier teams, and admin so simple you will wonder why
                benefits were ever this hard.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href="/contact">
                  <Button
                    size="lg"
                    className="w-full gap-2 pif-grad-care font-semibold text-white shadow-lg shadow-pif-teal/25 hover:opacity-95 sm:w-auto"
                  >
                    Talk to our team
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/plans">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-pif-navy-200 bg-white font-semibold text-pif-navy-800 hover:bg-pif-mist sm:w-auto"
                  >
                    Compare programs
                  </Button>
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.teamMeeting} priority aspect="aspect-[4/3]" width={1400} />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Why employers choose sharing */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Why employers choose sharing"
              title="Better for your budget — and your people"
              subtitle="Group health-sharing brings the things companies actually want from a benefit: cost you can plan for, a team that feels looked after, and almost nothing to manage."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {WHY_EMPLOYERS.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-pif-navy-100 bg-white p-8 text-center shadow-sm ring-1 ring-pif-navy/5">
                  <IconChip icon={v.icon} variant="brand" className="mx-auto mb-5" />
                  <h3 className="font-heading text-xl font-semibold text-pif-navy-800">{v.title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works for teams */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="How it works for teams"
              title="From first call to a cared-for team — in four steps"
              subtitle="We do the heavy lifting so your benefits don’t become a second job. Here is how getting your company started looks."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 0.07}>
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

      {/* What's included */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What’s included"
              title="A full circle of care for everyone on your team"
              subtitle="Every membership comes loaded with real, everyday value — the kind of support your people will use and thank you for."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((s, i) => (
              <Reveal key={s.title} delay={(i % 3) * 0.07}>
                <FeatureCard icon={s.icon} title={s.title} href="/services" linkLabel="Explore services">
                  {s.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Simple admin — image + checklist (dark) */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                align="left"
                tone="light"
                eyebrowTone="light"
                eyebrow="Simple to offer"
                title="Built to be easy on whoever runs your benefits"
              />
              <p className="mt-5 text-lg leading-relaxed text-white/80">
                {BRAND.name} is a health care sharing community, not insurance — and that
                means none of the bureaucracy that usually comes with group coverage. We
                keep it light for you and warm for your team.
              </p>
              <CheckList tone="light" className="mt-8" items={ADMIN_BENEFITS} />
            </div>
            <Reveal delay={0.1}>
              <BrandImage
                image={IMAGES.teamCollab}
                aspect="aspect-[4/3]"
                scrim={false}
                className="ring-white/10"
                width={1400}
              />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ROI / savings stat strip */}
      <section className="bg-white py-16 md:py-20">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="The numbers"
              title="Real savings, real community, real results"
              subtitle="When healthcare costs less and works better, everybody wins — your business and the people who power it."
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-12">
            <StatStrip
              tone="light"
              stats={[
                { value: STATS.savings, label: 'Typical savings vs. premiums' },
                { value: STATS.members, label: 'Members & growing' },
                { value: STATS.shared, label: 'Shared by the community' },
                { value: STATS.satisfaction, label: 'Average member rating' },
              ]}
            />
          </Reveal>
        </Container>
      </section>

      {/* Book a consultation emphasis */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <BrandImage image={IMAGES.consultation} aspect="aspect-[4/3]" />
            </Reveal>
            <Reveal delay={0.1}>
              <Eyebrow tone="gold" className="mb-4">
                Let’s talk
              </Eyebrow>
              <h2 className="font-heading text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold leading-[1.12] text-pif-navy-800 text-balance">
                Book a consultation built around{' '}
                <span className="gradient-text">your company</span>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">
                No two teams are the same, so we never start with a one-size-fits-all
                quote. In a short, no-pressure call we will learn about your people and
                your budget, then design a benefit that fits.
              </p>
              <div className="mt-8 space-y-5">
                {[
                  {
                    icon: CalendarCheck,
                    title: 'A 20-minute, no-obligation call',
                    body: 'Pick a time that works. We come prepared and you leave with clear, honest options.',
                  },
                  {
                    icon: Wallet,
                    title: 'A plan that fits your budget',
                    body: 'We tailor program levels and your contribution to what your business can comfortably support.',
                  },
                  {
                    icon: HeartHandshake,
                    title: 'A partner, not a policy',
                    body: 'One dedicated contact who knows your account and your people — for the long haul.',
                  },
                ].map((b, i) => (
                  <div key={b.title} className={i > 0 ? 'flex gap-4 border-t border-pif-navy-100 pt-5' : 'flex gap-4'}>
                    <IconChip icon={b.icon} variant="soft" className="h-11 w-11 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-pif-navy-800">{b.title}</p>
                      <p className="mt-1 text-slate-600">{b.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link href="/contact">
                  <Button
                    size="lg"
                    className="w-full gap-2 pif-grad-care font-semibold text-white shadow-lg shadow-pif-teal/25 hover:opacity-95 sm:w-auto"
                  >
                    Book a consultation
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a
                  href={`tel:${PHONE.tel}`}
                  className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
                >
                  <PhoneCall className="h-4 w-4" />
                  {PHONE.display}
                </a>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Ready to give your team a benefit they’ll love?"
        subtitle="Tell us about your company and we’ll design an affordable, community-driven health benefit that fits your people and your budget."
        primary={{ label: 'Talk to our team', href: '/contact' }}
        secondary={{ label: 'Compare programs', href: '/plans' }}
      />
    </>
  );
}
