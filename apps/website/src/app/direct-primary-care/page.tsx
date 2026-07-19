import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import {
  ArrowUpRight,
  Stethoscope,
  CalendarBlank,
  ChatCircle,
  Wallet,
  Clock,
  Handshake,
  ShieldCheck,
  Pill,
  Microscope,
  UserPlus,
  MagnifyingGlass,
  PhoneCall,
  Stack,
} from '@phosphor-icons/react/dist/ssr';
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
  title: 'Direct Primary Care | Pay It Forward Health',
  description:
    'Direct Primary Care (DPC) is a flat monthly membership with your own primary-care doctor — unlimited visits, same-day access, and no copays. Pair it with health care sharing for everyday care plus protection from the big stuff. Not insurance.',
};

const WHAT_IS_DPC = [
  {
    icon: Wallet,
    title: 'One flat monthly fee',
    body: 'You pay your doctor a simple, predictable membership fee each month. No copays, no per-visit charges, and no surprise bills for the everyday care you already use.',
  },
  {
    icon: CalendarBlank,
    title: 'Same-day, unhurried visits',
    body: 'DPC doctors keep small patient panels, so you get same- or next-day appointments and real time to talk — not a rushed seven minutes and a referral.',
  },
  {
    icon: ChatCircle,
    title: 'Your doctor on call',
    body: 'Text, call, or video your physician directly between visits. Many small questions get answered in minutes, without ever leaving home.',
  },
];

const BENEFITS = [
  {
    icon: Stethoscope,
    title: 'Unlimited primary care',
    body: 'Annual physicals, sick visits, chronic-condition management, and ongoing check-ins — all included in your membership, as often as you need them.',
  },
  {
    icon: Clock,
    title: 'Same-day access',
    body: 'When something comes up, you are seen quickly. Shorter waits mean problems get caught early, before they become bigger and costlier.',
  },
  {
    icon: Microscope,
    title: 'Wholesale labs & imaging',
    body: 'DPC practices often pass through deeply discounted, transparent prices on common lab work and basic imaging — sometimes a fraction of retail.',
  },
  {
    icon: Pill,
    title: 'Lower-cost medications',
    body: 'Many doctors dispense common prescriptions at near-cost or point you to the lowest price, so routine refills stay affordable.',
  },
  {
    icon: Handshake,
    title: 'A real relationship',
    body: 'You see the same physician who knows your history, your family, and your goals — care that feels personal again, the way it should.',
  },
  {
    icon: Wallet,
    title: 'Predictable everyday costs',
    body: 'A flat fee for primary care means no guessing at copays or deductibles for the visits you make most. You always know what you will pay.',
  },
];

const PAIRING_NOTE = [
  'DPC covers the everyday: visits, check-ins, and ongoing care',
  'Sharing covers the unexpected: surgeries, hospital stays, and big events',
  'Together they replace the high premiums of traditional insurance',
  'No networks and no referrals — keep the doctor you choose',
  'Join any time of year, with no open-enrollment window to wait for',
];

const FIND_STEPS = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Become a member',
    body: 'Choose the sharing program that fits your household and enroll online in minutes. There is no health questionnaire to get a quote and no season to wait for.',
  },
  {
    icon: MagnifyingGlass,
    step: '02',
    title: 'Find a DPC doctor near you',
    body: 'Tell us where you live and what you need. Our team helps you locate a trusted Direct Primary Care practice in your area — or confirm one you already love.',
  },
  {
    icon: PhoneCall,
    step: '03',
    title: 'Enroll with your physician',
    body: 'Sign up directly with the DPC practice and start your flat monthly membership. Your sharing membership stays right alongside it for the bigger needs.',
  },
];

export default function DirectPrimaryCarePage() {
  return (
    <>
      {/* Hero — split */}
      <section className="hub-inner-page-hero">
        <Container className="py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <Eyebrow className="mb-4">Direct Primary Care</Eyebrow>
              <h1 className="font-heading text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                Your own doctor, for one flat{' '}
                <span className="gradient-text">monthly fee</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                Direct Primary Care (DPC) is a simple membership with a primary-care
                physician who knows you by name — unlimited visits, same-day access, and
                no copays. Pair it with {BRAND.name} sharing and you have everyday care
                plus protection from the big stuff, all without insurance.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href="/enroll">
                  <Button
                    size="lg"
                    className="w-full gap-2 pif-grad-care font-semibold text-white shadow-lg shadow-pif-teal/25 hover:opacity-95 sm:w-auto"
                  >
                    Become a Member
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full gap-2 border-pif-navy-200 font-semibold text-pif-navy-800 hover:bg-pif-mist sm:w-auto"
                  >
                    Find a DPC doctor
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-sm text-slate-500">
                No copays. Same-day visits. Welcoming to everyone.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.heroDoctorPatient} aspect="aspect-[4/3]" priority />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* What is DPC */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What is Direct Primary Care?"
              title="Healthcare without the middleman"
              subtitle="DPC removes insurance from your everyday care. You pay your doctor directly through a flat monthly membership — and in return, you get more time, more access, and a real relationship."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {WHAT_IS_DPC.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-pif-navy-100 bg-white p-8 text-center shadow-sm ring-1 ring-pif-navy/5">
                  <IconChip icon={item.icon} variant="brand" className="mx-auto mb-5" />
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

      {/* Benefits grid */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Why members love it"
              title="More care, more access, fewer surprises"
              subtitle="A DPC membership turns primary care into something simple and personal again — and it pairs beautifully with sharing."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={(i % 3) * 0.07}>
                <FeatureCard icon={b.icon} title={b.title} iconVariant={i === 0 ? 'brand' : 'soft'}>
                  {b.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* How DPC + sharing work together — two-card explainer */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="A perfect pair"
              title="DPC for the everyday, sharing for the big stuff"
              subtitle="Think of it as two layers of care that fit together. One handles the routine; the other is there when life takes a turn — and together they cost far less than traditional insurance."
            />
          </Reveal>

          <div className="mx-auto mt-14 grid max-w-5xl items-stretch gap-6 md:grid-cols-2">
            <Reveal>
              <div className="flex h-full flex-col rounded-3xl border border-pif-navy-100 bg-pif-mist p-8 shadow-sm ring-1 ring-pif-navy/5 md:p-10">
                <IconChip icon={Stethoscope} variant="brand" className="mb-6" />
                <h3 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  Direct Primary Care
                </h3>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-pif-teal-700">
                  The everyday layer
                </p>
                <p className="mt-4 leading-relaxed text-slate-600">
                  Your flat monthly membership covers the care you use most — check-ups,
                  sick visits, chronic-condition management, and quick questions between
                  appointments.
                </p>
                <CheckList
                  className="mt-7"
                  items={[
                    'Unlimited primary-care visits',
                    'Same-day and virtual access',
                    'Discounted labs, imaging & medications',
                  ]}
                />
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="flex h-full flex-col rounded-3xl border border-pif-green-100 bg-pif-green-50/50 p-8 shadow-sm ring-1 ring-pif-green-100 md:p-10">
                <IconChip icon={Handshake} variant="gold" className="mb-6" />
                <h3 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  {BRAND.shortName} Sharing
                </h3>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-pif-green-700">
                  The big-stuff layer
                </p>
                <p className="mt-4 leading-relaxed text-slate-600">
                  When something major happens, your community is there. Eligible
                  surgeries, hospital stays, and emergencies are shared by fellow members
                  — so a serious event never becomes a financial one.
                </p>
                <CheckList
                  className="mt-7"
                  items={[
                    'Eligible hospital stays & surgeries shared',
                    'Advocates who negotiate large bills',
                    'A community that shows up when it matters',
                  ]}
                />
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
              {BRAND.name} is not an insurance company and the program is not insurance.
              It is a voluntary community of members sharing one another&apos;s eligible
              medical costs. DPC memberships are arranged directly with independent
              physicians.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* The combined value — dark split */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                align="left"
                tone="light"
                eyebrowTone="light"
                eyebrow="Two layers, one peace of mind"
                title="A complete picture of care, without insurance"
              />
              <p className="mt-5 text-lg leading-relaxed text-white/80">
                On their own, DPC and sharing each do something well. Together, they cover
                nearly everything a healthy household needs — the routine and the
                rare — for a fraction of what insurance asks every month.
              </p>
              <CheckList tone="light" className="mt-8" items={PAIRING_NOTE} />
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

      {/* How to find / add DPC — steps */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Getting started"
              title="How to add Direct Primary Care to your membership"
              subtitle="Pairing a DPC doctor with your sharing membership is simple — and our team is here to help you find the right practice."
            />
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-5xl gap-8 md:grid-cols-3">
            {FIND_STEPS.map((s, i) => (
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
              href="/contact"
              className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
            >
              Ask us to help find a DPC doctor near you
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </section>

      {/* Reassurance band */}
      <section className="hub-section-muted py-16 md:py-24">
        <Container>
          <Reveal>
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-3xl border border-pif-navy-100 bg-white p-10 text-center shadow-sm ring-1 ring-pif-navy/5 md:p-14">
              <IconChip icon={ShieldCheck} variant="gold" />
              <h2 className="font-heading text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-tight text-pif-navy-800 text-balance">
                No networks. No referrals. No open enrollment.
              </h2>
              <p className="mt-2 max-w-xl text-lg leading-relaxed text-slate-600">
                Keep the doctor you choose, get same-day care when you need it, and join
                whenever life calls for it. DPC and sharing put you — not an insurer — at
                the center of your care.
              </p>
              <Link
                href="/how-it-works"
                className="mt-4 inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
              >
                See how sharing works
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Image + everyday-care emphasis */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 md:order-1">
              <BrandImage image={IMAGES.clinicianSmiling} aspect="aspect-[4/3]" />
            </Reveal>
            <Reveal className="order-1 md:order-2" delay={0.1}>
              <SectionHeading
                align="left"
                eyebrow="Care that knows you"
                title="A doctor in your corner, every day"
                subtitle="With DPC, your physician has the time and the relationship to truly care for you — and your sharing community has your back for the moments that matter most."
              />
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-pif-navy-100 bg-pif-mist p-5 ring-1 ring-pif-navy/5">
                <IconChip icon={Stack} variant="brand" />
                <p className="text-slate-700">
                  Everyday care from your DPC doctor, big-event protection from your
                  community — one simple, affordable approach to staying well.
                </p>
              </div>
            </Reveal>
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
                { value: STATS.savings, label: 'Typical savings vs. insurance' },
              ]}
            />
          </Reveal>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Everyday care plus peace of mind — without insurance"
        subtitle="Become a member, pair it with a Direct Primary Care doctor, and enjoy unlimited visits and same-day access while your community has you covered for the big stuff."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'Talk to our team', href: '/contact' }}
      />
    </>
  );
}
