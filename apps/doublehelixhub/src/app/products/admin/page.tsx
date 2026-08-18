import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { LandingSignalStrip } from '@crm-eco/ui/components/landing-signal-strip';
import { LandingDevice } from '@crm-eco/ui/components/landing-device';
import { LandingBento, LandingBentoTile } from '@crm-eco/ui/components/landing-bento';
import { LandingJourney } from '@crm-eco/ui/components/landing-journey';
import { LandingRail } from '@crm-eco/ui/components/landing-rail';
import type { LandingRailStation } from '@crm-eco/ui/components/landing-rail';
import type { LandingSignalItem } from '@crm-eco/ui/components/landing-signal-strip';
import { ProductStill, PRODUCT_STILLS } from '@/components/landing/ProductStill';
import { landingFontVars } from '@/components/landing/fonts';
import root from '@/components/landing/dhh-landing.module.css';
import styles from './admin-product.module.css';

/**
 * Admin Enrollment — the vendor's product page for the agencies and TPAs
 * evaluating the software.
 *
 * Built on the shared landing system (`lp-*` classes + `--lp-*` tokens from
 * packages/ui, imported globally by app/globals.css), emerald-led via
 * `data-strand="mms"` so it reads as a sibling of the shipped MMS landing
 * without being a copy of it. Page-scoped composition lives in
 * ./admin-product.module.css; nothing in packages/ui was edited.
 *
 * HONESTY: every claim below is carried forward from the page this replaces.
 * No metric, logo, customer, testimonial or certification has been added, and
 * no capability claim has been amplified. The three stills are the real MMS
 * screenshots that ship on the MMS landing, with their vetted alt text — each
 * one ends with an explicit statement that the data is invented. Where a
 * capability has no honest still (plans and rate engines), the tile is
 * typographic with a strand ornament rather than a UI faked out of divs.
 *
 * AMBER is semantic, exactly as on the MMS landing: money moments only —
 * billing, commissions, payouts. The legend under the console says so in
 * words, so the colour is a key rather than decoration.
 */

export const metadata: Metadata = {
  title: 'Admin Enrollment | Double Helix Software',
  description:
    'Run plans, members, billing, commissions, payouts, and ops from a single multi-tenant admin platform.',
};

const CRM_HREF = '/products/crm';
const ACCESS_HREF = '/#request-access';

/**
 * The hero's "Built for" panel — the three pillars the previous page listed,
 * verbatim. "Billing + commissions" carries the money signal; nothing else
 * on this page borrows amber that is not about money.
 */
const BUILT_FOR: LandingSignalItem[] = [
  { id: 'tenancy', label: 'Tenancy', value: 'Multi-tenant RLS.' },
  { id: 'money', label: 'Money', value: 'Billing + commissions.', signal: true },
  { id: 'ops', label: 'Visibility', value: 'Ops dashboards.' },
];

/**
 * The strand ornament inside the "Built for" panel. Never rendered as text —
 * the panel's own copy carries the claim; these only give the SVG a length.
 */
const PANEL_ORNAMENT: LandingRailStation[] = [
  { id: 'org', label: 'Org' },
  { id: 'plan', label: 'Plan' },
  { id: 'member', label: 'Member' },
];

/** The same, for the plans tile in the bento. */
const PLANS_ORNAMENT: LandingRailStation[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'tier', label: 'Tier' },
  { id: 'rate', label: 'Rate card' },
  { id: 'effective', label: 'Effective date' },
];

/**
 * How it runs — the three stages the previous page shipped, with their bodies
 * intact as station captions. "Operate" carries the money signal because it
 * is where premiums, commissions and vendor payments happen.
 */
const STATIONS: LandingRailStation[] = [
  {
    id: 'configure',
    label: 'Configure',
    caption:
      'Stand up plans, rates, and branding for each tenant org — isolation is the default, not an afterthought.',
  },
  {
    id: 'enroll',
    label: 'Enroll',
    caption:
      'Move members through enrollment, changes, and terminations with dependents and effective dates intact.',
  },
  {
    id: 'operate',
    label: 'Operate',
    caption:
      'Bill premiums, run commissions, pay vendors, and keep the member portal in sync — one spine.',
    signal: true,
  },
];

/** The four isolation guarantees, verbatim. */
const ISOLATION = [
  'Row-level security on every member and financial table',
  'White-labeled portals and email per tenant',
  'Gateway credentials scoped to the org that owns them',
  'Commission books that never leak across agencies',
];

/* ---------------------------------------------------------------------------
 * Alt text, copied verbatim from apps/admin/src/components/landing/
 * AdminLandingPage.tsx — the same PNGs, and these strings were written and
 * vetted for honesty. Every one names what is on screen and says the data is
 * invented. Do not shorten one without keeping that clause.
 * ------------------------------------------------------------------------ */

const CONSOLE_ALT =
  'The MMS operations console: alert chips for failed payments, a failed job, enrollments ' +
  'pending review and commissions pending, above membership, revenue, commission and system ' +
  'tiles and a member lifecycle bar running Leads, Draft, In progress, Submitted, Active. ' +
  'Invented demo data.';

const QUEUE_ALT =
  'The MMS action items queue: a returned ACH payment, an application awaiting review, ' +
  'a payout batch ready for fourteen agents, a NACHA export that did not complete, an ' +
  'outstanding signature and a coverage start to confirm. Every name, amount and date ' +
  'shown is invented demo data.';

const REGISTRY_ALT =
  'The MMS member registry: a table of members with email, phone, state, plan, market, ' +
  'tobacco, advisor, status and created date, headed "All Members". Invented demo data.';

export default function AdminProductPage() {
  return (
    <div className={`lp-root ${root.root} ${landingFontVars}`} data-strand="mms">
      <main>
        {/* -------------------------------- hero ----------------------------- */}
        <section className={`lp-hero ${styles.hero}`} aria-label="Admin Enrollment">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Product 02 · Admin Enrollment</p>
            <h1 className="lp-display">
              Enrollment ops on one <span className="lp-gradient">tenancy spine</span>
            </h1>
            <p className="lp-lede">
              Plans, members, billing, commissions, payouts, and portals — multi-tenant
              isolation for every agency and TPA. The operational half of Double Helix.
            </p>
            <div className="lp-hero-actions">
              <Link href={ACCESS_HREF} className="lp-btn-primary">
                Request access
              </Link>
              <Link href={CRM_HREF} className="lp-btn-secondary">
                See CRM Core
              </Link>
            </div>
          </div>

          <div className={styles.builtFor}>
            <div className={styles.builtForInner}>
              <p className="lp-eyebrow">Built for</p>
              <LandingSignalStrip
                className={styles.builtForStrip}
                items={BUILT_FOR}
                label="Built for"
              />
              <p className={styles.panelNote}>
                Every agency and TPA runs in its own isolated partition — shared platform,
                private data.
              </p>
              {/* Ornament, not evidence: the record rail turning through the
                  panel. SVG is aria-hidden inside the component. */}
              <LandingRail
                className={styles.panelStrand}
                tone="emerald"
                stations={PANEL_ORNAMENT}
                orientation="vertical"
                showStations={false}
                fade="ends"
              />
            </div>
          </div>

          <div className={`lp-hero-stage ${styles.heroStage}`}>
            <LandingDevice
              className={styles.consoleDevice}
              chrome="window"
              chromeLabel="Admin / Operations"
              glow="emerald"
            >
              <div className={styles.crop}>
                <ProductStill
                  {...PRODUCT_STILLS['mms-console']}
                  alt={CONSOLE_ALT}
                  sizes="(max-width: 768px) 200vw, (max-width: 1080px) 94vw, 1120px"
                  imgClassName={styles.consoleShot}
                  priority
                />
              </div>
            </LandingDevice>
            <div className={styles.consoleMeta}>
              <p className={styles.consoleCaption}>
                Operations console — demo data, invented names and amounts
              </p>
              <p className={styles.consoleLegend}>Amber marks money moments</p>
            </div>
          </div>
        </section>

        {/* ------------------------------ how it runs ------------------------ */}
        <LandingSection
          id="how-it-runs"
          band
          rhythm="loose"
          aria-label="How Admin Enrollment runs"
        >
          <LandingJourney
            className={styles.journey}
            tone="emerald"
            stations={STATIONS}
            label="Configure, enroll, operate"
            header={
              <LandingSectionHead
                eyebrow="How it runs"
                heading="Configure → enroll → operate"
                align="center"
                lede="From rate cards to ACH payouts — the full member lifecycle lives on one backbone."
              />
            }
            footnote={
              <>
                The sales side of the same platform is{' '}
                <Link href={CRM_HREF} className="lp-inline-link">
                  CRM Core
                </Link>{' '}
                — advisors close there, ops enrolls here.
              </>
            }
          />
        </LandingSection>

        {/* ----------------------------- capabilities ------------------------ */}
        <LandingSection id="capabilities" aria-label="Capabilities">
          <LandingSectionHead
            eyebrow="Capabilities"
            heading="The ops platform behind your agency"
            lede="Run plans, members, billing, commissions, payouts, and ops from a single multi-tenant admin platform. The screens below are the real product with invented people in it."
          />

          <LandingBento>
            <LandingBentoTile
              span="lead"
              label="Members"
              title="Member management"
              body="Enroll, change, terminate. Family units, dependents, and lifecycle events handled cleanly."
              media={
                <div className={`${styles.crop} ${styles.cropRegistry}`}>
                  <ProductStill
                    {...PRODUCT_STILLS['mms-registry']}
                    alt={REGISTRY_ALT}
                    sizes="(max-width: 768px) 450vw, (max-width: 1080px) 92vw, 730px"
                    imgClassName={styles.registryShot}
                  />
                </div>
              }
              mediaFit="panel"
              mediaCaption="Member registry — demo data, invented names"
            />

            {/* No honest still exists for a rate card, so this tile takes the
                typographic + strand fallback rather than a faked screenshot. */}
            <LandingBentoTile
              span="tall"
              className={styles.plansTile}
              label="Plans"
              title="Plans & rate engines"
              body="Define plans, tiers, and rate cards per carrier. Versioning + effective dating built in."
            >
              <ul className={styles.chips}>
                <li>Plans</li>
                <li>Tiers</li>
                <li>Rate cards</li>
                <li>Versioning</li>
                <li>Effective dating</li>
              </ul>
              <LandingRail
                className={styles.plansStrand}
                tone="emerald"
                stations={PLANS_ORNAMENT}
                orientation="vertical"
                showStations={false}
                fade="ends"
              />
            </LandingBentoTile>

            <LandingBentoTile
              span="wide"
              tone="signal"
              label="Payouts"
              title="Commissions & payouts"
              body="Automate advisor and agent comp from books to payable runs. ACH and check supported."
              media={
                <div className={`${styles.crop} ${styles.cropQueue}`}>
                  <ProductStill
                    {...PRODUCT_STILLS['mms-queue']}
                    alt={QUEUE_ALT}
                    sizes="(max-width: 768px) 260vw, (max-width: 1080px) 62vw, 730px"
                    imgClassName={styles.queueShot}
                  />
                </div>
              }
              mediaFit="panel"
              mediaCaption="Action items — demo data, invented names and amounts"
            />

            <LandingBentoTile
              span="unit"
              tone="signal"
              label="Billing"
              title="Billing engine"
              body="Multi-gateway support for member premiums, recurring billing, refunds, and reconciliation."
            >
              <ul className={`${styles.chips} ${styles.chipsSignal}`}>
                <li>Premiums</li>
                <li>Recurring</li>
                <li>Refunds</li>
                <li>Reconciliation</li>
              </ul>
            </LandingBentoTile>

            <LandingBentoTile
              span="half"
              tone="b"
              label="Portal"
              title="Member portal"
              body="Self-service for enrolled members — view plan, ID cards, billing, and submit changes."
            >
              <ul className={styles.chips}>
                <li>Plan</li>
                <li>ID cards</li>
                <li>Billing</li>
                <li>Changes</li>
              </ul>
            </LandingBentoTile>

            {/* Vendor payables is money too, but the amber stays on the two
                tiles the legend points at — one accent, held semantic, does not
                become an ambient wash across half the grid. */}
            <LandingBentoTile
              span="half"
              label="Payables"
              title="Vendor payables"
              body="Track vendor invoices, approvals, and payouts in the same financial backbone."
            />

            <LandingBentoTile
              span="half"
              label="Landing pages"
              title="Tenant landing pages"
              body="Each tenant org gets a built-in landing-page builder, populated from their product catalog."
            />

            <LandingBentoTile
              span="half"
              tone="b"
              className={styles.fullOnTablet}
              label="Branding"
              title="Branding per tenant"
              body="White-labeled domains, logos, and email templates so members see your brand, not ours."
            />
          </LandingBento>
        </LandingSection>

        {/* ------------------------------ isolation -------------------------- */}
        <LandingSection id="isolation" band aria-label="Multi-tenant by design">
          <LandingSectionHead
            eyebrow="Multi-tenant by design"
            heading="Isolation is the product"
            lede="Agencies and TPAs share infrastructure — never data. RLS, branding, domains, and billing all resolve at the org boundary."
          />
          <ul className={styles.isolation}>
            {ISOLATION.map((item, i) => (
              <li key={item} className={styles.isolationItem}>
                <span className={styles.isolationIndex} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className={styles.isolationText}>{item}</p>
              </li>
            ))}
          </ul>
        </LandingSection>

        {/* -------------------------------- close ---------------------------- */}
        <section className="lp-close" aria-label="Request access">
          <div className="lp-close-inner">
            <div className={`lp-close-core ${styles.closeCore}`} data-layout="split">
              <div>
                <p className={`lp-eyebrow ${styles.closeEyebrow}`}>Early access</p>
                <h2 className="lp-display">Ready to run enrollment here?</h2>
                <p>
                  We’re onboarding agencies and TPAs in waves. Tell us your stack —
                  we’ll respond within a business day.
                </p>
                <div className="lp-close-actions">
                  <Link href={ACCESS_HREF} className="lp-btn-primary">
                    Request access
                  </Link>
                  <Link href="/contact" className="lp-btn-secondary">
                    Contact us
                  </Link>
                </div>
              </div>

              <Link href={CRM_HREF} className={`lp-crosslink ${styles.crosslink}`}>
                <span className="lp-crosslink-label">Pair with</span>
                <span className="lp-crosslink-title">
                  CRM Core
                  <ArrowUpRight
                    size={16}
                    className={styles.crosslinkArrow}
                    aria-hidden="true"
                  />
                </span>
                <span className="lp-crosslink-body">
                  Advisors close in CRM; ops enrolls in Admin. Same identity, same tenancy
                  — no reconciliation tax between sales and membership.
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
