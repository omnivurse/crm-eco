import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import {
  CheckCircle2,
  Minus,
  ArrowRight,
  Star,
  Shield,
  Heart,
  HelpCircle,
} from 'lucide-react';
import { buildMatrixPreview, getPlanOptions } from '@crm-eco/rates';
import type { RateConfig } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';

const rateConfig = seedConfig as unknown as RateConfig;

export const metadata: Metadata = {
  title: 'Plans & Pricing',
  description:
    'Compare Pay It Forward Health sharing plans. Affordable monthly contributions for individuals and families. Find the right plan for your needs.',
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

  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, code, monthly_share, iua_amount, description, tier')
    .eq('is_active', true)
    .or('hide_from_public.is.null,hide_from_public.eq.false')
    .order('monthly_share');

  if (!plans || plans.length === 0) return { plans: [], benefits: [] };

  const planIds = plans.map((p: DbPlan) => p.id);

  const { data: benefits } = await supabase
    .from('product_benefits')
    .select('id, plan_id, benefit_name, description, sort_order')
    .in('plan_id', planIds)
    .order('sort_order');

  return { plans: plans as DbPlan[], benefits: (benefits || []) as DbBenefit[] };
}

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
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Find the right plan for you
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Simple, transparent pricing with no hidden fees. Choose the coverage level
            that best fits your family&apos;s needs and budget.
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          {plans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg">Plans are being configured. Check back soon!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {plans.map((plan, index) => {
                const isPopular = index === popularIndex;
                const planBenefits = benefitsByPlan.get(plan.id) || [];

                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl p-6 md:p-8 ${
                      isPopular
                        ? 'bg-gradient-to-b from-teal-600 to-teal-700 text-white shadow-xl shadow-teal-600/20 ring-4 ring-teal-600/20 md:scale-[1.03]'
                        : 'bg-white border-2 border-slate-200 shadow-sm'
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
                        isPopular ? 'text-teal-100' : 'text-slate-500'
                      }`}
                    >
                      {plan.description || 'Health sharing plan'}
                    </p>
                    <div className="mt-4 mb-2">
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
                                isPopular ? 'text-teal-100' : 'text-slate-500'
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
                                isPopular ? 'text-teal-100' : 'text-slate-500'
                              }`}
                            >
                              /month
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    {plan.iua_amount !== null && (
                      <p
                        className={`text-xs mb-6 ${
                          isPopular ? 'text-teal-200' : 'text-slate-400'
                        }`}
                      >
                        IUA: {formatCurrency(plan.iua_amount)} per incident
                      </p>
                    )}
                    {planBenefits.length > 0 && (
                      <ul className="space-y-2.5 mb-8">
                        {planBenefits.map((benefit) => (
                          <li key={benefit.id} className="flex items-start gap-2">
                            <CheckCircle2
                              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                isPopular ? 'text-teal-200' : 'text-teal-600'
                              }`}
                            />
                            <span
                              className={`text-sm ${
                                isPopular ? 'text-teal-50' : 'text-slate-600'
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
                            ? 'bg-white text-teal-700 hover:bg-teal-50'
                            : 'bg-teal-600 hover:bg-teal-700 text-white'
                        }`}
                      >
                        Enroll Now
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Feature Comparison Table -- only if we have plans and benefits */}
      {plans.length >= 2 && allBenefitNames.length > 0 && (
        <section className="section-padding bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Compare plan features
              </h2>
              <p className="text-slate-600">
                See exactly what&apos;s included in each plan
              </p>
            </div>

            <div className="max-w-4xl mx-auto bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-4 text-sm font-semibold text-slate-700">
                        Feature
                      </th>
                      {plans.map((plan, idx) => (
                        <th
                          key={plan.id}
                          className={`text-center p-4 text-sm font-semibold ${
                            idx === popularIndex
                              ? 'text-teal-700 bg-teal-50'
                              : 'text-slate-700'
                          }`}
                        >
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Monthly Share row */}
                    <tr className="border-b">
                      <td className="p-4 text-sm text-slate-700 font-medium">Monthly Share</td>
                      {plans.map((plan, idx) => (
                        <td
                          key={plan.id}
                          className={`text-center p-4 ${idx === popularIndex ? 'bg-teal-50/30' : ''}`}
                        >
                          <span className={`text-sm font-medium ${idx === popularIndex ? 'font-semibold text-teal-700' : 'text-slate-700'}`}>
                            {formatCurrency(plan.monthly_share)}
                          </span>
                        </td>
                      ))}
                    </tr>
                    {/* IUA row */}
                    <tr className="border-b">
                      <td className="p-4 text-sm text-slate-700 font-medium">Initial Unshareable Amount (IUA)</td>
                      {plans.map((plan, idx) => (
                        <td
                          key={plan.id}
                          className={`text-center p-4 ${idx === popularIndex ? 'bg-teal-50/30' : ''}`}
                        >
                          <span className={`text-sm font-medium ${idx === popularIndex ? 'font-semibold text-teal-700' : 'text-slate-700'}`}>
                            {formatCurrency(plan.iua_amount)}
                          </span>
                        </td>
                      ))}
                    </tr>
                    {/* Benefit rows */}
                    {allBenefitNames.map((benefitName, rowIdx) => {
                      const planHasBenefit = plans.map(
                        (plan) => (benefitsByPlan.get(plan.id) || []).some((b) => b.benefit_name === benefitName)
                      );
                      return (
                        <tr
                          key={benefitName}
                          className={rowIdx < allBenefitNames.length - 1 ? 'border-b' : ''}
                        >
                          <td className="p-4 text-sm text-slate-700 font-medium">{benefitName}</td>
                          {plans.map((plan, idx) => (
                            <td
                              key={plan.id}
                              className={`text-center p-4 ${idx === popularIndex ? 'bg-teal-50/30' : ''}`}
                            >
                              {planHasBenefit[idx] ? (
                                <CheckCircle2 className="w-5 h-5 text-teal-600 mx-auto" />
                              ) : (
                                <Minus className="w-5 h-5 text-slate-300 mx-auto" />
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
          </div>
        </section>
      )}

      {/* What's Included */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                What is the IUA?
              </h3>
              <p className="text-slate-600 leading-relaxed mb-3">
                The Initial Unshareable Amount (IUA) is similar to a deductible in
                traditional insurance. It&apos;s the amount you pay out-of-pocket per
                medical incident before the community begins sharing your expenses.
              </p>
              <p className="text-slate-600 leading-relaxed">
                A lower IUA means you pay less out-of-pocket per incident, but your
                monthly share amount is higher. Choose the balance that works best for
                your situation.
              </p>
            </div>

            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Monthly Share Amount
              </h3>
              <p className="text-slate-600 leading-relaxed mb-3">
                Your monthly share is the amount you contribute each month to the
                sharing pool. This is not an insurance premium -- it&apos;s your voluntary
                contribution that helps fellow members with their medical needs.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Your first contribution is processed after your enrollment is approved.
                You can choose your preferred billing day (1st, 5th, 10th, 15th, 20th,
                or 25th of each month).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Plans FAQ */}
      <section className="section-padding bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Common questions about our plans
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: 'Can I switch plans after enrolling?',
                  a: 'Yes, you can request a plan change during our annual open enrollment period, or within 30 days of a qualifying life event such as marriage, birth of a child, or loss of other coverage.',
                },
                {
                  q: 'Are family members included in my plan?',
                  a: 'Your monthly share covers you as the primary member. Spouse and dependent children can be added to your plan during enrollment. Additional family members may affect your monthly share amount.',
                },
                {
                  q: 'What if I need care before my IUA is met?',
                  a: 'You are responsible for medical costs up to your IUA per incident. After you meet the IUA for a particular medical incident, the community shares the remaining eligible expenses. The IUA resets per incident, not annually.',
                },
                {
                  q: 'Is there a maximum amount that can be shared?',
                  a: 'Yes, sharing limits apply per incident and per membership year. The Complete plan has the highest sharing limits. Contact us for specific details about sharing maximums for each plan level.',
                },
              ].map((item) => (
                <details key={item.q} className="group bg-white rounded-xl border p-0">
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                    <span className="font-medium text-slate-900 pr-4">{item.q}</span>
                    <HelpCircle className="w-5 h-5 text-slate-400 flex-shrink-0 group-open:text-teal-600 transition-colors" />
                  </summary>
                  <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-teal-600 to-emerald-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to enroll?
          </h2>
          <p className="text-teal-100 mb-8 max-w-xl mx-auto">
            Join thousands of families who trust Pay It Forward Health for their
            healthcare sharing needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/enroll">
              <Button
                size="lg"
                className="bg-white text-teal-700 hover:bg-teal-50 shadow-lg gap-2 w-full sm:w-auto"
              >
                Start Enrollment
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/faq">
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                View FAQ
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
