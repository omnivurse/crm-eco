import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { CheckCircle2, Star, ArrowRight } from 'lucide-react';
import { buildMatrixPreview } from '@crm-eco/rates';
import type { RateConfig } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

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
  const supabase = await createServerSupabaseClient();

  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, code, monthly_share, description')
    .eq('is_active', true)
    .or('hide_from_public.is.null,hide_from_public.eq.false')
    .order('monthly_share')
    .limit(3);

  const dbPlans = (plans || []) as DbPlan[];

  // Fetch benefits for found plans
  let benefitsByPlan = new Map<string, DbBenefit[]>();
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

  // If no plans in DB, show nothing (avoid empty state on homepage)
  if (dbPlans.length === 0) return null;

  const popularIndex = dbPlans.length >= 3 ? 1 : -1;

  return (
    <section className="section-padding bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Plans for every family
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Affordable monthly contributions that fit your budget. Choose the plan
            that works best for your household.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {dbPlans.map((plan, index) => {
            const isPopular = index === popularIndex;
            const planBenefits = benefitsByPlan.get(plan.id) || [];

            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 md:p-8 ${
                  isPopular
                    ? 'bg-gradient-to-b from-dhh-ink to-dhh-panel text-white shadow-xl shadow-cyan-500/20 ring-4 ring-primary/20 scale-[1.02]'
                    : 'bg-white border shadow-sm'
                }`}
              >
                {isPopular && (
                  <div className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full mb-4">
                    <Star className="w-3 h-3" />
                    Most Popular
                  </div>
                )}
                <h3
                  className={`text-xl font-bold ${
                    isPopular ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    isPopular ? 'text-cyan-100' : 'text-slate-500'
                  }`}
                >
                  {plan.description || 'Health sharing plan'}
                </p>
                <div className="mt-4 mb-6">
                  {(() => {
                    const preview = buildMatrixPreview(rateConfig, plan.code, 'current');
                    const startingAt = preview
                      ? Math.min(...Object.values(preview.matrix.member || {}).filter(Boolean))
                      : null;
                    return startingAt ? (
                      <>
                        <span
                          className={`text-4xl font-bold ${
                            isPopular ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {formatCurrency(startingAt)}
                        </span>
                        <span
                          className={`text-sm ${
                            isPopular ? 'text-cyan-100' : 'text-slate-500'
                          }`}
                        >
                          /mo starting
                        </span>
                      </>
                    ) : (
                      <>
                        <span
                          className={`text-4xl font-bold ${
                            isPopular ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {formatCurrency(plan.monthly_share)}
                        </span>
                        <span
                          className={`text-sm ${
                            isPopular ? 'text-cyan-100' : 'text-slate-500'
                          }`}
                        >
                          /month
                        </span>
                      </>
                    );
                  })()}
                </div>
                {planBenefits.length > 0 && (
                  <ul className="space-y-2.5 mb-8">
                    {planBenefits.map((benefit) => (
                      <li key={benefit.id} className="flex items-start gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            isPopular ? 'text-cyan-200' : 'text-primary'
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            isPopular ? 'text-cyan-50' : 'text-slate-600'
                          }`}
                        >
                          {benefit.benefit_name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={`/enroll?plan=${plan.id}`}>
                  <Button
                    className={`w-full ${
                      isPopular
                        ? 'bg-white text-cyan-700 hover:bg-cyan-50'
                        : 'hub-btn-gradient text-white'
                    }`}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link href="/plans">
            <Button variant="link" className="text-primary gap-2">
              View all plans and compare features
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
