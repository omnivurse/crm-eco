'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/primitives/Container';
import { SectionHeading } from '@/components/primitives/SectionHeading';
import { IconQuote } from '@/components/icons';

const quotes = [
  {
    quote:
      'Replacing two legacy systems with Double Helix cut our enrollment cycle from 11 days to under 48 hours. The audit trail alone justified the move.',
    author: 'Avery Holm',
    role: 'COO, Carrington Health Sharing',
    metric: { value: '11 → 2', label: 'days to enroll' },
  },
  {
    quote:
      'The multi-tenancy is real, not a marketing claim. We onboarded three subsidiaries in a week with their own branding and zero data overlap.',
    author: 'Mariana Vasquez',
    role: 'Director of Operations, Northwave Group',
    metric: { value: '3 in 7', label: 'tenants live in week one' },
  },
  {
    quote:
      'Our compliance team approved Double Helix faster than any vendor we have onboarded. The security posture is genuinely engineered, not bolted on.',
    author: 'James Okafor',
    role: 'GRC Lead, Meridian Networks',
    metric: { value: '< 14', label: 'days vendor-review' },
  },
];

export function CustomersSection() {
  return (
    <section id="customers" className="section relative">
      <div aria-hidden="true" className="aurora-soft" />
      <Container className="relative">
        <SectionHeading
          eyebrow="In production"
          title={
            <>
              Operators don&apos;t adopt software lightly.{' '}
              <span className="text-gradient-helix">They adopted this.</span>
            </>
          }
        />

        <div className="mt-16 grid gap-5 lg:grid-cols-3">
          {quotes.map((q, i) => (
            <motion.figure
              key={q.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="relative flex flex-col rounded-3xl glass-strong p-7"
            >
              <IconQuote
                size={28}
                weight="duotone"
                className="text-helix-cyan-300/70"
              />
              <blockquote className="mt-5 flex-1 text-[15px] leading-relaxed text-white/90">
                {q.quote}
              </blockquote>
              <figcaption className="mt-7 border-t border-white/[0.06] pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{q.author}</p>
                    <p className="text-xs text-helix-fog">{q.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-base font-medium text-helix-cyan-200">
                      {q.metric.value}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-helix-fog">
                      {q.metric.label}
                    </p>
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
