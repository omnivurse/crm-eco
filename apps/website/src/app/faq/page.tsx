'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button, Input } from '@crm-eco/ui';
import { Search, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

const categories = [
  'All',
  'General',
  'Membership',
  'Billing',
  'Needs & Sharing',
  'Eligibility',
] as const;

const faqItems = [
  {
      question: 'What is health sharing?',
      answer:
        'Health sharing is a community-based approach to managing healthcare costs. Members voluntarily contribute a monthly amount to a shared pool, and when a member has an eligible medical need, the community shares the cost. Double Helix Hub is a health cost sharing ministry — we are not insurance, but we provide an affordable alternative for individuals and families who share similar values.',
      category: 'General' as const,
    },
    {
      question: 'How is this different from insurance?',
      answer:
        'Health sharing is fundamentally different from insurance. We are not an insurance company — we are a community of members who voluntarily share each other\'s medical expenses. There are no premiums paid to an insurer; instead, your monthly share goes directly to help fellow members. We have no profit motive, no complex claims denials, and a transparent process. Many members find they save 40-60% compared to traditional insurance while receiving compassionate support from the community.',
      category: 'General' as const,
    },
    {
      question: 'Who is eligible?',
      answer:
        'Eligibility varies by plan. Generally, we welcome individuals and families who agree with our shared statement of beliefs. You must be a U.S. resident, and some plans have age or household composition requirements. Pre-existing conditions may have waiting periods. Contact us or review the enrollment materials for specific eligibility criteria for your chosen plan.',
      category: 'Eligibility' as const,
    },
    {
      question: 'What are monthly share amounts?',
      answer:
        'Monthly share amounts are your voluntary contribution to the sharing pool each month. They vary by plan tier (Essential, Premium, Complete) and household size. For example, Essential starts at $149/mo for individuals, Premium at $249/mo, and Complete at $349/mo. Family rates are available. Your share goes directly to help fellow members with eligible medical needs — it is not an insurance premium.',
      category: 'Billing' as const,
    },
    {
      question: 'How do I submit a need?',
      answer:
        'When you have a medical expense, log into your member portal and submit a "need" with your provider\'s bill and supporting documentation. Our team reviews it for eligibility according to our guidelines. Once approved, your need is shared with the community and you will receive support. Most needs are processed within 48-72 hours. You can also call our member services team for assistance.',
      category: 'Needs & Sharing' as const,
    },
    {
      question: 'What is the IUA?',
      answer:
        'The IUA (Initial Unshareable Amount) is the amount you pay out of pocket for each medical incident before the community begins sharing. Think of it like a per-incident deductible. For example, with a $500 IUA, you pay the first $500 of an eligible need, and the community shares amounts above that. Lower-tier plans have higher IUAs; Complete plans have the lowest at $250 per incident.',
      category: 'General' as const,
    },
    {
      question: 'Are pre-existing conditions covered?',
      answer:
        'Pre-existing conditions may be subject to a waiting period, typically 12-24 months depending on the condition and plan. After the waiting period, many pre-existing conditions become eligible for sharing. We encourage you to review our guidelines or speak with our team to understand how your specific situation would be handled. We are committed to transparency about what is and is not shareable.',
      category: 'Eligibility' as const,
    },
    {
      question: 'Can I keep my doctor?',
      answer:
        'Yes. Unlike many insurance plans with narrow networks, health sharing does not restrict you to specific providers. You can see any licensed healthcare provider you choose. You pay the provider (or use our provider network for discounted rates when available), then submit your need for sharing. This freedom of choice is one of the benefits our members appreciate most.',
      category: 'Membership' as const,
    },
    {
      question: 'How long does enrollment take?',
      answer:
        'Enrollment typically takes 10-15 minutes online. You will provide household information, select your plan, and complete the membership agreement. Membership becomes effective on the first of the month following your enrollment. You will receive a welcome packet and access to the member portal within a few days.',
      category: 'Membership' as const,
    },
    {
      question: 'Is this ACA compliant?',
      answer:
        'Health sharing ministries are exempt from the Affordable Care Act (ACA) individual mandate requirements. We are not insurance and do not provide ACA-compliant health insurance. If you need an ACA-compliant plan for specific reasons (e.g., subsidies), you may need to consider marketplace insurance. Many of our members choose health sharing for its affordability and community focus.',
      category: 'General' as const,
    },
    {
      question: "What's not eligible for sharing?",
      answer:
        'Certain expenses are not eligible for sharing under our guidelines. These typically include: elective procedures, treatment for lifestyle choices that violate our beliefs, care that could have been prevented, and expenses incurred before membership. We provide a clear list of non-shareable items in our guidelines. When in doubt, contact us before incurring a large expense.',
      category: 'Needs & Sharing' as const,
    },
    {
      question: 'How do I cancel?',
      answer:
        'You may cancel your membership at any time by contacting member services or through your member portal. Cancellation takes effect at the end of your current billing period. You will remain eligible for sharing of needs that were submitted before your cancellation date. We do not charge cancellation fees. We hope you stay, but we make it easy to leave if your circumstances change.',
      category: 'Billing' as const,
    },
    {
      question: 'How are needs processed?',
      answer:
        'When you submit a need, our team reviews the documentation for completeness and eligibility. Eligible needs are then shared with the community. Members\' monthly contributions fund the sharing pool. Processing typically takes 48-72 hours for straightforward needs; complex cases may take longer. You will receive updates via email and can track status in your member portal.',
      category: 'Needs & Sharing' as const,
    },
    {
      question: 'What about prescriptions?',
      answer:
        'Prescription assistance is included in Premium and Complete plans. We work with pharmacy networks to provide discounted rates on medications. You may submit prescription costs as a need for sharing once you have met your IUA. Some preventive medications may be shareable. Check your plan details for specific prescription benefits and any formulary restrictions.',
      category: 'Needs & Sharing' as const,
    },
  {
    question: 'Can I add family members?',
    answer:
      'Yes. You can add a spouse and dependent children to your plan. Family members are added at the start of the next month. Premium and Complete plans offer the best value for families with lower per-person costs. To add family members, log into your portal or contact member services. You may need to provide documentation for dependents.',
    category: 'Membership' as const,
  },
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const filteredFaqs = useMemo(() => {
    return faqItems.filter((item) => {
      const matchesCategory =
        activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch =
        searchQuery === '' ||
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const toggleOpen = (question: string) => {
    setOpenQuestion((prev) => (prev === question ? null : question));
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.12),transparent)]" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight mb-6">
              Have questions?{' '}
              <span className="bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
                We have answers.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Find answers to common questions about Double Helix Hub, our plans,
              and how health sharing works.
            </p>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="section-padding bg-white -mt-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Search */}
            <div className="relative mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="search"
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-base"
              />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 mb-10">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(cat)}
                  className={
                    activeCategory === cat
                      ? 'bg-teal-600 hover:bg-teal-700 text-white'
                      : ''
                  }
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* FAQ Accordion */}
            <div className="space-y-3">
              {filteredFaqs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-lg">No FAQs match your search.</p>
                  <p className="text-sm mt-2">
                    Try a different search term or category.
                  </p>
                </div>
              ) : (
                filteredFaqs.map((item) => {
                  const isOpen = openQuestion === item.question;
                  return (
                    <div
                      key={item.question}
                      className="border rounded-xl overflow-hidden shadow-sm bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => toggleOpen(item.question)}
                        className="w-full flex items-center justify-between text-left py-4 px-5 font-semibold text-slate-900 hover:bg-slate-50/50 transition-colors"
                      >
                        <span className="pr-4">{item.question}</span>
                        <span className="flex-shrink-0 text-teal-600">
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 pt-0 border-t">
                          <p className="text-slate-600 leading-relaxed pt-4">
                            {item.answer}
                          </p>
                          <span className="inline-block mt-3 text-xs font-medium text-teal-600">
                            {item.category}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-600 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="container mx-auto px-4 relative text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Still have questions?
          </h2>
          <p className="text-lg text-teal-100 mb-8 max-w-2xl mx-auto">
            Our team is here to help. Reach out and we&apos;ll get back to you as soon
            as possible.
          </p>
          <Link href="/contact">
            <Button
              size="lg"
              className="bg-white text-teal-700 hover:bg-teal-50 shadow-lg gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Contact us
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
