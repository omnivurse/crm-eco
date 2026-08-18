import type { Metadata } from 'next';
import Link from 'next/link';
import { SmsPrivacyPolicy } from '@crm-eco/ui/components/sms-privacy-policy';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { landingFontVars } from '@/components/landing/fonts';
import landing from '@/components/landing/dhh-landing.module.css';
import styles from '@/components/landing/dhh-doc.module.css';

export const metadata: Metadata = {
  title: 'SMS Privacy Policy | Double Helix Software',
  description:
    'How Double Helix Software and tenant brands collect, use, and protect information related to text message campaigns.',
};

/**
 * The body of this document comes from the SHARED `SmsPrivacyPolicy` component
 * in @crm-eco/ui, which several apps render — not a word of it is ours to
 * reword, and the component itself is untouched. It is handed `styles.prose`
 * as its only class; that rule set also resets the component's `opacity-90` /
 * `opacity-70` utilities, whose element opacity multiplied with the alpha
 * already inside the --lp-* colours and dropped the "Last updated" line under
 * the AA contrast floor.
 */
export default function SmsPrivacyPage() {
  return (
    <div className={`lp-root ${landing.root} ${landingFontVars}`} data-strand="dhh">
      <main>
        <LandingSection className={styles.page} aria-label="SMS Privacy Policy">
          <LandingSectionHead
            className={styles.head}
            as="h1"
            eyebrow="Legal"
            heading="SMS Privacy Policy"
            lede="This policy explains how we handle personal information for text message campaigns, including how to opt out."
          />

          <div className={styles.paper}>
            <div className={styles.paperInner}>
              <SmsPrivacyPolicy
                brand={{
                  companyName: 'Double Helix Software',
                  contactEmail: 'privacy@doublehelixhub.com',
                  supportEmail: 'support@doublehelixhub.com',
                }}
                className={styles.prose}
              />
            </div>
          </div>

          <nav className={styles.related} aria-label="Other legal documents">
            <Link href="/legal/privacy" className="lp-crosslink">
              <span className="lp-crosslink-label">Legal</span>
              <span className="lp-crosslink-title">Privacy Policy</span>
            </Link>
            <Link href="/legal/terms" className="lp-crosslink">
              <span className="lp-crosslink-label">Legal</span>
              <span className="lp-crosslink-title">Terms of Service</span>
            </Link>
          </nav>
        </LandingSection>
      </main>
    </div>
  );
}
