import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  Badge,
} from '@crm-eco/ui';
import {
  DollarSign,
  Users,
  Award,
  ArrowRight,
  Star,
  Briefcase,
  FileCheck,
  GraduationCap,
  Wallet,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'For Advisors',
  description:
    'Partner with Double Helix Hub. Earn competitive commissions while helping families find affordable health sharing. Join our growing network of advisors.',
};

const benefits = [
  {
    title: 'Competitive Commissions',
    description:
      'Earn generous commissions on every membership you help bring to our community. Our tiered structure rewards top performers.',
    icon: DollarSign,
  },
  {
    title: 'Growing Network',
    description:
      'Join a community of advisors serving families across the country. Our member base continues to expand, creating more opportunities.',
    icon: Users,
  },
  {
    title: 'Marketing Support',
    description:
      'Access co-branded materials, social media assets, and training resources to help you succeed and grow your practice.',
    icon: Award,
  },
  {
    title: 'Dedicated Portal',
    description:
      'Manage your clients, track commissions, and access resources through our advisor-only portal designed for your workflow.',
    icon: Briefcase,
  },
];

const commissionTiers = [
  { level: 'Bronze', percent: '8%', minMembers: '1–24', color: 'amber' },
  { level: 'Silver', percent: '10%', minMembers: '25–49', color: 'slate' },
  { level: 'Gold', percent: '12%', minMembers: '50+', color: 'teal' },
];

const steps = [
  {
    step: 1,
    title: 'Apply',
    description:
      'Submit your application through our advisor portal. We review applications within 2–3 business days.',
    icon: FileCheck,
  },
  {
    step: 2,
    title: 'Get Trained',
    description:
      'Complete our onboarding and compliance training. Learn our plans, sharing guidelines, and best practices.',
    icon: GraduationCap,
  },
  {
    step: 3,
    title: 'Start Earning',
    description:
      'Begin enrolling families and earning commissions. Our team supports you every step of the way.',
    icon: Wallet,
  },
];

const testimonials = [
  {
    quote:
      'Partnering with Double Helix Hub has been a game-changer for my practice. The commissions are fair, the support is excellent, and I feel good helping families find affordable healthcare.',
    name: 'Jennifer R.',
    role: 'Independent Advisor, Texas',
    rating: 5,
  },
  {
    quote:
      'The training and marketing materials they provide are top-notch. I was up and running within a week, and my clients love the transparency of health sharing.',
    name: 'Marcus T.',
    role: 'Health Benefits Consultant, Florida',
    rating: 5,
  },
  {
    quote:
      "I've been an advisor for two years now. The dedicated portal makes it easy to manage everything, and the commission structure really rewards consistency.",
    name: 'Sarah L.',
    role: 'Family Benefits Specialist, Ohio',
    rating: 5,
  },
];

export default function ForAdvisorsPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden hub-inner-page-hero">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.12),transparent)]" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 hub-icon-chip border rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-cyan-700">
                Advisor Partnership Program
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight mb-6">
              Partner with{' '}
              <span className="gradient-text">
                Double Helix Hub
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
              Earn while helping families find affordable health sharing. Join our
              network of advisors who are making a difference in their communities.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/contact">
                <Button
                  size="lg"
                  className="hub-btn-gradient text-white shadow-lg shadow-cyan-500/20 gap-2 w-full sm:w-auto"
                >
                  Apply Now
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <Link href="/contact">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 w-full sm:w-auto"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition - Benefit Cards */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Why advisors choose us
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Everything you need to grow your practice and serve families well.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {benefits.map((benefit) => (
              <Card
                key={benefit.title}
                className="border shadow-sm hover:shadow-md transition-shadow h-full"
              >
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl hub-gradient-icon flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Commission Structure */}
      <section className="section-padding bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Commission structure
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Simple, transparent tiers that reward your growth.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {commissionTiers.map((tier) => (
              <Card
                key={tier.level}
                className={`border shadow-sm overflow-hidden ${
                  tier.color === 'teal' ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div
                  className={`h-1.5 ${
                    tier.color === 'teal'
                      ? 'hub-gradient-icon'
                      : tier.color === 'slate'
                        ? 'bg-slate-400'
                        : 'bg-amber-400'
                  }`}
                />
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-900">
                      {tier.level}
                    </h3>
                    {tier.color === 'teal' && (
                      <Badge className="hub-icon-chip text-cyan-700 hover:bg-cyan-50">
                        Best Value
                      </Badge>
                    )}
                  </div>
                  <p className="text-3xl font-bold text-primary mb-1">
                    {tier.percent}
                  </p>
                  <p className="text-sm text-slate-500 mb-4">
                    commission per membership
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Active members:</span>{' '}
                    {tier.minMembers}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How to Become an Advisor */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              How to become an advisor
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Three simple steps to start earning with Double Helix Hub.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="w-16 h-16 rounded-2xl hub-gradient-icon flex items-center justify-center mx-auto mb-5 shadow-lg shadow-cyan-500/20">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-2 md:right-auto md:left-1/2 md:ml-6 w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <a href="/contact">
              <Button
                size="lg"
                className="hub-btn-gradient text-white gap-2"
              >
                Start Your Application
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Advisor Testimonials */}
      <section className="section-padding bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              What advisors are saying
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Hear from advisors who have partnered with Double Helix Hub.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial) => (
              <Card
                key={testimonial.name}
                className="border shadow-sm h-full"
              >
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
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
                    <p className="text-sm text-slate-500">
                      {testimonial.role}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden hub-cta-band py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="container mx-auto px-4 relative text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to partner with us?
          </h2>
          <p className="text-lg text-cyan-100 mb-8 max-w-2xl mx-auto">
            Join our network of advisors and start earning while helping families
            find affordable health sharing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/contact">
              <Button
                size="lg"
                className="bg-white text-cyan-700 hover:bg-cyan-50 shadow-lg gap-2 w-full sm:w-auto"
              >
                Apply Now
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <Link href="/contact">
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 gap-2 w-full sm:w-auto"
              >
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
