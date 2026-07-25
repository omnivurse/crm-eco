'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button, Input } from '@crm-eco/ui';
import { Search, ChevronDown, HelpCircle, Phone, Mail, MessageCircle } from 'lucide-react';
import { Reveal } from '@/components/sections/Reveal';
import {
  Container,
  Eyebrow,
  IconChip,
  CTABand,
} from '@/components/sections/blocks';
import { BRAND, PHONE, EMAIL } from '@/lib/site';

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
        'Health sharing is a community-based way to manage medical costs. Members voluntarily contribute an affordable amount each month into a shared community, and when a member has an eligible medical need, the community helps share the cost. Pay It Forward Health is a health care sharing program — we are not insurance, but we offer a transparent, affordable alternative for individuals and families who want to take care of one another.',
      category: 'General' as const,
    },
    {
      question: 'How is this different from insurance?',
      answer:
        'Health sharing is fundamentally different from insurance. We are not an insurance company — we are a community of members who voluntarily help share one another\'s eligible medical expenses. There are no premiums paid to an insurer; instead, your monthly share goes directly toward helping fellow members. There is no profit motive, no confusing claim denials, and the process stays transparent. Many members find they pay far less each month than they would for comparable insurance, while gaining the support of a real community.',
      category: 'General' as const,
    },
    {
      question: 'Who is eligible?',
      answer:
        'We welcome people of every background and belief — there is no religious requirement and no health questionnaire to get a quote. Generally you must be a U.S. resident, and some programs have age or household requirements. Pre-existing conditions may have a waiting period. Because there is no open-enrollment window, you can join any time of year. Reach out or review the enrollment materials for the specifics of the program you choose.',
      category: 'Eligibility' as const,
    },
    {
      question: 'What are monthly share amounts?',
      answer:
        'Your monthly share is the affordable amount you contribute to the community each month. Shares vary by program tier (Essential, Premium, Complete) and household size. For example, Essential starts at $149/mo for individuals, Premium at $249/mo, and Complete at $349/mo, with family rates available. Your share goes directly toward helping fellow members with eligible medical needs — it is not an insurance premium.',
      category: 'Billing' as const,
    },
    {
      question: 'How do I submit a need?',
      answer:
        'When you have a medical expense, log into your member portal and submit a "need" along with your provider\'s bill and any supporting documents. Our team reviews it for eligibility according to the sharing guidelines. Once approved, your need is shared by the community and you receive support. Most needs are processed within 48–72 hours. You can also call our member services team any time you would like a hand.',
      category: 'Needs & Sharing' as const,
    },
    {
      question: 'What is the IUA?',
      answer:
        'The IUA (Initial Unshareable Amount) is the amount you pay out of pocket for each medical incident before the community begins sharing. Think of it like a per-incident responsibility amount. For example, with a $500 IUA, you cover the first $500 of an eligible need, and the community shares amounts above that. Lower-tier programs carry a higher IUA; Complete programs have the lowest at $250 per incident.',
      category: 'General' as const,
    },
    {
      question: 'Are pre-existing conditions covered?',
      answer:
        'Pre-existing conditions may be subject to a waiting period, typically 12–24 months depending on the condition and program. After the waiting period, many pre-existing conditions become eligible for sharing. We encourage you to review the guidelines or speak with our team so you understand exactly how your situation would be handled. We are committed to being transparent about what is and is not shareable.',
      category: 'Eligibility' as const,
    },
    {
      question: 'Can I keep my doctor?',
      answer:
        'Yes. Unlike many insurance plans with narrow networks, health sharing does not restrict you to specific providers. You can see any licensed healthcare provider you choose, with no referrals to chase. You pay the provider (or use available cash-pay and discount programs), then submit your need for sharing. This freedom of choice is one of the things our members appreciate most.',
      category: 'Membership' as const,
    },
    {
      question: 'How long does enrollment take?',
      answer:
        'Enrollment usually takes about 10–15 minutes online — no agents and no pressure. You provide your household information, choose your program, and complete the membership agreement. Membership becomes effective on the first of the month following your enrollment. You will receive a welcome packet and access to the member portal within a few days.',
      category: 'Membership' as const,
    },
    {
      question: 'Is this ACA compliant?',
      answer:
        'Health care sharing programs are not insurance and are treated differently under the Affordable Care Act (ACA). We do not provide ACA-compliant health insurance. If you specifically need an ACA-compliant plan (for example, to receive subsidies), you may want to consider marketplace insurance. Many of our members choose health sharing for its affordability, transparency, and community focus.',
      category: 'General' as const,
    },
    {
      question: "What's not eligible for sharing?",
      answer:
        'Certain expenses are not eligible for sharing under our guidelines. These typically include elective procedures, certain lifestyle-related care, preventable situations, and expenses incurred before your membership began. We publish a clear list of non-shareable items in our guidelines. When in doubt, contact us before incurring a large expense and we will help you understand what to expect.',
      category: 'Needs & Sharing' as const,
    },
    {
      question: 'How do I cancel?',
      answer:
        'You may cancel your membership at any time through your member portal or by contacting member services. Cancellation takes effect at the end of your current billing period, and there are no cancellation fees. You remain eligible for sharing of needs that were submitted before your cancellation date. We hope you stay — but we make it easy to leave if your circumstances change.',
      category: 'Billing' as const,
    },
    {
      question: 'How are needs processed?',
      answer:
        'When you submit a need, our team reviews the documentation for completeness and eligibility. Eligible needs are then shared by the community, funded by members\' monthly contributions. Processing typically takes 48–72 hours for straightforward needs; more complex cases may take a little longer. You receive updates by email and can track the status any time in your member portal.',
      category: 'Needs & Sharing' as const,
    },
    {
      question: 'What about prescriptions?',
      answer:
        'Prescription savings are included in Premium and Complete programs. We work with pharmacy networks to offer discounted rates on medications, and you may submit prescription costs as a need for sharing once you have met your IUA. Some preventive medications may be shareable. Check your program details for specific prescription benefits and any formulary notes.',
      category: 'Needs & Sharing' as const,
    },
  {
    question: 'Can I add family members?',
    answer:
      'Yes. You can add a spouse and dependent children to your program. Family members are added at the start of the next month. Premium and Complete programs offer the best value for families, with lower per-person costs. To add family members, log into your portal or contact member services — you may be asked to provide documentation for dependents.',
    category: 'Membership' as const,
  },
  {
    question: 'When does my membership start?',
    answer:
      'Because there is no open-enrollment window, you can join any time of year. Your membership becomes effective on the first day of the month after you complete enrollment, and your monthly share begins then. From that date forward, eligible needs that arise can be submitted for sharing by the community.',
    category: 'Membership' as const,
  },
  {
    question: 'Is there a network of doctors I have to use?',
    answer:
      'No. There are no provider networks with health sharing. You are free to see any licensed doctor, specialist, or hospital you trust, anywhere in the country. Some members use cash-pay rates or our partner discounts to keep costs down, but you are never locked into a network or required to get a referral.',
    category: 'Membership' as const,
  },
  {
    question: 'Does maternity have a waiting period?',
    answer:
      'Maternity needs are eligible for sharing under most family programs, and they are typically subject to a waiting period before conception. The exact waiting period and shareable amounts depend on the program you choose. We are glad to walk you through the maternity guidelines so you can plan with confidence — just reach out to our member services team.',
    category: 'Needs & Sharing' as const,
  },
  {
    question: 'What happens in an emergency?',
    answer:
      'In a true emergency, always seek care immediately — your health comes first. Go to the nearest emergency room or call 911 as needed. Afterward, submit the bills as a need through your member portal, and our team will review them for sharing according to the guidelines. Our medical advocacy team can also help review and negotiate large emergency bills on your behalf.',
    category: 'Needs & Sharing' as const,
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
      {/* Inner-page hero */}
      <section className="hub-inner-page-hero relative overflow-hidden">
        <Container className="relative py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <IconChip icon={HelpCircle} variant="brand" className="mx-auto mb-6" />
              <Eyebrow className="mb-4">Frequently asked questions</Eyebrow>
              <h1 className="font-heading text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.08] text-pif-navy-800 text-balance">
                Have questions?{' '}
                <span className="gradient-text">We have answers.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Everything you want to know about {BRAND.name}, our programs, and how
                health sharing actually works. Remember: we are a caring community, not
                insurance — and you can join any time of year.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Search, filters & accordion */}
      <section className="bg-white pb-20 pt-4 md:pb-28">
        <Container>
          <div className="mx-auto max-w-3xl">
            {/* Search */}
            <Reveal>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-pif-teal-500"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  placeholder="Search questions and answers…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search frequently asked questions"
                  className="h-14 rounded-2xl border-pif-navy-100 bg-pif-mist pl-12 text-base shadow-sm ring-1 ring-pif-navy/5 focus-visible:ring-pif-teal-400"
                />
              </div>
            </Reveal>

            {/* Category filter chips */}
            <Reveal delay={0.05}>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      aria-pressed={isActive}
                      className={
                        isActive
                          ? 'pif-grad-care rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pif-teal/25 transition-all'
                          : 'rounded-full border border-pif-navy-100 bg-white px-4 py-2 text-sm font-semibold text-pif-navy-700 transition-all hover:border-pif-teal-300 hover:text-pif-teal-700'
                      }
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </Reveal>

            {/* Result count */}
            <p className="mt-8 text-center text-sm font-medium text-slate-500">
              {filteredFaqs.length}{' '}
              {filteredFaqs.length === 1 ? 'question' : 'questions'}
              {activeCategory !== 'All' && (
                <>
                  {' '}
                  in <span className="text-pif-teal-700">{activeCategory}</span>
                </>
              )}
            </p>

            {/* Accordion */}
            <div className="mt-6 space-y-3">
              {filteredFaqs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-pif-navy-200 bg-pif-mist px-6 py-16 text-center">
                  <IconChip icon={Search} variant="soft" className="mx-auto mb-4" />
                  <p className="font-heading text-lg font-semibold text-pif-navy-800">
                    No questions match your search.
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Try a different term or pick another category — or reach out and
                    we&apos;ll answer personally.
                  </p>
                </div>
              ) : (
                filteredFaqs.map((item) => {
                  const isOpen = openQuestion === item.question;
                  return (
                    <div
                      key={item.question}
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm ring-1 transition-all duration-300 ${
                        isOpen
                          ? 'border-pif-teal-200 ring-pif-teal-100'
                          : 'border-pif-navy-100 ring-pif-navy/5 hover:border-pif-teal-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleOpen(item.question)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-pif-mist/60 sm:px-6"
                      >
                        <span className="font-heading text-base font-semibold text-pif-navy-800 sm:text-lg">
                          {item.question}
                        </span>
                        <span
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                            isOpen
                              ? 'pif-grad-care rotate-180 text-white'
                              : 'bg-pif-teal-50 text-pif-teal-700'
                          }`}
                        >
                          <ChevronDown className="h-5 w-5" aria-hidden="true" />
                        </span>
                      </button>
                      <div
                        className={`grid transition-all duration-300 ease-out ${
                          isOpen
                            ? 'grid-rows-[1fr] opacity-100'
                            : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="border-t border-pif-navy-100 px-5 pb-6 pt-4 sm:px-6">
                            <p className="leading-relaxed text-slate-600">
                              {item.answer}
                            </p>
                            <span className="mt-4 inline-flex items-center rounded-full bg-pif-teal-50 px-3 py-1 text-xs font-semibold text-pif-teal-700">
                              {item.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Still have questions? Contact note */}
            <Reveal delay={0.05}>
              <div className="mt-12 rounded-3xl border border-pif-navy-100 bg-pif-mist p-8 text-center ring-1 ring-pif-navy/5 sm:p-10">
                <IconChip icon={MessageCircle} variant="gold" className="mx-auto mb-5" />
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  Still have questions?
                </h2>
                <p className="mx-auto mt-3 max-w-xl leading-relaxed text-slate-600">
                  We&apos;re real people, happy to help. Reach out and a member of our
                  team will walk you through anything — no pressure, no sales script.
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link href="/contact">
                    <Button size="lg" className="hub-btn-gradient w-full gap-2 sm:w-auto">
                      <MessageCircle className="h-5 w-5" />
                      Contact us
                    </Button>
                  </Link>
                  <a
                    href={`tel:${PHONE.tel}`}
                    className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
                  >
                    <Phone className="h-4 w-4" />
                    {PHONE.display}
                  </a>
                  <a
                    href={`mailto:${EMAIL.support}`}
                    className="inline-flex items-center gap-2 font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
                  >
                    <Mail className="h-4 w-4" />
                    {EMAIL.support}
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <CTABand
        title="Ready to join a community that cares?"
        subtitle="No open-enrollment window, no networks, no surprises. Join any time of year and start sharing with people who show up for one another."
        primary={{ label: 'Become a Member', href: '/enroll' }}
        secondary={{ label: 'Compare Plans', href: '/plans' }}
      />
    </>
  );
}
