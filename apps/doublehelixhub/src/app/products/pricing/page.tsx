import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMatrixPreview, getPlanOptions } from '@crm-eco/rates';
import type { RateConfig, CoverageTier } from '@crm-eco/rates/types';
import seedConfig from '@crm-eco/rates/config';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { landingFontVars } from '@/components/landing/fonts';
import landing from '@/components/landing/dhh-landing.module.css';
import styles from '@/components/landing/dhh-doc.module.css';

export const metadata: Metadata = {
  title: 'MSA Pricing Matrix | Double Helix Hub',
  description:
    'Provisional PIFH MSA rate cards — Individual and Group tiers by IUA, age band, and coverage level.',
};

const config = seedConfig as unknown as RateConfig;

const TIER_LABELS: Record<CoverageTier, string> = {
  member: 'Member Only',
  member_spouse: 'Member + Spouse',
  member_children: 'Member + Child(ren)',
  family: 'Member + Family',
};

const SEGMENT_LABELS: Record<string, string> = {
  individual: 'Individual',
  group: 'Group',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

/**
 * The PIFH MSA rate matrix, rendered from the shared @crm-eco/rates config.
 *
 * The rate data, the provisional disclaimer and the engine's own footnotes are
 * reproduced verbatim — they are compliance-relevant, so nothing here rewrites,
 * rounds, reorders or summarises them.
 *
 * Two defects fixed:
 *  1. The page was painted for a dark ground (`text-teal-300/80`, `text-teal-200`,
 *     `text-amber-100` on `bg-amber-500/10`, `bg-white/[0.03]`) on a site that
 *     defaults to LIGHT, which left the disclaimer callout — the one block that
 *     must be read — close to illegible. It now uses the --lp-* tokens, which
 *     are AA-measured in both themes, and the callout carries its amber in the
 *     border/wash while the text itself sits at full --lp-fg contrast. It also
 *     asked for `font-serif`, a family this app does not load; the display face
 *     is now the same Bricolage Grotesque the two product landings use.
 *  2. It linked to `/products`, which is not a route — there is no
 *     src/app/products/page.tsx. It now points at /products/admin, the product
 *     that owns plans and rate engines, with /pricing (platform licensing) and
 *     /products/crm reachable from the foot of the page.
 *
 * Accessibility work beyond the brief's two defects: the column headers had no
 * `scope`, and the coverage-tier cells were `<td>`, so a screen reader read the
 * matrix as an unlabelled grid of numbers. Column headers are now
 * `scope="col"`, tier cells are `<th scope="row">`, each table carries an
 * sr-only `<caption>`, and the scroller is a labelled, focusable region so a
 * keyboard user can pan a table that is wider than the phone it is on.
 */
export default function MsaPricingPage() {
  const plans = getPlanOptions(config, 'current');

  return (
    <div className={`lp-root ${landing.root} ${landingFontVars}`} data-strand="dhh">
      <main>
        <LandingSection className={styles.page} aria-label="MSA provisional pricing">
          <LandingSectionHead
            className={styles.head}
            as="h1"
            eyebrow="Rate engine"
            heading="MSA provisional pricing"
            lede={
              <>
                Shared <code className={styles.code}>@crm-eco/rates</code> matrix used by admin,
                CRM, member portal, website, and embeddable quote widgets. Partnership
                (doctor/nurse) costs and wellness lab panel are not included. Enrollment
                contribution is configurable separately.
              </>
            }
            aside={
              <Link href="/products/admin" className={styles.backLink}>
                <span aria-hidden="true">&larr;</span> Admin Enrollment
              </Link>
            }
          />

          <div className={styles.stack}>
            <div className={`${styles.notice} ${styles.wide}`}>
              <span className={styles.noticeTick} aria-hidden="true" />
              <p>
                Provisional rates — not final. Founding-member enrollment contribution waiver is
                settings-driven ($800 list / $650 waiver proposed).
              </p>
            </div>

            <div className={styles.plans}>
              {plans.map((plan) => {
                const preview = buildMatrixPreview(config, plan.planId, 'current');
                if (!preview) return null;
                const headingId = `plan-${plan.planId}`;
                const segment = preview.marketSegment
                  ? SEGMENT_LABELS[preview.marketSegment]
                  : undefined;

                return (
                  <section key={plan.planId} className={styles.plan} aria-labelledby={headingId}>
                    <div className={styles.planHead}>
                      <h2 id={headingId} className={styles.planTitle}>
                        {preview.displayName}
                      </h2>
                      <div className={styles.planMeta}>
                        {segment ? <span className={styles.chip}>{segment}</span> : null}
                        {preview.provisional ? (
                          <span className={`${styles.chip} ${styles.chipSignal}`}>Provisional</span>
                        ) : null}
                        <span className={styles.planId}>{plan.planId}</span>
                      </div>
                    </div>

                    {/* The table pans inside this box; the page body never
                        scrolls sideways. tabIndex makes the scroller reachable
                        by keyboard, which a bare overflow container is not. */}
                    <div
                      className={styles.tableWrap}
                      role="region"
                      aria-label={`${preview.displayName} rate table`}
                      tabIndex={0}
                    >
                      <table className={styles.matrix}>
                        <caption className="sr-only">
                          {preview.displayName} — rates by coverage tier and age band.
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Coverage</th>
                            {preview.ageBands.map((band) => (
                              <th key={band.id} scope="col">
                                {band.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.coverageTiers.map((tier) => (
                            <tr key={tier}>
                              <th scope="row">{TIER_LABELS[tier]}</th>
                              {preview.ageBands.map((band) => (
                                <td key={band.id}>
                                  {formatCurrency(preview.matrix[tier]?.[band.id] ?? 0)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {preview.footnotes && (
                      <ul className={styles.footnotes}>
                        {preview.footnotes.map((fn, i) => (
                          <li key={i}>* {fn}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          </div>

          <nav className={`${styles.related} ${styles.wide}`} aria-label="Related pages">
            <Link href="/products/admin" className="lp-crosslink">
              <span className="lp-crosslink-label">Product</span>
              <span className="lp-crosslink-title">Admin Enrollment</span>
              <span className="lp-crosslink-body">
                Define plans, tiers, and rate cards per carrier. Versioning + effective dating built
                in.
              </span>
            </Link>
            <Link href="/pricing" className="lp-crosslink">
              <span className="lp-crosslink-label">Platform</span>
              <span className="lp-crosslink-title">Double Helix pricing</span>
              <span className="lp-crosslink-body">
                What a Double Helix licence costs, per tenant org. Subscribe to CRM Core, Admin
                Enrollment, or both.
              </span>
            </Link>
          </nav>
        </LandingSection>
      </main>
    </div>
  );
}
