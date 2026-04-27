'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Container } from '@/components/primitives/Container';
import { SectionHeading } from '@/components/primitives/SectionHeading';
import {
  IconUsers,
  IconBriefcase,
  IconArrowOut,
  IconCheck,
} from '@/components/icons';
import { HelixMark } from '@/components/brand/HelixMark';

const products = [
  {
    id: 'admin',
    code: '01',
    name: 'Admin',
    title: 'Member management & enrollment platform',
    description:
      'The system of record for members, agents, products, billing, and commissions — purpose-built for health sharing and enrollment-driven organizations.',
    href: '/admin',
    color: 'cyan' as const,
    icon: IconUsers,
    bullets: [
      'Multi-tenant member directory',
      'Plan & product configuration',
      'Billing, NACHA, & commissions',
      'Granular RLS-enforced access',
    ],
  },
  {
    id: 'crm',
    code: '02',
    name: 'CRM',
    title: 'Sales, advisor, & enrollment automation',
    description:
      'A modern pipeline CRM tuned for advisor networks: lead routing, hierarchy, deal stages, e-signature enrollment, and built-in compliance.',
    href: '/crm',
    color: 'violet' as const,
    icon: IconBriefcase,
    bullets: [
      'Advisor hierarchy & territories',
      'Lead capture → enrollment flow',
      'E-signature & document vault',
      'Compliance-ready audit trail',
    ],
  },
];

export function ProductDuoSection() {
  return (
    <section id="platform" className="section relative">
      <div aria-hidden="true" className="aurora-soft" />
      <Container className="relative">
        <SectionHeading
          eyebrow="The product duo"
          title={
            <>
              Two strands.{' '}
              <span className="text-gradient-helix">One platform.</span>
            </>
          }
          description="Use either standalone or together. Your data stays in sync across both — no integrations, no duplicate records, no compromises."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href={p.href}
                className="group relative block overflow-hidden rounded-3xl glass p-8 transition-all duration-500 hover:-translate-y-1 lg:p-10"
              >
                {/* Color glow on hover */}
                <div
                  className={`pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${
                    p.color === 'cyan'
                      ? 'bg-gradient-to-br from-helix-cyan-500/20 via-transparent to-transparent'
                      : 'bg-gradient-to-br from-helix-violet-500/20 via-transparent to-transparent'
                  }`}
                />
                {/* Top row: code + helix mark */}
                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${
                        p.color === 'cyan'
                          ? 'bg-helix-cyan-500/10 ring-helix-cyan-500/30'
                          : 'bg-helix-violet-500/10 ring-helix-violet-500/30'
                      }`}
                    >
                      <HelixMark className="h-5 w-5" tone={p.color} />
                    </span>
                    <div>
                      <p className="font-mono text-[11px] tracking-[0.2em] text-helix-fog">
                        STRAND · {p.code}
                      </p>
                      <p className="font-display text-lg font-semibold text-white">
                        {p.name}
                      </p>
                    </div>
                  </div>
                  <span className="text-helix-fog transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white">
                    <IconArrowOut size={18} weight="bold" />
                  </span>
                </div>

                <h3 className="relative mt-8 font-display text-2xl font-semibold leading-tight text-white sm:text-[28px]">
                  {p.title}
                </h3>
                <p className="relative mt-3 text-sm leading-relaxed text-helix-mist sm:text-base">
                  {p.description}
                </p>

                {/* Feature bullets */}
                <ul className="relative mt-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-white/85">
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${
                          p.color === 'cyan'
                            ? 'bg-helix-cyan-500/20 text-helix-cyan-200'
                            : 'bg-helix-violet-500/20 text-helix-violet-200'
                        }`}
                      >
                        <IconCheck size={11} weight="bold" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>

                {/* Bottom learn-more link */}
                <div className="relative mt-9 flex items-center justify-between border-t border-white/[0.06] pt-5">
                  <span
                    className={`text-sm font-medium ${
                      p.color === 'cyan' ? 'text-helix-cyan-200' : 'text-helix-violet-200'
                    }`}
                  >
                    Explore {p.name}
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.18em] text-helix-fog">
                    DH/{p.code}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
