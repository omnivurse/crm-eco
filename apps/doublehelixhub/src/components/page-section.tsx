import type { ReactNode } from 'react';
import Link from 'next/link';
import { LandingSection } from '@crm-eco/ui/components/landing-section';
import { LandingRail } from '@crm-eco/ui/components/landing-rail';
import type { LandingRailStation } from '@crm-eco/ui/components/landing-rail';
import { landingFontVars } from '@/components/landing/fonts';
import landing from '@/components/landing/dhh-landing.module.css';
import styles from '@/components/landing/dhh-marketing.module.css';

/**
 * The shared masthead for a secondary corporate page.
 *
 * Same props it has always taken — `eyebrow`, `title`, `lede`, `children`,
 * `cta` — so every existing caller keeps working; the three text props are
 * widened from `string` to `ReactNode` so a page can put the landing family's
 * `.lp-gradient` on the half of its headline that carries the idea. Widening
 * breaks nothing: every `string` is a valid `ReactNode`.
 *
 * What changed is the dress. It was `container-page` + `dh-eyebrow` +
 * `font-heading`; it is now a `.lp-root` landing page — `.lp-hero`,
 * `.lp-eyebrow`, `h1.lp-display`, `.lp-lede`, `.lp-btn-primary` — so a
 * corporate page and a product landing are recognisably the same site.
 *
 * `data-strand="dhh"` is the corporate strand: cyan-led accents plus the
 * balanced two-lobe mesh that `globals.css` paints when a landing root is on
 * the page. Neither product leads on doublehelixhub.com.
 *
 * The masthead's right-hand column is the record rail with its stations
 * hidden — the signature, not a screenshot. There is no honest still of "about
 * us", and the brief's rule is explicit: a tile with no honest still goes
 * typographic + strand rather than faking a product surface out of divs.
 *
 * The `cta` moved from the foot of the page into `.lp-hero-actions`. It is the
 * same label pointing at the same href; the landing family puts the primary
 * action beside the headline, and a lone button under a card grid was reading
 * as an orphan.
 */

/**
 * Ornament geometry only. `showStations={false}` means these strings are never
 * rendered and never announced — the rail's viewBox is one square per station,
 * so the count is what sets the strand's height. Three stations is a masthead;
 * five is a full page. They are named for the two products and the bundle
 * because that is what the strand means on this site, not because the page
 * claims anything about them.
 */
const MASTHEAD_STATIONS: LandingRailStation[] = [
  { id: 'crm-core', label: 'CRM Core' },
  { id: 'admin-enrollment', label: 'Admin Enrollment' },
  { id: 'suite', label: 'Suite' },
];

export function PageSection({
  eyebrow,
  title,
  lede,
  children,
  cta,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  cta?: { href: string; label: string };
}) {
  return (
    <div
      className={`lp-root ${landing.root} ${landingFontVars}`}
      data-strand="dhh"
    >
      <main>
        <section className={`lp-hero ${styles.masthead}`}>
          <div className="lp-hero-copy">
            {eyebrow ? <p className="lp-eyebrow">{eyebrow}</p> : null}
            <h1 className="lp-display">{title}</h1>
            {lede ? <p className="lp-lede">{lede}</p> : null}
            {cta ? (
              <div className="lp-hero-actions">
                <Link href={cta.href} className="lp-btn-primary">
                  {cta.label}
                </Link>
              </div>
            ) : null}
          </div>

          <div className={`lp-hero-stage ${styles.mastheadStage}`} aria-hidden="true">
            <LandingRail
              className={styles.mastheadSpine}
              tone="cyan"
              stations={MASTHEAD_STATIONS}
              orientation="vertical"
              showStations={false}
              fade="ends"
            />
          </div>
        </section>

        {children ? <LandingSection>{children}</LandingSection> : null}
      </main>
    </div>
  );
}
