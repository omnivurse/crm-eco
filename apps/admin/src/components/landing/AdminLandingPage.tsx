import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LandingNav } from '@crm-eco/ui/components/landing-nav';
import { LandingFooter } from '@crm-eco/ui/components/landing-footer';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { LandingSignalStrip } from '@crm-eco/ui/components/landing-signal-strip';
import { LandingDevice } from '@crm-eco/ui/components/landing-device';
import { LandingBento, LandingBentoTile } from '@crm-eco/ui/components/landing-bento';
import { LandingJourney } from '@crm-eco/ui/components/landing-journey';
import { LandingRail } from '@crm-eco/ui/components/landing-rail';
import type { LandingRailStation } from '@crm-eco/ui/components/landing-rail';
import type { LandingSignalItem } from '@crm-eco/ui/components/landing-signal-strip';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ProductStill } from './ProductStill';
import { landingFontVars } from './fonts';
import styles from './mms-landing.module.css';
import '@crm-eco/ui/styles/landing.css';

const CRM_URL = 'https://crm.doublehelixhub.com';
const PLATFORM_URL = 'https://doublehelixhub.com';

const NAV_LINKS = [
  { href: '#pipeline', label: 'The pipeline' },
  { href: '#registry', label: 'What it runs' },
  { href: PLATFORM_URL, label: 'Platform', external: true },
];

/**
 * Hero truth strip. Every line restates a claim MMS already makes —
 * no metrics, no certifications, no logos.
 */
const SIGNALS: LandingSignalItem[] = [
  {
    id: 'applications',
    label: 'Applications',
    value: 'Digital application, e-sign and plan selection in one flow.',
  },
  {
    id: 'registry',
    label: 'Registry',
    value: 'Coverage, dependents and history on one member record.',
  },
  {
    id: 'payouts',
    label: 'Payouts',
    value: 'Commissions accrue when enrollments bind.',
    signal: true,
  },
];

/**
 * The four turns the ornamental strand makes inside the billing tile. Never
 * rendered as text — the tile's own chips carry the claim; this only gives
 * the SVG a length. It keeps the brand gradient: the amber in this tile is
 * the money semantic, and it is already doing that work in the label and the
 * chips.
 */
const BILLING_ORNAMENT: LandingRailStation[] = [
  { id: 'run', label: 'Monthly run' },
  { id: 'returns', label: 'Return codes' },
  { id: 'retry', label: 'Retry' },
  { id: 'nacha', label: 'NACHA export' },
];

/**
 * The operations pipeline — the rungs of the strand, in order. Billing and
 * payout carry the amber signal because they are the money moments.
 */
const STATIONS: LandingRailStation[] = [
  {
    id: 'application',
    label: 'Application',
    caption: 'A household applies online and picks a plan in the same flow.',
  },
  {
    id: 'signature',
    label: 'Signature',
    caption: 'E-sign closes the application instead of restarting it on paper.',
  },
  {
    id: 'coverage',
    label: 'Coverage',
    caption: 'Coverage binds and the member record opens with the household on it.',
  },
  {
    id: 'billing',
    label: 'Billing',
    caption: 'Monthly runs collect against the coverage that is actually enrolled.',
    signal: true,
  },
  {
    id: 'payout',
    label: 'Payout',
    caption: 'Agent commissions follow what bound, with the payout trail behind them.',
    signal: true,
  },
];

const QUEUE_ALT =
  'The MMS action items queue: a returned ACH payment, an application awaiting review, ' +
  'a payout batch ready for fourteen agents, a NACHA export that did not complete, an ' +
  'outstanding signature and a coverage start to confirm. Every name, amount and date ' +
  'shown is invented demo data.';

const CONSOLE_ALT =
  'The MMS operations console: alert chips for failed payments, a failed job, enrollments ' +
  'pending review and commissions pending, above membership, revenue, commission and system ' +
  'tiles and a member lifecycle bar running Leads, Draft, In progress, Submitted, Active. ' +
  'Invented demo data.';

const REGISTRY_ALT =
  'The MMS member registry: a table of members with email, phone, state, plan, market, ' +
  'tobacco, advisor, status and created date, headed "All Members". Invented demo data.';

export default function AdminLandingPage() {
  return (
    <div className={`lp-root ${styles.root} ${landingFontVars}`} data-strand="mms">
      <LandingNav
        links={NAV_LINKS}
        authHref="/login"
        authLabel="Sign in"
        productLabel="MMS"
        themeToggle={<ThemeToggle variant="icon" className="lp-theme-btn !h-11 !w-11" />}
      />

      <main>
        {/* -------------------------------- hero ----------------------------- */}
        <section className={`lp-hero ${styles.hero}`} aria-label="Double Helix MMS">
          <div className={`lp-hero-copy ${styles.heroCopy}`}>
            <p className="lp-eyebrow">Double Helix MMS</p>
            <h1 className="lp-display">
              <span className={styles.heroLine}>Applications in.</span>
              <span className={`lp-gradient ${styles.heroLine}`}>
                Members on the books.
              </span>
            </h1>
          </div>

          {/* The strand runs between the two halves of the masthead. */}
          <div className={styles.heroSpineCell}>
            <LandingRail
              className={styles.heroSpine}
              tone="emerald"
              stations={STATIONS}
              orientation="vertical"
              showStations={false}
              fade="ends"
            />
          </div>

          <div className={styles.heroAside}>
            <p className={`lp-lede ${styles.heroLede}`}>
              MMS is the operations side of health sharing: enrollment at the front, the
              member registry in the middle, billing and agent payouts at the end — one
              engine, one record, no re-keying between the stages.
            </p>
            <div className="lp-hero-actions">
              <Link href="/login" className="lp-btn-primary">
                Sign in
              </Link>
              <a href="#pipeline" className="lp-btn-secondary">
                See the pipeline
              </a>
            </div>
          </div>

          <div className={styles.heroStrip}>
            <LandingSignalStrip items={SIGNALS} variant="band" label="What MMS runs" />
          </div>

          <div className={`lp-hero-stage ${styles.heroStage}`}>
            <LandingDevice
              className={styles.consoleDevice}
              chrome="window"
              chromeLabel="MMS / Console"
              glow="emerald"
            >
              <div className={styles.crop}>
                <ProductStill
                  name="mms-console"
                  alt={CONSOLE_ALT}
                  width={2592}
                  height={1002}
                  sizes="(max-width: 768px) 320vw, (max-width: 900px) 92vw, 1130px"
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

        {/* ------------------------------ pipeline --------------------------- */}
        <LandingSection
          id="pipeline"
          band
          rhythm="loose"
          aria-label="How a member gets on the books"
        >
          <LandingJourney
            className={styles.journey}
            tone="emerald"
            stations={STATIONS}
            label="How a member gets on the books"
            header={
              <LandingSectionHead
                eyebrow="The pipeline"
                heading="Five stages, one record"
                lede="An application does not become a spreadsheet on the way to becoming a member. The same record carries the household from the form through to the payout that follows it."
              />
            }
            footnote={
              <>
                The agency side of the book — leads, contacts and the today queue — is run
                from{' '}
                <a
                  href={CRM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-inline-link"
                >
                  CRM
                </a>
                , the other strand of the same platform.
              </>
            }
          />
        </LandingSection>

        {/* ------------------------------- bento ----------------------------- */}
        <LandingSection id="registry" aria-label="What operations runs">
          <LandingSectionHead
            eyebrow="What it runs"
            heading="One registry, and everything that hangs off it"
            lede="Enrollment writes the member record; billing, commissions and support all read it. The screens here are the real product with invented people in it."
          />

          <LandingBento>
            <LandingBentoTile
              span="lead"
              label="Work queue"
              title="The engine says what broke"
              body="A returned payment, a signature that never came back, an export that stopped halfway — each one arrives named, priced and dated, instead of surfacing in next month's reconciliation."
              media={
                <div className={`${styles.crop} ${styles.cropQueue}`}>
                  <ProductStill
                    name="mms-queue"
                    alt={QUEUE_ALT}
                    width={1792}
                    height={1056}
                    sizes="(max-width: 768px) 210vw, (max-width: 1080px) 62vw, 730px"
                    imgClassName={styles.queueShot}
                  />
                </div>
              }
              mediaFit="panel"
              mediaCaption="Action items — demo data, invented names and amounts"
            />

            <LandingBentoTile
              span="tall"
              tone="signal"
              className={styles.billingTile}
              label="Billing"
              title="Billing and NACHA"
              body="Monthly runs stay tied to the coverage that is actually enrolled, and the bank file is an export from that run rather than a spreadsheet rebuilt by hand."
            >
              <ul className={`${styles.chips} ${styles.chipsSignal}`}>
                <li>Monthly run</li>
                <li>Return codes</li>
                <li>Retry</li>
                <li>NACHA export</li>
              </ul>
              {/* No honest still exists for a bank file, so the tall tile
                  takes the spec's typographic + strand fallback rather than a
                  UI faked out of divs. */}
              <LandingRail
                className={styles.billingStrand}
                tone="emerald"
                stations={BILLING_ORNAMENT}
                orientation="vertical"
                showStations={false}
                fade="ends"
              />
            </LandingBentoTile>

            <LandingBentoTile
              span="wide"
              label="Member registry"
              title="The member record is the system of record"
              body="Coverage, dependents and history sit on a single member, so support answers the question from the same row billing collects against."
              media={
                <div className={`${styles.crop} ${styles.cropRegistry}`}>
                  <ProductStill
                    name="mms-registry"
                    alt={REGISTRY_ALT}
                    width={3032}
                    height={1284}
                    sizes="(max-width: 768px) 350vw, (max-width: 1080px) 62vw, 730px"
                    imgClassName={styles.registryShot}
                  />
                </div>
              }
              mediaFit="panel"
              mediaCaption="Member registry — demo data, invented names"
            />

            <LandingBentoTile
              span="unit"
              tone="b"
              className={styles.centeredTile}
              label="Enrollment"
              title="Applications that finish"
              body="Digital application, e-sign and plan selection in one flow, and what comes out the end is a live member record."
            >
              <ul className={styles.chips}>
                <li>Application</li>
                <li>Signature</li>
                <li>Plan</li>
                <li>Effective date</li>
              </ul>
            </LandingBentoTile>

            <LandingBentoTile
              span="half"
              label="Plans"
              title="Configured before the window opens"
              body="Set products, rates and rules ahead of the next open window, so enrollment collects the right thing the first time."
            />

            <LandingBentoTile
              span="half"
              tone="signal"
              className={styles.fullOnTablet}
              label="Commissions"
              title="Payouts follow what bound"
              body="Agent commissions accrue when enrollments bind, and the payout batch carries the trail of what produced it."
            />
          </LandingBento>
        </LandingSection>

        {/* -------------------------------- close ---------------------------- */}
        <section className="lp-close" aria-label="Sign in">
          <div className="lp-close-inner">
            <div className="lp-close-core" data-layout="split">
              <div>
                <h2 className="lp-display">Sign in to run enrollment</h2>
                <p>
                  Open the member workspace with your MMS account and the queue is waiting
                  where operations left it.
                </p>
                <div className="lp-close-actions">
                  <Link href="/login" className="lp-btn-primary">
                    Sign in
                  </Link>
                  <a
                    href={PLATFORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lp-btn-secondary"
                  >
                    About the platform
                  </a>
                </div>
              </div>

              <a
                href={CRM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`lp-crosslink ${styles.crosslink}`}
              >
                <span className="lp-crosslink-label">The other strand</span>
                <span className="lp-crosslink-title">
                  CRM
                  <ArrowUpRight
                    size={16}
                    className={styles.crosslinkArrow}
                    aria-hidden="true"
                  />
                </span>
                <span className="lp-crosslink-body">
                  The agency side of the same platform: the book of business, the today
                  queue and the commissions an agency works from.
                </span>
                {/* Each chip names a section the CRM landing already claims —
                    no new capability is introduced here. */}
                <span className={styles.chips} aria-hidden="true">
                  <span>Book of business</span>
                  <span>Today queue</span>
                  <span>Enrollment handoff</span>
                  <span className={styles.chipSignal}>Commissions</span>
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter
        brand="Double Helix MMS"
        description={
          <>
            The operations workspace in the{' '}
            <a
              href={PLATFORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-inline-link"
            >
              Double Helix
            </a>{' '}
            platform: enrollment, the member registry, billing and commissions for health
            sharing organizations. Paired with{' '}
            <a
              href={CRM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-inline-link"
            >
              CRM
            </a>{' '}
            for agency-side work.
          </>
        }
        columns={[
          {
            heading: 'Product',
            links: [
              { href: '#pipeline', label: 'The pipeline' },
              { href: '#registry', label: 'What it runs' },
              { href: '/login', label: 'Sign in' },
            ],
          },
          {
            heading: 'Platform',
            links: [
              { href: PLATFORM_URL, label: 'Double Helix', external: true },
              { href: CRM_URL, label: 'CRM', external: true },
              { href: `${PLATFORM_URL}/security`, label: 'Security', external: true },
              { href: `${PLATFORM_URL}/integrations`, label: 'Integrations', external: true },
            ],
          },
          {
            heading: 'Company',
            links: [
              { href: PLATFORM_URL, label: 'About', external: true },
              { href: 'mailto:support@doublehelixhub.com', label: 'Contact' },
              { href: '/legal/sms-privacy', label: 'SMS privacy' },
              { href: `${PLATFORM_URL}/legal/privacy`, label: 'Privacy', external: true },
              { href: `${PLATFORM_URL}/legal/terms`, label: 'Terms', external: true },
            ],
          },
        ]}
      />
    </div>
  );
}
