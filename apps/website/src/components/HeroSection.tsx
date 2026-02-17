'use client';

import Link from 'next/link';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@crm-eco/ui';
import {
  Heart,
  Shield,
  Users,
  ArrowRight,
  Star,
  Sparkles,
  Leaf,
  Activity,
  Apple,
  Dumbbell,
} from 'lucide-react';
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
  useInView,
  type Variants,
} from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Count-up hook                                                      */
/* ------------------------------------------------------------------ */
function useCountUp(
  end: number,
  duration: number = 2000,
  startOnView: boolean = true,
  ref?: React.RefObject<HTMLElement | null>,
) {
  const [count, setCount] = useState(0);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, amount: 0.5 });
  const started = startOnView ? inView : true;

  useEffect(() => {
    if (!started) return;
    let raf: number;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, end, duration]);

  return count;
}

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const STATS = [
  { label: 'Active Members', end: 10000, prefix: '', suffix: '+', icon: Users },
  { label: 'Needs Shared', end: 5, prefix: '$', suffix: 'M+', icon: Heart },
  { label: 'Families Covered', end: 3500, prefix: '', suffix: '+', icon: Shield },
  { label: 'Member Satisfaction', end: 98, prefix: '', suffix: '%', icon: Star },
] as const;

interface FloatingOrb {
  icon: React.ElementType;
  x: string;
  y: string;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  mobileHidden?: boolean;
}

const ORBS: FloatingOrb[] = [
  { icon: Heart, x: '8%', y: '18%', size: 52, delay: 0, duration: 7, drift: -14 },
  { icon: Shield, x: '85%', y: '22%', size: 48, delay: 1.2, duration: 9, drift: 12 },
  { icon: Leaf, x: '15%', y: '72%', size: 44, delay: 0.6, duration: 8, drift: -10 },
  { icon: Activity, x: '78%', y: '68%', size: 40, delay: 2, duration: 6, drift: 14 },
  { icon: Apple, x: '92%', y: '45%', size: 38, delay: 1.8, duration: 10, drift: -12, mobileHidden: true },
  { icon: Dumbbell, x: '5%', y: '48%', size: 42, delay: 0.8, duration: 7.5, drift: 10, mobileHidden: true },
  { icon: Users, x: '55%', y: '12%', size: 36, delay: 2.4, duration: 8.5, drift: -8, mobileHidden: true },
  { icon: Sparkles, x: '40%', y: '80%', size: 34, delay: 1.4, duration: 9.5, drift: 11, mobileHidden: true },
];

const NETWORK_LINES: [number, number][] = [
  [0, 1],
  [1, 3],
  [2, 5],
  [0, 2],
  [4, 6],
  [3, 7],
];

/* ------------------------------------------------------------------ */
/*  Framer-motion variants                                             */
/* ------------------------------------------------------------------ */

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const badgeVariants: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 32, rotateX: 40 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

const statCardVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

/* ------------------------------------------------------------------ */
/*  Stat card sub-component                                            */
/* ------------------------------------------------------------------ */

function StatCard({
  stat,
}: {
  stat: (typeof STATS)[number];
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const value = useCountUp(stat.end, 2200, true, cardRef);

  return (
    <motion.div
      ref={cardRef}
      variants={statCardVariants}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-5 text-center shadow-[0_4px_24px_rgba(4,116,116,0.08)] hover:shadow-[0_8px_32px_rgba(4,116,116,0.14)] transition-shadow cursor-default"
    >
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-2.5">
        <stat.icon className="w-4.5 h-4.5 text-teal-600" />
      </div>
      <p className="text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">
        {stat.prefix ?? ''}
        {value.toLocaleString()}
        {stat.suffix ?? ''}
      </p>
      <p className="text-xs text-slate-500 mt-1 font-medium">{stat.label}</p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main hero                                                          */
/* ------------------------------------------------------------------ */

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  /* Mouse parallax values */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const blobParallaxX = useTransform(mouseX, [-1, 1], [-18, 18]);
  const blobParallaxY = useTransform(mouseY, [-1, 1], [-18, 18]);
  const orbParallaxX = useTransform(mouseX, [-1, 1], [-10, 10]);
  const orbParallaxY = useTransform(mouseY, [-1, 1], [-10, 10]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (reduceMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      mouseX.set(nx);
      mouseY.set(ny);
    },
    [reduceMotion, mouseX, mouseY],
  );

  /* Orb positions for SVG lines (approximate centers) */
  const orbCenters = ORBS.map((o) => ({
    x: parseFloat(o.x),
    y: parseFloat(o.y),
  }));

  const headlineWords = ['Healthcare', 'the', 'way', 'it', 'should', 'be'];

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/20 min-h-[92vh] flex flex-col justify-center"
    >
      {/* --- Layer 1: Radial base glow --- */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.15),transparent)]" />

      {/* --- Layer 2: Animated mesh blobs --- */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={reduceMotion ? {} : { x: blobParallaxX, y: blobParallaxY }}
      >
        <div
          className="hero-blob animate-blob-1"
          style={{
            width: 520, height: 520,
            top: '-8%', left: '10%',
            background: 'radial-gradient(circle, rgba(4,116,116,0.28) 0%, rgba(6,155,154,0.10) 60%, transparent 80%)',
          }}
        />
        <div
          className="hero-blob animate-blob-2"
          style={{
            width: 440, height: 440,
            top: '20%', right: '5%',
            background: 'radial-gradient(circle, rgba(2,115,67,0.22) 0%, rgba(2,115,67,0.06) 60%, transparent 80%)',
          }}
        />
        <div
          className="hero-blob animate-blob-3"
          style={{
            width: 380, height: 380,
            bottom: '5%', left: '25%',
            background: 'radial-gradient(circle, rgba(0,53,96,0.18) 0%, rgba(0,53,96,0.04) 60%, transparent 80%)',
          }}
        />
        <div
          className="hero-blob animate-blob-4"
          style={{
            width: 300, height: 300,
            top: '55%', right: '20%',
            background: 'radial-gradient(circle, rgba(233,182,31,0.14) 0%, rgba(233,182,31,0.03) 60%, transparent 80%)',
          }}
        />
        <div
          className="hero-blob animate-blob-5 hidden md:block"
          style={{
            width: 260, height: 260,
            top: '10%', left: '55%',
            background: 'radial-gradient(circle, rgba(6,155,154,0.18) 0%, rgba(4,116,116,0.05) 60%, transparent 80%)',
          }}
        />
      </motion.div>

      {/* --- Layer 3: SVG network connection lines --- */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none hidden md:block"
        preserveAspectRatio="none"
      >
        {NETWORK_LINES.map(([from, to], i) => {
          const a = orbCenters[from];
          const b = orbCenters[to];
          return (
            <line
              key={i}
              x1={`${a.x}%`}
              y1={`${a.y}%`}
              x2={`${b.x}%`}
              y2={`${b.y}%`}
              className="hero-network-line"
              stroke="rgba(4,116,116,0.10)"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>

      {/* --- Layer 4: Floating health icon orbs --- */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={reduceMotion ? {} : { x: orbParallaxX, y: orbParallaxY }}
      >
        {ORBS.map((orb, i) => (
          <motion.div
            key={i}
            className={`absolute flex items-center justify-center rounded-full bg-white/50 backdrop-blur-md border border-white/60 shadow-lg ${orb.mobileHidden ? 'hidden md:flex' : ''}`}
            style={{
              left: orb.x,
              top: orb.y,
              width: orb.size,
              height: orb.size,
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={
              reduceMotion
                ? { opacity: 0.7, scale: 1 }
                : {
                    opacity: [0, 0.75, 0.6, 0.75],
                    scale: [0.5, 1, 1, 1],
                    y: [0, orb.drift, -orb.drift * 0.6, 0],
                    rotate: [0, orb.drift * 0.3, -orb.drift * 0.2, 0],
                  }
            }
            transition={{
              duration: orb.duration,
              delay: orb.delay,
              repeat: Infinity,
              repeatType: 'loop',
              ease: 'easeInOut',
            }}
          >
            <orb.icon
              className="text-teal-600/70"
              style={{ width: orb.size * 0.44, height: orb.size * 0.44 }}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* --- Layer 5: Content --- */}
      <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div
            variants={badgeVariants}
            className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-lg border border-teal-200/60 rounded-full px-5 py-2 mb-7 shadow-sm"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" />
            </span>
            <span className="text-sm font-semibold text-teal-700 tracking-wide">
              Community-powered health sharing
            </span>
          </motion.div>

          {/* Headline - word-by-word reveal */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight mb-6 leading-[1.1]">
            {headlineWords.map((word, i) => (
              <span key={i} className="inline-block overflow-hidden mr-[0.28em] last:mr-0">
                <motion.span
                  variants={wordVariants}
                  className={`inline-block ${
                    i >= 4
                      ? 'bg-gradient-to-r from-teal-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent'
                      : ''
                  }`}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </h1>

          {/* Subtext */}
          <motion.p
            variants={fadeUp}
            className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Join a caring community where members share medical expenses together.
            Affordable, transparent, and built on the principle of paying it forward.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/enroll">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  className="hero-cta-shimmer bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-lg shadow-teal-600/25 gap-2 w-full sm:w-auto text-base px-8"
                >
                  Start Your Enrollment
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            </Link>
            <Link href="/how-it-works">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 w-full sm:w-auto bg-white/60 backdrop-blur-sm border-slate-200 hover:bg-white/80 text-base px-8"
                >
                  Learn How It Works
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>

        {/* --- Layer 6: Stats strip (glassmorphism cards) --- */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto mt-16 md:mt-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </motion.div>
      </div>

      {/* Bottom fade edge */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </section>
  );
}
