import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import { Container, Eyebrow, CTABand } from '@/components/sections/blocks';
import { Reveal } from '@/components/sections/Reveal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The Terms of Service for membership in the Pay It Forward Health community health care sharing program. This is not insurance.',
};

export default function TermsOfServicePage() {
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
              <FileText className="h-6 w-6" strokeWidth={2} />
            </span>
            <Eyebrow tone="light" className="mt-6">
              Legal
            </Eyebrow>
            <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight text-white">
              Terms of Service
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
                  1. Acceptance of Terms
                </h2>
                <p className="mt-4">
                  By accessing or using the Double Helix Hub website, services,
                  and membership program, you agree to be bound by these Terms of
                  Service. If you do not agree to these terms, please do not use our
                  services or enroll as a member.
                </p>
                <p className="mt-4">
                  These terms apply to all visitors, users, and members of Pay It
                  Forward Health. We reserve the right to modify these terms at any
                  time. Continued use of our services after changes constitutes
                  acceptance of the modified terms.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  2. Description of Service
                </h2>
                <p className="mt-4">
                  Double Helix Hub is a health cost sharing ministry. We
                  facilitate voluntary sharing of medical expenses among our
                  members. This is NOT insurance. Members contribute monthly amounts
                  that are used to share eligible medical needs of other members.
                </p>
                <p className="mt-4">
                  Our program operates on the principle of mutual aid and community
                  support. We provide a platform for members to connect, contribute,
                  and receive support for qualifying medical expenses in accordance
                  with our Sharing Guidelines.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  3. Membership
                </h2>
                <p className="mt-4">
                  Membership in Double Helix Hub is voluntary and subject to
                  approval. Applicants must meet eligibility requirements as
                  described in our enrollment materials. Membership begins on the
                  first day of the month following approval and receipt of initial
                  contribution.
                </p>
                <p className="mt-4">
                  Members must maintain current membership status by timely payment
                  of monthly contributions and adherence to our guidelines.
                  Failure to meet these requirements may result in suspension or
                  termination of membership.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  4. Monthly Contributions
                </h2>
                <p className="mt-4">
                  Each member agrees to contribute a monthly share amount as
                  specified in their selected plan. Contribution amounts are
                  determined by household size and plan level. These contributions
                  fund the sharing pool used to assist members with eligible
                  medical needs.
                </p>
                <p className="mt-4">
                  Contributions are due by the first of each month. Late payments
                  may result in a grace period during which sharing privileges may
                  be suspended. We reserve the right to adjust contribution amounts
                  with reasonable notice to members.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  5. Medical Needs Sharing
                </h2>
                <p className="mt-4">
                  Sharing of medical needs is subject to our Sharing Guidelines,
                  which define eligible expenses, the Initial Unshareable Amount
                  (IUA), and submission requirements. Not all medical expenses are
                  eligible for sharing. Members should review the Sharing
                  Guidelines thoroughly before submitting a need.
                </p>
                <p className="mt-4">
                  Submission of a need does not guarantee sharing. All needs are
                  reviewed for eligibility. Sharing is voluntary and dependent on
                  available funds in the sharing pool. Double Helix Hub does not
                  guarantee payment of any medical expense.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  6. Limitations
                </h2>
                <p className="mt-4">
                  Double Helix Hub is NOT an insurance company. We do not
                  provide insurance coverage, guarantee payment of medical
                  expenses, or assume any insurance-like obligations. Our program
                  is a voluntary sharing arrangement among members.
                </p>
                <p className="mt-4">
                  The ministry is not subject to state insurance regulation. Our
                  program may not satisfy Affordable Care Act or state healthcare
                  mandate requirements. Members are responsible for understanding
                  their obligations under applicable law.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  7. Privacy
                </h2>
                <p className="mt-4">
                  Your use of our services is also governed by our Privacy Policy.
                  We collect and use personal information as described in that
                  policy. By using our services, you consent to our collection and
                  use of your information in accordance with the Privacy Policy.
                </p>
                <p className="mt-4">
                  Medical need submissions may require sharing of health information
                  with our staff and, in anonymized form, with the sharing
                  community. We take reasonable steps to protect the confidentiality
                  of member information.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  8. Termination
                </h2>
                <p className="mt-4">
                  Members may terminate their membership at any time by providing
                  written notice. Termination is effective at the end of the
                  current billing period. No refunds of contributions are provided
                  upon termination.
                </p>
                <p className="mt-4">
                  Double Helix Hub reserves the right to suspend or terminate
                  membership for violation of these terms, non-payment of
                  contributions, fraud, or other conduct we deem harmful to the
                  community. We will provide notice when reasonably practicable.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  9. Governing Law
                </h2>
                <p className="mt-4">
                  These Terms of Service shall be governed by and construed in
                  accordance with the laws of the State of [State], without regard
                  to its conflict of law provisions. Any disputes arising from these
                  terms or your use of our services shall be resolved in the
                  courts of [State].
                </p>
                <p className="mt-4">
                  If any provision of these terms is found to be unenforceable, the
                  remaining provisions shall continue in full force and effect.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  10. Contact
                </h2>
                <p className="mt-4">
                  If you have questions about these Terms of Service, please
                  contact us at legal@payitforwardhealth.com or through our Contact
                  page. We will respond to inquiries as promptly as possible.
                </p>
                <p className="mt-4">
                  Double Helix Hub is committed to transparency and member
                  support. We encourage you to reach out with any concerns or
                  questions about your membership or these terms.
                </p>
              </section>
            </div>

            {/* Quiet related-policy links */}
            <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-pif-navy-100 pt-8">
              <Link
                href="/legal/privacy"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
              >
                Privacy Policy
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
        title="Have a question before you join?"
        subtitle="We are glad to explain how membership works and answer anything about these terms."
        primary={{ label: 'Contact Us', href: '/contact' }}
        secondary={null}
      />
    </>
  );
}
