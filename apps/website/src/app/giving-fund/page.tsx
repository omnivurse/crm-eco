import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import {
  ArrowUpRight,
  Gift,
  Heart,
  Handshake,
  Plant,
  FileText,
  PaperPlaneTilt,
  ShieldCheck,
  Coins,
  Users,
  Quotes,
  Sparkle,
} from '@phosphor-icons/react/dist/ssr';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  SectionHeading,
  Eyebrow,
  FeatureCard,
  IconChip,
  BrandImage,
  CTABand,
  CheckList,
} from '@/components/sections/blocks';
import { IMAGES } from '@/lib/site-images';
import { BRAND, PORTAL_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Additional Giving Fund | ${BRAND.name}`,
  description:
    'The Additional Giving Fund is a voluntary way our community comes alongside members whose needs fall outside the standard sharing guidelines — like pre-existing conditions in early membership. Learn how to request help or give.',
};

const WHAT_IT_IS = [
  {
    icon: Heart,
    title: 'Generosity, made simple',
    body: 'Some needs do not fit neatly inside the sharing guidelines — yet the people behind them are still our neighbors. The Giving Fund is how the community chooses to help anyway.',
  },
  {
    icon: Handshake,
    title: 'Voluntary, never required',
    body: 'Giving is entirely optional and separate from your monthly share. No one is billed for it, and no one is ever turned away for not contributing.',
  },
  {
    icon: ShieldCheck,
    title: 'Stewarded with care',
    body: 'Every gift is pooled and distributed thoughtfully, with the same transparency and integrity we bring to ordinary sharing requests.',
  },
];

const COVERED_SITUATIONS = [
  'Pre-existing conditions that are not yet eligible for sharing in early membership',
  'Long-term or chronic needs that reach beyond standard sharing limits',
  'Unexpected hardships during a difficult season for a member or their family',
  'Care that falls just outside the published guidelines but still deserves compassion',
];

const REQUEST_STEPS = [
  {
    icon: FileText,
    step: '01',
    title: 'Share your story',
    body: 'Reach out to our member care team and tell us what you are facing. A real person listens — there is no automated wall to get past.',
  },
  {
    icon: Users,
    step: '02',
    title: 'We review together',
    body: 'Our team reviews each request with care and discretion, confirming the need and gathering any documentation that helps tell the full picture.',
  },
  {
    icon: Handshake,
    step: '03',
    title: 'The community responds',
    body: 'When a request is approved, a gift is sent from the fund to help carry the cost — quietly, and with dignity for the member receiving it.',
  },
];

const GIVE_WAYS = [
  {
    icon: Gift,
    title: 'Add a gift any month',
    body: 'From your member portal you can include a one-time gift alongside your regular share whenever you feel led to give a little more.',
  },
  {
    icon: Coins,
    title: 'Give on a recurring basis',
    body: 'Set a small monthly amount to flow into the Giving Fund automatically — a steady act of paying it forward for someone you may never meet.',
  },
  {
    icon: Plant,
    title: 'Give in honor of someone',
    body: 'Mark a milestone, remember a loved one, or celebrate a recovery by making a gift in their name. Every contribution plants something good.',
  },
];

export default function GivingFundPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(244,180,0,0.10),transparent_55%)]" />
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <Eyebrow tone="gold">Additional Giving Fund</Eyebrow>
              <h1 className="mt-5 font-heading text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                When a need falls outside the guidelines, the{' '}
                <span className="gradient-text">community still shows up</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                The Additional Giving Fund is a voluntary pool of generosity. It lets members come
                alongside one another for needs the standard sharing guidelines cannot cover &mdash;
                because being welcoming means no one is left to carry the weight alone.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href={PORTAL_URL}>
                  <Button size="lg" className="w-full gap-2 hub-btn-gradient font-semibold text-white shadow-lg sm:w-auto">
                    Give to the fund
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-pif-navy/15 bg-white font-semibold text-pif-navy-800 hover:bg-pif-mist sm:w-auto"
                  >
                    Request support
                  </Button>
                </Link>
              </div>
              <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <Sparkle className="h-4 w-4 text-pif-gold-500" aria-hidden="true" />
                Giving is always voluntary and separate from your monthly share.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.community} width={1200} priority aspect="aspect-[4/3]" />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* What the Giving Fund is */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What it is"
              title="A way to give beyond the guidelines"
              subtitle="Health-sharing works because of clear, fair guidelines that keep monthly shares affordable for everyone. The Giving Fund is how our community chooses to go a step further — together — for needs those guidelines were never meant to reach."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {WHAT_IT_IS.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-pif-navy-100 bg-white p-8 text-center shadow-sm ring-1 ring-pif-navy/5">
                  <IconChip icon={item.icon} variant="gold" className="mx-auto mb-5" />
                  <h3 className="font-heading text-xl font-semibold text-pif-navy-800">{item.title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-12 max-w-2xl text-center text-sm leading-relaxed text-slate-500">
              The Giving Fund is voluntary mutual aid, not insurance and not a guarantee of payment.
              It is a reflection of a simple belief: that we are stronger when we carry one
              another&apos;s burdens.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Who it comes alongside — image + list */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 md:order-1">
              <BrandImage image={IMAGES.parentChild} aspect="aspect-[4/3]" />
            </Reveal>
            <Reveal className="order-1 md:order-2" delay={0.1}>
              <SectionHeading
                align="left"
                eyebrow="Who it helps"
                title="For the needs that the rules can’t quite hold"
                subtitle="No set of guidelines can anticipate every life. The Giving Fund exists for the moments that fall in the gaps — so a member facing a hard season is met with help, not a closed door."
              />
              <CheckList className="mt-8" items={COVERED_SITUATIONS} />
              <p className="mt-8 text-slate-600">
                Not sure whether your situation fits? Reach out anyway. We would rather talk it
                through with you than have you assume the answer is no.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* How members can request support */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Requesting support"
              title="How to ask for help"
              subtitle="If you are a member facing a need that the guidelines cannot cover, here is the simple, human path to requesting help from the Giving Fund."
            />
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-5xl gap-8 md:grid-cols-3">
            {REQUEST_STEPS.map((s, i) => (
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
          <Reveal delay={0.1}>
            <div className="mt-12 text-center">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
              >
                <PaperPlaneTilt className="h-4 w-4" aria-hidden="true" />
                Start a Giving Fund request
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* How members can contribute / give */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Ways to give"
              title="Pay it forward to a neighbor in need"
              subtitle="Every gift, large or small, is pooled and passed on to members the guidelines cannot reach. Here are a few ways our community chooses to give."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {GIVE_WAYS.map((g, i) => (
              <Reveal key={g.title} delay={(i % 3) * 0.07}>
                <FeatureCard
                  icon={g.icon}
                  title={g.title}
                  href={PORTAL_URL}
                  linkLabel="Give from your portal"
                  iconVariant="brand"
                >
                  {g.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Warm story / quote — dark */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.10),transparent_70%)]" />
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <Eyebrow tone="gold">A member story</Eyebrow>
              <Quotes className="mt-6 h-10 w-10 text-pif-gold-300" aria-hidden="true" />
              <blockquote className="mt-5 font-heading text-2xl font-medium leading-snug text-white text-balance md:text-3xl">
                &ldquo;My daughter&apos;s condition started before we joined, so it wasn&apos;t
                eligible for sharing yet. I braced myself to face it alone. Instead, the Giving Fund
                stepped in &mdash; people I&apos;ll never meet helped carry us. That is the moment I
                understood what &lsquo;pay it forward&rsquo; really means.&rdquo;
              </blockquote>
              <figcaption className="mt-8 border-t border-white/15 pt-6">
                <p className="font-semibold text-white">Rachel T.</p>
                <p className="text-sm text-white/70">Family program member &amp; Giving Fund recipient</p>
              </figcaption>
            </Reveal>
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

      {/* Reassurance band */}
      <section className="hub-section-muted py-16 md:py-20">
        <Container>
          <Reveal>
            <div className="mx-auto max-w-3xl rounded-3xl border border-pif-navy-100 bg-white p-8 text-center shadow-sm ring-1 ring-pif-navy/5 md:p-10">
              <IconChip icon={Gift} variant="gold" className="mx-auto mb-5" />
              <h3 className="font-heading text-2xl font-semibold text-pif-navy-800">
                Generosity is the whole point
              </h3>
              <p className="mt-4 leading-relaxed text-slate-600">
                You can join {BRAND.name} at any time, keep the doctors you trust, and become part
                of a community that welcomes everyone. The Giving Fund is simply that welcome,
                extended a little further &mdash; voluntarily, and with open hands.
              </p>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Be the reason a neighbor isn’t alone"
        subtitle="Give to the Additional Giving Fund, or reach out if you need help. Either way, you are part of a community that pays it forward."
        primary={{ label: 'Give to the fund', href: PORTAL_URL }}
        secondary={{ label: 'Request support', href: '/contact' }}
      />
    </>
  );
}
