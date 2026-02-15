import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import {
  Heart,
  Shield,
  Users,
  ArrowRight,
  CheckCircle2,
  Star,
  Sparkles,
  HeartHandshake,
  Leaf,
  TrendingUp,
} from 'lucide-react';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.12),transparent)]" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-700">
                Community-powered health sharing
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight mb-6">
              Healthcare the way{' '}
              <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                it should be
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join a caring community where members share medical expenses together.
              Affordable, transparent, and built on the principle of paying it forward.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/enroll">
                <Button
                  size="lg"
                  className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 gap-2 w-full sm:w-auto"
                >
                  Start Your Enrollment
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 w-full sm:w-auto"
                >
                  Learn How It Works
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="bg-white border-y">
        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Active Members', value: '10,000+', icon: Users },
              { label: 'Needs Shared', value: '$5M+', icon: Heart },
              { label: 'Families Covered', value: '3,500+', icon: Shield },
              { label: 'Member Satisfaction', value: '98%', icon: Star },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="w-5 h-5 text-teal-600" />
                </div>
                <p className="text-2xl md:text-3xl font-bold text-slate-900">
                  {stat.value}
                </p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Overview */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              How health sharing works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A simple, transparent approach to managing healthcare costs
              as a community.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: '1',
                title: 'Join the Community',
                description:
                  'Choose a plan that fits your needs and complete your enrollment in minutes. Membership starts on the first of the next month.',
                icon: HeartHandshake,
                color: 'teal',
              },
              {
                step: '2',
                title: 'Share Monthly',
                description:
                  'Each month, your contribution goes into the sharing pool. This is how members support each other with medical needs.',
                icon: TrendingUp,
                color: 'emerald',
              },
              {
                step: '3',
                title: 'Get Support',
                description:
                  'When you have a medical need, submit it to the community. Eligible needs are shared by fellow members.',
                icon: Shield,
                color: 'blue',
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-teal-600/20 group-hover:shadow-xl group-hover:shadow-teal-600/30 transition-shadow">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 md:right-auto md:left-1/2 md:ml-6 w-7 h-7 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/how-it-works">
              <Button variant="outline" className="gap-2">
                Learn more about how it works
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Plan Preview */}
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
            {[
              {
                name: 'Essential',
                price: '149',
                description: 'Core coverage for individuals',
                features: [
                  'Primary care sharing',
                  'Emergency room visits',
                  'Hospitalization coverage',
                  'Preventive care benefits',
                ],
              },
              {
                name: 'Premium',
                price: '249',
                description: 'Comprehensive family coverage',
                popular: true,
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
                price: '349',
                description: 'Maximum coverage and benefits',
                features: [
                  'Everything in Premium',
                  'Dental & vision sharing',
                  'Maternity benefits',
                  'Lowest per-incident share',
                  'Wellness incentives',
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 md:p-8 ${
                  plan.popular
                    ? 'bg-gradient-to-b from-teal-600 to-teal-700 text-white shadow-xl shadow-teal-600/20 ring-4 ring-teal-600/20 scale-[1.02]'
                    : 'bg-white border shadow-sm'
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
                <div className="mt-4 mb-6">
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
                <Link href={`/enroll`}>
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'bg-white text-teal-700 hover:bg-teal-50'
                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                    }`}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/plans">
              <Button variant="link" className="text-teal-600 gap-2">
                View all plans and compare features
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Loved by our members
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Hear from real families who have experienced the power of community
              health sharing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                quote:
                  'Switching to Pay It Forward Health was the best decision for our family. We save over $400 a month compared to our old insurance, and the community support is incredible.',
                name: 'Sarah M.',
                role: 'Member since 2023',
              },
              {
                quote:
                  'When my son needed surgery, the sharing community came through for us. The process was simple and our need was covered quickly. I am so grateful.',
                name: 'David K.',
                role: 'Family plan member',
              },
              {
                quote:
                  'As a self-employed freelancer, traditional insurance was unaffordable. This healthshare gives me peace of mind at a price I can actually manage.',
                name: 'Maria L.',
                role: 'Individual plan member',
              },
            ].map((testimonial) => (
              <div
                key={testimonial.name}
                className="bg-slate-50 rounded-2xl p-6 md:p-8"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="text-slate-700 leading-relaxed mb-6">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div>
                  <p className="font-semibold text-slate-900">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Not Insurance Explainer */}
      <section className="section-padding bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 mb-4">
                  <Leaf className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">
                    A different approach
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">
                  Health sharing, not insurance
                </h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Pay It Forward Health is a health cost sharing ministry where members
                  voluntarily share each other&apos;s medical expenses. This is fundamentally
                  different from traditional insurance.
                </p>
                <ul className="space-y-3">
                  {[
                    'Members share costs directly -- no middleman markup',
                    'Transparent pricing with no hidden fees',
                    'Community-driven support and accountability',
                    'Focus on wellness and preventive care',
                    'Lower monthly costs than traditional plans',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">
                  Why members choose us
                </h3>
                <div className="space-y-4">
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-3xl font-bold">60%</p>
                    <p className="text-teal-100 text-sm">
                      average savings vs. traditional insurance
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-3xl font-bold">48 hrs</p>
                    <p className="text-teal-100 text-sm">
                      average need processing time
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-3xl font-bold">98%</p>
                    <p className="text-teal-100 text-sm">
                      of eligible needs shared successfully
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-600 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="container mx-auto px-4 relative text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to join a healthier community?
          </h2>
          <p className="text-lg text-teal-100 mb-8 max-w-2xl mx-auto">
            Start your enrollment today and join thousands of families who are paying
            it forward for each other&apos;s health.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/enroll">
              <Button
                size="lg"
                className="bg-white text-teal-700 hover:bg-teal-50 shadow-lg gap-2 w-full sm:w-auto"
              >
                Enroll Now
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/plans">
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 gap-2 w-full sm:w-auto"
              >
                Compare Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
