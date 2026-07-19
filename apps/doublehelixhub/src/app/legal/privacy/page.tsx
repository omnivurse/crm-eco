import type { Metadata } from 'next';
import { PageSection } from '@/components/page-section';

export const metadata: Metadata = {
  title: 'Privacy Policy | Double Helix Software',
};

export default function PrivacyPage() {
  return (
    <PageSection
      eyebrow="Legal"
      title="Privacy Policy"
      lede="A full privacy policy will be published before general availability. The summary below describes our current data handling for evaluation accounts."
    >
      <div className="dh-bezel max-w-3xl">
        <div className="dh-bezel-inner space-y-5 p-7 text-sm leading-relaxed text-white/55 sm:p-8">
          <p>
            Double Helix Software is a multi-tenant SaaS platform. Each licensed tenant org owns its
            customer, member, and operational data within an isolated row-level-secured database
            partition. Double Helix-the-company processes that data only to the extent required to
            operate the platform, deliver support, and meet legal obligations.
          </p>
          <p>
            During phase 1 (private access), evaluation accounts may surface anonymized aggregate
            metrics to internal product and engineering teams. We do not sell or share customer or
            member data with third parties.
          </p>
          <p>
            For HIPAA-relevant deployments, Double Helix offers a Business Associate Agreement (BAA)
            to in-scope licensees. Contact us for the current BAA template and supported coverage.
          </p>
          <p>
            A finalized policy will replace this page before public launch. Until then, please
            contact{' '}
            <a className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300" href="mailto:privacy@doublehelixhub.com">
              privacy@doublehelixhub.com
            </a>{' '}
            with any questions.
          </p>
        </div>
      </div>
    </PageSection>
  );
}
