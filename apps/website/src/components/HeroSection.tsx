'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  ShieldCheck,
  Handshake,
  CalendarCheck,
  Heart,
} from '@phosphor-icons/react';
import { motion, type Variants } from 'framer-motion';
import { STATS } from '@/lib/site';

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
  },
};

const PROMISES = [
  { icon: ShieldCheck, label: 'Not insurance' },
  { icon: CalendarCheck, label: 'Join any time' },
  { icon: Handshake, label: 'No networks' },
] as const;

export function HeroSection() {
  return (
    <section className="hub-page-hero relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-8 lg:px-12">
        <motion.div
          className="grid min-h-[auto] items-center gap-10 py-16 sm:py-20 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-24"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {/* Copy column */}
          <div>
            <motion.div variants={fadeUp} className="mb-7">
              <span className="hub-eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-pif-green-500 shadow-[0_0_0_3px_rgba(18,160,101,0.18)]" />
                Community health sharing
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mb-6 max-w-[14ch] font-heading text-[clamp(2.75rem,6vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.03em] text-pif-navy-800"
            >
              Care that <em className="font-normal italic text-pif-teal-700">moves</em> forward
              together
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mb-10 max-w-xl text-lg leading-relaxed text-slate-600"
            >
              Members share medical costs in a community built on generosity. Keep your doctors.
              Skip the networks. And when you&apos;re well, you help{' '}
              <span className="pif-underline font-semibold text-pif-navy-800">pay it forward</span>.
            </motion.p>

            <motion.div variants={fadeUp} className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/enroll" className="group pif-btn-island pif-btn-care text-base">
                Become a Member
                <span className="pif-btn-ico">
                  <ArrowUpRight weight="light" className="h-4 w-4" />
                </span>
              </Link>
              <Link href="/how-it-works" className="pif-btn-ghost text-center text-base sm:text-left">
                See how it works
              </Link>
            </motion.div>

            <motion.ul variants={fadeUp} className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {PROMISES.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Icon weight="light" className="h-[18px] w-[18px] text-pif-green-600" />
                  {label}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Z-Axis cascade cards */}
          <motion.div variants={fadeUp} className="relative min-h-[380px] md:min-h-[460px]">
            {/* Main shared card */}
            <div className="pif-bezel relative z-[3] -rotate-1 md:w-[92%]">
              <div className="pif-bezel-inner p-7 sm:p-8">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-pif-teal-700">
                  Shared this year
                </p>
                <p className="font-heading text-[clamp(2.5rem,5vw,3.25rem)] font-medium leading-none tracking-[-0.03em] text-pif-navy-800">
                  {STATS.shared}
                </p>
                <p className="mt-2 mb-6 text-sm text-slate-500">Medical costs covered by the community</p>
                <div className="mb-5 h-1 overflow-hidden rounded-full bg-pif-teal-50">
                  <div className="pif-bar-fill h-full w-[72%] rounded-full bg-gradient-to-r from-pif-teal to-pif-green" />
                </div>
                <div className="flex items-center justify-between border-t border-pif-navy-50 pt-4 text-sm text-slate-500">
                  <span>Member contributions</span>
                  <strong className="font-semibold text-pif-navy-800">On track</strong>
                </div>
              </div>
            </div>

            {/* Floating members card */}
            <div className="pif-bezel pif-bezel-deep absolute -right-1 top-0 z-[4] w-[min(200px,48%)] rotate-[3deg] max-md:relative max-md:right-auto max-md:top-auto max-md:mt-4 max-md:w-full max-md:rotate-0">
              <div className="pif-bezel-inner p-5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-pif-gold-300">
                  Active members
                </p>
                <p className="font-heading text-[1.75rem] font-medium leading-none tracking-[-0.03em] text-white">
                  {STATS.members}
                </p>
                <p className="mt-2 text-sm text-white/65">Families caring for families</p>
              </div>
            </div>

            {/* Floating promises card */}
            <div className="pif-bezel absolute -left-2 bottom-2 z-[2] w-[min(220px,52%)] -rotate-[2.5deg] max-md:relative max-md:bottom-auto max-md:left-auto max-md:mt-4 max-md:w-full max-md:rotate-0">
              <div className="pif-bezel-inner space-y-3 p-5">
                {[
                  { icon: Heart, label: 'Keep your doctors' },
                  { icon: Handshake, label: 'Transparent sharing' },
                  { icon: CalendarCheck, label: 'Join in minutes' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-sm font-medium text-pif-ink">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-pif-teal-50 text-pif-teal-700">
                      <Icon weight="light" className="h-3.5 w-3.5" />
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
