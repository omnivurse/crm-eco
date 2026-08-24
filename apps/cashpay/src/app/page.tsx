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
            <h1 className="lp-display">Every published payer, on one tape.</h1>
            <p className="lp-lede">
              Anthem, UHC, Cigna, Medicare, cash — named on the tick, not guessed. 55 HCL markets.
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
            lede="Hospital cash is live. Every tick already carries carrier, plan, LOB, product, chargemaster list, Medicare analog, NPI, and address. Clinic, pharmacy, imaging, and laboratory files 400 on this key until HCL maps them."
          />
          <div className={tape.specimen}>
            <div>
              <span className={tape.statLabel}>Who pays</span>
              <strong>Anthem · Medicare</strong>
            </div>
            <div>
              <span className={tape.statLabel}>List / analog</span>
              <span className={tape.mono}>Chargemaster · CMS $</span>
            </div>
            <div>
              <span className={tape.statLabel}>Loud / quiet</span>
              <div className={tape.rate}>Published rate</div>
              <div className={tape.needle}>× Medicare</div>
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
                Named payer on every tick. List vs Medicare vs published. Procedure typeahead,
                radius, outlier fence, coach, compare tray, facility dossier.
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
