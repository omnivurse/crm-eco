'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@crm-eco/ui';
import { ArrowRight } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Framer-motion variants                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Trust badge data                                                   */
/* ------------------------------------------------------------------ */

const TRUST_BADGES = [
  '10,000+ Members',
  '$5M+ Shared',
  '98% Satisfaction',
] as const;

/* ------------------------------------------------------------------ */
/*  HeroSection                                                        */
/* ------------------------------------------------------------------ */

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #002B5C 0%, #003d6b 50%, #0a4f6e 75%, #0d6a6e 100%)',
      }}
    >
      {/* Subtle top-right radial glow */}
      <div
        className="absolute top-0 right-0 w-[60%] h-[80%] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 80% 20%, rgba(20,184,166,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Main container */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col-reverse lg:flex-row items-center lg:items-stretch min-h-[auto] lg:min-h-[90vh]">
          {/* -------- LEFT SIDE: Text (55%) -------- */}
          <motion.div
            className="flex flex-col justify-center w-full lg:w-[55%] py-16 sm:py-20 lg:py-28 lg:pr-14"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Eyebrow */}
            <motion.p
              variants={fadeUp}
              className="text-sm tracking-[0.2em] uppercase font-medium mb-5"
              style={{ color: '#5eead4', fontSize: '14px' }}
            >
              Community Health Sharing
            </motion.p>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              className="text-white font-bold leading-[1.08] mb-6"
              style={{
                fontSize: 'clamp(36px, 5vw, 64px)',
                letterSpacing: '-0.75px',
              }}
            >
              Healthcare that puts{' '}
              <br className="hidden sm:block" />
              people first
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUp}
              className="leading-relaxed mb-10 max-w-lg"
              style={{ fontSize: '18px', color: '#cbd5e1', lineHeight: 1.7 }}
            >
              Join thousands of families sharing medical costs together.
              Transparent, affordable, and built on community.
            </motion.p>

            {/* Buttons */}
            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-4 mb-10"
            >
              <Link href="/plans">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    size="lg"
                    className="bg-white text-[#002B5C] hover:bg-slate-100 rounded-lg font-semibold gap-2 w-full sm:w-auto px-8 text-base shadow-lg shadow-black/10"
                  >
                    Find Your Plan
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/how-it-works">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white rounded-lg font-semibold w-full sm:w-auto px-8 text-base"
                  >
                    How It Works
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              variants={fadeUp}
              className="flex flex-wrap items-center gap-x-6 gap-y-2"
            >
              {TRUST_BADGES.map((badge, i) => (
                <span key={badge} className="flex items-center gap-x-6">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}
                  >
                    {badge}
                  </span>
                  {i < TRUST_BADGES.length - 1 && (
                    <span
                      className="hidden sm:block w-px h-4"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                    />
                  )}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* -------- RIGHT SIDE: Image (45%) -------- */}
          <motion.div
            className="w-full lg:w-[45%] flex items-center justify-center py-10 lg:py-16"
            variants={imageReveal}
            initial="hidden"
            animate="visible"
          >
            <div className="relative w-full max-w-md lg:max-w-none aspect-[3/4] sm:aspect-[4/5] lg:aspect-auto lg:h-[min(75vh,640px)] rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
              <Image
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80"
                alt="Doctor with patient in a warm, professional healthcare setting"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
              {/* Left-edge gradient overlay to blend with background */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to right, #002B5C 0%, rgba(0,43,92,0.4) 15%, transparent 40%)',
                }}
              />
              {/* Bottom edge fade */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to top, rgba(0,43,92,0.3) 0%, transparent 25%)',
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
