import { LandingNav } from '@crm-eco/ui/components/landing-nav';
import { LandingFooter } from '@crm-eco/ui/components/landing-footer';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AccessForm } from '@/components/AccessForm';
import { InstrumentPreview } from '@/components/InstrumentPreview';
import { MarketAtlas } from '@/components/MarketAtlas';
import { landingFontVars } from '@/lib/fonts';
import { brand } from '@/lib/brand';
import { loadHclCatalog, uniqueStates } from '@crm-eco/cash-pay';
import styles from './cashpay-landing.module.css';
import tape from './instrument.module.css';

const NAV_LINKS = [
  { href: '#markets', label: 'Markets' },
  { href: '#file', label: 'The file' },
  { href: '#access', label: 'License this UI' },
];

export default function HomePage() {
  const markets = uniqueStates(loadHclCatalog());

  return (
    <div className={`lp-root ${styles.root} ${landingFontVars}`}>
      <LandingNav
        links={NAV_LINKS}
        authHref="/search"
        authLabel="Open the instrument"
        productLabel={brand.product}
        themeToggle={<ThemeToggle className="lp-theme-btn !h-11 !w-11" />}
      />

      <main>
        <section className={`lp-hero ${styles.hero}`} aria-label={`${brand.name} ${brand.product}`}>
          <div className={`lp-hero-copy ${styles.heroCopy}`}>
            <p className="lp-eyebrow">{brand.product}</p>
            <h1 className="lp-display">Hospital cash files, finally designed.</h1>
            <p className="lp-lede">
              Published rates for 55 HCL markets. Not a quote. Not insurance.
            </p>
            <div className="lp-hero-actions">
              <a href="/search" className="lp-btn-primary">
                Open the instrument
              </a>
              <a href="#access" className="lp-btn-secondary">
                License this UI
              </a>
            </div>
          </div>

          <div className={styles.heroStage}>
            <InstrumentPreview />
          </div>
        </section>

        <LandingSection id="markets" aria-label="HCL markets">
          <LandingSectionHead
            heading="55 HCL markets, 225 metros"
            lede="HCL does not list plain California or Texas. Those files live under CA-N, CA-S, and four Texas regions. Names match their inventory exactly."
          />
          <MarketAtlas markets={markets} />
        </LandingSection>

        <LandingSection id="file" aria-label="What the file contains">
          <LandingSectionHead
            heading="One tick from the file"
            lede="Hospital cash is live on this key. Pharmacy, imaging, and laboratory are not mapped yet, so they are not offered as if they work."
          />
          <div className={tape.specimen}>
            <div>
              <span className={tape.statLabel}>Code</span>
              <span className={tape.mono}>CPT / HCPCS</span>
            </div>
            <div>
              <span className={tape.statLabel}>Tick</span>
              <strong>Facility, city, payment method</strong>
            </div>
            <div>
              <span className={tape.statLabel}>Loud / quiet</span>
              <div className={tape.rate}>Cash rate</div>
              <div className={tape.needle}>CMS relativity</div>
            </div>
          </div>
        </LandingSection>

        <LandingSection id="contrast" aria-label="Five dropdowns versus an instrument">
          <LandingSectionHead
            heading="Their site asks five questions. This one reads the tape."
            lede="Specialty, state, metro, code, billing class. The data was never the problem. The interface was."
          />
          <div className={tape.contrast}>
            <div className={tape.contrastCol}>
              <strong>Five dropdowns</strong>
              <p className={tape.note}>
                A GET-Rates form that dumps rows. No compare, no Medicare needle, no shareable
                metro URL.
              </p>
            </div>
            <div className={tape.contrastCol}>
              <strong>The instrument</strong>
              <p className={tape.note}>
                HCL market, exact metro, CPT as the hero query, slice stats labeled as this page,
                compare tray, facility drawer.
              </p>
            </div>
          </div>
        </LandingSection>

        <LandingSection id="access" aria-label="License this UI">
          <LandingSectionHead
            heading="Put a UI on your data"
            lede="White-label tokens, not a fork. Leave a note and we will talk metros, branding, and the live specialty list."
          />
          <AccessForm />
        </LandingSection>
      </main>

      <LandingFooter
        brand={`${brand.name} · ${brand.product}`}
        description="Cash Pay displays published hospital cash and self-pay figures via Health Cost Labs. Completeness varies by metro. Not a medical, insurance, or billing quote."
        columns={[
          {
            heading: 'Product',
            links: [
              { href: '/search', label: 'Open the instrument' },
              { href: '#access', label: 'License this UI' },
            ],
          },
          {
            heading: 'Platform',
            links: [
              { href: 'https://doublehelixhub.com', label: 'Double Helix Hub', external: true },
            ],
          },
        ]}
      />
    </div>
  );
}
