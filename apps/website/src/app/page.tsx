import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import {
  ArrowRight,
  CheckCircle2,
  Star,
  HeartHandshake,
  Leaf,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { HomePlanCards } from '@/components/HomePlanCards';
import { HeroSection } from '@/components/HeroSection';

export default function HomePage() {
  return (
    <>
      {/* Hero Section (animated) */}
      <HeroSection />

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
      <HomePlanCards />

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
