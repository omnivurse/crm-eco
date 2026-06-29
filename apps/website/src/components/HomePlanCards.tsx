import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { CheckCircle2, Star, ArrowRight } from 'lucide-react';
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
    <section className="relative bg-pif-mist py-20 md:py-28">
      <Container>
        <SectionHeading
          eyebrow="Membership Programs"
          title="A program for every household and budget"
          subtitle="Affordable monthly shares with no annual deductible to satisfy. Choose the level of support that fits your family — change or cancel any time."
        />

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
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
                className={`relative flex flex-col rounded-2xl p-7 md:p-8 ${
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

                <div className="mb-6 mt-5">
                  <span className={`font-heading text-4xl font-bold ${isPopular ? 'text-white' : 'text-pif-navy-800'}`}>
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
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link href="/plans" className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600">
            Compare all programs and pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
