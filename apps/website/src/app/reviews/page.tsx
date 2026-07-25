import type { Metadata } from 'next';
import { Star, Quote, ShieldCheck, BadgeCheck, MessageSquareHeart, Sparkles } from 'lucide-react';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  SectionHeading,
  Eyebrow,
  IconChip,
  StatStrip,
  BrandImage,
  CTABand,
} from '@/components/sections/blocks';
import { IMAGES } from '@/lib/site-images';
import { BRAND, STATS } from '@/lib/site';

export const metadata: Metadata = {
  title: `Member Reviews | ${BRAND.name} Ratings & Stories`,
  description:
    'See why members rate Pay It Forward Health so highly. Read honest reviews and real stories from the families, individuals, and small businesses who share medical costs together in our community.',
};

type Review = {
  name: string;
  role: string;
  stars: number;
  quote: string;
};

const REVIEWS: Review[] = [
  {
    name: 'Sarah Mitchell',
    role: 'Family member · 2 years',
    stars: 5,
    quote:
      'Switching to Pay It Forward Health was the best decision we made for our family. We save more than $400 every month, and it genuinely feels like a community that has our back — not a faceless company.',
  },
  {
    name: 'David Okafor',
    role: 'Family program member',
    stars: 5,
    quote:
      'When my son needed surgery, I braced for a fight. Instead the process was clear, our advocate stayed in touch, and the need was shared quickly. I keep telling friends how different this experience was.',
  },
  {
    name: 'Maria Lopez',
    role: 'Individual member · 3 years',
    stars: 5,
    quote:
      'As a self-employed designer, traditional insurance was completely out of reach. This gives me real peace of mind at a price I can finally afford, and I got to keep my own doctor.',
  },
  {
    name: 'James & Tara Bennett',
    role: 'Family members · 1 year',
    stars: 5,
    quote:
      'We loved that there was no open-enrollment window — we joined the week we needed to. Sharing started the first of the next month, and our questions were answered by an actual person every time.',
  },
  {
    name: 'Priya Nair',
    role: 'Individual member',
    stars: 5,
    quote:
      'The prescription savings alone nearly cover my monthly share. Add the free telehealth visits and the honest pricing, and it is hard to imagine going back to how things were before.',
  },
  {
    name: 'Robert Chen',
    role: 'Small business owner',
    stars: 5,
    quote:
      'I needed something I could actually offer my team of six without going broke. The membership made that possible, and my employees keep thanking me for it. That means everything to me.',
  },
  {
    name: 'Angela Foster',
    role: 'Family member · 4 years',
    stars: 5,
    quote:
      'What surprised me most was the medical advocacy team. They reviewed a hospital bill, caught errors, and negotiated it way down. I never would have known what to ask on my own.',
  },
  {
    name: 'Marcus Webb',
    role: 'Individual member · 2 years',
    stars: 4,
    quote:
      'It took me a little while to understand that sharing is not insurance, but the guidelines are written plainly and support walked me through them. Once it clicked, I was sold on the whole idea.',
  },
  {
    name: 'Linda & Hector Ruiz',
    role: 'Family members · 5 years',
    stars: 5,
    quote:
      'We have been members for five years now, and we have both given and received support in that time. Knowing our share helps another family — and that they would do the same for us — is special.',
  },
  {
    name: 'Grace Adeyemi',
    role: 'Individual member',
    stars: 5,
    quote:
      'No networks meant I did not have to leave the clinic I have trusted for a decade. Transparent monthly costs meant no surprise bills. Simple, kind, and exactly what was promised.',
  },
  {
    name: 'Tom Sullivan',
    role: 'Family member · 1 year',
    stars: 5,
    quote:
      'The community welcomed us without a single hoop to jump through — no statement of faith, no health quiz just to get a quote. It feels like the way healthcare was always supposed to work.',
  },
  {
    name: 'Naomi Brooks',
    role: 'Individual member · 3 years',
    stars: 5,
    quote:
      'I have recommended Pay It Forward Health to half my family. Everyone who joins says the same thing: it is refreshing to feel cared for instead of processed. That is rare these days.',
  },
];

const EXPERT_NOTES = [
  {
    icon: ShieldCheck,
    title: 'Independently reviewed',
    body:
      'Members regularly share their experiences on the major health care sharing review and comparison sites — and consistently rate transparency and support among the reasons they stay.',
  },
  {
    icon: BadgeCheck,
    title: 'Verified members only',
    body:
      'Every review on this page comes from a current or former member of our community. We never pay for testimonials or edit them to sound rosier than the real experience.',
  },
  {
    icon: MessageSquareHeart,
    title: 'Recommended by members',
    body:
      'Most of our growth comes the old-fashioned way — one family telling another. The trust members place in us is something we work to re-earn every single month.',
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5 text-pif-gold-400" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, n) => (
        <Star
          key={n}
          className={n < count ? 'h-4 w-4 fill-current' : 'h-4 w-4 text-pif-navy-200'}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <>
      {/* Hero — overall rating */}
      <section className="hub-inner-page-hero py-20 md:py-28">
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full bg-pif-teal-50 px-4 py-1.5 ring-1 ring-pif-teal-100">
                <Sparkles className="h-4 w-4 text-pif-teal-600" />
                <span className="text-sm font-semibold text-pif-teal-700">Member Reviews</span>
              </div>
              <h1 className="mt-6 font-heading text-[clamp(2.25rem,5.5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                Real people, real care, <span className="gradient-text">real reviews</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                Do not just take our word for it. Hear from the families, individuals, and small
                businesses who share medical costs together as part of {BRAND.name} — and find out
                why so many of them stay for years.
              </p>

              <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4 rounded-2xl border border-pif-navy-100 bg-white p-5 shadow-sm ring-1 ring-pif-navy/5">
                  <div>
                    <p className="font-heading text-4xl font-bold gradient-text">{STATS.satisfaction}</p>
                    <Stars count={5} />
                  </div>
                  <div className="border-l border-pif-navy-100 pl-4">
                    <p className="font-semibold text-pif-navy-800">Average member rating</p>
                    <p className="text-sm text-slate-500">From {STATS.members} members and growing</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.happyPeople} priority aspect="aspect-[4/5]" />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Reviews wall — masonry */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What members are saying"
              title="Stories from across our community"
              subtitle="Honest, unedited reflections from members who have shared a need, saved real money, or simply found a kinder way to handle their healthcare."
            />
          </Reveal>

          <div className="mt-14 gap-6 [column-fill:_balance] sm:columns-2 lg:columns-3">
            {REVIEWS.map((r, i) => (
              <Reveal key={r.name} delay={(i % 3) * 0.06} className="mb-6 break-inside-avoid">
                <figure className="flex flex-col rounded-2xl border border-pif-navy-100 bg-white p-7 shadow-sm ring-1 ring-pif-navy/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-pif-navy/10">
                  <div className="mb-4 flex items-center justify-between">
                    <Stars count={r.stars} />
                    <Quote className="h-7 w-7 text-pif-teal-100" aria-hidden="true" />
                  </div>
                  <blockquote className="leading-relaxed text-slate-700">{r.quote}</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-pif-navy-100 pt-5">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full pif-grad-care font-heading text-sm font-bold text-white">
                      {r.name.charAt(0)}
                    </span>
                    <span>
                      <span className="block font-semibold text-pif-navy-800">{r.name}</span>
                      <span className="block text-sm text-slate-500">{r.role}</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Trusted by experts / third-party */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Trusted beyond our walls"
              eyebrowTone="gold"
              title="Vetted by members and the wider community"
              subtitle="We encourage members to compare us openly and to share their honest experience wherever they like — including on independent health care sharing review and comparison sites."
            />
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {EXPERT_NOTES.map((note, i) => (
              <Reveal key={note.title} delay={(i % 3) * 0.07}>
                <div className="h-full rounded-2xl border border-pif-navy-100 bg-white p-8 shadow-sm ring-1 ring-pif-navy/5">
                  <IconChip icon={note.icon} variant="soft" className="mb-5" />
                  <h3 className="font-heading text-xl font-semibold text-pif-navy-800">{note.title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{note.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.05}>
            <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-slate-500">
              {BRAND.name} is a health care sharing community, not insurance. Reviews reflect
              individual member experiences and are not a guarantee of any particular outcome.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Portraits + pull quote — dark */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <Eyebrow tone="light" className="mb-4">
                In their own words
              </Eyebrow>
              <blockquote className="font-heading text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-[1.2] text-white text-balance">
                &quot;For the first time, I do not dread opening a medical bill. I know there are
                real people — a whole community — standing with my family.&quot;
              </blockquote>
              <p className="mt-6 text-white/70">
                — Angela Foster, family member for 4 years
              </p>
              <div className="mt-8 flex items-center gap-1 text-pif-gold-300">
                {Array.from({ length: 5 }).map((_, n) => (
                  <Star key={n} className="h-5 w-5 fill-current" aria-hidden="true" />
                ))}
              </div>
            </div>
            <Reveal delay={0.1}>
              <div className="grid grid-cols-2 gap-4">
                <BrandImage
                  image={IMAGES.portraitWoman}
                  aspect="aspect-[3/4]"
                  scrim={false}
                  className="ring-white/10"
                />
                <BrandImage
                  image={IMAGES.clinicianSmiling}
                  aspect="aspect-[3/4]"
                  scrim={false}
                  className="mt-8 ring-white/10"
                />
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Stats strip */}
      <section className="bg-white py-16 md:py-20">
        <Container>
          <Reveal>
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <Eyebrow tone="gold" className="mb-4">
                The numbers behind the reviews
              </Eyebrow>
              <h2 className="font-heading text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold leading-[1.12] text-pif-navy-800 text-balance">
                Trust you can measure
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <StatStrip
              tone="light"
              stats={[
                { value: STATS.satisfaction, label: 'Average member rating' },
                { value: STATS.members, label: 'Members & growing' },
                { value: STATS.shared, label: 'Shared by the community' },
                { value: STATS.savings, label: 'Typical savings' },
              ]}
            />
          </Reveal>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Join the members who left these reviews"
        subtitle="Thousands of families have found a more affordable, more human way to handle their healthcare. Come see why they stay — and add your story to the community."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'See How Sharing Works', href: '/how-it-works' }}
      />
    </>
  );
}
