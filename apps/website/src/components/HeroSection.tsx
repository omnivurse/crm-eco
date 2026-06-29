'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@crm-eco/ui';
import { ArrowRight, ShieldCheck, HeartHandshake, CalendarCheck } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { IMAGES, imageUrl } from '@/lib/site-images';
import { STATS } from '@/lib/site';

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const PROMISES = [
  { icon: ShieldCheck, label: 'Not insurance' },
  { icon: CalendarCheck, label: 'Join any time' },
  { icon: HeartHandshake, label: 'No networks' },
] as const;

export function HeroSection() {
  return (
    <section className="hub-page-hero relative overflow-hidden border-b border-pif-navy-100">
      {/* Subtle full-bleed background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <Image
          src={imageUrl(IMAGES.heroBackground, 1920)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-[0.22]"
        />
        <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
          <Image
            src={imageUrl(IMAGES.logoMark)}
            alt=""
            width={780}
            height={938}
            className="h-[clamp(72px,13vw,128px)] w-auto opacity-40"
          />
        </div>
        <div className="absolute inset-0 bg-white/82" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <motion.div
          className="flex min-h-[auto] flex-col justify-center py-14 sm:py-20 lg:min-h-[88vh] lg:py-28"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeUp} className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-pif-teal-100 bg-pif-teal-50/90 px-3.5 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-pif-green-500" />
            <span className="text-xs font-semibold text-pif-teal-800">Community health sharing · welcoming to all</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mb-6 max-w-3xl font-heading font-semibold leading-[1.06] text-pif-navy-800"
            style={{ fontSize: 'clamp(38px, 5.2vw, 66px)', letterSpacing: '-0.015em' }}
          >
            The caring alternative to{' '}
            <span className="gradient-text">health insurance</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mb-9 max-w-xl text-lg leading-relaxed text-slate-600">
            At Pay It Forward Health, members share one another&apos;s medical costs in a community built
            on generosity. Keep your own doctors, skip the networks, and pay a fraction of what
            traditional insurance costs — and when you&apos;re well, you help{' '}
            <span className="pif-underline font-semibold text-pif-navy-800">pay it forward</span>.
          </motion.p>

          <motion.div variants={fadeUp} className="mb-9 flex flex-col gap-4 sm:flex-row">
            <Link href="/enroll">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" className="hub-btn-gradient w-full gap-2 rounded-xl px-8 text-base font-semibold sm:w-auto">
                  Become a Member
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </Link>
            <Link href="/how-it-works">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full rounded-xl border-pif-navy-200 bg-white/90 px-8 text-base font-semibold text-pif-navy-800 backdrop-blur-sm hover:border-pif-teal-400 hover:bg-pif-teal-50/60 hover:text-pif-navy-900 sm:w-auto"
                >
                  See How It Works
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            {PROMISES.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                <Icon className="h-4 w-4 text-pif-green-600" strokeWidth={2.25} />
                {label}
              </span>
            ))}
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-4 sm:gap-5"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-pif-navy-100/80 bg-white/90 px-4 py-3 shadow-sm shadow-pif-navy/5 backdrop-blur-sm">
              <span className="pif-grad-care flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white">
                <HeartHandshake className="h-5 w-5" />
              </span>
              <div>
                <p className="font-heading text-2xl font-bold leading-none text-pif-navy-800">{STATS.shared}</p>
                <p className="text-xs text-slate-500">shared by members</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-pif-navy-100/80 bg-white/90 px-4 py-3 shadow-sm shadow-pif-navy/5 backdrop-blur-sm">
              <div>
                <p className="font-heading text-2xl font-bold leading-none text-pif-navy-800">{STATS.satisfaction}</p>
                <p className="text-xs text-slate-500">member rating</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
