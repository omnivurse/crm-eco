import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { SmsPrivacyPolicy } from '@crm-eco/ui/components/sms-privacy-policy';
import { Container, Eyebrow } from '@/components/sections/blocks';
import { Reveal } from '@/components/sections/Reveal';
import { BRAND, EMAIL, PHONE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'SMS Privacy Policy',
  description:
    'How Pay It Forward Health collects, uses, and protects your information for text message campaigns — including how to opt out.',
};

export default function SmsPrivacyPolicyPage() {
  return (
    <>
      <section className="hub-section-dark relative overflow-hidden py-16 md:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.10),transparent_65%)]" />
        <Container className="relative">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="mt-8 max-w-2xl">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-pif-gold-300 ring-1 ring-white/15">
              <MessageSquare className="h-6 w-6" strokeWidth={2} />
            </span>
            <Eyebrow tone="light" className="mt-6">
              Legal
            </Eyebrow>
            <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight text-white">
              SMS Privacy Policy
            </h1>
            <p className="mt-4 text-sm font-medium text-white/60">
              Text messaging campaigns for {BRAND.name}
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-white py-16 md:py-20">
        <Container>
          <Reveal className="mx-auto max-w-3xl">
            <SmsPrivacyPolicy
              brand={{
                companyName: BRAND.name,
                contactEmail: EMAIL.privacy,
                supportEmail: EMAIL.support,
                contactPhoneDisplay: PHONE.display,
                contactPhoneTel: PHONE.tel,
              }}
              className="text-slate-700 [&_a]:text-pif-teal-700 [&_h2]:text-slate-900"
            />
          </Reveal>
        </Container>
      </section>
    </>
  );
}
