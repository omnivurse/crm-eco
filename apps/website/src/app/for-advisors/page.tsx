import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import {
  ArrowRight,
  CircleDollarSign,
  CalendarClock,
  Headphones,
  ClipboardCheck,
  GraduationCap,
  Rocket,
  Megaphone,
  LayoutDashboard,
  BadgePercent,
  HeartHandshake,
  Quote,
  Star,
} from 'lucide-react';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  Eyebrow,
  SectionHeading,
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
  title: 'For Advisors',
  description:
    'Offer your clients an affordable, year-round alternative to insurance. Partner with Pay It Forward Health for competitive compensation, real marketing support, and a back office that has your back.',
};

const WHY_PARTNER = [
  {
    icon: HeartHandshake,
    title: 'A product clients actually love',
    body: 'Health care sharing is affordable, transparent, and welcoming to everyone — no networks, no health questionnaire to get a quote. It is an easy story to tell and a relationship that keeps families coming back.',
  },
  {
    icon: CalendarClock,
    title: 'Sell all year long',
    body: 'There is no open-enrollment window. Households can join whenever life changes, so you are never waiting on a calendar to grow your book or help someone who needs coverage today.',
  },
  {
    icon: Headphones,
    title: 'Real people behind you',
    body: 'A dedicated partner team answers your questions, helps with enrollment, and supports your members after the sale — so you can focus on relationships, not paperwork.',
  },
];

const STEPS = [
  {
    icon: ClipboardCheck,
    step: '01',
    title: 'Apply to partner',
    body: 'Tell us about your practice and the families you serve. We review applications quickly and reach out within a couple of business days.',
  },
  {
    icon: GraduationCap,
    step: '02',
    title: 'Get up to speed',
    body: 'Complete a short onboarding on how sharing works, who it is right for, and how to enroll a member. You will be confident and compliant before your first conversation.',
  },
  {
    icon: Rocket,
    step: '03',
    title: 'Start helping families',
    body: 'Enroll households year-round through your advisor tools, track your members and earnings in one place, and lean on our team whenever you need a hand.',
  },
];

const WHAT_YOU_GET = [
  {
    icon: BadgePercent,
    title: 'Competitive compensation',
    body: 'Earn fair, transparent commissions on every household you enroll, with a structure that rewards consistency and growth. You always know what you have earned.',
  },
  {
    icon: Megaphone,
    title: 'Marketing that helps you sell',
    body: 'Co-branded materials, plain-language explainers, social assets, and talking points — everything you need to introduce sharing clearly and confidently.',
  },
  {
    icon: LayoutDashboard,
    title: 'A real back office',
    body: 'A dedicated advisor portal to enroll members, manage your book, and see your commissions — backed by a support team that handles the heavy lifting.',
  },
];

const REASSURANCE = [
  'A genuinely affordable option families can say yes to',
  'No provider networks and no referrals — members keep their own doctors',
  'Year-round enrollment, so you are never blocked by a calendar',
  'Welcoming to people of every background and belief',
  'A partner team that supports your members long after the sale',
];

const TESTIMONIALS = [
  {
    quote:
      'Adding sharing to what I offer changed my practice. Families finally have an affordable option, and the partner team makes enrollment painless.',
    name: 'Jennifer R.',
    role: 'Independent advisor, Texas',
  },
  {
    quote:
      'The marketing materials are clear and honest, so my clients understand exactly what they are joining. I was helping families within my first week.',
    name: 'Marcus T.',
    role: 'Health benefits consultant, Florida',
  },
  {
    quote:
      'Year-round enrollment means I am never waiting on a season to grow. The advisor portal keeps my book and my commissions in one easy place.',
    name: 'Sarah L.',
    role: 'Family benefits specialist, Ohio',
  },
];

export default function ForAdvisorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="hub-inner-page-hero">
        <Container className="py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <Eyebrow className="mb-4">Advisor Partnership Program</Eyebrow>
              <h1 className="font-heading text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                Offer families a healthier{' '}
                <span className="gradient-text">alternative</span> to insurance
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                Partner with {BRAND.name} to give your clients an affordable,
                transparent way to handle medical costs — and grow a practice
                built on trust. It is health care sharing, not insurance, and
                it is a relationship families keep.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href="/enroll">
                  <Button
                    size="lg"
                    className="w-full gap-2 pif-grad-care font-semibold text-white shadow-lg shadow-pif-teal/25 hover:opacity-95 sm:w-auto"
                  >
                    Become an Advisor
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full gap-2 border-pif-navy-200 font-semibold text-pif-navy-800 hover:bg-pif-mist sm:w-auto"
                  >
                    Talk to our team
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-sm text-slate-500">
                Year-round enrollment. No networks. Welcoming to everyone.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.teamMeeting} aspect="aspect-[4/3]" priority />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Why partner with PIFH */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Why partner with us"
              title="An easy yes for your clients — and your business"
              subtitle="Sharing gives families real savings and gives you a product you can stand behind, all year round."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {WHY_PARTNER.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-pif-navy-100 bg-white p-8 shadow-sm ring-1 ring-pif-navy/5">
                  <IconChip icon={item.icon} variant="brand" className="mb-5" />
                  <h3 className="font-heading text-xl font-semibold text-pif-navy-800">
                    {item.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works for advisors */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="From application to your first enrollment in three steps"
              subtitle="We keep onboarding simple so you can start helping families quickly and with confidence."
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
                  <h3 className="font-heading text-xl font-semibold text-pif-navy-800">
                    {s.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/enroll"
              className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
            >
              Start your advisor application
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </section>

      {/* What you get */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What you get"
              title="Everything you need to grow a thriving practice"
              subtitle="Fair compensation, marketing that does the explaining for you, and a back office that handles the rest."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {WHAT_YOU_GET.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <FeatureCard
                  icon={item.icon}
                  title={item.title}
                  iconVariant={i === 0 ? 'gold' : 'soft'}
                >
                  {item.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Reassurance — dark split with image */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                align="left"
                tone="light"
                eyebrowTone="light"
                eyebrow="What you can promise"
                title="A simple, honest offer families can trust"
              />
              <p className="mt-5 text-lg leading-relaxed text-white/80">
                {BRAND.name} is a health care sharing community — not insurance.
                Members voluntarily share one another&apos;s eligible medical
                costs, which keeps it affordable and human. That is a story your
                clients will thank you for telling.
              </p>
              <CheckList tone="light" className="mt-8" items={REASSURANCE} />
            </div>
            <Reveal delay={0.1}>
              <BrandImage
                image={IMAGES.consultation}
                aspect="aspect-[4/3]"
                scrim={false}
                className="ring-white/10"
              />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Credibility / stats strip */}
      <section className="bg-white py-16 md:py-24">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="A community worth representing"
              title="Numbers your clients can stand behind"
              subtitle="When you introduce families to sharing, you are introducing them to a community that consistently shows up."
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-12">
            <StatStrip
              tone="light"
              stats={[
                { value: STATS.members, label: 'Members & growing' },
                { value: STATS.shared, label: 'Shared by the community' },
                { value: STATS.satisfaction, label: 'Average member rating' },
                { value: STATS.savings, label: 'Typical savings vs. insurance' },
              ]}
            />
          </Reveal>
        </Container>
      </section>

      {/* Advisor testimonials */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="From our advisors"
              title="Trusted by the people who recommend us"
              subtitle="Hear from advisors who have built lasting client relationships with sharing."
            />
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.08}>
                <figure className="flex h-full flex-col rounded-2xl border border-pif-navy-100 bg-white p-7 shadow-sm ring-1 ring-pif-navy/5">
                  <div className="mb-4 flex items-center gap-1 text-pif-gold-400">
                    {Array.from({ length: 5 }).map((_, n) => (
                      <Star key={n} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <Quote className="mb-3 h-7 w-7 text-pif-teal-200" />
                  <blockquote className="flex-1 leading-relaxed text-slate-700">
                    {t.quote}
                  </blockquote>
                  <figcaption className="mt-6 border-t border-pif-navy-100 pt-5">
                    <p className="font-semibold text-pif-navy-800">{t.name}</p>
                    <p className="text-sm text-slate-500">{t.role}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Earnings reassurance band */}
      <section className="bg-white py-16 md:py-24">
        <Container>
          <Reveal>
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-3xl border border-pif-gold-100 bg-pif-gold-50/60 p-10 text-center ring-1 ring-pif-gold-100">
              <IconChip icon={CircleDollarSign} variant="gold" />
              <h3 className="font-heading text-2xl font-semibold text-pif-navy-800">
                Earn while you help families pay it forward
              </h3>
              <p className="max-w-2xl leading-relaxed text-slate-600">
                Transparent commissions, no enrollment season to wait on, and a
                team that supports you and your members every step of the way.
                Doing right by your clients and building your business are the
                same thing here.
              </p>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Ready to offer your clients something better?"
        subtitle="Join our network of advisors and help families find affordable, transparent health care sharing — all year round."
        primary={{ label: 'Become an Advisor', href: '/enroll' }}
        secondary={{ label: 'Talk to our team', href: '/contact' }}
      />
    </>
  );
}
