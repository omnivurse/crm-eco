import Link from 'next/link';
import { Button } from '@crm-eco/ui';
import { ArrowRight } from 'lucide-react';
import { HomePlanCards } from '@/components/HomePlanCards';
import { HeroSection } from '@/components/HeroSection';

export default function HomePage() {
  return (
    <>
      {/* ── Hero Section ── */}
      <HeroSection />

      {/* ── How Health Sharing Works ── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-teal-600 font-semibold mb-3">
              How It Works
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-[family-name:var(--font-heading)]">
              A smarter way to manage healthcare costs
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {[
              {
                step: '1',
                title: 'Choose Your Plan',
                description:
                  'Browse our flexible plan options and select the coverage level that fits your family and budget. Enrollment takes just minutes.',
              },
              {
                step: '2',
                title: 'Share Monthly',
                description:
                  'Each month, your affordable contribution goes into the community sharing pool, where members support one another.',
              },
              {
                step: '3',
                title: 'Get Support When You Need It',
                description:
                  'When a medical need arises, submit it to the community. Eligible needs are processed quickly and shared by fellow members.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-teal-600/20 flex items-center justify-center mx-auto mb-6">
                  <span className="text-5xl font-bold text-teal-600 leading-none">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 font-[family-name:var(--font-heading)]">
                  {item.title}
                </h3>
                <p className="text-base text-slate-600 leading-relaxed font-[family-name:var(--font-body)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-teal-700 font-semibold hover:text-teal-800 transition-colors text-base"
            >
              Learn more about how it works
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Plan Cards ── */}
      <HomePlanCards />

      {/* ── Why Families Choose Us ── */}
      <section className="py-20 md:py-28 bg-[#F0F7FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left — Image */}
            <div className="order-2 md:order-1">
              <img
                src="https://images.unsplash.com/photo-1511895426328-dc8714191300?w=600&q=80"
                alt="Happy family smiling together"
                className="rounded-2xl shadow-xl w-full h-auto object-cover aspect-[4/3]"
              />
            </div>

            {/* Right — Stats */}
            <div className="order-1 md:order-2">
              <p className="text-sm uppercase tracking-widest text-teal-600 font-semibold mb-3">
                Why Families Choose Us
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-10 font-[family-name:var(--font-heading)]">
                Real results for real families
              </h2>

              <div className="space-y-8">
                <div>
                  <p className="text-4xl font-bold text-teal-700 font-[family-name:var(--font-heading)]">
                    60%
                  </p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">
                    Average savings
                  </p>
                  <p className="text-slate-600 font-[family-name:var(--font-body)]">
                    Members typically save up to 60% compared to traditional insurance premiums, keeping more money where it belongs.
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-8">
                  <p className="text-4xl font-bold text-teal-700 font-[family-name:var(--font-heading)]">
                    48-hour
                  </p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">
                    Processing time
                  </p>
                  <p className="text-slate-600 font-[family-name:var(--font-body)]">
                    Most eligible needs are reviewed and processed within 48 hours, so you never wait long for the support you need.
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-8">
                  <p className="text-4xl font-bold text-teal-700 font-[family-name:var(--font-heading)]">
                    98%
                  </p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">
                    Eligible needs shared
                  </p>
                  <p className="text-slate-600 font-[family-name:var(--font-body)]">
                    Our community consistently comes through &mdash; 98% of eligible medical needs are successfully shared among members.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-teal-600 font-semibold mb-3">
              Member Stories
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-[family-name:var(--font-heading)]">
              Hear from our community
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                quote:
                  'Switching to Pay It Forward Health was the best decision for our family. We save over $400 a month and the community support is unlike anything we have experienced before.',
                name: 'Sarah Mitchell',
                role: 'Member since 2023',
              },
              {
                quote:
                  'When my son needed surgery, the sharing community came through for us. The process was straightforward and our need was covered quickly. I could not be more grateful.',
                name: 'David Kim',
                role: 'Family plan member',
              },
              {
                quote:
                  'As a self-employed designer, traditional insurance was simply out of reach. This community gives me genuine peace of mind at a price I can actually afford.',
                name: 'Maria Lopez',
                role: 'Individual plan member',
              },
            ].map((testimonial) => (
              <div key={testimonial.name} className="flex flex-col">
                <span
                  className="text-5xl leading-none text-teal-200 font-serif select-none mb-4"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <p className="text-lg text-slate-700 italic leading-relaxed flex-1 font-[family-name:var(--font-body)]">
                  {testimonial.quote}
                </p>
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="font-bold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Health Sharing, Not Insurance — Dark Section ── */}
      <section className="py-20 md:py-28 relative overflow-hidden bg-[#002B5C] bg-[radial-gradient(ellipse_at_30%_50%,rgba(255,255,255,0.04)_0%,transparent_60%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-teal-300 font-semibold mb-3">
              A Different Model
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white font-[family-name:var(--font-heading)]">
              A different approach to healthcare
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center max-w-6xl mx-auto">
            {/* Left — Benefit Points */}
            <div>
              <ul className="space-y-5">
                {[
                  'Members share costs directly — no middleman',
                  'Transparent pricing with no hidden fees',
                  'Community-driven support',
                  'Focus on preventive care and wellness',
                  'Lower monthly costs than traditional plans',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-4">
                    <span className="text-emerald-400 text-xl mt-0.5 flex-shrink-0 font-bold">
                      &#10003;
                    </span>
                    <span className="text-white/90 text-lg leading-relaxed font-[family-name:var(--font-body)]">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-white/60 text-sm mt-8 leading-relaxed font-[family-name:var(--font-body)]">
                Pay It Forward Health is a health cost sharing ministry, not an
                insurance company. Members voluntarily share each other&apos;s
                medical expenses as an act of community and mutual aid.
              </p>
            </div>

            {/* Right — Image */}
            <div>
              <img
                src="https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&q=80"
                alt="Doctor consultation"
                className="rounded-2xl shadow-2xl w-full h-auto object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 md:py-28 bg-gradient-to-r from-teal-700 to-emerald-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_70%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-[family-name:var(--font-heading)]">
            Ready to join a healthier community?
          </h2>
          <p className="text-lg text-teal-100 mb-10 max-w-2xl mx-auto font-[family-name:var(--font-body)]">
            Take the first step today. Join thousands of families who are
            choosing transparency, community, and real savings for their
            healthcare.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/enroll">
              <Button
                size="lg"
                className="bg-white text-teal-700 hover:bg-teal-50 shadow-lg gap-2 w-full sm:w-auto font-semibold"
              >
                Start Enrollment
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/plans">
              <Button
                variant="outline"
                size="lg"
                className="border-white/40 text-white hover:bg-white/10 w-full sm:w-auto font-semibold"
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
