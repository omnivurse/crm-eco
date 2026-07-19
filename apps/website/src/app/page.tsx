import Link from 'next/link';
import {
  ArrowUpRight, Heart, Globe, CalendarBlank, UserPlus, PiggyBank, Lifebuoy,
  Stethoscope, Pill, VideoCamera, Scales, Gift, Handshake, Star, Quotes,
} from '@phosphor-icons/react/dist/ssr';
import { HeroSection } from '@/components/HeroSection';
import { HomePlanCards } from '@/components/HomePlanCards';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container, SectionHeading, FeatureCard, IconChip, StatStrip, BrandImage,
  CTABand, CheckList,
} from '@/components/sections/blocks';
import { IMAGES } from '@/lib/site-images';
import { STATS } from '@/lib/site';

const VALUE_PROPS = [
  { icon: Heart, title: 'Welcoming', body: 'Open to people of every background and belief. There is no religious requirement and no health questionnaire to get a quote.' },
  { icon: Globe, title: 'Flexible', body: 'Keep the doctors and hospitals you already trust. There are no provider networks and no referrals to chase.' },
  { icon: CalendarBlank, title: 'Accessible', body: 'No open-enrollment window. Join whenever life calls for it, and your sharing begins the first of the following month.' },
];

const STEPS = [
  { icon: UserPlus, step: '01', title: 'Become a member', body: 'Pick the program that fits your household and enroll online in minutes. No agents, no pressure.' },
  { icon: PiggyBank, step: '02', title: 'Share each month', body: 'Your affordable monthly share goes into a community that supports one another — a fraction of typical premiums.' },
  { icon: Lifebuoy, step: '03', title: 'Get support when you need it', body: 'When a medical need arises, submit a sharing request. Eligible needs are shared by the community, often within days.' },
];

const SERVICES = [
  { icon: Handshake, title: 'Medical Cost Sharing', body: 'The heart of your membership — eligible doctor visits, hospital stays, surgeries and more, shared by the community.' },
  { icon: Stethoscope, title: 'Preventive Care', body: 'Annual wellness visits and screenings that help you stay ahead of problems, included in your membership.' },
  { icon: Pill, title: 'Prescription Savings', body: 'Meaningful discounts on everyday and specialty medications through our pharmacy savings program.' },
  { icon: VideoCamera, title: 'Virtual Care', body: 'Talk to a licensed provider by phone or video, day or night, usually at no additional cost.' },
  { icon: Scales, title: 'Medical Advocacy', body: 'Our team reviews and negotiates large bills on your behalf, so you are never facing the system alone.' },
  { icon: Gift, title: 'Giving Fund', body: 'A way for our community to come alongside members with needs that fall outside the guidelines.' },
];

const TESTIMONIALS = [
  { quote: 'Switching to Pay It Forward Health was the best decision for our family. We save over $400 a month, and it actually feels like a community.', name: 'Sarah Mitchell', role: 'Family member since 2023' },
  { quote: 'When my son needed surgery, the community came through. The process was clear and our need was shared quickly. I could not be more grateful.', name: 'David Kim', role: 'Family program member' },
  { quote: 'As a self-employed designer, traditional insurance was out of reach. This gives me real peace of mind at a price I can finally afford.', name: 'Maria Lopez', role: 'Individual program member' },
];

export default function HomePage() {
  return (
    <>
      <HeroSection />

      {/* Value props */}
      <section className="bg-white py-24 md:py-32">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Why members choose us"
              title="Healthcare that feels human again"
              subtitle="Three things make sharing different from insurance — and they all come back to people helping people."
            />
          </Reveal>
          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {VALUE_PROPS.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.08}>
                <div className="pif-bezel h-full">
                  <div className="pif-bezel-inner flex h-full flex-col p-8 text-center">
                    <IconChip icon={v.icon} variant="brand" className="mx-auto mb-5" />
                    <h3 className="font-heading text-xl font-medium text-pif-navy-800">{v.title}</h3>
                    <p className="mt-3 leading-relaxed text-slate-600">{v.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="hub-section-muted py-24 md:py-32">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="How It Works"
              title="A smarter, simpler way to handle medical costs"
              subtitle="No deductibles to satisfy, no networks to navigate. Just a transparent, three-step rhythm of community care."
            />
          </Reveal>
          <div className="mx-auto mt-16 grid max-w-5xl gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 0.08}>
                <div className="pif-bezel relative h-full">
                  <div className="pif-bezel-inner relative h-full p-7">
                    <span className="absolute right-6 top-5 font-heading text-5xl font-medium text-pif-navy-50">{s.step}</span>
                    <IconChip icon={s.icon} variant="soft" className="mb-5" />
                    <h3 className="font-heading text-xl font-medium text-pif-navy-800">{s.title}</h3>
                    <p className="mt-3 leading-relaxed text-slate-600">{s.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/how-it-works" className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:gap-3 hover:text-pif-green-600">
              See exactly how sharing works
              <ArrowUpRight weight="light" className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </section>

      {/* Plans (live data) */}
      <HomePlanCards />

      {/* Results + image */}
      <section className="bg-white py-24 md:py-32">
        <Container>
          <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 md:order-1">
              <BrandImage image={IMAGES.familyTogether} aspect="aspect-[4/3]" tilt="left" />
            </Reveal>
            <Reveal className="order-1 md:order-2" delay={0.1}>
              <SectionHeading
                align="left"
                eyebrow="Real results for real families"
                title="More care, less cost, no surprises"
                subtitle="Members keep more of their money and still get the care they need — backed by a community that shows up."
              />
              <div className="mt-8 space-y-7">
                {[
                  { stat: STATS.savings, label: 'Average savings vs. insurance', body: 'Most members pay far less each month than they would for a comparable insurance premium.' },
                  { stat: '48 hours', label: 'Typical processing time', body: 'Most eligible sharing requests are reviewed within two business days — you are never left waiting.' },
                  { stat: '98%', label: 'Eligible needs shared', body: 'When a need meets the guidelines, the community comes through — consistently.' },
                ].map((r, i) => (
                  <div key={r.label} className={i > 0 ? 'border-t border-pif-navy-100 pt-7' : ''}>
                    <p className="gradient-text font-heading text-3xl font-bold">{r.stat}</p>
                    <p className="mt-1 font-semibold text-pif-navy-800">{r.label}</p>
                    <p className="mt-1 text-slate-600">{r.body}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Services / features */}
      <section className="hub-section-muted py-24 md:py-32">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Everything included"
              title="A whole community of support, in one membership"
              subtitle="Your membership is more than cost sharing — it is a full circle of care that surrounds you and your family."
            />
          </Reveal>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={(i % 3) * 0.07}>
                <FeatureCard icon={s.icon} title={s.title} href="/services" linkLabel="Explore services">
                  {s.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-24 md:py-32">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Member stories"
              title="Trusted by thousands of families"
              subtitle="Real members, real needs met. This is what community care looks like."
            />
          </Reveal>
          <div className="mx-auto mt-16 grid max-w-6xl gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.08}>
                <div className={`pif-bezel h-full ${i === 1 ? 'md:-translate-y-2' : ''}`}>
                  <figure className="pif-bezel-inner flex h-full flex-col p-7">
                    <div className="mb-4 flex items-center gap-1 text-pif-gold-400">
                      {Array.from({ length: 5 }).map((_, n) => (
                        <Star key={n} weight="fill" className="h-4 w-4" />
                      ))}
                    </div>
                    <Quotes weight="light" className="mb-3 h-7 w-7 text-pif-teal-200" />
                    <blockquote className="flex-1 leading-relaxed text-slate-700">{t.quote}</blockquote>
                    <figcaption className="mt-6 border-t border-pif-navy-50 pt-5">
                      <p className="font-semibold text-pif-navy-800">{t.name}</p>
                      <p className="text-sm text-slate-500">{t.role}</p>
                    </figcaption>
                  </figure>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* A different model — dark */}
      <section className="hub-section-dark relative overflow-hidden py-24 md:py-32">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                align="left"
                tone="light"
                eyebrowTone="light"
                eyebrow="A different model"
                title="Community care, not a corporate policy"
              />
              <p className="mt-5 text-lg leading-relaxed text-white/80">
                Pay It Forward Health is a health care sharing program — not insurance. Members voluntarily
                share one another&apos;s eligible medical costs as an act of community and mutual aid.
              </p>
              <CheckList
                tone="light"
                className="mt-8"
                items={[
                  'Members share costs directly — no insurance middleman',
                  'Transparent, predictable monthly shares with no hidden fees',
                  'Keep your own doctors — no networks, no referrals',
                  'A real team of people advocating for you on big bills',
                  'A fraction of the cost of traditional coverage',
                ]}
              />
            </div>
            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.consultation} aspect="aspect-[4/3]" scrim={false} tilt="right" />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Stats strip */}
      <section className="bg-white py-20 md:py-24">
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
        title="Ready to join a community that cares?"
        subtitle="Take the first step today. Thousands of families have chosen transparency, real savings, and a community that pays it forward."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'Compare Plans', href: '/plans' }}
      />
    </>
  );
}
