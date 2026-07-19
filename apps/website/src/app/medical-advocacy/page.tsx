import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import {
  ArrowUpRight,
  Scales,
  FileMagnifyingGlass,
  Gavel,
  CurrencyDollar,
  ShieldCheck,
  PhoneCall,
  ClipboardText,
  Receipt,
  TrendDown,
  Handshake,
  UserCheck,
  Clock,
  Sparkle,
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
import { BRAND, PHONE, STATS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Medical Advocacy | Pay It Forward Health',
  description:
    'Big medical bills can feel overwhelming. The Pay It Forward Health advocacy team reviews and negotiates large bills on your behalf, catches billing errors, and secures fair cash pricing — so you are never facing the system alone. Not insurance.',
};

const WHAT_WE_DO = [
  {
    icon: FileMagnifyingGlass,
    title: 'Review every line',
    body: 'We read large bills line by line to catch duplicate charges, upcoding, services you never received, and the simple mistakes that quietly inflate what you are asked to pay.',
  },
  {
    icon: Gavel,
    title: 'Negotiate on your behalf',
    body: 'Our advocates speak the language of billing departments. We push back on inflated charges and work directly with providers to bring large bills down to a fair number.',
  },
  {
    icon: CurrencyDollar,
    title: 'Secure fair cash pricing',
    body: 'Hospitals and clinics often have a far lower cash price than the sticker amount. We surface it and arrange that pricing before a need is ever shared by the community.',
  },
  {
    icon: ShieldCheck,
    title: 'Protect you from surprises',
    body: 'Surprise balance bills and aggressive collections are stressful. We step in early, communicate with providers, and keep you out of the back-and-forth.',
  },
  {
    icon: PhoneCall,
    title: 'Handle the phone calls',
    body: 'No more hold music or being transferred in circles. Your advocate makes the calls, asks the right questions, and keeps a record of every conversation for you.',
  },
  {
    icon: ClipboardText,
    title: 'Explain what you owe',
    body: 'When the dust settles, we walk you through exactly what the community shared, what was reduced, and what remains — in plain language, with no jargon.',
  },
];

const PROCESS = [
  {
    icon: Receipt,
    step: '01',
    title: 'PaperPlaneTilt us the bill',
    body: 'When a large bill arrives, forward it through your member portal or call us. There is nothing to fight on your own — your advocate takes it from there.',
  },
  {
    icon: FileMagnifyingGlass,
    step: '02',
    title: 'We audit the charges',
    body: 'We compare the bill against fair market and cash pricing, flag errors, and identify every charge that deserves a second look before anyone pays a dollar.',
  },
  {
    icon: Gavel,
    step: '03',
    title: 'We negotiate',
    body: 'Your advocate contacts the provider, disputes inflated charges, and works toward a fair, agreed price — keeping you informed at each step.',
  },
  {
    icon: TrendDown,
    step: '04',
    title: 'Costs come down',
    body: 'Once a fair price is settled, the eligible amount is shared by the community and you see exactly what you saved — often a fraction of the original total.',
  },
];

const EXAMPLE_SAVINGS = [
  {
    icon: Scales,
    label: 'Emergency room visit',
    billed: '$9,200',
    settled: '$3,100',
    note: 'After duplicate charges were removed and a fair cash price was arranged with the hospital.',
  },
  {
    icon: ClipboardText,
    label: 'Outpatient surgery',
    billed: '$26,500',
    settled: '$11,400',
    note: 'Following a line-by-line audit and direct negotiation with the surgical center.',
  },
  {
    icon: Receipt,
    label: 'Imaging & lab work',
    billed: '$4,800',
    settled: '$1,250',
    note: 'After catching a coding error and securing the provider’s self-pay rate.',
  },
];

const WHY_IT_MATTERS = [
  'You never have to argue with a billing department alone',
  'Errors and inflated charges are caught before they cost you',
  'Fair cash pricing means less is shared and the community goes further',
  'Clear, plain-language updates so you always know where things stand',
  'A real person on your side — not an automated claims line',
];

export default function MedicalAdvocacyPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pif-grad-brand">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(255,255,255,0.16),transparent)]" />
        <Container className="relative py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-[0.8125rem] font-bold uppercase tracking-[0.2em] text-pif-teal-200">
                Medical Advocacy
              </p>
              <h1 className="mt-5 font-heading text-[clamp(2.25rem,5.5vw,4rem)] font-semibold leading-[1.08] text-white text-balance">
                A team in your corner for big medical bills
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
                When a large bill shows up, you do not have to face it alone. Our advocates review
                the charges, catch costly errors, and negotiate a fair price on your behalf — so
                more of every need is shared and far less lands on you.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href="/enroll">
                  <Button
                    size="lg"
                    className="w-full gap-2 bg-white font-semibold text-pif-navy-800 shadow-lg hover:bg-pif-mist sm:w-auto"
                  >
                    Become a Member
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`tel:${PHONE.tel}`}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full gap-2 border-white/50 bg-transparent font-semibold text-white hover:bg-white/10 sm:w-auto"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Talk to an advocate
                  </Button>
                </Link>
              </div>
              <p className="mt-5 text-sm text-white/70">
                Included with membership — there is no extra fee to have an advocate on your side.
              </p>
            </div>
            <Reveal delay={0.1}>
              <BrandImage
                image={IMAGES.doctorTablet}
                aspect="aspect-[4/3]"
                priority
                scrim={false}
                className="ring-white/10"
              />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* What advocacy does */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What your advocate does"
              title="Real help with the hardest part of healthcare"
              subtitle="Medical billing is confusing by design. Your advocate brings clarity, leverage, and a steady hand to every large bill."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_WE_DO.map((item, i) => (
              <Reveal key={item.title} delay={(i % 3) * 0.07}>
                <FeatureCard icon={item.icon} title={item.title}>
                  {item.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* The process — numbered steps */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="How it works"
              title="From a scary bill to a fair price"
              subtitle="You send us the bill — we do the rest. Here is the simple path every large bill follows once it reaches our advocacy team."
            />
          </Reveal>
          <div className="mx-auto mt-14 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map((s, i) => (
              <Reveal key={s.step} delay={(i % 4) * 0.07}>
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

      {/* Example savings — clearly illustrative */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="What savings can look like"
              title="The difference advocacy can make"
              subtitle="Every bill is different, but these illustrative examples show the kind of reductions our advocates work toward when they review and negotiate large charges."
            />
          </Reveal>

          <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-3">
            {EXAMPLE_SAVINGS.map((ex, i) => (
              <Reveal key={ex.label} delay={i * 0.08}>
                <div className="flex h-full flex-col rounded-2xl border border-pif-navy-100 bg-white p-7 shadow-sm ring-1 ring-pif-navy/5">
                  <IconChip icon={ex.icon} variant="brand" className="mb-5" />
                  <h3 className="font-heading text-lg font-semibold text-pif-navy-800">
                    {ex.label}
                  </h3>
                  <div className="mt-5 flex items-end justify-between gap-3 border-t border-pif-navy-100 pt-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Originally billed
                      </p>
                      <p className="mt-1 font-heading text-2xl font-bold text-slate-400 line-through">
                        {ex.billed}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-pif-teal-700">
                        Settled at
                      </p>
                      <p className="gradient-text mt-1 font-heading text-3xl font-bold">
                        {ex.settled}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">{ex.note}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15}>
            <p className="mx-auto mt-8 flex max-w-2xl items-start justify-center gap-2 text-center text-sm text-slate-500">
              <Sparkle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pif-gold-500" aria-hidden="true" />
              <span>
                Figures above are illustrative examples only — not guarantees, quotes, or typical
                results. Actual savings vary by provider, procedure, and circumstance.
              </span>
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Why it matters — dark with image */}
      <section className="hub-section-dark relative overflow-hidden py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                align="left"
                tone="light"
                eyebrowTone="light"
                eyebrow="Why it matters"
                title="You should never face the billing system alone"
              />
              <p className="mt-5 text-lg leading-relaxed text-white/80">
                {BRAND.name} is a health care sharing community — not insurance. Advocacy is part of
                how the community cares for one another: when costs are fair and errors are caught,
                every share goes further, and the next member in need is supported too.
              </p>
              <CheckList tone="light" className="mt-8" items={WHY_IT_MATTERS} />
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

      {/* Reassurance trio */}
      <section className="bg-white py-20 md:py-24">
        <Container>
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            {[
              {
                icon: Handshake,
                title: 'Included with membership',
                body: 'Advocacy comes standard with your membership. There is no separate fee to have a trained advocate review and negotiate your large bills.',
              },
              {
                icon: UserCheck,
                title: 'A real human, not a script',
                body: 'You work with a person who knows your situation — not a call center reading from a denial script. They stay with your case until it is resolved.',
              },
              {
                icon: Clock,
                title: 'We act early',
                body: 'The sooner we see a large bill, the more we can do. PaperPlaneTilt it our way as soon as it arrives, and we will get to work before charges become collections.',
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-pif-navy-100 bg-white p-8 text-center shadow-sm ring-1 ring-pif-navy/5">
                  <IconChip icon={c.icon} variant="gold" className="mx-auto mb-5" />
                  <h3 className="font-heading text-xl font-semibold text-pif-navy-800">{c.title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{c.body}</p>
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
                { value: STATS.savings, label: 'Typical savings' },
                { value: STATS.satisfaction, label: 'Average member rating' },
              ]}
            />
          </Reveal>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Let our advocates take the weight off your shoulders"
        subtitle="Join a community that has your back when the bills get big. Membership includes advocacy, telehealth, prescription savings, and more — at a fraction of the cost of insurance."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'Explore Member Services', href: '/services' }}
      />
    </>
  );
}
