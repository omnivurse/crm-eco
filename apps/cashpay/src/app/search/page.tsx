import type { Metadata } from 'next';
import { LandingNav } from '@crm-eco/ui/components/landing-nav';
import { LandingFooter } from '@crm-eco/ui/components/landing-footer';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CashPaySearch } from '@/components/CashPaySearch';
import { landingFontVars } from '@/lib/fonts';
import { brand } from '@/lib/brand';
import styles from '../cashpay-landing.module.css';

export const metadata: Metadata = {
  title: 'Search cash prices',
};

export default function SearchPage() {
  return (
    <div className={`lp-root ${styles.root} ${landingFontVars}`}>
      <LandingNav
        links={[
          { href: '/', label: 'Home' },
          { href: '/#access', label: 'Request access' },
          { href: 'https://doublehelixhub.com', label: 'Hub', external: true },
        ]}
        authHref="#search"
        authLabel="Compare prices"
        productLabel={brand.product}
        themeToggle={<ThemeToggle className="lp-theme-btn !h-11 !w-11" />}
      />
      <main>
        <LandingSection id="search" aria-label="Compare cash prices">
          <LandingSectionHead
            as="h1"
            eyebrow="Search"
            heading="Compare cash prices"
            lede="Published hospital cash / self-pay figures for the metros on the file. Not a quote. Not insurance."
          />
          <div className={styles.searchPanel}>
            <CashPaySearch />
          </div>
        </LandingSection>
      </main>
      <LandingFooter
        brand={`${brand.name} · ${brand.product}`}
        description="Data from published cash-price files via Health Cost Labs — hospital, RX, imaging, labs. Completeness varies."
        columns={[
          {
            heading: 'Product',
            links: [
              { href: '/', label: 'Home' },
              { href: '/#access', label: 'Request access' },
            ],
          },
        ]}
      />
    </div>
  );
}
