'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/primitives/Container';
import { SectionHeading } from '@/components/primitives/SectionHeading';
import {
  IconBuilding,
  IconShield,
  IconDb,
  IconPlug,
  IconBolt,
  IconList,
} from '@/components/icons';

const capabilities = [
  {
    icon: IconBuilding,
    title: 'Multi-tenant by design',
    body: 'Every record is scoped to an organization with row-level security. Subdomain-based tenant resolution, per-tenant theming, and isolated audit trails.',
  },
  {
    icon: IconShield,
    title: 'HIPAA-grade controls',
    body: 'PHI is segregated, encrypted at rest, and access-logged. Granular role permissions, BAA-ready, and SOC 2 Type II in flight.',
  },
  {
    icon: IconDb,
    title: 'Postgres + RLS foundation',
    body: 'Built on Supabase with hand-tuned RLS policies and idempotent migrations. Your data lives in your tenant — never co-mingled.',
  },
  {
    icon: IconPlug,
    title: 'API & webhooks first',
    body: 'A versioned REST API, signed webhooks, and event streams. Drop into your existing telephony, payment, or carrier integrations.',
  },
  {
    icon: IconBolt,
    title: 'Edge-rendered UI',
    body: 'Next.js 16 server components rendered at the edge. Sub-200ms response times even on cold visits — globally.',
  },
  {
    icon: IconList,
    title: 'Audit log everything',
    body: 'Every read, write, and admin action is captured to an immutable audit table. Export to your SIEM via webhook or signed URL.',
  },
];

export function PlatformSection() {
  return (
    <section className="section relative">
      <div aria-hidden="true" className="aurora-soft" />
      <Container className="relative">
        <SectionHeading
          eyebrow="Platform foundations"
          tone="violet"
          title={
            <>
              Engineered for the realities of{' '}
              <span className="text-gradient-helix">healthcare operations</span>.
            </>
          }
          description="Multi-tenant. Compliance-aware. API-first. Designed by operators, for operators — not by enterprise consultants."
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.03] sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group relative bg-ink-950/80 p-7 transition-colors hover:bg-ink-900"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-helix-cyan-500/20 to-helix-violet-500/20 ring-1 ring-white/10">
                <c.icon size={20} weight="duotone" className="text-helix-cyan-200" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-white">
                {c.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-helix-mist">
                {c.body}
              </p>

              {/* Subtle bottom-accent on hover */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-helix-cyan-500/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
