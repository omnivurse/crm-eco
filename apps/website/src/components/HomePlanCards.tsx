import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { CheckCircle, Star, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { buildMatrixPreview } from '@crm-eco/rates';
import type { RateConfig } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';
import { Container, SectionHeading } from '@/components/sections/blocks';
import { PIFH_ORG_ID } from '@/lib/site';

const rateConfig = seedConfig as unknown as RateConfig;

interface DbPlan {
  id: string;
  name: string;
  code: string;
  monthly_share: number | null;
  description: string | null;
}
interface DbBenefit {
  id: string;
  plan_id: string;
  benefit_name: string;
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

export async function HomePlanCards() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = await createServerSupabaseClient();

  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, code, monthly_share, description')
    .eq('organization_id', PIFH_ORG_ID)
    .eq('is_active', true)
    .or('hide_from_public.is.null,hide_from_public.eq.false')
    .order('monthly_share')
    .limit(3);

  const dbPlans = (plans || []) as DbPlan[];

  const benefitsByPlan = new Map<string, DbBenefit[]>();
  if (dbPlans.length > 0) {
    const planIds = dbPlans.map((p) => p.id);
    const { data: benefits } = await supabase
      .from('product_benefits')
      .select('id, plan_id, benefit_name')
      .in('plan_id', planIds)
      .order('sort_order');
    for (const b of (benefits || []) as DbBenefit[]) {
      if (!benefitsByPlan.has(b.plan_id)) benefitsByPlan.set(b.plan_id, []);
      benefitsByPlan.get(b.plan_id)!.push(b);
    }
  }

  if (dbPlans.length === 0) return null;

  const popularIndex = dbPlans.length >= 3 ? 1 : -1;

  return (
    <section className="relative bg-pif-mist py-24 md:py-32">
      <Container>
        <SectionHeading
          eyebrow="Membership Programs"
          title="A program for every household and budget"
          subtitle="Affordable monthly shares with no annual deductible to satisfy. Choose the level of support that fits your family — change or cancel any time."
        />

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 md:grid-cols-3">
          {dbPlans.map((plan, index) => {
            const isPopular = index === popularIndex;
            const planBenefits = benefitsByPlan.get(plan.id) || [];
            const preview = buildMatrixPreview(rateConfig, plan.code, 'current');
            const startingAt = preview
              ? Math.min(...Object.values(preview.matrix.member || {}).filter(Boolean))
              : null;
            const price = startingAt ?? plan.monthly_share;

            return (
              <div
                key={plan.id}
                className={`pif-bezel relative h-full ${isPopular ? 'md:-translate-y-3' : ''}`}
              >
                <div
                  className={`pif-bezel-inner relative flex h-full flex-col p-7 md:p-8 ${
                    isPopular ? 'pif-grad-deep text-white' : 'bg-white'
                  }`}
                  style={isPopular ? { background: 'var(--pif-grad-deep)' } : undefined}
                >
                  {isPopular && (
                    <span className="pif-grad-gold absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3.5 py-1 text-xs font-bold text-pif-navy-900 shadow-[0_4px_16px_rgba(244,180,0,0.35)]">
                      <Star weight="fill" className="h-3 w-3" />
                      Most Popular
                    </span>
                  )}
                  <h3 className={`font-heading text-xl font-medium ${isPopular ? 'text-white' : 'text-pif-navy-800'}`}>
                    {plan.name}
                  </h3>
                  <p className={`mt-1 text-sm ${isPopular ? 'text-pif-teal-100' : 'text-slate-500'}`}>
                    {plan.description || 'Community health sharing program'}
                  </p>

                  <div className="mb-6 mt-5">
                    <span className={`font-heading text-4xl font-medium tracking-[-0.02em] ${isPopular ? 'text-white' : 'text-pif-navy-800'}`}>
                      {formatCurrency(price)}
                    </span>
                    <span className={`text-sm ${isPopular ? 'text-pif-teal-100' : 'text-slate-500'}`}>
                      {startingAt ? '/mo starting' : '/month'}
                    </span>
                  </div>

                  {planBenefits.length > 0 && (
                    <ul className="mb-8 space-y-2.5">
                      {planBenefits.map((benefit) => (
                        <li key={benefit.id} className="flex items-start gap-2">
                          <CheckCircle
                            weight="light"
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
                    <Link
                      href={`/enroll?plan=${plan.id}`}
                      className={`group flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
                        isPopular
                          ? 'bg-white text-pif-navy-800'
                          : 'pif-grad-care text-white shadow-[0_8px_20px_rgba(14,140,154,0.22)]'
                      }`}
                    >
                      Get Started
                      <span className={`grid h-7 w-7 place-items-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px ${
                        isPopular ? 'bg-pif-navy-800/5' : 'bg-white/15'
                      }`}>
                        <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:gap-3 hover:text-pif-green-600"
          >
            Compare all programs and pricing
            <ArrowUpRight weight="light" className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
