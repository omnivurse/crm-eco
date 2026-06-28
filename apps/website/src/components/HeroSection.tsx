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
const imageReveal: Variants = {
  hidden: { opacity: 0, scale: 0.97, x: 24 },
  visible: { opacity: 1, scale: 1, x: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.25 } },
};

const PROMISES = [
  { icon: ShieldCheck, label: 'Not insurance' },
  { icon: CalendarCheck, label: 'Join any time' },
  { icon: HeartHandshake, label: 'No networks' },
] as const;

export function HeroSection() {
  return (
    <section className="hub-page-hero relative overflow-hidden border-b border-pif-navy-100">
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="flex min-h-[auto] flex-col-reverse items-center lg:min-h-[88vh] lg:flex-row lg:items-stretch">
          {/* Copy */}
          <motion.div
            className="flex w-full flex-col justify-center py-14 sm:py-20 lg:w-[54%] lg:py-28 lg:pr-14"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp} className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-pif-teal-100 bg-pif-teal-50 px-3.5 py-1.5">
              <span className="h-2 w-2 rounded-full bg-pif-green-500" />
              <span className="text-xs font-semibold text-pif-teal-800">Community health sharing · welcoming to all</span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mb-6 font-heading font-semibold leading-[1.06] text-pif-navy-800"
              style={{ fontSize: 'clamp(38px, 5.2vw, 66px)', letterSpacing: '-0.015em' }}
            >
              The caring alternative to{' '}
              <span className="gradient-text">health insurance</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mb-9 max-w-xl text-lg leading-relaxed text-slate-600">
              At Pay It Forward Health, members share one another&apos;s medical costs in a community built
              on generosity. Keep your own doctors, skip the networks, and pay a fraction of what
              traditional insurance costs — and when you&apos;re well, you help <span className="pif-underline font-semibold text-pif-navy-800">pay it forward</span>.
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
                    className="w-full rounded-xl border-pif-navy-200 bg-white px-8 text-base font-semibold text-pif-navy-800 hover:border-pif-teal-400 hover:bg-pif-teal-50/60 hover:text-pif-navy-900 sm:w-auto"
                  >
                    See How It Works
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {PROMISES.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Icon className="h-4 w-4 text-pif-green-600" strokeWidth={2.25} />
                  {label}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Image */}
          <motion.div
            className="flex w-full items-center justify-center py-10 lg:w-[46%] lg:py-16"
            variants={imageReveal}
            initial="hidden"
            animate="visible"
          >
            <div className="relative w-full max-w-md lg:max-w-none">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[2rem] shadow-2xl shadow-pif-navy/20 ring-1 ring-pif-navy/10 sm:aspect-[4/5] lg:h-[min(76vh,660px)]">
                <Image
                  src={imageUrl(IMAGES.heroDoctorPatient, 900)}
                  alt={IMAGES.heroDoctorPatient.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  className="object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-pif-navy-900/35 via-transparent to-transparent" />
              </div>

              {/* Floating trust card */}
              <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-pif-navy-100 bg-white/95 p-4 shadow-xl shadow-pif-navy/15 backdrop-blur sm:block">
                <div className="flex items-center gap-3">
                  <span className="pif-grad-care flex h-11 w-11 items-center justify-center rounded-xl text-white">
                    <HeartHandshake className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-heading text-2xl font-bold leading-none text-pif-navy-800">{STATS.shared}</p>
                    <p className="text-xs text-slate-500">shared by members</p>
                  </div>
                </div>
              </div>

              {/* Floating rating chip */}
              <div className="absolute -right-3 top-6 hidden rounded-xl border border-pif-navy-100 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-pif-navy/15 backdrop-blur md:block">
                <p className="font-heading text-lg font-bold leading-none text-pif-navy-800">{STATS.satisfaction}</p>
                <p className="text-[11px] text-slate-500">member rating</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
