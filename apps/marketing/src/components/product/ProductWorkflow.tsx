'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/primitives/Container';
import { SectionHeading } from '@/components/primitives/SectionHeading';
import { cn } from '@/lib/cn';

type Step = {
  code: string;
  title: string;
  body: string;
};

type ProductWorkflowProps = {
  eyebrow: string;
  title: React.ReactNode;
  tone: 'cyan' | 'violet';
  steps: Step[];
};

export function ProductWorkflow({ eyebrow, title, tone, steps }: ProductWorkflowProps) {
  return (
    <section className="section relative">
      <Container>
        <SectionHeading eyebrow={eyebrow} tone={tone} title={title} />

        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.03] lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.code}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="relative bg-ink-950/80 p-7"
            >
              <p
                className={cn(
                  'font-mono text-[11px] tracking-[0.22em]',
                  tone === 'cyan' ? 'text-helix-cyan-300' : 'text-helix-violet-300',
                )}
              >
                {s.code}
              </p>
              <h3 className="mt-5 font-display text-lg font-semibold text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-helix-mist">{s.body}</p>

              {/* Connector arrow on desktop, except last */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute right-3 top-1/2 hidden h-px w-6 lg:block',
                    tone === 'cyan' ? 'bg-helix-cyan-500/40' : 'bg-helix-violet-500/40',
                  )}
                />
              )}
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
