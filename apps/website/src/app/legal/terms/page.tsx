import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for Double Helix Hub health sharing ministry.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-primary hover:text-cyan-700 mb-8 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <p className="text-sm text-slate-500 mb-12">
          Last updated: February 15, 2025
        </p>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12">
          Terms of Service
        </h1>

        <div className="space-y-12 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="mb-4">
              By accessing or using the Double Helix Hub website, services,
              and membership program, you agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use our
              services or enroll as a member.
            </p>
            <p className="mb-4">
              These terms apply to all visitors, users, and members of Pay It
              Forward Health. We reserve the right to modify these terms at any
              time. Continued use of our services after changes constitutes
              acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              2. Description of Service
            </h2>
            <p className="mb-4">
              Double Helix Hub is a health cost sharing ministry. We
              facilitate voluntary sharing of medical expenses among our
              members. This is NOT insurance. Members contribute monthly amounts
              that are used to share eligible medical needs of other members.
            </p>
            <p className="mb-4">
              Our program operates on the principle of mutual aid and community
              support. We provide a platform for members to connect, contribute,
              and receive support for qualifying medical expenses in accordance
              with our Sharing Guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              3. Membership
            </h2>
            <p className="mb-4">
              Membership in Double Helix Hub is voluntary and subject to
              approval. Applicants must meet eligibility requirements as
              described in our enrollment materials. Membership begins on the
              first day of the month following approval and receipt of initial
              contribution.
            </p>
            <p className="mb-4">
              Members must maintain current membership status by timely payment
              of monthly contributions and adherence to our guidelines.
              Failure to meet these requirements may result in suspension or
              termination of membership.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              4. Monthly Contributions
            </h2>
            <p className="mb-4">
              Each member agrees to contribute a monthly share amount as
              specified in their selected plan. Contribution amounts are
              determined by household size and plan level. These contributions
              fund the sharing pool used to assist members with eligible
              medical needs.
            </p>
            <p className="mb-4">
              Contributions are due by the first of each month. Late payments
              may result in a grace period during which sharing privileges may
              be suspended. We reserve the right to adjust contribution amounts
              with reasonable notice to members.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              5. Medical Needs Sharing
            </h2>
            <p className="mb-4">
              Sharing of medical needs is subject to our Sharing Guidelines,
              which define eligible expenses, the Initial Unshareable Amount
              (IUA), and submission requirements. Not all medical expenses are
              eligible for sharing. Members should review the Sharing
              Guidelines thoroughly before submitting a need.
            </p>
            <p className="mb-4">
              Submission of a need does not guarantee sharing. All needs are
              reviewed for eligibility. Sharing is voluntary and dependent on
              available funds in the sharing pool. Double Helix Hub does not
              guarantee payment of any medical expense.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              6. Limitations
            </h2>
            <p className="mb-4">
              Double Helix Hub is NOT an insurance company. We do not
              provide insurance coverage, guarantee payment of medical
              expenses, or assume any insurance-like obligations. Our program
              is a voluntary sharing arrangement among members.
            </p>
            <p className="mb-4">
              The ministry is not subject to state insurance regulation. Our
              program may not satisfy Affordable Care Act or state healthcare
              mandate requirements. Members are responsible for understanding
              their obligations under applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              7. Privacy
            </h2>
            <p className="mb-4">
              Your use of our services is also governed by our Privacy Policy.
              We collect and use personal information as described in that
              policy. By using our services, you consent to our collection and
              use of your information in accordance with the Privacy Policy.
            </p>
            <p className="mb-4">
              Medical need submissions may require sharing of health information
              with our staff and, in anonymized form, with the sharing
              community. We take reasonable steps to protect the confidentiality
              of member information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              8. Termination
            </h2>
            <p className="mb-4">
              Members may terminate their membership at any time by providing
              written notice. Termination is effective at the end of the
              current billing period. No refunds of contributions are provided
              upon termination.
            </p>
            <p className="mb-4">
              Double Helix Hub reserves the right to suspend or terminate
              membership for violation of these terms, non-payment of
              contributions, fraud, or other conduct we deem harmful to the
              community. We will provide notice when reasonably practicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              9. Governing Law
            </h2>
            <p className="mb-4">
              These Terms of Service shall be governed by and construed in
              accordance with the laws of the State of [State], without regard
              to its conflict of law provisions. Any disputes arising from these
              terms or your use of our services shall be resolved in the
              courts of [State].
            </p>
            <p className="mb-4">
              If any provision of these terms is found to be unenforceable, the
              remaining provisions shall continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              10. Contact
            </h2>
            <p className="mb-4">
              If you have questions about these Terms of Service, please
              contact us at legal@doublehelixhub.com or through our Contact
              page. We will respond to inquiries as promptly as possible.
            </p>
            <p>
              Double Helix Hub is committed to transparency and member
              support. We encourage you to reach out with any concerns or
              questions about your membership or these terms.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200">
          <Link
            href="/legal/privacy"
            className="text-primary hover:text-cyan-700 font-medium"
          >
            View Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}
