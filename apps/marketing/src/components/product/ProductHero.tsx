'use client';

import { motion } from 'framer-motion';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { HelixCanvas } from '@/components/helix/HelixCanvas';
import { HelixMark } from '@/components/brand/HelixMark';
import { IconArrowRight } from '@/components/icons';
import { cn } from '@/lib/cn';

type ProductHeroProps = {
  code: string;
  name: string;
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  tone: 'cyan' | 'violet';
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  highlights: { value: string; label: string }[];
};

export function ProductHero({
  code,
  name,
  eyebrow,
  title,
  description,
  tone,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  highlights,
}: ProductHeroProps) {
  const accentClasses =
    tone === 'cyan'
      ? {
          ring: 'ring-helix-cyan-500/30',
          chip: 'bg-helix-cyan-500/10 text-helix-cyan-100 border-helix-cyan-500/30',
          dot: 'bg-helix-cyan-300',
        }
      : {
          ring: 'ring-helix-violet-500/30',
          chip: 'bg-helix-violet-500/10 text-helix-violet-100 border-helix-violet-500/30',
          dot: 'bg-helix-violet-300',
        };

  const helixColors =
    tone === 'cyan'
      ? { color1: '#3DD6FF', color2: '#0DBEEB' }
      : { color1: '#937DFF', color2: '#6F5BFF' };

  return (
    <section className="relative overflow-hidden pb-16 pt-20 lg:pt-28">
      <div aria-hidden="true" className="aurora animate-aurora-shift" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_30%,black_20%,transparent_75%)]"
      />

      <Container className="relative">
        {/* Strand identity chip */}
        <div className="flex items-center justify-center gap-2 lg:justify-start">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 backdrop-blur-md',
              accentClasses.chip,
            )}
          >
            <span className={cn('h-1.5 w-1.5 animate-pulse-soft rounded-full', accentClasses.dot)} />
            <span className="font-mono text-[11px] tracking-[0.22em]">STRAND · {code}</span>
            <span className="text-[12px] font-medium">{name}</span>
          </span>
        </div>

        <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-12">
          {/* Copy */}
          <div className="lg:col-span-7">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={tone === 'cyan' ? 'eyebrow' : 'eyebrow-violet'}
            >
              {eyebrow}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="display-1 mt-5"
            >
              {title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-helix-mist sm:text-lg"
            >
              {description}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Button href={primaryHref} variant="primary" size="lg">
                {primaryLabel}
                <IconArrowRight size={16} weight="bold" />
              </Button>
              <Button href={secondaryHref} variant="ghost" size="lg">
                {secondaryLabel}
              </Button>
            </motion.div>

            {/* Highlights */}
            <motion.dl
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="mt-12 grid max-w-xl grid-cols-3 gap-6"
            >
              {highlights.map((h) => (
                <div key={h.label} className="border-l border-white/10 pl-4">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-helix-fog">
                    {h.label}
                  </dt>
                  <dd className="tabular mt-1 text-2xl font-medium text-white">
                    {h.value}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          {/* Helix visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5"
          >
            <div className="relative">
              <div
                className={cn(
                  'absolute -inset-6 rounded-[2.5rem] blur-2xl',
                  tone === 'cyan'
                    ? 'bg-gradient-to-tr from-helix-cyan-500/20 via-transparent to-helix-cyan-500/10'
                    : 'bg-gradient-to-tr from-helix-violet-500/20 via-transparent to-helix-violet-500/10',
                )}
              />
              <div className={cn('relative overflow-hidden rounded-3xl glass-strong ring-1', accentClasses.ring)}>
                <HelixCanvas height={520} {...helixColors} />

                {/* Top-left product mark */}
                <div className="pointer-events-none absolute left-5 top-5 inline-flex items-center gap-2 rounded-full glass px-3 py-1.5">
                  <HelixMark className="h-4 w-4" tone={tone} />
                  <span className="text-xs font-medium text-white">{name}</span>
                </div>

                {/* Bottom data strip */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-white/[0.06] bg-ink-950/70 px-5 py-3 backdrop-blur-md">
                  <div className="flex items-center justify-between text-[11px] tracking-[0.18em] text-helix-fog">
                    <span className="font-mono">DH/{code} · v1.0</span>
                    <span className="flex items-center gap-2">
                      <span className={cn('h-1.5 w-1.5 animate-pulse-soft rounded-full', accentClasses.dot)} />
                      ACTIVE
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
