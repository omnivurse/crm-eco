import type { Metadata } from 'next';
import { LandingBento } from '@crm-eco/ui/components/landing-bento';
import { LandingRail } from '@crm-eco/ui/components/landing-rail';
import type { LandingRailStation } from '@crm-eco/ui/components/landing-rail';
import { PageSection } from '@/components/page-section';
import styles from '@/components/landing/dhh-marketing.module.css';

export const metadata: Metadata = {
  title: 'About | Double Helix Software',
  description: 'A purpose-built operating system for health benefits, born out of running real benefits operations.',
};

/**
 * Ornament geometry for the "How we ship" tile. `showStations={false}`, so
 * these strings are never rendered and never announced — they only set the
 * strand's length. They are lifted from that tile's own sentence ("Schema,
 * RLS, and identity are unified"), so even the invisible words are the page's
 * existing copy rather than a new claim.
 */
const BACKBONE_ORNAMENT: LandingRailStation[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'schema', label: 'Schema' },
  { id: 'rls', label: 'RLS' },
];

/**
 * /about — restyled into the landing family, copy carried forward verbatim.
 *
 * Every word below (the headline, the lede, the three card headings and their
 * bodies, the CTA label and its href) is text this page already shipped.
 * Nothing was added, amplified or removed: there are no metrics, customer
 * names, logos or certifications on this page, and none were invented for it.
 *
 * The three cards are `.lp-tile`s in the shared bento grid. Their tones are
 * the two strands read as bookends — "Our thesis" on cyan (CRM Core), "Who we
 * serve" on emerald (Admin Enrollment) — with the shared backbone between
 * them, which is the one card whose claim IS the strand and therefore the one
 * carrying the strand ornament.
 *
 * The tiles are composed from the shared classes rather than through
 * `<LandingBentoTile>` for one reason: that component always emits an `h3`,
 * and these sit directly under the page `h1`. Same markup, same chrome, one
 * heading level corrected — the same trade `site-header.tsx` and
 * `site-footer.tsx` make against `<LandingNav>` / `<LandingFooter>`.
 *
 * No card carries a product screenshot. None of the three sentences is
 * evidenced by any still that exists, and a screenshot under a sentence it
 * does not evidence is decoration pretending to be proof.
 *
 * The `01 / 02 / 03` labels are the family's mono ledger micro-label. They are
 * indices, not claims.
 */
export default function AboutPage() {
  return (
    <PageSection
      eyebrow="About"
      title={
        <>
          Built by operators, <span className="lp-gradient">for operators.</span>
        </>
      }
      lede="Double Helix Software started as the internal toolset behind a benefits advisory operation. We rebuilt every painful spreadsheet, every off-the-shelf CRM workaround, every billing and commissions hack — and shipped them as a platform any agency or TPA can license."
      cta={{ href: '/#request-access', label: 'Request access' }}
    >
      <LandingBento>
        <article className="lp-tile" data-span="unit" data-tone="a">
          <div className="lp-tile-inner">
            <div className="lp-tile-body">
              <p className="lp-eyebrow lp-tile-label">01</p>
              <h2 className="lp-tile-title">Our thesis</h2>
              <p className="lp-tile-text">
                Generic CRMs don’t know what a Medicare lead is. Generic billing systems don’t
                know what an advisor commission is. We built both — together — so the data flows.
              </p>
            </div>
          </div>
        </article>

        <article className={`lp-tile ${styles.strandTile}`} data-span="unit">
          <div className="lp-tile-inner">
            <div className="lp-tile-body">
              <p className="lp-eyebrow lp-tile-label">02</p>
              <h2 className="lp-tile-title">How we ship</h2>
              <p className="lp-tile-text">
                One shared backbone. Multi-tenant by design. Schema, RLS, and identity are
                unified so every product feels like part of the same system rather than a
                stitched-together suite.
              </p>
              <LandingRail
                className={styles.tileStrand}
                tone="cyan"
                stations={BACKBONE_ORNAMENT}
                orientation="vertical"
                showStations={false}
                fade="ends"
              />
            </div>
          </div>
        </article>

        <article className="lp-tile" data-span="unit" data-tone="b">
          <div className="lp-tile-inner">
            <div className="lp-tile-body">
              <p className="lp-eyebrow lp-tile-label">03</p>
              <h2 className="lp-tile-title">Who we serve</h2>
              <p className="lp-tile-text">
                Independent benefits advisors, growing agencies, and TPAs who need a real
                operating system without enterprise pricing or implementation pain.
              </p>
            </div>
          </div>
        </article>
      </LandingBento>
    </PageSection>
  );
}
