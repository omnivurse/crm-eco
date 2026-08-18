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
import shell from '@/components/landing/dhh-landing.module.css';
import styles from './crm-product.module.css';

/**
 * CRM Core — the vendor's product page on doublehelixhub.com.
 *
 * Same design language as the two shipped product landings (the shared
 * `--lp-*` system in packages/ui), cyan-led like the CRM landing, but a
 * different job: that page is the app's own front door for people who already
 * use it, this one is aimed at an agency evaluating the software. Hence a
 * spec-sheet "why" band and a capability inventory, and hence the mirrored
 * hero — the strand runs down the RIGHT of the still here.
 *
 * HONESTY: every claim below is carried forward verbatim (or recombined from
 * its own words) from the previous version of this page. Nothing new is
 * claimed, no metric, logo, customer, testimonial or certification appears,
 * and the three stills are the real product screenshots shipped with the
 * product landings — never a UI faked out of divs.
 */

export const metadata: Metadata = {
  title: 'CRM Core | Double Helix Software',
  description:
    'The CRM built for health benefits — pipelines, modules, automations, and document workflows tuned for advisors and agencies.',
};

/* ---------------------------------------------------------------- copy --- */

/** Who the page says it is built for. Carried forward exactly. */
const AUDIENCES: LandingSignalItem[] = [
  { id: 'advisors', label: 'Advisors', value: 'Independent advisors' },
  { id: 'agencies', label: 'Agencies', value: 'Growing agencies' },
  { id: 'teams', label: 'Teams', value: 'Enrollment teams' },
];

/**
 * The three-step motion, as the journey rail. The rail numbers its own
 * stations 01 / 02 / 03, which is exactly how the previous version of this
 * page rendered them.
 */
const STATIONS: LandingRailStation[] = [
  {
    id: 'capture',
    label: 'Capture',
    caption:
      'Inbound forms, imports, and advisor-entered leads land in the right org with source attribution intact.',
  },
  {
    id: 'qualify',
    label: 'Qualify',
    caption:
      'Stage gates, required fields, and workqueues keep every book moving — Medicare, ACA, group, or healthshare.',
  },
  {
    id: 'close',
    label: 'Close',
    caption:
      'Proposals, e-sign, and handoff into Admin Enrollment when you run the full stack.',
  },
];

/**
 * Stations for the ornamental strand in the controls tile. Never rendered as
 * text (`showStations={false}`) — the tile's own copy carries the claim; the
 * strand is the "typographic + strand" fallback for a surface with no honest
 * screenshot.
 */
const CONTROL_STATIONS: LandingRailStation[] = [
  { id: 'rls', label: 'Row-level security' },
  { id: 'audit-log', label: 'Audit log' },
  { id: 'phi', label: 'PHI guardrails' },
];

/** The four differentiators, verbatim. */
const DIFFERENTIATORS = [
  'Org-level isolation with shared infrastructure',
  'Modules and stages that match benefits vocabulary',
  'Sequences that respect compliance-sensitive outreach',
  'Clean handoff into Admin Enrollment when you need ops',
];

/* ---------------------------------------------------------------- alts --- */
/* Copied verbatim from the shipped landings, where they were written and
   vetted for honesty. Each one ends with an explicit "invented demo data"
   clause; do not remove it. */

const DESK_ALT =
  "Double Helix CRM dashboard: a Today's queue of nine people with status, city, plan, " +
  'who enrolled them and the next action, beside a Next up panel for one member. ' +
  'Every name, plan and number shown is invented demo data.';

const RECORD_ALT =
  'The Next up panel on the CRM dashboard: a pending member with city, date of birth, ' +
  'plan, who enrolled them, referring member, member ID and effective date, above a ' +
  'Confirm start date action and a recently viewed list. Invented demo data.';

const COVERAGE_ALT =
  'A coverage snapshot on a CRM record: sharing entity, membership, monthly contribution, ' +
  'IUA, member tier, effective date and who enrolled them. Invented demo data.';

/* ---------------------------------------------------------------- page --- */

export default function CrmProductPage() {
  return (
    <div className={`lp-root ${shell.root} ${landingFontVars}`} data-strand="crm">
      <main>
        {/* -------------------------------- hero ---------------------------- */}
        <section className={`lp-hero ${styles.hero}`} aria-label="CRM Core">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Product 01 · CRM Core</p>
            <h1 className="lp-display">
              The CRM that already knows <span className="lp-gradient">benefits</span>
            </h1>
            <p className="lp-lede">
              Pipelines, modules, and automations purpose-built for Medicare, ACA, group,
              and healthshare advisors. Stop bending a generic CRM into shape.
            </p>
            <div className="lp-hero-actions">
              <Link href="/#request-access" className="lp-btn-primary">
                Request access
              </Link>
              <Link href="/products/admin" className="lp-btn-secondary">
                See Admin Enrollment
              </Link>
            </div>
            <LandingSignalStrip items={AUDIENCES} label="Built for" />
          </div>

          <div className={`lp-hero-stage ${styles.heroStage}`}>
            <LandingRail
              className={styles.heroSpine}
              tone="cyan"
              stations={STATIONS}
              orientation="vertical"
              showStations={false}
              fade="ends"
            />
            <LandingDevice
              className={styles.heroDevice}
              chrome="window"
              chromeLabel="CRM Core / Record"
              glow="cyan"
              tilt="right"
              ratio="332 / 431"
              caption="A record in CRM Core — invented demo data"
            >
              <ProductStill
                {...PRODUCT_STILLS['crm-record']}
                alt={RECORD_ALT}
                sizes="(max-width: 900px) 380px, 520px"
                priority
              />
            </LandingDevice>
          </div>
        </section>

        {/* ------------------------------- journey -------------------------- */}
        <LandingSection
          id="how-it-runs"
          rhythm="loose"
          className={styles.anchor}
          aria-label="How CRM Core runs"
        >
          <LandingJourney
            className={styles.journey}
            tone="cyan"
            stations={STATIONS}
            label="How a record moves through CRM Core"
            header={
              <LandingSectionHead
                eyebrow="How it runs"
                heading="Capture → qualify → close"
                align="center"
                lede="A motion tuned for benefits sales — not a generic opportunity object with a health sticker on it."
              />
            }
            footnote={
              <>
                Close hands off into{' '}
                <Link href="/products/admin" className="lp-inline-link">
                  Admin Enrollment
                </Link>{' '}
                when you run the full stack.
              </>
            }
          />
        </LandingSection>

        {/* ----------------------------- capabilities ----------------------- */}
        <LandingSection
          id="capabilities"
          className={styles.anchor}
          aria-label="CRM Core capabilities"
        >
          <LandingSectionHead
            eyebrow="Capabilities"
            heading="Everything a benefits book needs"
            lede="One tenancy-aware spine — every lead, deal, and sequence stays inside your org."
          />

          <LandingBento>
            <LandingBentoTile
              span="lead"
              label="Records"
              title="Modular records"
              body="Leads, deals, accounts, plans, custom modules — define your own fields and stages per tenant org."
              media={
                <ProductStill
                  {...PRODUCT_STILLS['crm-desk']}
                  alt={DESK_ALT}
                  sizes="(max-width: 768px) 1100px, (max-width: 1080px) 62vw, 730px"
                  imgClassName={styles.deskShot}
                />
              }
              mediaFit="panel"
              mediaCaption="Records in CRM Core — invented demo data"
              className={styles.deskTile}
            />

            <LandingBentoTile
              span="unit"
              tone="a"
              label="Messaging"
              title="Email & SMS sync"
              body="Two-way Gmail/Outlook + Twilio threading attached to records, with sequences and automations."
            >
              {/* Every chip on this page is a word the tile's own body already
                  uses — the ledger texture never introduces a claim. */}
              <ul className={styles.chips}>
                <li>Gmail</li>
                <li>Outlook</li>
                <li>Twilio</li>
                <li>Sequences</li>
              </ul>
            </LandingBentoTile>

            <LandingBentoTile
              span="unit"
              label="Controls"
              title="Audit + HIPAA-aware"
              body="Row-level security, immutable audit logs, and PHI guardrails baked into the data model."
              className={styles.controlsTile}
            >
              {/* No honest still exists for row-level security, an audit log or
                  a PHI guardrail, so this tile takes the spec's typographic +
                  strand fallback rather than a UI faked out of divs. */}
              <LandingRail
                className={styles.controlsStrand}
                tone="cyan"
                stations={CONTROL_STATIONS}
                orientation="vertical"
                showStations={false}
                fade="ends"
              />
            </LandingBentoTile>

            <LandingBentoTile
              span="unit"
              label="Capture"
              title="Embeddable forms"
              body="Drop quote forms onto any tenant marketing site. Anonymous submissions land scoped to the right org."
            >
              <ul className={styles.chips}>
                <li>Quote form</li>
                <li>Anonymous</li>
                <li>Org-scoped</li>
              </ul>
            </LandingBentoTile>

            <LandingBentoTile
              span="unit"
              label="Paperwork"
              title="Documents & e-sign"
              body="Generate proposals from templates, send for signature, archive against the deal record."
            >
              <ul className={styles.chips}>
                <li>Template</li>
                <li>Signature</li>
                <li>Deal record</li>
              </ul>
            </LandingBentoTile>

            <LandingBentoTile
              span="unit"
              label="Workflows"
              title="Automation engine"
              body="Event-driven workflows with conditions, queues, and retries. Trigger on stage change, time, or webhook."
              className={styles.fullOnTablet}
            >
              <ul className={styles.chips}>
                <li>Stage change</li>
                <li>Time</li>
                <li>Webhook</li>
              </ul>
            </LandingBentoTile>
          </LandingBento>
        </LandingSection>

        {/* --------------------------- why CRM Core ------------------------- */}
        <LandingSection
          id="why"
          band
          className={styles.anchor}
          aria-label="Why CRM Core"
        >
          <LandingSectionHead
            eyebrow="Why CRM Core"
            heading="Purpose-built beats bolted-on"
            lede="Generic platforms force you to invent Medicare stages, ACA households, and commission handoffs. We ship them."
          />

          <ol className={styles.spec}>
            {DIFFERENTIATORS.map((item, i) => (
              <li key={item} className={styles.specItem}>
                <span className={styles.specIndex} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={styles.specText}>{item}</span>
              </li>
            ))}
          </ol>

          {/*
            The exhibit for "modules and stages that match benefits vocabulary":
            a real record's coverage fields, where that vocabulary is literally
            on screen — sharing entity, membership, contribution, IUA, member
            tier, effective date.
          */}
          <LandingDevice
            className={`${styles.exhibit} ${styles.exhibitDevice}`}
            chrome="plate"
            glow="cyan"
            caption="Benefits vocabulary on a record — invented demo data"
          >
            <div className={styles.crop}>
              <ProductStill
                {...PRODUCT_STILLS['crm-coverage']}
                alt={COVERAGE_ALT}
                sizes="(max-width: 768px) 1180px, 1090px"
                imgClassName={styles.coverageShot}
              />
            </div>
          </LandingDevice>
        </LandingSection>

        {/* -------------------------------- close --------------------------- */}
        <section className="lp-close" aria-label="Request access">
          <div className="lp-close-inner">
            <div className={`lp-close-core ${styles.closeCore}`} data-layout="split">
              <div>
                {/* A <span>, not a <p>: `.lp-close p` out-specifies
                    `.lp-eyebrow` and would repaint the micro-label as body
                    copy. */}
                <span className="lp-eyebrow">Early access</span>
                <h2 className="lp-display">Ready to run your book here?</h2>
                <p>
                  We&rsquo;re onboarding agencies in waves. Tell us what you&rsquo;re
                  running today — we&rsquo;ll get back within a business day.
                </p>
                <div className="lp-close-actions">
                  <Link href="/#request-access" className="lp-btn-primary">
                    Request access
                  </Link>
                  <Link href="/products/admin" className="lp-btn-secondary">
                    See Admin Enrollment
                  </Link>
                </div>
              </div>

              <Link
                href="/products/admin"
                className={`lp-crosslink ${styles.crosslink}`}
              >
                <span className="lp-crosslink-label">Pair with</span>
                <span className="lp-crosslink-title">
                  Admin Enrollment
                  <ArrowUpRight
                    size={16}
                    className={styles.crosslinkArrow}
                    aria-hidden="true"
                  />
                </span>
                <span className="lp-crosslink-body">
                  Close in CRM, enroll in Admin — same identity layer, same tenancy
                  model, no CSV ping-pong between sales and ops.
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
