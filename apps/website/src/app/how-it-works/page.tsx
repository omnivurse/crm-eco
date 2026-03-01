'use client';

import Link from 'next/link';
import { Button, Card, CardContent } from '@crm-eco/ui';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Shield,
  Heart,
  Users,
  FileCheck,
  CreditCard,
  Send,
  HeartHandshake,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    number: 1,
    title: 'Choose Your Plan',
    description:
      'Select from Essential, Premium, or Complete plans based on your family size and coverage needs. Compare features and find the right fit.',
    icon: Shield,
  },
  {
    number: 2,
    title: 'Complete Enrollment',
    description:
      'Fill out our simple enrollment form with your household information. Most families complete enrollment in under 15 minutes.',
    icon: FileCheck,
  },
  {
    number: 3,
    title: 'Monthly Contributions',
    description:
      'Your monthly contribution goes into the sharing pool. This is how members support each other when medical needs arise.',
    icon: CreditCard,
  },
  {
    number: 4,
    title: 'Submit Medical Needs',
    description:
      'When you have an eligible medical expense, submit your need through our portal. We guide you through the process step by step.',
    icon: Send,
  },
  {
    number: 5,
    title: 'Community Shares',
    description:
      'Eligible needs are shared among members. You receive support from the community, and you support others with your contributions.',
    icon: HeartHandshake,
  },
];

const comparisonData = [
  {
    category: 'Monthly Cost',
    sharing: 'Typically 40-60% lower',
    insurance: 'Higher premiums, deductibles',
    sharingGood: true,
  },
  {
    category: 'Coverage Model',
    sharing: 'Members share eligible needs',
    insurance: 'Insurance company pays claims',
    sharingGood: true,
  },
  {
    category: 'Transparency',
    sharing: 'Full visibility into sharing',
    insurance: 'Complex policies, hidden terms',
    sharingGood: true,
  },
  {
    category: 'Community',
    sharing: 'Direct member-to-member support',
    insurance: 'Transactional relationship',
    sharingGood: true,
  },
  {
    category: 'Flexibility',
    sharing: 'Choose your providers',
    insurance: 'Network restrictions often apply',
    sharingGood: true,
  },
  {
    category: 'Claims Process',
    sharing: 'Simple submission, direct sharing',
    insurance: 'Complex claims, denials common',
    sharingGood: true,
  },
];

const eligibilityItems = [
  'Individuals and families of all sizes',
  'U.S. residents (varies by state)',
  'Those seeking affordable healthcare alternatives',
  'People who value community and transparency',
  'Self-employed and small business owners',
  'Families with healthy lifestyles',
];

export default function HowItWorksPage() {
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
                Simple & Transparent
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight mb-6">
              Understanding{' '}
              <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                Health Sharing
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Learn how Pay It Forward Health works — from choosing a plan to
              submitting needs and receiving support from our community.
            </p>
          </div>
        </div>
      </section>

      {/* Step-by-Step Walkthrough */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              How It Works in 5 Steps
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A straightforward process from enrollment to community support.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true, margin: '-50px' }}
                variants={{
                  initial: { opacity: 0, y: 20 },
                  animate: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-shrink-0 flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-xl font-bold">
                          {step.number}
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center md:hidden">
                          <step.icon className="w-6 h-6 text-teal-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="hidden md:flex w-12 h-12 rounded-xl bg-teal-50 items-center justify-center mb-3">
                          <step.icon className="w-6 h-6 text-teal-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">
                          {step.title}
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What is Health Sharing Explainer */}
      <section className="section-padding bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                What is Health Sharing?
              </h2>
            </div>
            <div className="space-y-4 text-slate-600 leading-relaxed">
              <p>
                Health sharing is a community-based approach to managing healthcare
                costs. Instead of paying premiums to an insurance company, members
                contribute a monthly amount that goes into a sharing pool. When
                members have eligible medical needs, the community shares those
                costs directly.
              </p>
              <p>
                Pay It Forward Health is a health cost sharing ministry — not
                insurance. We facilitate voluntary sharing among members who agree
                to our guidelines. This model often results in significantly lower
                monthly costs while maintaining transparency and a sense of
                community that traditional insurance cannot provide.
              </p>
              <p>
                Members choose their own healthcare providers, submit needs through
                our simple portal, and receive support from fellow members. It&apos;s
                healthcare the way it was meant to be: neighbor helping neighbor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Grid */}
      <section className="section-padding bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Health Sharing vs Traditional Insurance
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              See how community health sharing compares to conventional insurance.
            </p>
          </div>

          <div className="max-w-5xl mx-auto overflow-x-auto">
            <div className="min-w-[600px] border rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-3 bg-slate-50 border-b">
                <div className="p-4 font-semibold text-slate-900">Category</div>
                <div className="p-4 font-semibold text-teal-700 text-center">
                  Health Sharing
                </div>
                <div className="p-4 font-semibold text-slate-600 text-center">
                  Traditional Insurance
                </div>
              </div>
              {comparisonData.map((row) => (
                <div
                  key={row.category}
                  className="grid grid-cols-3 border-b last:border-b-0 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="p-4 font-medium text-slate-900">
                    {row.category}
                  </div>
                  <div className="p-4 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
                    <span className="text-slate-700 text-sm">
                      {row.sharing}
                    </span>
                  </div>
                  <div className="p-4 flex items-center justify-center gap-2">
                    <XCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 text-sm">
                      {row.insurance}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Eligibility Section */}
      <section className="section-padding bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                Who Can Join?
              </h2>
            </div>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Pay It Forward Health welcomes a wide range of members. Here&apos;s who
              typically joins our community:
            </p>
            <ul className="space-y-3">
              {eligibilityItems.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-slate-600 mt-6 text-sm">
              Eligibility may vary by state. Contact us or complete enrollment to
              confirm your eligibility.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-600 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="container mx-auto px-4 relative text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Join?
          </h2>
          <p className="text-lg text-teal-100 mb-8 max-w-2xl mx-auto">
            Start your enrollment today and become part of a community that shares
            healthcare costs — and cares for each other.
          </p>
          <Link href="/enroll">
            <Button
              size="lg"
              className="bg-white text-teal-700 hover:bg-teal-50 shadow-lg gap-2"
            >
              Enroll Now
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
