import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sharing Guidelines',
  description:
    'Pay It Forward Health sharing guidelines: eligible medical needs, ineligible expenses, IUA, and member responsibilities.',
};

export default function SharingGuidelinesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-8 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <p className="text-sm text-slate-500 mb-12">
          Last updated: February 15, 2025
        </p>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12">
          Sharing Guidelines
        </h1>

        <div className="space-y-12 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              1. Overview
            </h2>
            <p className="mb-4">
              Pay It Forward Health operates as a health cost sharing ministry.
              Members voluntarily share each other&apos;s eligible medical
              expenses. These guidelines define what qualifies for sharing, how
              the process works, and member responsibilities.
            </p>
            <p className="mb-4">
              These guidelines are essential reading for all members. Sharing
              is subject to available funds in the sharing pool and compliance
              with these guidelines. Pay It Forward Health is NOT insurance and
              does not guarantee payment of any medical expense.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              2. Eligible Medical Needs
            </h2>
            <p className="mb-4">
              Eligible medical needs generally include:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Hospital stays and inpatient care</li>
              <li>Emergency room visits for acute conditions</li>
              <li>Surgical procedures (inpatient and outpatient)</li>
              <li>Primary care and specialist physician visits</li>
              <li>Diagnostic tests (labs, imaging, etc.)</li>
              <li>Maternity care (subject to plan and waiting periods)</li>
              <li>Mental health counseling and therapy</li>
              <li>Prescription medications (subject to plan)</li>
              <li>Preventive care and wellness visits</li>
            </ul>
            <p>
              Eligibility is determined on a case-by-case basis. All needs must
              be submitted with required documentation and meet the criteria
              outlined in these guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              3. Ineligible Expenses
            </h2>
            <p className="mb-4">
              The following are generally NOT eligible for sharing:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Expenses incurred before membership effective date</li>
              <li>Pre-existing conditions (subject to waiting period)</li>
              <li>Expenses below the Initial Unshareable Amount (IUA)</li>
              <li>Cosmetic or elective procedures not medically necessary</li>
              <li>Experimental or investigational treatments</li>
              <li>Substance abuse treatment (unless specified in plan)</li>
              <li>Dental and vision (unless included in plan)</li>
              <li>Expenses from providers outside our network (where applicable)</li>
              <li>Intentional self-injury or injuries from illegal activity</li>
            </ul>
            <p>
              This list is not exhaustive. Members should contact us with
              questions about specific situations before incurring expenses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              4. Initial Unshareable Amount (IUA)
            </h2>
            <p className="mb-4">
              The Initial Unshareable Amount (IUA) is the amount each household
              is responsible for before sharing begins for a given need. Think
              of it similarly to a deductible. The IUA varies by plan level:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Essential:</strong> $500 per incident</li>
              <li><strong>Premium:</strong> $300 per incident</li>
              <li><strong>Complete:</strong> $150 per incident</li>
            </ul>
            <p>
              Multiple related expenses for the same medical incident may be
              combined toward the IUA. Once the IUA is met, eligible amounts
              above that threshold may be submitted for sharing. The IUA applies
              per incident, not per year.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              5. Pre-Existing Conditions
            </h2>
            <p className="mb-4">
              Pre-existing conditions are medical conditions for which you
              received diagnosis or treatment in the 24 months prior to
              membership. There is typically a waiting period before
              pre-existing conditions become eligible for sharing:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Most pre-existing conditions: 24-month waiting period</li>
              <li>Certain conditions may have longer or different waiting periods</li>
              <li>Routine care for pre-existing conditions may be eligible sooner</li>
            </ul>
            <p>
              Members with pre-existing conditions should review their
              enrollment materials and contact us for specific guidance. We
              are committed to transparency about what is and is not covered.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              6. Submission Process
            </h2>
            <p className="mb-4">
              To submit a medical need for sharing:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mb-4">
              <li>Obtain care from a qualified healthcare provider</li>
              <li>Pay your provider or arrange for itemized billing</li>
              <li>Submit the need through the member portal with required documentation</li>
              <li>Include itemized bills, proof of payment, and any requested medical records</li>
              <li>Our team will review for eligibility and process accordingly</li>
            </ol>
            <p>
              Needs should be submitted within 6 months of the date of service.
              Incomplete submissions may delay processing. We aim to process
              eligible needs within 48–72 hours of receiving complete
              documentation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              7. Sharing Limits
            </h2>
            <p className="mb-4">
              Sharing is subject to per-incident and annual limits based on your
              plan. Limits are designed to ensure the long-term sustainability
              of our sharing community while providing meaningful support for
              members.
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Per-incident limits vary by plan (Essential, Premium, Complete)</li>
              <li>Annual sharing limits apply per household</li>
              <li>Lifetime maximums may apply for certain plan levels</li>
              <li>Sharing depends on available funds in the pool</li>
            </ul>
            <p>
              Specific limit amounts are provided in your plan documents. We
              encourage members to review their plan details and contact us
              with questions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              8. Member Responsibilities
            </h2>
            <p className="mb-4">
              Members are responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Paying monthly contributions on time</li>
              <li>Submitting needs with complete, accurate documentation</li>
              <li>Negotiating with providers for fair pricing (we encourage price transparency)</li>
              <li>Maintaining a healthy lifestyle in accordance with our community values</li>
              <li>Communicating honestly with our team about your needs</li>
              <li>Understanding that sharing is voluntary and not guaranteed</li>
              <li>Reviewing and complying with these guidelines and your plan terms</li>
            </ul>
            <p>
              Fraudulent submissions or misrepresentation may result in
              termination of membership and potential legal action. We rely on
              the integrity of our members to maintain a sustainable sharing
              community.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-200 flex flex-wrap gap-6">
          <Link
            href="/legal/terms"
            className="text-teal-600 hover:text-teal-700 font-medium"
          >
            View Terms of Service →
          </Link>
          <Link
            href="/legal/privacy"
            className="text-teal-600 hover:text-teal-700 font-medium"
          >
            View Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}
