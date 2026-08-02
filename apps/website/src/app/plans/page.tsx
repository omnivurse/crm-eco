import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  CheckCircle2,
  ArrowRight,
  Star,
  CalendarClock,
  Wallet,
  ShieldCheck,
  HeartHandshake,
  Stethoscope,
  Pill,
  Video,
  Scale,
  Users,
} from 'lucide-react';
import { buildMatrixPreview, getPlanOptions } from '@crm-eco/rates';
import type { RateConfig } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  Eyebrow,
  SectionHeading,
  IconChip,
  FeatureCard,
  StatStrip,
  BrandImage,
  CTABand,
  CheckList,
} from '@/components/sections/blocks';
import { IMAGES } from '@/lib/site-images';
import { STATS, PIFH_ORG_ID } from '@/lib/site';

const rateConfig = seedConfig as unknown as RateConfig;

export const metadata: Metadata = {
  title: 'Plans & Pricing',
  description:
    'Compare Pay It Forward Health sharing programs. Affordable monthly shares with a simple per-incident IUA, no annual deductible, and no networks. Join any time.',
};

interface DbPlan {
  id: string;
  name: string;
  code: string;
  monthly_share: number | null;
  iua_amount: number | null;
  description: string | null;
  tier: string | null;
}

interface DbBenefit {
  id: string;
  plan_id: string;
  benefit_name: string;
  description: string | null;
  sort_order: number;
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

async function getPlansWithBenefits() {
  const supabase = await createServerSupabaseClient();

  const { data: msaPlans } = await supabase
    .from('plans')
    .select('id, name, code, monthly_share, iua_amount, description, tier')
    .eq('organization_id', PIFH_ORG_ID)
    .eq('is_active', true)
    .or('hide_from_public.is.null,hide_from_public.eq.false')
    .like('code', 'PIFH-MSA-%')
    .order('iua_amount');

  let plans = (msaPlans || []) as DbPlan[];

  // Seed fallback so the public site shows MSA matrices before DB migration.
  if (plans.length === 0) {
    plans = getPlanOptions(rateConfig, 'current').map((p) => ({
      id: p.planId,
      name: p.displayName,
      code: p.planId,
      monthly_share: null,
      iua_amount: p.iuaAmount ?? null,
      description: `Provisional MSA ${p.marketSegment ?? ''} sharing — partnership & wellness lab costs not included.`,
      tier: p.marketSegment ?? null,
    }));
    return { plans, benefits: [] };
  }

  const planIds = plans.map((p: DbPlan) => p.id);

  const { data: benefits } = await supabase
    .from('product_benefits')
    .select('id, plan_id, benefit_name, description, sort_order')
    .in('plan_id', planIds)
    .order('sort_order');

  return { plans: plans as DbPlan[], benefits: (benefits || []) as DbBenefit[] };
}

const PRICING_FACTS = [
  {
    icon: Wallet,
    title: 'Your monthly share',
    body: 'A predictable amount you contribute each month into the community pool. It is not a premium — it is your part in helping fellow members with their eligible needs, and theirs in helping you.',
  },
  {
    icon: ShieldCheck,
    title: 'The IUA, per incident',
    body: 'The Initial Unshareable Amount is what you pay out of pocket for a given medical need before the community shares the rest. A lower IUA pairs with a higher monthly share — pick the balance that fits.',
  },
  {
    icon: CalendarClock,
    title: 'No annual deductible',
    body: 'There is nothing to "satisfy" each year and no networks to chase. The IUA applies per incident, your sharing begins the first of the following month, and you can change or cancel any time.',
  },
];

const INCLUDED = [
  { icon: HeartHandshake, title: 'Medical cost sharing', body: 'The heart of every program — eligible doctor visits, hospital stays, surgeries and more, shared by the community.' },
  { icon: Stethoscope, title: 'Preventive care', body: 'Annual wellness visits and screenings that help you stay ahead of bigger problems, included in your membership.' },
  { icon: Video, title: 'Virtual care', body: 'Talk to a licensed provider by phone or video, day or night, usually at no additional cost to you.' },
  { icon: Pill, title: 'Prescription savings', body: 'Meaningful discounts on everyday and specialty medications through our pharmacy savings program.' },
  { icon: Scale, title: 'Medical advocacy', body: 'Our team reviews and negotiates large bills on your behalf, so you are never facing the system alone.' },
  { icon: Users, title: 'A real community', body: 'No religious requirement and no health questionnaire to get a quote — everyone is welcome to join and belong.' },
];

const ALL_PROGRAMS_INCLUDE = [
  'No provider networks — keep the doctors and hospitals you already trust',
  'No open-enrollment window — join whenever life calls for it',
  'A simple per-incident IUA instead of an annual deductible',
  'Transparent monthly shares with no hidden fees or surprise bills',
  'A team of real people advocating for you on big medical bills',
  'Open to every background and belief — no health questionnaire to get a quote',
];

const FAQ_TEASERS = [
  {
    q: 'Can I switch programs after I join?',
    a: 'Yes. Because there is no open-enrollment window, you can request a program change as your needs change — there is no annual lock-in to wait out.',
  },
  {
    q: 'What happens before my IUA is met?',
    a: 'You are responsible for eligible costs up to your IUA for that specific medical need. After the IUA is met, the community shares the remaining eligible expenses. The IUA applies per incident, not per year.',
  },
  {
    q: 'Can I add my family?',
    a: 'Absolutely. Your spouse and dependent children can be added during enrollment. Household size factors into your monthly share, which you will see clearly before you commit.',
  },
];

export default async function PlansPage() {
  const { plans, benefits } = await getPlansWithBenefits();

  const benefitsByPlan = new Map<string, DbBenefit[]>();
  for (const b of benefits) {
    if (!benefitsByPlan.has(b.plan_id)) benefitsByPlan.set(b.plan_id, []);
    benefitsByPlan.get(b.plan_id)!.push(b);
  }

  // Mark the middle plan (or second) as popular if we have 3+ plans
  const popularIndex = plans.length >= 3 ? 1 : -1;

  // Collect all unique benefit names across all plans for comparison table
  const allBenefitNames: string[] = [];
  const seen = new Set<string>();
  for (const b of benefits) {
    if (!seen.has(b.benefit_name)) {
      seen.add(b.benefit_name);
      allBenefitNames.push(b.benefit_name);
    }
  }

  return (
    <>
      {/* ----------------------------------------------------------- Hero */}
      <section className="hub-inner-page-hero py-20 md:py-28">
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <Eyebrow className="mb-4">Membership Programs</Eyebrow>
              <h1 className="font-heading text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                Find the program that{' '}
                <span className="gradient-text">fits your family</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                Affordable monthly shares, a simple per-incident IUA, and no annual deductible
                to satisfy. Every Pay It Forward Health program is community health sharing —
                not insurance — so you keep your own doctors and can join any time.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href="/enroll">
                  <Button size="lg" className="hub-btn-gradient w-full gap-2 font-semibold text-white sm:w-auto">
                    Become a Member
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-pif-navy/20 bg-white font-semibold text-pif-navy-800 hover:bg-pif-mist sm:w-auto"
                  >
                    How sharing works
                  </Button>
                </Link>
              </div>
              <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-pif-green-600" />
                Not insurance &middot; No networks &middot; Welcoming to all
              </p>
            </div>
            <Reveal delay={0.1}>
              <BrandImage image={IMAGES.familyTogether} aspect="aspect-[4/3]" priority />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------- Program comparison */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Compare programs"
              title="A program for every household and budget"
              subtitle="Pick the level of support that fits your family. Change or cancel any time — there is no open-enrollment window to wait for."
            />
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Provisional MSA pricing — partnership (doctor/nurse) costs and wellness lab panel are
              not included yet. Enrollment contribution is separate and adjustable.
            </p>
          </Reveal>

          {plans.length === 0 ? (
            <div className="mx-auto mt-14 max-w-xl rounded-2xl border border-pif-navy-100 bg-pif-mist p-10 text-center ring-1 ring-pif-navy/5">
              <IconChip icon={CalendarClock} variant="soft" className="mx-auto mb-5" />
              <h3 className="font-heading text-xl font-semibold text-pif-navy-800">
                Programs are being finalized
              </h3>
              <p className="mt-3 leading-relaxed text-slate-600">
                Our membership programs are being configured right now. Reach out and we&apos;ll
                walk you through your options and pricing personally.
              </p>
              <Link href="/contact" className="mt-6 inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600">
                Talk to our team
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
              {plans.map((plan, index) => {
                const isPopular = index === popularIndex;
                const planBenefits = benefitsByPlan.get(plan.id) || [];
                const preview = buildMatrixPreview(rateConfig, plan.code, 'current');
                const startingAt = preview
                  ? Math.min(...Object.values(preview.matrix.member || {}).filter(Boolean))
                  : null;
                const price = startingAt ?? plan.monthly_share;

                return (
                  <Reveal key={plan.id} delay={index * 0.08} className="h-full">
                    <div
                      className={`relative flex h-full flex-col rounded-2xl p-7 md:p-8 ${
                        isPopular
                          ? 'hub-card-popular text-white md:-mt-3 md:mb-3'
                          : 'border border-pif-navy-100 bg-white shadow-sm ring-1 ring-pif-navy/5'
                      }`}
                    >
                      {isPopular && (
                        <span className="pif-grad-gold absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3.5 py-1 text-xs font-bold text-pif-navy-900 shadow-md">
                          <Star className="h-3 w-3 fill-current" />
                          Most Popular
                        </span>
                      )}

                      <h3 className={`font-heading text-xl font-semibold ${isPopular ? 'text-white' : 'text-pif-navy-800'}`}>
                        {plan.name}
                      </h3>
                      <p className={`mt-1 text-sm ${isPopular ? 'text-pif-teal-100' : 'text-slate-500'}`}>
                        {plan.description || 'Community health sharing program'}
                      </p>

                      <div className="mb-1 mt-5">
                        <span className={`font-heading text-4xl font-bold ${isPopular ? 'text-white' : 'text-pif-navy-800'}`}>
                          {formatCurrency(price)}
                        </span>
                        <span className={`text-sm ${isPopular ? 'text-pif-teal-100' : 'text-slate-500'}`}>
                          {startingAt ? '/mo starting' : '/month'}
                        </span>
                      </div>
                      {plan.iua_amount !== null && (
                        <p className={`mb-6 text-xs ${isPopular ? 'text-pif-teal-100/80' : 'text-slate-400'}`}>
                          {formatCurrency(plan.iua_amount)} IUA per incident
                        </p>
                      )}
                      {plan.iua_amount === null && <div className="mb-6" />}

                      {planBenefits.length > 0 && (
                        <ul className="mb-8 space-y-2.5">
                          {planBenefits.map((benefit) => (
                            <li key={benefit.id} className="flex items-start gap-2">
                              <CheckCircle2
                                className={`mt-0.5 h-4 w-4 flex-shrink-0 ${isPopular ? 'text-pif-gold-300' : 'text-pif-green-600'}`}
                              />
                              <span className={`text-sm ${isPopular ? 'text-white/85' : 'text-slate-600'}`}>
                                {benefit.benefit_name}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-auto">
                        <Link href={`/enroll?plan=${plan.id}`}>
                          <Button
                            className={`w-full font-semibold ${
                              isPopular ? 'bg-white text-pif-navy-800 hover:bg-pif-mist' : 'hub-btn-gradient text-white'
                            }`}
                          >
                            Enroll Now
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          )}

          {/* Feature comparison table -- only if we have plans and benefits */}
          {plans.length >= 2 && allBenefitNames.length > 0 && (
            <Reveal className="mx-auto mt-16 max-w-4xl">
              <div className="overflow-hidden rounded-2xl border border-pif-navy-100 bg-white shadow-sm ring-1 ring-pif-navy/5">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-pif-navy-100 bg-pif-mist">
                        <th className="p-4 text-left text-sm font-semibold text-pif-navy-800">
                          What&apos;s included
                        </th>
                        {plans.map((plan, idx) => (
                          <th
                            key={plan.id}
                            className={`p-4 text-center text-sm font-semibold ${
                              idx === popularIndex ? 'text-pif-teal-700' : 'text-pif-navy-800'
                            }`}
                          >
                            {plan.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-pif-navy-100">
                        <td className="p-4 text-sm font-medium text-slate-700">Monthly share</td>
                        {plans.map((plan, idx) => (
                          <td key={plan.id} className={`p-4 text-center ${idx === popularIndex ? 'bg-pif-teal-50/50' : ''}`}>
                            <span className={`text-sm font-semibold ${idx === popularIndex ? 'text-pif-teal-700' : 'text-slate-700'}`}>
                              {formatCurrency(plan.monthly_share)}
                            </span>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-pif-navy-100">
                        <td className="p-4 text-sm font-medium text-slate-700">
                          Initial Unshareable Amount (IUA)
                        </td>
                        {plans.map((plan, idx) => (
                          <td key={plan.id} className={`p-4 text-center ${idx === popularIndex ? 'bg-pif-teal-50/50' : ''}`}>
                            <span className={`text-sm font-semibold ${idx === popularIndex ? 'text-pif-teal-700' : 'text-slate-700'}`}>
                              {formatCurrency(plan.iua_amount)}
                            </span>
                          </td>
                        ))}
                      </tr>
                      {allBenefitNames.map((benefitName, rowIdx) => {
                        const planHasBenefit = plans.map((plan) =>
                          (benefitsByPlan.get(plan.id) || []).some((b) => b.benefit_name === benefitName),
                        );
                        return (
                          <tr
                            key={benefitName}
                            className={rowIdx < allBenefitNames.length - 1 ? 'border-b border-pif-navy-100' : ''}
                          >
                            <td className="p-4 text-sm font-medium text-slate-700">{benefitName}</td>
                            {plans.map((plan, idx) => (
                              <td key={plan.id} className={`p-4 text-center ${idx === popularIndex ? 'bg-pif-teal-50/50' : ''}`}>
                                {planHasBenefit[idx] ? (
                                  <CheckCircle2 className="mx-auto h-5 w-5 text-pif-green-600" />
                                ) : (
                                  <span className="mx-auto block h-px w-4 bg-pif-navy-200" aria-label="Not included" />
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          )}
        </Container>
      </section>

      {/* ----------------------------------------------- How pricing works */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="How pricing works"
              title="Two simple numbers, no fine print"
              subtitle="Sharing is refreshingly clear: a monthly share that you choose, and a per-incident IUA. There is no annual deductible and nothing hidden."
            />
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PRICING_FACTS.map((fact, i) => (
              <Reveal key={fact.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-pif-navy-100 bg-white p-7 shadow-sm ring-1 ring-pif-navy/5">
                  <IconChip icon={fact.icon} variant="brand" className="mb-5" />
                  <h3 className="font-heading text-xl font-semibold text-pif-navy-800">{fact.title}</h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{fact.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ------------------------------- What's included across all programs */}
      <section className="bg-white py-20 md:py-28">
        <Container>
          <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-20">
            <Reveal className="order-2 md:order-1">
              <BrandImage image={IMAGES.consultation} aspect="aspect-[4/3]" />
            </Reveal>
            <Reveal className="order-1 md:order-2" delay={0.1}>
              <SectionHeading
                align="left"
                eyebrow="Included in every program"
                title="The same caring foundation, whatever you choose"
                subtitle="No matter which program fits your budget, the essentials of membership come standard."
              />
              <CheckList className="mt-8" items={ALL_PROGRAMS_INCLUDE} />
            </Reveal>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((item, i) => (
              <Reveal key={item.title} delay={(i % 3) * 0.07}>
                <FeatureCard icon={item.icon} title={item.title}>
                  {item.body}
                </FeatureCard>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ----------------------------------------------------- Stats strip */}
      <section className="hub-section-dark py-16 md:py-20">
        <Container>
          <Reveal>
            <StatStrip
              tone="dark"
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

      {/* -------------------------------------------------------- FAQ teaser */}
      <section className="hub-section-muted py-20 md:py-28">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Quick answers"
              title="Common questions about our programs"
              subtitle="A few of the things members ask most. There is plenty more in our full FAQ."
            />
          </Reveal>
          <div className="mx-auto mt-12 max-w-3xl space-y-4">
            {FAQ_TEASERS.map((item, i) => (
              <Reveal key={item.q} delay={i * 0.06}>
                <div className="rounded-2xl border border-pif-navy-100 bg-white p-6 shadow-sm ring-1 ring-pif-navy/5">
                  <h3 className="font-heading text-lg font-semibold text-pif-navy-800">{item.q}</h3>
                  <p className="mt-2 leading-relaxed text-slate-600">{item.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/faq" className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600">
              Read all frequently asked questions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </section>

      {/* --------------------------------------------------------- Final CTA */}
      <CTABand
        title="Ready to join a community that cares?"
        subtitle="Pick the program that fits your household and enroll online in minutes. No agents, no pressure — just transparent sharing and a community that pays it forward."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'How It Works', href: '/how-it-works' }}
      />
    </>
  );
}
