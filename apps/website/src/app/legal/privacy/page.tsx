import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { Container, Eyebrow, CTABand } from '@/components/sections/blocks';
import { Reveal } from '@/components/sections/Reveal';
import { BRAND, PHONE, EMAIL, ADDRESS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Pay It Forward Health collects, uses, and protects your personal and health information — explained in plain language.',
};

export default function PrivacyPolicyPage() {
  return (
    <>
      {/* Compact inner hero */}
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
              <ShieldCheck className="h-6 w-6" strokeWidth={2} />
            </span>
            <Eyebrow tone="light" className="mt-6">
              Legal
            </Eyebrow>
            <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight text-white">
              Privacy Policy
            </h1>
            <p className="mt-4 text-sm font-medium text-white/60">
              Last updated: February 15, 2025
            </p>
          </div>
        </Container>
      </section>

      {/* Readable prose */}
      <section className="bg-white py-16 md:py-20">
        <Container>
          <Reveal className="mx-auto max-w-3xl">
            <div className="space-y-12 text-[1.0625rem] leading-relaxed text-slate-700">
              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  1. Information We Collect
                </h2>
                <p className="mt-4">
                  We collect information you provide directly to us, including
                  name, address, email, phone number, date of birth, and household
                  information when you enroll or contact us. For medical need
                  submissions, we collect relevant health information and
                  documentation necessary to process your request.
                </p>
                <p className="mt-4">
                  We automatically collect certain information when you visit our
                  website, such as IP address, browser type, device information,
                  and pages visited. This helps us improve our services and
                  understand how members use our platform.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  2. How We Use Information
                </h2>
                <p className="mt-4">
                  We use your information to administer your membership, process
                  contributions, evaluate and share medical needs, and communicate
                  with you about your account. We may use anonymized or aggregated
                  data to improve our services, conduct analytics, and share with
                  the community in accordance with our Sharing Guidelines.
                </p>
                <p className="mt-4">
                  We may send you transactional emails, membership updates, and
                  occasional information about our program. You may opt out of
                  marketing communications while still receiving essential
                  account-related messages.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  3. Information Sharing
                </h2>
                <p className="mt-4">
                  We do not sell your personal information. We may share
                  information with service providers who assist us in operating our
                  platform, such as payment processors and customer support tools.
                  These providers are contractually obligated to protect your
                  information.
                </p>
                <p className="mt-4">
                  Medical need information may be shared in anonymized form with the
                  sharing community as part of our transparency practices. In
                  limited circumstances, we may disclose information when required
                  by law or to protect our rights and the safety of our members.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  4. Data Security
                </h2>
                <p className="mt-4">
                  We implement industry-standard security measures to protect your
                  personal and health information. This includes encryption in
                  transit and at rest, access controls, and regular security
                  assessments. Our staff receives training on data protection and
                  confidentiality.
                </p>
                <p className="mt-4">
                  While we strive to protect your information, no method of
                  transmission over the internet is 100% secure. We cannot guarantee
                  absolute security but are committed to maintaining robust
                  safeguards.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  5. Your Rights
                </h2>
                <p className="mt-4">
                  Depending on your location, you may have rights to access, correct,
                  or delete your personal information. You may also have the right
                  to restrict or object to certain processing. To exercise these
                  rights, contact us at privacy@payitforwardhealth.com.
                </p>
                <p className="mt-4">
                  We will respond to your request within a reasonable timeframe. If
                  you are in a jurisdiction with specific privacy laws (such as
                  GDPR or CCPA), we will honor applicable rights to the extent
                  required by law.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  6. Cookies
                </h2>
                <p className="mt-4">
                  Our website uses cookies and similar technologies to enhance your
                  experience. Essential cookies are necessary for the site to function
                  properly. We may also use analytics cookies to understand how
                  visitors use our site and improve our services.
                </p>
                <p className="mt-4">
                  You can control cookie preferences through your browser settings.
                  Disabling certain cookies may affect the functionality of our
                  website. For more information, see your browser&apos;s help
                  documentation.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  7. Children&apos;s Privacy
                </h2>
                <p className="mt-4">
                  Our services are not directed to individuals under 18. We do not
                  knowingly collect personal information from children. If you believe
                  we have inadvertently collected information from a child, please
                  contact us immediately and we will take steps to delete such
                  information.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  8. Changes to Policy
                </h2>
                <p className="mt-4">
                  We may update this Privacy Policy from time to time. We will
                  notify you of material changes by posting the updated policy on
                  our website and updating the &quot;Last updated&quot; date. For
                  significant changes, we may also notify you by email.
                </p>
                <p className="mt-4">
                  We encourage you to review this policy periodically. Your
                  continued use of our services after changes constitutes
                  acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  9. Contact
                </h2>
                <p className="mt-4">
                  For questions about this Privacy Policy or our data practices,
                  please contact us at{' '}
                  <a
                    href={`mailto:${EMAIL.privacy}`}
                    className="font-semibold text-pif-teal-700 hover:text-pif-green-600"
                  >
                    {EMAIL.privacy}
                  </a>
                  , call{' '}
                  <a
                    href={`tel:${PHONE.tel}`}
                    className="font-semibold text-pif-teal-700 hover:text-pif-green-600"
                  >
                    {PHONE.display}
                  </a>
                  , or reach us through our Contact page. Mail may be sent to{' '}
                  {ADDRESS.display}. Our privacy team will respond to your inquiry
                  as promptly as possible.
                </p>
                <p className="mt-4">
                  {BRAND.name} is committed to protecting your privacy and
                  being transparent about our practices. We welcome your questions
                  and feedback.
                </p>
              </section>
            </div>

            {/* Quiet related-policy links */}
            <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-pif-navy-100 pt-8">
              <Link
                href="/legal/terms"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
              >
                Terms of Service
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/legal/sms-privacy"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
              >
                SMS Privacy Policy
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/legal/sharing-guidelines"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
              >
                Sharing Guidelines
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      <CTABand
        title="Questions about your privacy?"
        subtitle="Our team is happy to walk you through how we handle and protect your information."
        primary={{ label: 'Contact Us', href: '/contact' }}
        secondary={null}
      />
    </>
  );
}
