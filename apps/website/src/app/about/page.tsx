import type { Metadata } from 'next';
import {
  Heart,
  HeartHandshake,
  Users,
  ShieldCheck,
  Leaf,
  Sparkles,
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
  title: `About ${BRAND.name} | Our Mission & Community`,
  description:
    'Pay It Forward Health is a community health-sharing organization — an affordable alternative to insurance where neighbors help carry one another’s medical costs. Meet our mission, values, and the people we welcome.',
};

const CORE_VALUES = [
  {
    icon: Heart,
    title: 'Compassion',
    body: 'Every shared need is someone’s real, often frightening, moment. We meet members with warmth and dignity, never a form letter or a runaround.',
  },
  {
    icon: ShieldCheck,
    title: 'Stewardship',
    body: 'Your monthly share is a sacred trust. We keep costs lean, negotiate hard on big bills, and treat every dollar as if it were our own family’s.',
  },
  {
    icon: Users,
    title: 'Community',
    body: 'Healthcare works best when neighbors look out for neighbors. Our members form a genuine network of support — not a faceless policyholder pool.',
  },
  {
    icon: Leaf,
    title: 'Transparency',
    body: 'No hidden fees, no surprise bills, no fine print designed to trip you up. We show exactly where shares go and how needs are met.',
  },
];

const BELIEFS = [
  'We are a health care sharing community — not insurance.',
  'You are welcome here regardless of background, belief, or income.',
  'Keep the doctors you trust — there are no networks and no referrals.',
  'Join any time of year — there is no open-enrollment window.',
  'Pre-existing conditions are reviewed fairly, with a path to sharing.',
  'Real people answer the phone and advocate for you on big bills.',
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white py-20 md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,rgba(14,140,154,0.12),transparent)]" />
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full bg-pif-teal-50 px-4 py-1.5 ring-1 ring-pif-teal-100">
                <Sparkles className="h-4 w-4 text-pif-teal-600" />
                <span className="text-sm font-semibold text-pif-teal-700">Our Mission</span>
              </div>
              <h1 className="mt-6 font-heading text-[clamp(2.25rem,5.5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                A community where we{' '}
                <span className="gradient-text">carry one another</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                {BRAND.name} exists for one reason: healthcare should be affordable,
                honest, and rooted in people helping people. We bring families together
                to share medical costs — and to remind each other that no one should
                face a health crisis alone.
              </p>
              <p className="mt-4 max-w-xl leading-relaxed text-slate-600">
                We are a health care sharing community, not an insurance company. That
                difference is the whole point — and the heart of how we keep care within
                reach for thousands of households.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.familyTogether} priority aspect="aspect-[4/3]" />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Origin / "pay it forward" story */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 lg:order-1">
              <BrandImage image={IMAGES.community} aspect="aspect-[4/3]" />
            </Reveal>
            <Reveal className="order-1 lg:order-2" delay={0.1}>
              <SectionHeading
                align="left"
                eyebrow="Why we exist"
                eyebrowTone="gold"
                title="The simple idea behind paying it forward"
              />
              <div className="mt-6 space-y-5 text-lg leading-relaxed text-slate-600">
                <p>
                  It started with a question families kept asking: why is good care so
                  expensive, and why does it feel like you&apos;re on your own when you
                  need it most? We believed there had to be a kinder, more affordable way.
                </p>
                <p>
                  So we built one around an old idea. In a sharing community, the members
                  who are well help carry the costs of the members who are sick. When your
                  season of need passes — and it will — you&apos;re there to help carry the
                  next family through theirs. The gift keeps moving forward.
                </p>
                <p>
                  That&apos;s &quot;pay it forward&quot; in practice: generosity given today
                  becomes the support you can count on tomorrow. It&apos;s not charity and
                  it&apos;s not a policy. It&apos;s a community that shows up for each other,
                  month after month.
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Core values */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What guides us"
              title="The values at the heart of our community"
              subtitle="Four commitments shape every decision we make — from how we answer the phone to how we steward your share."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CORE_VALUES.map((value, i) => (
              <Reveal key={value.title} delay={(i % 4) * 0.07}>
                <FeatureCard icon={value.icon} title={value.title} iconVariant="brand">
                  {value.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* What we believe / who we welcome — dark */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                align="left"
                tone="light"
                eyebrowTone="light"
                eyebrow="What we believe"
                title="Open to all, built for real life"
              />
              <p className="mt-5 text-lg leading-relaxed text-white/80">
                We welcome people of every background, belief, and walk of life. There&apos;s
                no membership test of faith and no health questionnaire just to get a quote —
                only a community committed to caring for one another.
              </p>
              <CheckList tone="light" className="mt-8" items={BELIEFS} />
            </div>
            <Reveal delay={0.1}>
              <BrandImage
                image={IMAGES.happyPeople}
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
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <Eyebrow tone="gold" className="mb-4">A growing movement</Eyebrow>
              <h2 className="font-heading text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold leading-[1.12] text-pif-navy-800 text-balance">
                Generosity adds up
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
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

      {/* Image-rich community section */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Our community"
              title="People helping people — in every season of life"
              subtitle="Behind every shared need is a real family, a real clinician, and a real moment of care. This is what paying it forward looks like."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Reveal className="sm:col-span-2 lg:col-span-2">
              <BrandImage image={IMAGES.familyOutdoor} aspect="aspect-[16/10]" width={1400} />
            </Reveal>
            <Reveal delay={0.08}>
              <BrandImage image={IMAGES.clinicianSmiling} aspect="aspect-[16/10]" />
            </Reveal>
            <Reveal delay={0.04}>
              <BrandImage image={IMAGES.parentChild} aspect="aspect-[16/10]" />
            </Reveal>
            <Reveal className="sm:col-span-2 lg:col-span-2" delay={0.08}>
              <BrandImage image={IMAGES.teamMeeting} aspect="aspect-[16/10]" width={1400} />
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="mx-auto mt-12 flex max-w-2xl items-center gap-4 rounded-2xl border border-pif-navy-100 bg-white p-6 shadow-sm ring-1 ring-pif-navy/5">
              <IconChip icon={HeartHandshake} variant="gold" />
              <p className="leading-relaxed text-slate-700">
                When a member is hurting, the whole community leans in. That&apos;s the
                promise we make to each other — and the one we&apos;d love for you to be
                part of.
              </p>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Join a community that pays it forward"
        subtitle="Become part of a movement where the healthy help carry the sick — and where your generosity comes back around when you need it most."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'See How Sharing Works', href: '/how-it-works' }}
      />
    </>
  );
}
