import { LandingNav } from '@crm-eco/ui/components/landing-nav';
import { LandingFooter } from '@crm-eco/ui/components/landing-footer';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { LandingSignalStrip } from '@crm-eco/ui/components/landing-signal-strip';
import { LandingRail } from '@crm-eco/ui/components/landing-rail';
import type { LandingRailStation } from '@crm-eco/ui/components/landing-rail';
import type { LandingSignalItem } from '@crm-eco/ui/components/landing-signal-strip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CashPaySearch } from '@/components/CashPaySearch';
import { AccessForm } from '@/components/AccessForm';
import { landingFontVars } from '@/lib/fonts';
import { brand } from '@/lib/brand';
import styles from './cashpay-landing.module.css';

const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#search', label: 'Search' },
  { href: '#access', label: 'Request access' },
  { href: 'https://doublehelixhub.com', label: 'Hub', external: true },
];

const BACKBONE: LandingRailStation[] = [
  { id: 'zip', label: 'ZIP' },
  { id: 'metro', label: 'Metro' },
  { id: 'file', label: 'Hospital · RX · labs' },
  { id: 'rate', label: 'Cash rate', signal: true },
  { id: 'verify', label: 'Verify' },
];

const SIGNALS: LandingSignalItem[] = [
  {
    id: 'source',
    label: 'Source',
    value: 'Published cash / self-pay files — hospital, pharmacy, imaging, labs.',
  },
  {
    id: 'scope',
    label: 'Scope',
    value: 'Metro + specialty on the key: facility CPT and RX NDC when loaded.',
  },
  {
    id: 'not',
    label: 'Not',
    value: 'Not a quote, not insurance, not a billed-amount guarantee.',
  },
];

export default function HomePage() {
  return (
    <div className={`lp-root ${styles.root} ${landingFontVars}`}>
      <LandingNav
        links={NAV_LINKS}
        authHref="#search"
        authLabel="Compare prices"
        productLabel={brand.product}
        themeToggle={<ThemeToggle className="lp-theme-btn !h-11 !w-11" />}
      />

      <main>
        <section className={`lp-hero ${styles.hero}`} aria-label={`${brand.name} ${brand.product}`}>
          <div className={`lp-hero-copy ${styles.heroCopy}`}>
            <p className="lp-eyebrow">{brand.product}</p>
            <h1 className="lp-display">Published cash prices — hospital, RX, and the rest of the file.</h1>
            <p className="lp-lede">
              Cash Pay is a cash-price finder. It surfaces published cash / self-pay figures for
              hospital and facility care, pharmacy (RX / NDC), imaging, labs, and other billed
              services in the Health Cost Labs load. It is not insurance, not a quote, and not a
              guarantee of what you will be billed.
            </p>
            <p className="lp-lede">
              Coverage depends on which metros and specialties are loaded for your API key. Where
              the file has no mapping yet, we say so — we do not invent KPIs.
            </p>
            <div className="lp-hero-actions">
              <a href="#search" className="lp-btn-primary">
                Open search
              </a>
              <a href="#access" className="lp-btn-secondary">
                Request access
              </a>
            </div>
          </div>

          <div className={styles.heroStage}>
            <LandingRail
              className={styles.heroSpine}
              tone="cyan"
              stations={BACKBONE}
              orientation="vertical"
              showStations={false}
              fade="ends"
            />
            <div className={styles.strandTags}>
              <p className={`${styles.strandTag} ${styles.strandTagA}`}>
                <span className={styles.strandKind}>
                  <span className={styles.strandDot} aria-hidden="true" />
                  Strand A
                </span>
                <span className={styles.strandName}>CRM Core</span>
                <span className={styles.strandRole}>Book, enrollments, desk</span>
              </p>
              <p className={`${styles.strandTag} ${styles.strandTagB}`}>
                <span className={styles.strandKind}>
                  <span className={styles.strandDot} aria-hidden="true" />
                  Strand B
                </span>
                <span className={styles.strandName}>Admin Enrollment</span>
                <span className={styles.strandRole}>Members, billing, portal</span>
              </p>
              <p className={styles.backboneNote}>One identity layer · one data backbone</p>
            </div>
          </div>

          <div className={styles.heroStrip}>
            <LandingSignalStrip items={SIGNALS} variant="band" label="What Cash Pay is" />
          </div>
        </section>

        <LandingSection id="how" aria-label="How Cash Pay works">
          <LandingSectionHead
            eyebrow="Method"
            heading="How Cash Pay works"
            lede="State and MSA names must match the Health Cost Labs allowlist exactly. Specialty must match too — hospital, Pharmacy / RX, imaging, or laboratory."
          />
          <ol className={styles.steps}>
            <li>
              <strong>Pick your metro.</strong> Choose a state, then an allowlisted MSA for that
              state.
            </li>
            <li>
              <strong>Pick what to price.</strong> Hospital and facility (CPT / HCPCS), pharmacy /
              RX (NDC), imaging, or laboratory — then an optional code.
            </li>
            <li>
              <strong>Compare, then verify.</strong> Use the figure as a starting point. Confirm
              with the facility or pharmacy before you pay.
            </li>
          </ol>
        </LandingSection>

        <LandingSection id="search" aria-label="Compare cash prices">
          <LandingSectionHead
            eyebrow="Search"
            heading="Compare cash prices"
            lede="Amber is reserved for the published rate. Search hospital, RX, imaging, or labs. Completeness varies by metro and load date."
          />
          <div className={styles.searchPanel}>
            <CashPaySearch />
          </div>
        </LandingSection>

        <LandingSection id="access" aria-label="Request access">
          <LandingSectionHead
            eyebrow="Teams"
            heading="Request access"
            lede="Selling or embedding Cash Pay for your organization? Leave a note — we will follow up about MSA coverage and branding (white-label via theme tokens, not a fork)."
          />
          <AccessForm />
        </LandingSection>
      </main>

      <LandingFooter
        brand={`${brand.name} · ${brand.product}`}
        description="Cash Pay displays published cash / self-pay figures for hospital, pharmacy (RX), imaging, labs, and other billed services via Health Cost Labs. Completeness varies by metro and specialty. Not a medical, insurance, or billing quote."
        columns={[
          {
            heading: 'Product',
            links: [
              { href: '#how', label: 'How it works' },
              { href: '#search', label: 'Search' },
              { href: '#access', label: 'Request access' },
            ],
          },
          {
            heading: 'Platform',
            links: [
              { href: 'https://doublehelixhub.com', label: 'Double Helix Hub', external: true },
              { href: 'https://crm.doublehelixhub.com', label: 'CRM', external: true },
              { href: 'https://admin.doublehelixhub.com', label: 'MMS', external: true },
            ],
          },
        ]}
      />
    </div>
  );
}
