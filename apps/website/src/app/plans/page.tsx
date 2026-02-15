import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Card, CardContent, Badge } from '@crm-eco/ui';
import {
  CheckCircle2,
  Minus,
  ArrowRight,
  Star,
  Shield,
  Heart,
  HelpCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Plans & Pricing',
  description:
    'Compare Pay It Forward Health sharing plans. Affordable monthly contributions for individuals and families. Find the right plan for your needs.',
};

const plans = [
  {
    name: 'Essential',
    price: 149,
    description: 'Core coverage for individuals',
    iua: '$2,500',
    features: [
      'Primary care sharing',
      'Emergency room visits',
      'Hospitalization coverage',
      'Preventive care benefits',
    ],
  },
  {
    name: 'Premium',
    price: 249,
    popular: true,
    description: 'Comprehensive family coverage',
    iua: '$1,500',
    features: [
      'Everything in Essential',
      'Specialist visits',
      'Mental health support',
      'Prescription assistance',
      'Lower per-incident share',
    ],
  },
  {
    name: 'Complete',
    price: 349,
    description: 'Maximum coverage and benefits',
    iua: '$500',
    features: [
      'Everything in Premium',
      'Dental & vision sharing',
      'Maternity benefits',
      'Lowest per-incident share',
      'Wellness incentives',
    ],
  },
];

const comparisonFeatures = [
  { name: 'Monthly Share', essential: '$149', premium: '$249', complete: '$349' },
  { name: 'Initial Unshareable Amount (IUA)', essential: '$2,500', premium: '$1,500', complete: '$500' },
  { name: 'Preventive Care', essential: true, premium: true, complete: true },
  { name: 'Primary Care', essential: true, premium: true, complete: true },
  { name: 'Specialist Visits', essential: false, premium: true, complete: true },
  { name: 'Emergency Room', essential: true, premium: true, complete: true },
  { name: 'Hospitalization', essential: true, premium: true, complete: true },
  { name: 'Mental Health', essential: false, premium: true, complete: true },
  { name: 'Prescription Assistance', essential: false, premium: true, complete: true },
  { name: 'Dental & Vision', essential: false, premium: false, complete: true },
  { name: 'Maternity', essential: false, premium: false, complete: true },
  { name: 'Wellness Incentives', essential: false, premium: false, complete: true },
];

export default function PlansPage() {
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
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 md:p-8 ${
                  plan.popular
                    ? 'bg-gradient-to-b from-teal-600 to-teal-700 text-white shadow-xl shadow-teal-600/20 ring-4 ring-teal-600/20 md:scale-[1.03]'
                    : 'bg-white border-2 border-slate-200 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full mb-4">
                    <Star className="w-3 h-3" />
                    Most Popular
                  </div>
                )}
                <h3
                  className={`text-xl font-bold ${
                    plan.popular ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    plan.popular ? 'text-teal-100' : 'text-slate-500'
                  }`}
                >
                  {plan.description}
                </p>
                <div className="mt-4 mb-2">
                  <span
                    className={`text-4xl font-bold ${
                      plan.popular ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    ${plan.price}
                  </span>
                  <span
                    className={`text-sm ${
                      plan.popular ? 'text-teal-100' : 'text-slate-500'
                    }`}
                  >
                    /month
                  </span>
                </div>
                <p
                  className={`text-xs mb-6 ${
                    plan.popular ? 'text-teal-200' : 'text-slate-400'
                  }`}
                >
                  IUA: {plan.iua} per incident
                </p>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          plan.popular ? 'text-teal-200' : 'text-teal-600'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          plan.popular ? 'text-teal-50' : 'text-slate-600'
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href="/enroll">
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'bg-white text-teal-700 hover:bg-teal-50'
                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                    }`}
                  >
                    Enroll Now
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
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
                    <th className="text-center p-4 text-sm font-semibold text-slate-700">
                      Essential
                    </th>
                    <th className="text-center p-4 text-sm font-semibold text-teal-700 bg-teal-50">
                      Premium
                    </th>
                    <th className="text-center p-4 text-sm font-semibold text-slate-700">
                      Complete
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, index) => (
                    <tr
                      key={feature.name}
                      className={index < comparisonFeatures.length - 1 ? 'border-b' : ''}
                    >
                      <td className="p-4 text-sm text-slate-700 font-medium">
                        {feature.name}
                      </td>
                      <td className="text-center p-4">
                        {typeof feature.essential === 'string' ? (
                          <span className="text-sm font-medium text-slate-700">
                            {feature.essential}
                          </span>
                        ) : feature.essential ? (
                          <CheckCircle2 className="w-5 h-5 text-teal-600 mx-auto" />
                        ) : (
                          <Minus className="w-5 h-5 text-slate-300 mx-auto" />
                        )}
                      </td>
                      <td className="text-center p-4 bg-teal-50/30">
                        {typeof feature.premium === 'string' ? (
                          <span className="text-sm font-semibold text-teal-700">
                            {feature.premium}
                          </span>
                        ) : feature.premium ? (
                          <CheckCircle2 className="w-5 h-5 text-teal-600 mx-auto" />
                        ) : (
                          <Minus className="w-5 h-5 text-slate-300 mx-auto" />
                        )}
                      </td>
                      <td className="text-center p-4">
                        {typeof feature.complete === 'string' ? (
                          <span className="text-sm font-medium text-slate-700">
                            {feature.complete}
                          </span>
                        ) : feature.complete ? (
                          <CheckCircle2 className="w-5 h-5 text-teal-600 mx-auto" />
                        ) : (
                          <Minus className="w-5 h-5 text-slate-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

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
