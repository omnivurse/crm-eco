import type { Metadata } from 'next';
import { PageSection } from '@/components/page-section';

export const metadata: Metadata = {
  title: 'Terms of Service | Double Helix Software',
};

export default function TermsPage() {
  return (
    <PageSection
      eyebrow="Legal"
      title="Terms of Service"
      lede="A full Terms of Service agreement will be published before general availability. The summary below describes our current evaluation terms."
    >
      <div className="prose prose-neutral max-w-3xl text-sm text-muted-foreground">
        <p>
          Double Helix Software is currently in private access. Use of any Double Helix product or
          service is governed by a written agreement signed between Double Helix and the licensed
          tenant org. Phase-1 evaluation accounts are subject to a non-production evaluation
          agreement furnished at onboarding.
        </p>
        <p>
          This page is a placeholder. The finalized public Terms of Service will replace it before
          general availability and will cover acceptable use, uptime commitments, support tiers,
          data ownership, security standards, and termination.
        </p>
        <p>
          Questions about the current evaluation agreement or proposed master services
          agreement?{' '}
          <a className="text-primary underline" href="mailto:legal@doublehelixhub.com">
            legal@doublehelixhub.com
          </a>
          .
        </p>
      </div>
    </PageSection>
  );
}
