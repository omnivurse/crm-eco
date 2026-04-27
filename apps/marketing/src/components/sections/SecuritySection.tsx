'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/primitives/Container';
import { SectionHeading } from '@/components/primitives/SectionHeading';
import {
  IconLock,
  IconShield,
  IconVault,
  IconEye,
  IconCheckCircle,
} from '@/components/icons';

const trustItems = [
  { label: 'SOC 2 Type II', sub: 'Audit in progress · Q3 2026' },
  { label: 'HIPAA / BAA', sub: 'Signed for every tenant' },
  { label: 'AES-256 at rest', sub: 'Per-tenant key derivation' },
  { label: 'TLS 1.3 in transit', sub: 'HSTS + cert pinning' },
  { label: 'PII tokenization', sub: 'Reversible only with audit' },
  { label: 'Field-level redaction', sub: 'Role-aware export pipeline' },
];

const securityPillars = [
  {
    icon: IconShield,
    title: 'Tenant isolation',
    body: 'Every query is constrained by row-level security tied to organization_id. There is no super-admin override path that crosses tenants.',
  },
  {
    icon: IconLock,
    title: 'Zero-standing-access',
    body: 'Engineering access to production data is gated by a time-bound, audit-logged break-glass workflow with approver-of-record.',
  },
  {
    icon: IconVault,
    title: 'Encrypted backups',
    body: 'Hourly point-in-time recovery, geo-replicated immutable backups, and quarterly restore drills with documented RTO / RPO.',
  },
  {
    icon: IconEye,
    title: 'Continuous monitoring',
    body: 'Anomaly detection on auth, RLS bypass attempts, and bulk-export patterns — surfaced into your tenant audit log in real time.',
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="section relative">
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_30%,transparent_70%)]" aria-hidden="true" />
      <Container className="relative">
        <div className="grid items-start gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading
              align="left"
              eyebrow="Trust & security"
              title={
                <>
                  Built for the operators who can&apos;t afford a{' '}
                  <span className="text-gradient-helix">data incident</span>.
                </>
              }
              description="Healthcare data is held to a higher standard. We treat it that way — top to bottom, schema to UI."
            />

            <div className="mt-10 grid grid-cols-2 gap-3">
              {trustItems.map((t) => (
                <div
                  key={t.label}
                  className="rounded-xl glass p-4"
                >
                  <div className="flex items-center gap-2">
                    <IconCheckCircle size={14} weight="duotone" className="text-helix-lime-400" />
                    <p className="text-sm font-medium text-white">{t.label}</p>
                  </div>
                  <p className="mt-1 pl-6 text-xs text-helix-fog">{t.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:col-span-7 lg:grid-cols-2">
            {securityPillars.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                className="rounded-2xl glass-strong p-6"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-helix-cyan-500/10 ring-1 ring-helix-cyan-500/30">
                  <p.icon size={18} weight="duotone" className="text-helix-cyan-200" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-white">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-helix-mist">
                  {p.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
