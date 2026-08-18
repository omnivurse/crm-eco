/**
 * doublehelixhub site footer.
 *
 * Built from the shared landing footer vocabulary — `.lp-footer`,
 * `.lp-footer-grid`, `.lp-footer-brand`, `.lp-footer-desc`, `.lp-footer-col`,
 * `.lp-footer-bottom` — so it is the same object as the footers on the CRM and
 * MMS landings, including their <=768px two-column collapse, their <=420px
 * single column and their 44px mobile link rows.
 *
 * It is composed here rather than through `packages/ui`'s `<LandingFooter>`
 * because that component takes `brand` as a plain string, has no slot for the
 * "Request access" action, and hard-codes the copyright year. This site needs
 * the brand mark, the CTA and a live year. Same classes, same look, no second
 * system — and `layout.tsx` renders exactly one footer, so nothing is doubled.
 *
 * Server component: no `'use client'`, phosphor icons from `/dist/ssr`.
 *
 * Copy is carried forward verbatim. Every link is the href it was.
 */

import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { BrandLogo } from '@crm-eco/ui/components/brand-logo';
import styles from '@/components/chrome.module.css';

type FooterLink = {
  href: string;
  label: string;
  /** The two products carry their strand tone, same as the mobile menu. */
  tone?: 'cyan' | 'emerald';
};

const COLUMNS: readonly { heading: string; links: readonly FooterLink[] }[] = [
  {
    heading: 'Products',
    links: [
      { href: '/products/crm', label: 'CRM Core', tone: 'cyan' },
      { href: '/products/admin', label: 'Admin Enrollment', tone: 'emerald' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/sms-privacy', label: 'SMS Privacy' },
      { href: '/legal/terms', label: 'Terms' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className={`lp-footer ${styles.footer}`}>
      <div className="lp-footer-grid">
        <div>
          <div className={`lp-footer-brand ${styles.footerBrand}`}>
            <BrandLogo variant="full" size="sm" tone="auto" alt="Double Helix Hub" />
          </div>
          <p className="lp-footer-desc">
            The operating system for health benefits. Licensed SaaS for advisors,
            agencies, and TPAs.
          </p>
          <Link href="/#request-access" className={styles.footerCta}>
            Request access
            <ArrowUpRight
              weight="light"
              className={`h-4 w-4 ${styles.footerCtaIcon}`}
              aria-hidden
            />
          </Link>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.heading} className="lp-footer-col">
            <h2 className={styles.colHeading}>{column.heading}</h2>
            {column.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={link.tone ? styles.colLink : undefined}
              >
                {link.tone ? (
                  <span
                    aria-hidden
                    className={`${styles.dot} ${
                      link.tone === 'cyan' ? styles.dotCyan : styles.dotEmerald
                    }`}
                  />
                ) : null}
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="lp-footer-bottom">
        <span>
          © {new Date().getFullYear()} Double Helix Software. All rights reserved.
        </span>
        <span>doublehelixhub.com</span>
      </div>
    </footer>
  );
}
