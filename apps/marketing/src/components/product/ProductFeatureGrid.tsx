'use client';

import type { Icon as PhIcon } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { Container } from '@/components/primitives/Container';
import { SectionHeading } from '@/components/primitives/SectionHeading';
import { cn } from '@/lib/cn';

type Feature = {
  icon: PhIcon;
  title: string;
  body: string;
};

type ProductFeatureGridProps = {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  tone: 'cyan' | 'violet';
  features: Feature[];
};

export function ProductFeatureGrid({
  eyebrow,
  title,
  description,
  tone,
  features,
}: ProductFeatureGridProps) {
  return (
    <section className="section relative">
      <div aria-hidden="true" className="aurora-soft" />
      <Container className="relative">
        <SectionHeading
          eyebrow={eyebrow}
          tone={tone}
          title={title}
          description={description}
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.03] sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              className="group relative bg-ink-950/80 p-7 transition-colors hover:bg-ink-900"
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg ring-1',
                  tone === 'cyan'
                    ? 'bg-helix-cyan-500/10 ring-helix-cyan-500/30'
                    : 'bg-helix-violet-500/10 ring-helix-violet-500/30',
                )}
              >
                <f.icon
                  size={20}
                  weight="duotone"
                  className={tone === 'cyan' ? 'text-helix-cyan-200' : 'text-helix-violet-200'}
                />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-helix-mist">{f.body}</p>

              <span
                className={cn(
                  'pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                  tone === 'cyan'
                    ? 'bg-gradient-to-r from-transparent via-helix-cyan-500/40 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-helix-violet-500/40 to-transparent',
                )}
              />
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
