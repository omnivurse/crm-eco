import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { landingFontVars } from '@/components/landing/fonts';
import landing from '@/components/landing/dhh-landing.module.css';
import styles from '@/components/landing/dhh-doc.module.css';

export const metadata: Metadata = {
  title: 'Privacy Policy | Double Helix Software',
};

/**
 * Legal copy is verbatim — it exists for legal review, so not one sentence is
 * reworded here. Everything that changed is chrome: the page now sits on the
 * shared landing system (`lp-root` + `--lp-*` tokens, `data-strand="dhh"` for
 * the balanced two-lobe corporate mesh), the body copy is set to a 68ch
 * reading measure at --lp-fg on --lp-bezel-inner, and the document no longer
 * dead-ends — the other two legal documents are one click away.
 */
export default function PrivacyPage() {
  return (
    <div className={`lp-root ${landing.root} ${landingFontVars}`} data-strand="dhh">
      <main>
        <LandingSection className={styles.page} aria-label="Privacy Policy">
          <LandingSectionHead
            className={styles.head}
            as="h1"
            eyebrow="Legal"
            heading="Privacy Policy"
            lede="A full privacy policy will be published before general availability. The summary below describes our current data handling for evaluation accounts."
          />

          <div className={styles.paper}>
            <div className={styles.paperInner}>
              <div className={styles.prose}>
                <p>
                  Double Helix Software is a multi-tenant SaaS platform. Each licensed tenant org
                  owns its customer, member, and operational data within an isolated
                  row-level-secured database partition. Double Helix-the-company processes that data
                  only to the extent required to operate the platform, deliver support, and meet
                  legal obligations.
                </p>
                <p>
                  During phase 1 (private access), evaluation accounts may surface anonymized
                  aggregate metrics to internal product and engineering teams. We do not sell or
                  share customer or member data with third parties.
                </p>
                <p>
                  For HIPAA-relevant deployments, Double Helix offers a Business Associate Agreement
                  (BAA) to in-scope licensees. Contact us for the current BAA template and supported
                  coverage.
                </p>
                <p>
                  A finalized policy will replace this page before public launch. Until then, please
                  contact <a href="mailto:privacy@doublehelixhub.com">privacy@doublehelixhub.com</a>{' '}
                  with any questions.
                </p>
              </div>
            </div>
          </div>

          <nav className={styles.related} aria-label="Other legal documents">
            <Link href="/legal/terms" className="lp-crosslink">
              <span className="lp-crosslink-label">Legal</span>
              <span className="lp-crosslink-title">Terms of Service</span>
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
