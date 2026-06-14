import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for Double Helix Hub. Learn how we collect, use, and protect your information.',
};

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>

        <div className="space-y-12 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              1. Information We Collect
            </h2>
            <p className="mb-4">
              We collect information you provide directly to us, including
              name, address, email, phone number, date of birth, and household
              information when you enroll or contact us. For medical need
              submissions, we collect relevant health information and
              documentation necessary to process your request.
            </p>
            <p className="mb-4">
              We automatically collect certain information when you visit our
              website, such as IP address, browser type, device information,
              and pages visited. This helps us improve our services and
              understand how members use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              2. How We Use Information
            </h2>
            <p className="mb-4">
              We use your information to administer your membership, process
              contributions, evaluate and share medical needs, and communicate
              with you about your account. We may use anonymized or aggregated
              data to improve our services, conduct analytics, and share with
              the community in accordance with our Sharing Guidelines.
            </p>
            <p className="mb-4">
              We may send you transactional emails, membership updates, and
              occasional information about our program. You may opt out of
              marketing communications while still receiving essential
              account-related messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              3. Information Sharing
            </h2>
            <p className="mb-4">
              We do not sell your personal information. We may share
              information with service providers who assist us in operating our
              platform, such as payment processors and customer support tools.
              These providers are contractually obligated to protect your
              information.
            </p>
            <p className="mb-4">
              Medical need information may be shared in anonymized form with the
              sharing community as part of our transparency practices. In
              limited circumstances, we may disclose information when required
              by law or to protect our rights and the safety of our members.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              4. Data Security
            </h2>
            <p className="mb-4">
              We implement industry-standard security measures to protect your
              personal and health information. This includes encryption in
              transit and at rest, access controls, and regular security
              assessments. Our staff receives training on data protection and
              confidentiality.
            </p>
            <p className="mb-4">
              While we strive to protect your information, no method of
              transmission over the internet is 100% secure. We cannot guarantee
              absolute security but are committed to maintaining robust
              safeguards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              5. Your Rights
            </h2>
            <p className="mb-4">
              Depending on your location, you may have rights to access, correct,
              or delete your personal information. You may also have the right
              to restrict or object to certain processing. To exercise these
              rights, contact us at privacy@doublehelixhub.com.
            </p>
            <p className="mb-4">
              We will respond to your request within a reasonable timeframe. If
              you are in a jurisdiction with specific privacy laws (such as
              GDPR or CCPA), we will honor applicable rights to the extent
              required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              6. Cookies
            </h2>
            <p className="mb-4">
              Our website uses cookies and similar technologies to enhance your
              experience. Essential cookies are necessary for the site to function
              properly. We may also use analytics cookies to understand how
              visitors use our site and improve our services.
            </p>
            <p className="mb-4">
              You can control cookie preferences through your browser settings.
              Disabling certain cookies may affect the functionality of our
              website. For more information, see your browser&apos;s help
              documentation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              7. Children&apos;s Privacy
            </h2>
            <p className="mb-4">
              Our services are not directed to individuals under 18. We do not
              knowingly collect personal information from children. If you believe
              we have inadvertently collected information from a child, please
              contact us immediately and we will take steps to delete such
              information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              8. Changes to Policy
            </h2>
            <p className="mb-4">
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by posting the updated policy on
              our website and updating the &quot;Last updated&quot; date. For
              significant changes, we may also notify you by email.
            </p>
            <p className="mb-4">
              We encourage you to review this policy periodically. Your
              continued use of our services after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              9. Contact
            </h2>
            <p className="mb-4">
              For questions about this Privacy Policy or our data practices,
              please contact us at privacy@doublehelixhub.com or through
              our Contact page. Our privacy team will respond to your inquiry
              as promptly as possible.
            </p>
            <p>
              Double Helix Hub is committed to protecting your privacy and
              being transparent about our practices. We welcome your questions
              and feedback.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200 flex gap-6">
          <Link
            href="/legal/terms"
            className="text-primary hover:text-cyan-700 font-medium"
          >
            View Terms of Service →
          </Link>
          <Link
            href="/legal/sharing-guidelines"
            className="text-primary hover:text-cyan-700 font-medium"
          >
            View Sharing Guidelines →
          </Link>
        </div>
      </div>
    </div>
  );
}
