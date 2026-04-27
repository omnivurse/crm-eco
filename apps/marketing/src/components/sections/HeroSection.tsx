'use client';

import { motion, type Variants } from 'framer-motion';
import { Container } from '@/components/primitives/Container';
import { Button } from '@/components/primitives/Button';
import { HelixCanvas } from '@/components/helix/HelixCanvas';
import {
  IconArrowRight,
  IconShield,
  IconUsers,
  IconCube,
} from '@/components/icons';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.1 + i * 0.08, ease: EASE },
  }),
};

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-20 lg:pt-28">
      {/* Backdrop layers */}
      <div aria-hidden="true" className="aurora animate-aurora-shift" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_30%,black_20%,transparent_75%)]"
      />

      <Container className="relative">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* LEFT — Copy */}
          <div className="lg:col-span-7">
            <motion.span
              initial="hidden"
              animate="visible"
              custom={0}
              variants={fadeUp}
              className="eyebrow"
            >
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-helix-cyan-300" />
              The two-strand healthcare platform
            </motion.span>

            <motion.h1
              initial="hidden"
              animate="visible"
              custom={1}
              variants={fadeUp}
              className="display-1 mt-5"
            >
              One platform.{' '}
              <span className="text-gradient-helix">Two intertwined products.</span>
              <br />
              Zero compromises.
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              custom={2}
              variants={fadeUp}
              className="mt-7 max-w-xl text-base leading-relaxed text-helix-mist sm:text-lg"
            >
              Double Helix pairs a member-management Admin platform with a sales
              & enrollment CRM — engineered as a single multi-tenant operating
              system for healthcare organizations.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              custom={3}
              variants={fadeUp}
              className="mt-10 flex flex-col gap-3 sm:flex-row"
            >
              <Button href="/contact?intent=demo" variant="primary" size="lg">
                Book a demo
                <IconArrowRight size={16} weight="bold" />
              </Button>
              <Button href="/admin" variant="ghost" size="lg">
                Explore the platform
              </Button>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              initial="hidden"
              animate="visible"
              custom={4}
              variants={fadeUp}
              className="mt-12 grid max-w-lg grid-cols-3 gap-6"
            >
              <TrustItem
                icon={<IconShield size={18} weight="duotone" className="text-helix-cyan-300" />}
                label="HIPAA-ready"
              />
              <TrustItem
                icon={<IconUsers size={18} weight="duotone" className="text-helix-violet-300" />}
                label="Multi-tenant"
              />
              <TrustItem
                icon={<IconCube size={18} weight="duotone" className="text-helix-cyan-300" />}
                label="API-first"
              />
            </motion.div>
          </div>

          {/* RIGHT — Animated double helix */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5"
          >
            <div className="relative">
              {/* Glowing frame */}
              <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-helix-cyan-500/15 via-transparent to-helix-violet-500/15 blur-2xl" />

              <div className="relative overflow-hidden rounded-3xl glass-strong">
                <HelixCanvas height={580} />

                {/* Corner labels — strand identity */}
                <div className="pointer-events-none absolute left-5 top-5 flex flex-col gap-2">
                  <StrandTag color="cyan" label="Admin" code="01" />
                </div>
                <div className="pointer-events-none absolute right-5 bottom-5 flex flex-col gap-2 items-end">
                  <StrandTag color="violet" label="CRM" code="02" />
                </div>

                {/* Bottom data strip */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-white/[0.06] bg-ink-950/70 px-5 py-3 backdrop-blur-md">
                  <div className="flex items-center justify-between text-[11px] tracking-[0.18em] text-helix-fog">
                    <span className="font-mono">SEQ · DH-001</span>
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-helix-lime-400" />
                      LIVE SYNC
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Logo cloud */}
        <div className="mt-20 lg:mt-28">
          <p className="text-center text-[11px] uppercase tracking-[0.22em] text-helix-fog">
            Trusted by healthcare operators across the country
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-70">
            {['MERIDIAN', 'CARRINGTON', 'NORTHWAVE', 'OAKLINE', 'CENTRY', 'POLLEN HEALTH'].map((n) => (
              <span
                key={n}
                className="font-display text-sm font-semibold tracking-[0.2em] text-helix-mist"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
        {icon}
      </span>
      <span className="text-xs font-medium text-white/85">{label}</span>
    </div>
  );
}

function StrandTag({
  color,
  label,
  code,
}: {
  color: 'cyan' | 'violet';
  label: string;
  code: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 backdrop-blur-md ${
        color === 'cyan'
          ? 'border-helix-cyan-500/30 bg-helix-cyan-500/10 text-helix-cyan-100'
          : 'border-helix-violet-500/30 bg-helix-violet-500/10 text-helix-violet-100'
      }`}
    >
      <span className="font-mono text-[10px] tracking-widest opacity-80">/{code}</span>
      <span className="text-[11px] font-medium tracking-wide">{label}</span>
    </div>
  );
}
