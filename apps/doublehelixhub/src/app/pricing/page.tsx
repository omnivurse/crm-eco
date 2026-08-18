import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from '@phosphor-icons/react/dist/ssr';
import { LandingSection } from '@crm-eco/ui/components/landing-section';
import { LandingRail } from '@crm-eco/ui/components/landing-rail';
import type { LandingRailStation } from '@crm-eco/ui/components/landing-rail';
import { landingFontVars } from '@/components/landing/fonts';
import landing from '@/components/landing/dhh-landing.module.css';
import styles from '@/components/landing/dhh-marketing.module.css';

export const metadata: Metadata = {
  title: 'Pricing | Double Helix Software',
  description: 'Simple per-tenant pricing for CRM Core and Admin Enrollment. Subscribe to one or both.',
};

/**
 * Ornament geometry for the masthead strand. `showStations={false}`, so the
 * labels are never rendered and never announced; the count sets the strand's
 * height. Named for the three tiers below, which is what this page is.
 */
const TIER_ORNAMENT: LandingRailStation[] = [
  { id: 'crm-core', label: 'CRM Core' },
  { id: 'admin-enrollment', label: 'Admin Enrollment' },
  { id: 'suite', label: 'Suite' },
];

/**
 * The tiers, byte-for-byte as they shipped: same names, same descriptions,
 * same "Custom" price, same "per tenant org", same feature bullets in the same
 * order, same CTA labels, same highlighted tier. Nothing here is a number we
 * invented — all three prices are deliberately Custom, and this file must
 * never be the place that changes.
 *
 * `accent` is presentation only: which of the two strands the card carries.
 */
const tiers = [
  {
    name: 'CRM Core',
    description: 'For benefits advisors and small agencies.',
    price: 'Custom',
    period: 'per tenant org',
    cta: 'Request a quote',
    accent: 'crm' as const,
    features: [
      'Unlimited records & modules',
      'Email & SMS sync',
      'Embeddable lead forms',
      'Automations engine',
      'HIPAA-aware audit logs',
    ],
  },
  {
    name: 'Admin Enrollment',
    description: 'For agencies running their own enrollment.',
    price: 'Custom',
    period: 'per tenant org',
    cta: 'Request a quote',
    accent: 'admin' as const,
    features: [
      'Plan & rate engines',
      'Member management + portal',
      'Multi-gateway billing',
      'Commissions & payouts',
      'Tenant landing-page builder',
    ],
    highlighted: true,
  },
  {
    name: 'Suite',
    description: 'CRM Core + Admin Enrollment, bundled.',
    price: 'Custom',
    period: 'per tenant org',
    cta: 'Talk to sales',
    accent: 'suite' as const,
    features: [
      'Everything in both products',
      'Unified identity & RLS',
      'Cross-product automations',
      'Dedicated onboarding manager',
      'Priority support',
    ],
  },
];

const TIER_ACCENT: Record<(typeof tiers)[number]['accent'], string> = {
  crm: styles.tierCrm,
  admin: styles.tierAdmin,
  suite: styles.tierSuite,
};

/**
 * /pricing — restyled into the landing family. This is a re-dress and a
 * recomposition, not a rewrite: the headline, the lede, all three tiers and
 * the closing line are the copy that was already here.
 *
 * The composition change worth naming: colour now carries the thesis. CRM Core
 * takes the cyan strand, Admin Enrollment the emerald one, and the Suite card's
 * rule runs cyan -> emerald because the Suite is literally both. That is the
 * company's own claim ("subscribe to either product — or both") said in the
 * one language a price table can say it in.
 *
 * There is no product screenshot on this page. The stills that exist show the
 * CRM desk and the MMS console; none of them evidences a price, and the honest
 * fallback for a surface with no still is typographic + strand.
 */
export default function PricingPage() {
  return (
    <div className={`lp-root ${landing.root} ${landingFontVars}`} data-strand="dhh">
      <main>
        <section className={`lp-hero ${styles.masthead}`} aria-label="Double Helix pricing">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Pricing</p>
            <h1 className="lp-display">
              Pricing scales with <span className="lp-gradient">your tenancy.</span>
            </h1>
            <p className="lp-lede">
              We&rsquo;re onboarding manually during phase 1 — every customer gets a hands-on
              implementation. Final pricing is custom while we calibrate seats, volume tiers, and
              gateway-specific fees.
            </p>
          </div>

          <div className={`lp-hero-stage ${styles.mastheadStage}`} aria-hidden="true">
            <LandingRail
              className={styles.mastheadSpine}
              tone="cyan"
              stations={TIER_ORNAMENT}
              orientation="vertical"
              showStations={false}
              fade="ends"
            />
          </div>
        </section>

        <LandingSection aria-label="Plans">
          <div className={styles.tierGrid}>
            {tiers.map((tier) => (
              <article
                key={tier.name}
                className={[
                  'lp-tile',
                  styles.tier,
                  TIER_ACCENT[tier.accent],
                  tier.highlighted ? styles.tierPopular : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={`lp-tile-inner ${styles.tierInner}`}>
                  {tier.highlighted && <span className={styles.tierBadge}>Most popular</span>}

                  <h2 className={styles.tierName}>{tier.name}</h2>
                  <p className={styles.tierDesc}>{tier.description}</p>

                  <p className={styles.tierPrice}>
                    <span className={styles.tierAmount}>{tier.price}</span>
                    <span className={styles.tierPeriod}>{tier.period}</span>
                  </p>

                  <ul className={styles.tierFeatures}>
                    {tier.features.map((feature) => (
                      <li key={feature} className={styles.tierFeature}>
                        <Check weight="light" className={styles.tierCheck} aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/#request-access"
                    className={`${tier.highlighted ? 'lp-btn-primary' : 'lp-btn-secondary'} ${styles.tierCta}`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <p className={styles.footnote}>
            Volume, multi-tenant, and partner agreements available — talk to us.
          </p>
        </LandingSection>
      </main>
    </div>
  );
}
