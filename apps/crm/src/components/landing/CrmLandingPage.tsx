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
import { ThemeToggle } from '@/components/crm/shell/ThemeToggle';
import { ProductStill } from './ProductStill';
import { landingFontVars } from './fonts';
import styles from './crm-landing.module.css';
import '@crm-eco/ui/styles/landing.css';

const MMS_URL = 'https://admin.doublehelixhub.com';
const PLATFORM_URL = 'https://doublehelixhub.com';

const NAV_LINKS = [
  { href: '#desk', label: 'The desk' },
  { href: '#journey', label: 'How it works' },
  { href: PLATFORM_URL, label: 'Platform', external: true },
];

/**
 * Hero truth strip. Every line is something the product already claims —
 * no certifications, no metrics, no logos.
 */
const SIGNALS: LandingSignalItem[] = [
  {
    id: 'privacy',
    label: 'Privacy',
    value: 'Built-in HIPAA controls.',
  },
  {
    id: 'audit',
    label: 'Audit',
    value: 'Changes land in an audit log.',
  },
  {
    id: 'access',
    label: 'Access',
    value: 'Roles decide who opens what.',
  },
];

/**
 * The three stations the ornamental strand in the security tile turns through.
 * Never rendered as text — the tile's own copy carries the claim.
 */
const CONTROL_STATIONS: LandingRailStation[] = [
  { id: 'encryption', label: 'Encryption' },
  { id: 'audit-log', label: 'Audit log' },
  { id: 'role-access', label: 'Role access' },
];

/** The record journey — the rungs of the strand, in order. */
const STATIONS: LandingRailStation[] = [
  {
    id: 'lead',
    label: 'Lead',
    caption: 'A quote request lands in the queue.',
  },
  {
    id: 'contact',
    label: 'Contact',
    caption: 'The record opens with the fields the work uses.',
  },
  {
    id: 'enrollment',
    label: 'Enrollment',
    caption: 'The household goes through branded enrollment.',
  },
  {
    id: 'member',
    label: 'Member',
    caption: 'Coverage starts; the record becomes a member.',
  },
  {
    id: 'commission',
    label: 'Commission',
    caption: 'What bound shows up as what is owed.',
    signal: true,
  },
];

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

const FIELDS_ALT =
  'A CRM record open on its contact, health sharing and mailing address sections, ' +
  'with name, email, phone, plan, member tier and address fields filled in. ' +
  'Invented demo data.';

export default function CrmLandingPage() {
  return (
    <div className={`lp-root ${styles.root} ${landingFontVars}`} data-strand="crm">
      <LandingNav
        links={NAV_LINKS}
        authHref="/crm-login"
        authLabel="Log in"
        productLabel="CRM"
        themeToggle={<ThemeToggle variant="icon" className="lp-theme-btn !h-11 !w-11" />}
      />

      <main>
        {/* ------------------------------- hero ------------------------------ */}
        <section className={`lp-hero ${styles.hero}`} aria-label="Double Helix CRM">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Double Helix CRM</p>
            <h1 className="lp-display">
              Your book of business, <span className="lp-gradient">on one desk</span>
            </h1>
            <p className="lp-lede">
              Contacts, enrollments and commissions sit on the same record, so the agency
              opens one queue in the morning instead of stitching the day together by
              hand.
            </p>
            <div className="lp-hero-actions">
              <Link href="/crm-login" className="lp-btn-primary">
                Log in
              </Link>
              <a href="#desk" className="lp-btn-secondary">
                See the desk
              </a>
            </div>
            <LandingSignalStrip items={SIGNALS} label="What is built in" />
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
              chromeLabel="CRM / Today"
              glow="cyan"
              tilt="left"
              ratio="332 / 431"
              caption="Next up on the desk — demo data, invented names"
            >
              <ProductStill
                name="crm-record"
                alt={RECORD_ALT}
                width={996}
                height={1293}
                sizes="(max-width: 900px) 380px, 520px"
                priority
              />
            </LandingDevice>
          </div>
        </section>

        {/* ------------------------------- bento ----------------------------- */}
        <LandingSection id="desk" aria-label="What agencies run in the CRM">
          <LandingSectionHead
            eyebrow="The desk"
            heading="What the agency actually runs"
            lede="The screens below are the real product with invented people in it — the queue you open in the morning, the coverage on the record, and the money at the end of it."
          />

          <LandingBento>
            <LandingBentoTile
              span="lead"
              label="Today"
              title="The day arrives already sorted"
              body="The queue leads with the people who need you — an overdue task, a signature that never came back, coverage starting in two weeks — and writes the next action beside the name."
              media={
                <ProductStill
                  name="crm-desk"
                  alt={DESK_ALT}
                  width={2896}
                  height={1516}
                  sizes="(max-width: 768px) 1100px, (max-width: 1080px) 62vw, 730px"
                  imgClassName={styles.deskShot}
                />
              }
              mediaFit="panel"
              mediaCaption="Demo data — invented names, plans and dates"
              className={styles.deskTile}
            />

            <LandingBentoTile
              span="unit"
              tone="a"
              label="Handoff"
              title="Enrollment without leaving the record"
              body="Send a household into branded enrollment from the contact you are already looking at, and what comes back lands on that same record."
            >
              <ul className={styles.chips}>
                <li>Plan</li>
                <li>Member tier</li>
                <li>Effective date</li>
                <li>Enrolled by</li>
              </ul>
            </LandingBentoTile>

            <LandingBentoTile
              span="unit"
              tone="signal"
              label="Commissions"
              title="What bound, what is owed"
              body="Payouts follow the enrollments that produced them, so the month does not get rebuilt in a spreadsheet."
            >
              <ul className={`${styles.chips} ${styles.chipsSignal}`}>
                <li>Bound</li>
                <li>Owed</li>
                <li>Per enrollment</li>
              </ul>
            </LandingBentoTile>

            <LandingBentoTile
              span="wide"
              label="The record"
              title="One form, not a folder"
              body="Contact details, health sharing and mailing address sit in named sections on the same record, so an answer takes one scroll instead of three tabs."
              media={
                <ProductStill
                  name="crm-fields"
                  alt={FIELDS_ALT}
                  width={2592}
                  height={1060}
                  sizes="(max-width: 768px) 1000px, (max-width: 1080px) 62vw, 730px"
                  imgClassName={styles.fieldsShot}
                />
              }
              mediaFit="panel"
              mediaCaption="A record open on its sections — demo data"
              className={styles.fieldsTile}
            />

            <LandingBentoTile
              span="unit"
              label="Controls"
              title="HIPAA controls on the whole book"
              body="Encryption, audit logs and role access are part of the workspace, not a policy document — whichever way the record arrived."
              className={styles.controlsTile}
            >
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
              span="wide"
              label="Coverage"
              title="Coverage lives on the person"
              body="Membership, monthly contribution, IUA and effective date read straight off the record, so nobody opens an attachment to answer a member’s question."
              media={
                <ProductStill
                  name="crm-coverage"
                  alt={COVERAGE_ALT}
                  width={2096}
                  height={382}
                  sizes="(max-width: 768px) 1180px, 1090px"
                  imgClassName={styles.coverageShot}
                />
              }
              mediaFit="panel"
              mediaCaption="Coverage snapshot on a record — demo data"
              className={styles.coverageTile}
            />
          </LandingBento>
        </LandingSection>

        {/* ------------------------------ journey ---------------------------- */}
        <LandingSection id="journey" rhythm="loose" aria-label="How a record moves">
          <LandingJourney
            className={styles.journey}
            tone="cyan"
            stations={STATIONS}
            label="How a record moves through the CRM"
            header={
              <LandingSectionHead
                eyebrow="How it works"
                heading="One record, five states"
                align="center"
                lede="The person carries the record from first call to paid commission. The state changes; the record does not get re-keyed."
              />
            }
            footnote={
              <>
                When the operations team owns enrollment and billing instead of the
                agency,{' '}
                <a
                  href={MMS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-inline-link"
                >
                  MMS
                </a>{' '}
                runs those stages and the CRM keeps the book.
              </>
            }
          />
        </LandingSection>

        {/* ------------------------------- close ----------------------------- */}
        <section className="lp-close" aria-label="Log in">
          <div className="lp-close-inner">
            <div className={`lp-close-core ${styles.closeCore}`} data-layout="split">
              <div>
                <h2 className="lp-display">Log in and open the book</h2>
                <p>
                  Sign in with your Double Helix CRM account and the queue is waiting
                  where you left it.
                </p>
                <div className="lp-close-actions">
                  <Link href="/crm-login" className="lp-btn-primary">
                    Log in
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
                href={MMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`lp-crosslink ${styles.crosslink}`}
              >
                <span className="lp-crosslink-label">The other strand</span>
                <span className="lp-crosslink-title">
                  MMS
                  <ArrowUpRight
                    size={16}
                    className={styles.crosslinkArrow}
                    aria-hidden="true"
                  />
                </span>
                <span className="lp-crosslink-body">
                  The operations side of the same platform, for the team that owns
                  enrollment and billing rather than the book.
                </span>
                <span className={styles.chips} aria-hidden="true">
                  <span>Enrollment engine</span>
                  <span>Member registry</span>
                  <span>Billing</span>
                  <span className={styles.chipSignal}>Payouts</span>
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter
        brand="Double Helix CRM"
        description={
          <>
            The agency workspace in the{' '}
            <a
              href={PLATFORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-inline-link"
            >
              Double Helix
            </a>{' '}
            platform. Pair it with{' '}
            <a
              href={MMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-inline-link"
            >
              MMS
            </a>{' '}
            when enrollment and billing sit with operations.
          </>
        }
        columns={[
          {
            heading: 'Product',
            links: [
              { href: '#desk', label: 'The desk' },
              { href: '#journey', label: 'How it works' },
              { href: '/crm-login', label: 'Log in' },
            ],
          },
          {
            heading: 'Platform',
            links: [
              { href: PLATFORM_URL, label: 'Double Helix', external: true },
              { href: MMS_URL, label: 'MMS', external: true },
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
