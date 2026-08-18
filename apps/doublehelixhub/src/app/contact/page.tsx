import type { Metadata } from 'next';
import { LandingRail } from '@crm-eco/ui/components/landing-rail';
import type { LandingRailStation } from '@crm-eco/ui/components/landing-rail';
import { LeadForm } from '@/components/lead-form';
import { landingFontVars } from '@/components/landing/fonts';
import landing from '@/components/landing/dhh-landing.module.css';
import styles from '@/components/landing/dhh-marketing.module.css';

export const metadata: Metadata = {
  title: 'Contact | Double Helix Software',
  description: 'Get in touch with the Double Helix team. We respond within one business day.',
};

/**
 * Ornament geometry for the strand that runs behind the form.
 * `showStations={false}`, so these labels are never rendered and never
 * announced — the count is what makes the strand as tall as the panel. They
 * are the lede's own words ("evaluating, comparing, or ready to migrate — drop
 * a note and we'll get back"), so even the invisible text is existing copy.
 */
const INTAKE_ORNAMENT: LandingRailStation[] = [
  { id: 'evaluate', label: 'Evaluate' },
  { id: 'compare', label: 'Compare' },
  { id: 'migrate', label: 'Migrate' },
  { id: 'note', label: 'Note' },
  { id: 'reply', label: 'Reply' },
];

/**
 * /contact — restyled into the landing family. Copy is carried forward
 * verbatim: the headline, the lede and BOTH information cards, including the
 * members card telling enrolled members to reach out to their agency rather
 * than to us. That card is the page's most load-bearing sentence and it is
 * reproduced word for word.
 *
 * Reading order is deliberately unchanged from the page that shipped: the two
 * cards stay in the copy column, ABOVE the form on a phone, so a member is
 * told to contact their agency before they start filling in a form that is not
 * for them. Putting the form first would have looked better and worked worse.
 *
 * `<LeadForm />` is untouched — same component, same field names, same POST to
 * /api/leads, same Supabase write, same honeypot. It is re-dressed from the
 * outside by `.formCore` in the page module; nothing about its wiring moved.
 */
export default function ContactPage() {
  return (
    <div className={`lp-root ${landing.root} ${landingFontVars}`} data-strand="dhh">
      <main>
        <section
          className={`lp-hero ${styles.contactHero}`}
          aria-label="Contact Double Helix Software"
        >
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Contact</p>
            <h1 className="lp-display">
              Tell us about <span className="lp-gradient">your operation.</span>
            </h1>
            <p className="lp-lede">
              Whether you&rsquo;re evaluating, comparing, or ready to migrate — drop a note and
              we&rsquo;ll get back within one business day.
            </p>

            <div className={styles.infoCards}>
              <article className="lp-tile" data-tone="a">
                <div className={`lp-tile-inner ${styles.infoCard}`}>
                  <p className="lp-eyebrow lp-tile-label">01</p>
                  <h2 className="lp-tile-title">For partners &amp; licensees</h2>
                  <p className="lp-tile-text">
                    We&rsquo;re selectively onboarding agencies and TPAs in waves. Tell us about your
                    book — we&rsquo;ll tell you whether we&rsquo;re a fit.
                  </p>
                </div>
              </article>

              <article className="lp-tile" data-tone="b">
                <div className={`lp-tile-inner ${styles.infoCard}`}>
                  <p className="lp-eyebrow lp-tile-label">02</p>
                  <h2 className="lp-tile-title">For members</h2>
                  <p className="lp-tile-text">
                    If you&rsquo;re an enrolled member of an agency that uses Double Helix, please
                    reach out to your agency directly — we don&rsquo;t handle individual member
                    support.
                  </p>
                </div>
              </article>
            </div>
          </div>

          <div className={`lp-hero-stage ${styles.contactStage}`}>
            <LandingRail
              className={styles.contactSpine}
              tone="cyan"
              stations={INTAKE_ORNAMENT}
              orientation="vertical"
              showStations={false}
              fade="ends"
            />

            <div className={styles.formPanel}>
              <div className={styles.formCore}>
                <LeadForm />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
