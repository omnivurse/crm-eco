import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { landingFontVars } from '@/components/landing/fonts';
import landing from '@/components/landing/dhh-landing.module.css';
import styles from '@/components/landing/dhh-doc.module.css';

export const metadata: Metadata = {
  title: 'Terms of Service | Double Helix Software',
};

/**
 * Legal copy is verbatim — structure, spacing, measure, hierarchy and contrast
 * only. See the note in ../privacy/page.tsx for what the chrome change is.
 */
export default function TermsPage() {
  return (
    <div className={`lp-root ${landing.root} ${landingFontVars}`} data-strand="dhh">
      <main>
        <LandingSection className={styles.page} aria-label="Terms of Service">
          <LandingSectionHead
            className={styles.head}
            as="h1"
            eyebrow="Legal"
            heading="Terms of Service"
            lede="A full Terms of Service agreement will be published before general availability. The summary below describes our current evaluation terms."
          />

          <div className={styles.paper}>
            <div className={styles.paperInner}>
              <div className={styles.prose}>
                <p>
                  Double Helix Software is currently in private access. Use of any Double Helix
                  product or service is governed by a written agreement signed between Double Helix
                  and the licensed tenant org. Phase-1 evaluation accounts are subject to a
                  non-production evaluation agreement furnished at onboarding.
                </p>
                <p>
                  This page is a placeholder. The finalized public Terms of Service will replace it
                  before general availability and will cover acceptable use, uptime commitments,
                  support tiers, data ownership, security standards, and termination.
                </p>
                <p>
                  Questions about the current evaluation agreement or proposed master services
                  agreement? <a href="mailto:legal@doublehelixhub.com">legal@doublehelixhub.com</a>.
                </p>
              </div>
            </div>
          </div>

          <nav className={styles.related} aria-label="Other legal documents">
            <Link href="/legal/privacy" className="lp-crosslink">
              <span className="lp-crosslink-label">Legal</span>
              <span className="lp-crosslink-title">Privacy Policy</span>
            </Link>
            <Link href="/legal/sms-privacy" className="lp-crosslink">
              <span className="lp-crosslink-label">Legal</span>
              <span className="lp-crosslink-title">SMS Privacy Policy</span>
            </Link>
          </nav>
        </LandingSection>
      </main>
    </div>
  );
}
