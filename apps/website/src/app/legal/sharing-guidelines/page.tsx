import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Handshake } from '@phosphor-icons/react/dist/ssr';
import { Container, Eyebrow, CTABand } from '@/components/sections/blocks';
import { Reveal } from '@/components/sections/Reveal';

export const metadata: Metadata = {
  title: 'Sharing Guidelines',
  description:
    'Pay It Forward Health sharing guidelines: eligible medical needs, ineligible expenses, the Initial Unshareable Amount, and member responsibilities.',
};

export default function SharingGuidelinesPage() {
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
                <ArrowLeft weight="light" className="h-4 w-4" />
                Back to home
              </Link>
          <div className="mt-8 max-w-2xl">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-pif-gold-300 ring-1 ring-white/15">
              <Handshake weight="light" className="h-6 w-6" />
            </span>
            <Eyebrow tone="light" className="mt-6">
              Legal
            </Eyebrow>
            <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight text-white">
              Sharing Guidelines
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
                  1. Overview
                </h2>
                <p className="mt-4">
                  Double Helix Hub operates as a health cost sharing ministry.
                  Members voluntarily share each other&apos;s eligible medical
                  expenses. These guidelines define what qualifies for sharing, how
                  the process works, and member responsibilities.
                </p>
                <p className="mt-4">
                  These guidelines are essential reading for all members. Sharing
                  is subject to available funds in the sharing pool and compliance
                  with these guidelines. Double Helix Hub is NOT insurance and
                  does not guarantee payment of any medical expense.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  2. Eligible Medical Needs
                </h2>
                <p className="mt-4">Eligible medical needs generally include:</p>
                <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-pif-teal-500">
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
                <p className="mt-4">
                  Eligibility is determined on a case-by-case basis. All needs must
                  be submitted with required documentation and meet the criteria
                  outlined in these guidelines.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  3. Ineligible Expenses
                </h2>
                <p className="mt-4">
                  The following are generally NOT eligible for sharing:
                </p>
                <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-pif-teal-500">
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
                <p className="mt-4">
                  This list is not exhaustive. Members should contact us with
                  questions about specific situations before incurring expenses.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  4. Initial Unshareable Amount (IUA)
                </h2>
                <p className="mt-4">
                  The Initial Unshareable Amount (IUA) is the amount each household
                  is responsible for before sharing begins for a given need. Think
                  of it similarly to a deductible. The IUA varies by plan level:
                </p>
                <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-pif-teal-500">
                  <li><strong>Essential:</strong> $500 per incident</li>
                  <li><strong>Premium:</strong> $300 per incident</li>
                  <li><strong>Complete:</strong> $150 per incident</li>
                </ul>
                <p className="mt-4">
                  Multiple related expenses for the same medical incident may be
                  combined toward the IUA. Once the IUA is met, eligible amounts
                  above that threshold may be submitted for sharing. The IUA applies
                  per incident, not per year.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  5. Pre-Existing Conditions
                </h2>
                <p className="mt-4">
                  Pre-existing conditions are medical conditions for which you
                  received diagnosis or treatment in the 24 months prior to
                  membership. There is typically a waiting period before
                  pre-existing conditions become eligible for sharing:
                </p>
                <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-pif-teal-500">
                  <li>Most pre-existing conditions: 24-month waiting period</li>
                  <li>Certain conditions may have longer or different waiting periods</li>
                  <li>Routine care for pre-existing conditions may be eligible sooner</li>
                </ul>
                <p className="mt-4">
                  Members with pre-existing conditions should review their
                  enrollment materials and contact us for specific guidance. We
                  are committed to transparency about what is and is not covered.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  6. Submission Process
                </h2>
                <p className="mt-4">To submit a medical need for sharing:</p>
                <ol className="mt-4 list-decimal space-y-2 pl-6 marker:font-semibold marker:text-pif-teal-600">
                  <li>Obtain care from a qualified healthcare provider</li>
                  <li>Pay your provider or arrange for itemized billing</li>
                  <li>Submit the need through the member portal with required documentation</li>
                  <li>Include itemized bills, proof of payment, and any requested medical records</li>
                  <li>Our team will review for eligibility and process accordingly</li>
                </ol>
                <p className="mt-4">
                  Needs should be submitted within 6 months of the date of service.
                  Incomplete submissions may delay processing. We aim to process
                  eligible needs within 48&ndash;72 hours of receiving complete
                  documentation.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  7. Sharing Limits
                </h2>
                <p className="mt-4">
                  Sharing is subject to per-incident and annual limits based on your
                  plan. Limits are designed to ensure the long-term sustainability
                  of our sharing community while providing meaningful support for
                  members.
                </p>
                <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-pif-teal-500">
                  <li>Per-incident limits vary by plan (Essential, Premium, Complete)</li>
                  <li>Annual sharing limits apply per household</li>
                  <li>Lifetime maximums may apply for certain plan levels</li>
                  <li>Sharing depends on available funds in the pool</li>
                </ul>
                <p className="mt-4">
                  Specific limit amounts are provided in your plan documents. We
                  encourage members to review their plan details and contact us
                  with questions.
                </p>
              </section>

              <section>
                <h2 className="font-heading text-2xl font-semibold text-pif-navy-800">
                  8. Member Responsibilities
                </h2>
                <p className="mt-4">Members are responsible for:</p>
                <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-pif-teal-500">
                  <li>Paying monthly contributions on time</li>
                  <li>Submitting needs with complete, accurate documentation</li>
                  <li>Negotiating with providers for fair pricing (we encourage price transparency)</li>
                  <li>Maintaining a healthy lifestyle in accordance with our community values</li>
                  <li>Communicating honestly with our team about your needs</li>
                  <li>Understanding that sharing is voluntary and not guaranteed</li>
                  <li>Reviewing and complying with these guidelines and your plan terms</li>
                </ul>
                <p className="mt-4">
                  Fraudulent submissions or misrepresentation may result in
                  termination of membership and potential legal action. We rely on
                  the integrity of our members to maintain a sustainable sharing
                  community.
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
                <ArrowUpRight weight="light" className="h-4 w-4" />
              </Link>
              <Link
                href="/legal/privacy"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-pif-teal-700 transition-colors hover:text-pif-green-600"
              >
                Privacy Policy
                <ArrowUpRight weight="light" className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      <CTABand
        title="Not sure if your need qualifies?"
        subtitle="Reach out before you incur an expense — our team will help you understand what is eligible for sharing."
        primary={{ label: 'Contact Us', href: '/contact' }}
        secondary={null}
      />
    </>
  );
}
