'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@crm-eco/ui';
import { ArrowRight } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const imageReveal: Variants = {
  hidden: { opacity: 0, scale: 0.97, x: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 },
  },
};

const TRUST_BADGES = [
  '10,000+ Members',
  '$5M+ Shared',
  '98% Satisfaction',
] as const;

export function HeroSection() {
  return (
    <section className="hub-page-hero relative overflow-hidden border-b border-slate-100">
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col-reverse lg:flex-row items-center lg:items-stretch min-h-[auto] lg:min-h-[88vh]">
          <motion.div
            className="flex flex-col justify-center w-full lg:w-[55%] py-16 sm:py-20 lg:py-28 lg:pr-14"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.p variants={fadeUp} className="hub-eyebrow mb-5">
              Community Health Sharing
            </motion.p>

            <motion.h1
              variants={fadeUp}
              className="text-dhh-ink font-bold leading-[1.08] mb-6 font-[family-name:var(--font-heading)]"
              style={{
                fontSize: 'clamp(36px, 5vw, 64px)',
                letterSpacing: '-0.75px',
              }}
            >
              Healthcare that puts{' '}
              <br className="hidden sm:block" />
              <span className="gradient-text">people first</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="leading-relaxed mb-10 max-w-lg text-lg text-slate-600"
            >
              Join thousands of families sharing medical costs together.
              Transparent, affordable, and built on community.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-4 mb-10"
            >
              <Link href="/plans">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    size="lg"
                    className="hub-btn-gradient rounded-lg font-semibold gap-2 w-full sm:w-auto px-8 text-base"
                  >
                    Find Your Plan
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/how-it-works">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-slate-300 bg-white text-slate-700 hover:border-cyan-400 hover:text-dhh-ink hover:bg-cyan-50/50 rounded-lg font-semibold w-full sm:w-auto px-8 text-base"
                  >
                    How It Works
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex flex-wrap items-center gap-x-6 gap-y-2"
            >
              {TRUST_BADGES.map((badge, i) => (
                <span key={badge} className="flex items-center gap-x-6">
                  <span className="text-sm font-medium text-slate-500">{badge}</span>
                  {i < TRUST_BADGES.length - 1 && (
                    <span className="hidden sm:block w-px h-4 bg-slate-200" />
                  )}
                </span>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="w-full lg:w-[45%] flex items-center justify-center py-10 lg:py-16"
            variants={imageReveal}
            initial="hidden"
            animate="visible"
          >
            <div className="relative w-full max-w-md lg:max-w-none aspect-[3/4] sm:aspect-[4/5] lg:aspect-auto lg:h-[min(75vh,640px)] rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200/80">
              <Image
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80"
                alt="Doctor with patient in a warm, professional healthcare setting"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-dhh-ink/20 via-transparent to-transparent" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
