import Link from 'next/link';
import { ArrowUpRight, Check } from 'lucide-react';
import { LandingSection, LandingSectionHead } from '@crm-eco/ui/components/landing-section';
import { LandingSignalStrip } from '@crm-eco/ui/components/landing-signal-strip';
import { LandingBento, LandingBentoTile } from '@crm-eco/ui/components/landing-bento';
import { LandingRail } from '@crm-eco/ui/components/landing-rail';
import type { LandingRailStation } from '@crm-eco/ui/components/landing-rail';
import type { LandingSignalItem } from '@crm-eco/ui/components/landing-signal-strip';
import { LeadForm } from '@/components/lead-form';
import { ProductStill, PRODUCT_STILLS } from '@/components/landing/ProductStill';
import { landingFontVars } from '@/components/landing/fonts';
import base from '@/components/landing/dhh-landing.module.css';
import styles from '@/components/landing/home-landing.module.css';

/**
 * doublehelixhub.com — the homepage.
 *
 * Built on the shared landing system (`--lp-*` / `.lp-*`, packages/ui), the
 * same one the CRM and MMS product landings ship, so the corporate site and
 * the two product sites read as one family. `landing.css` is imported globally
 * from app/globals.css, so nothing is imported here; `base.root` re-declares
 * the two type tokens on the element that carries the font classes.
 *
 * THE SIGNATURE. On the CRM landing the record rail is cyan-led; on MMS it is
 * emerald-led. Here the two strands ARE THE TWO PRODUCTS — CRM Core (cyan) and
 * Admin Enrollment (emerald) — running as one backbone, which is the company's
 * own stated thesis ("One identity layer. One data backbone. Subscribe to
 * either product — or both."). Both tones read equally, which is what makes
 * this hero visually distinct from the two single-tone product heroes.
 *
 * HONESTY. Every claim on this page was already on this page (or on the
 * product/pricing page it links to). No metrics, no logos, no customer names,
 * no testimonials, no certifications, no awards. The four screenshots are the
 * real product surfaces shipped by the two product landings, with invented
 * demo data, and each one is captioned as such. Nothing is drawn with divs:
 * the one tile with no honest still (the backbone tile) is typographic + a
 * strand ornament.
 */

const CRM_HREF = '/products/crm';
const ADMIN_HREF = '/products/admin';
const PRICING_HREF = '/pricing';

/**
 * The hero rail's rungs. Not rendered as text (`showStations={false}`) — the
 * strand tags beside it carry the meaning — but they are the backbone the
 * hero lede already names: "one backbone for contacts, deals, plans, billing,
 * and commissions". Five stations also fix the strand geometry the hero's tag
 * positions are derived from; see home-landing.module.css.
 */
const BACKBONE: LandingRailStation[] = [
  { id: 'contacts', label: 'Contacts' },
  { id: 'deals', label: 'Deals' },
  { id: 'plans', label: 'Plans' },
  { id: 'billing', label: 'Billing', signal: true },
  { id: 'commissions', label: 'Commissions', signal: true },
];

/** The four turns the ornamental strand makes inside the backbone tile. */
const BACKBONE_ORNAMENT: LandingRailStation[] = [
  { id: 'contacts', label: 'Contacts' },
  { id: 'plans', label: 'Plans' },
  { id: 'billing', label: 'Billing' },
  { id: 'commissions', label: 'Commissions' },
];

/**
 * The hero truth strip. These are the three proof points the previous hero
 * carried as chips — org-level isolation, CRM + Admin suite, early access
 * pricing — restated in plain words. No new claim, no metric.
 */
const SIGNALS: LandingSignalItem[] = [
  {
    id: 'isolation',
    label: 'Isolation',
    value: 'Org-level isolation for every agency, TPA and advisor group.',
  },
  {
    id: 'suite',
    label: 'Suite',
    value: 'CRM Core and Admin Enrollment on one identity layer.',
  },
  {
    id: 'access',
    label: 'Access',
    value: 'Early access pricing, onboarding in waves.',
  },
];

/**
 * Why Double Helix — the same six claims the previous section made, verbatim,
 * composed as a register instead of a 3x2 grid of icon cards. `tone` says
 * which strand a claim belongs to: 'a' CRM Core, 'b' Admin Enrollment, 'core'
 * the shared backbone, 'signal' the money one. Amber appears exactly once on
 * this page and it is the billing entry — semantic, never decoration.
 */
type LedgerTone = 'a' | 'b' | 'core' | 'signal';

interface LedgerEntry {
  id: string;
  tone: LedgerTone;
  title: string;
  body: string;
}

const WHY: LedgerEntry[] = [
  {
    id: 'multi-tenant',
    tone: 'core',
    title: 'Multi-tenant by design',
    body: 'Every agency, TPA, or advisor group is its own org. Strict data isolation with shared infrastructure.',
  },
  {
    id: 'hipaa',
    tone: 'core',
    title: 'HIPAA-aware foundations',
    body: 'Audit logging, RLS at the database, and encryption controls baked into the core schema.',
  },
  {
    id: 'billing',
    tone: 'signal',
    title: 'Billing engine inside',
    body: 'Multi-gateway support for member premiums, subscription billing, advisor commissions, and vendor payables.',
  },
  {
    id: 'identity',
    tone: 'core',
    title: 'Members, advisors, agents — one model',
    body: 'No bolted-on identity. Roles flow from a single membership table so portals, permissions, and pay flows align.',
  },
  {
    id: 'embed',
    tone: 'a',
    title: 'Embed anywhere',
    body: 'Drop quote forms and pricing widgets into any tenant’s WordPress, custom site, or landing page builder.',
  },
  {
    id: 'licensee',
    tone: 'b',
    title: 'Built for the licensee',
    body: 'White-labeled landing pages, branding, and domains for every tenant org. Your customers see your brand.',
  },
];

/** The three assurances the previous request-access section listed. */
const ACCESS_NOTES = [
  'No card required to evaluate.',
  'Migration help included for early customers.',
  'White-labeled landing pages and tenant branding throughout.',
];

/*
 * Alt text. The CRM strings are the ones the CRM landing ships, verbatim. The
 * two Admin strings are the MMS landing's, with only the product renamed to
 * the name this site sells it under — every field, figure and the explicit
 * "invented demo data" clause is unchanged.
 */

const DESK_ALT =
  "Double Helix CRM dashboard: a Today's queue of nine people with status, city, plan, " +
  'who enrolled them and the next action, beside a Next up panel for one member. ' +
  'Every name, plan and number shown is invented demo data.';

const RECORD_ALT =
  'The Next up panel on the CRM dashboard: a pending member with city, date of birth, ' +
  'plan, who enrolled them, referring member, member ID and effective date, above a ' +
  'Confirm start date action and a recently viewed list. Invented demo data.';

const CONSOLE_ALT =
  'The Admin Enrollment (MMS) operations console: alert chips for failed payments, a failed ' +
  'job, enrollments pending review and commissions pending, above membership, revenue, ' +
  'commission and system tiles and a member lifecycle bar running Leads, Draft, In progress, ' +
  'Submitted, Active. Invented demo data.';

const REGISTRY_ALT =
  'The Admin Enrollment (MMS) member registry: a table of members with email, phone, state, ' +
  'plan, market, tobacco, advisor, status and created date, headed "All Members". ' +
  'Invented demo data.';

export default function HomePage() {
  return (
    <div className={`lp-root ${base.root} ${landingFontVars}`} data-strand="dhh">
      <main>
        {/* ================================ hero =============================
            The rail runs down the middle of the stage and each product is
            tagged against the point where ITS strand reaches maximum
            separation — CRM Core on the left strand, Admin Enrollment on the
            right, converging into one backbone at the foot. Structural, not
            ornamental: the composition IS the thesis. */}
        <section className={`lp-hero ${styles.hero}`} aria-label="Double Helix Software">
          <div className={`lp-hero-copy ${styles.heroCopy}`}>
            <p className="lp-eyebrow">Multi-tenant SaaS</p>
            <h1 className="lp-display">
              The OS for <span className="lp-gradient">health benefits</span>
            </h1>
            <p className="lp-lede">
              CRM and enrollment for advisors, agencies, and TPAs — one backbone for
              contacts, deals, plans, billing, and commissions. Licensed. Isolated. Built
              to scale.
            </p>
            <div className="lp-hero-actions">
              <a href="#request-access" className="lp-btn-primary">
                Request access
              </a>
              <a href="#products" className="lp-btn-secondary">
                See the products
              </a>
            </div>
          </div>

          <div className={styles.heroStage}>
            <LandingRail
              className={styles.heroSpine}
              tone="cyan"
              stations={BACKBONE}
              orientation="vertical"
              showStations={false}
              fade="ends"
            />

            <div className={styles.strandTags}>
              <p className={`${styles.strandTag} ${styles.strandTagA}`}>
                <span className={styles.strandKind}>
                  <span className={styles.strandDot} aria-hidden="true" />
                  Strand A
                </span>
                <span className={styles.strandName}>CRM Core</span>
                <span className={styles.strandRole}>Leads, deals, sequences</span>
              </p>

              <p className={`${styles.strandTag} ${styles.strandTagB}`}>
                <span className={styles.strandKind}>
                  <span className={styles.strandDot} aria-hidden="true" />
                  Strand B
                </span>
                <span className={styles.strandName}>Admin Enrollment</span>
                <span className={styles.strandRole}>Billing, commissions, portal</span>
              </p>

              <p className={styles.backboneNote}>
                One identity layer · one data backbone
              </p>
            </div>
          </div>

          <div className={styles.heroStrip}>
            <LandingSignalStrip
              items={SIGNALS}
              variant="band"
              label="What the platform is"
            />
          </div>
        </section>

        {/* =============================== products ==========================
            The first time this site shows the software. Four real stills, two
            per product, each captioned as demo data. */}
        <LandingSection
          id="products"
          className={styles.products}
          aria-label="The two products"
        >
          <LandingSectionHead
            eyebrow="The products"
            heading="Two products. One data backbone."
            lede="CRM Core runs the agency’s book. Admin Enrollment runs plans, members, billing and commissions. The screens below are the real software, with invented people in it."
          />

          <LandingBento>
            <LandingBentoTile
              span="lead"
              label="Product 01 — CRM Core"
              title="The book of business, on one desk"
              body="Pipelines, modules, and automations purpose-built for Medicare, ACA, group, and healthshare advisors."
              className={styles.deskTile}
              media={
                <ProductStill
                  {...PRODUCT_STILLS['crm-desk']}
                  alt={DESK_ALT}
                  sizes="(max-width: 768px) 1100px, (max-width: 1080px) 62vw, 730px"
                  imgClassName={styles.deskShot}
                />
              }
              mediaFit="panel"
              mediaCaption="CRM Core — demo data, invented names, plans and dates"
            >
              <ul className={styles.chips}>
                <li>Leads</li>
                <li>Deals</li>
                <li>Sequences</li>
              </ul>
              <Link href={CRM_HREF} className={styles.tileLink}>
                Explore CRM Core
                <ArrowUpRight size={15} className={styles.tileArrow} aria-hidden="true" />
              </Link>
            </LandingBentoTile>

            <LandingBentoTile
              span="tall"
              tone="a"
              label="The record"
              title="The next person, already open"
              body="A pending member with plan, enroller, member ID and effective date — and the next action sitting beside them."
              media={
                <ProductStill
                  {...PRODUCT_STILLS['crm-record']}
                  alt={RECORD_ALT}
                  sizes="(max-width: 768px) 92vw, (max-width: 1080px) 46vw, 380px"
                />
              }
              mediaFit="panel"
              mediaCaption="Next up on the CRM desk — demo data, invented names"
            />

            {/* No honest still exists for "one identity layer, one data
                backbone" — it is an architecture claim, not a screen — so this
                tile is typographic with the strand turning through it, rather
                than a UI faked out of divs. */}
            <LandingBentoTile
              span="tall"
              label="Suite"
              title="Run the whole stack"
              body="One identity layer. One data backbone. Subscribe to either product — or both."
              className={styles.suiteTile}
            >
              <ul className={styles.chips}>
                <li>Shared core</li>
                <li>Contacts</li>
                <li>Deals</li>
                <li>Plans</li>
                <li>Billing</li>
                <li>Commissions</li>
              </ul>
              <Link href={PRICING_HREF} className={styles.tileLink}>
                See pricing
                <ArrowUpRight size={15} className={styles.tileArrow} aria-hidden="true" />
              </Link>
              <LandingRail
                className={styles.suiteStrand}
                tone="cyan"
                stations={BACKBONE_ORNAMENT}
                orientation="vertical"
                showStations={false}
                fade="ends"
              />
            </LandingBentoTile>

            <LandingBentoTile
              span="lead"
              label="Product 02 — Admin Enrollment"
              title="Enrollment, and everything that follows it"
              body="Plans, members, billing, commissions, and ops — multi-tenant isolation for every agency and TPA."
              className={styles.consoleTile}
              media={
                <ProductStill
                  {...PRODUCT_STILLS['mms-console']}
                  alt={CONSOLE_ALT}
                  sizes="(max-width: 768px) 1120px, (max-width: 1080px) 62vw, 730px"
                  imgClassName={styles.consoleShot}
                />
              }
              mediaFit="panel"
              mediaCaption="Admin Enrollment console — demo data, invented names and amounts"
            >
              <ul className={styles.chips}>
                <li>Billing</li>
                <li>Commissions</li>
                <li>Portal</li>
              </ul>
              <Link href={ADMIN_HREF} className={styles.tileLink}>
                Explore Admin Enrollment
                <ArrowUpRight size={15} className={styles.tileArrow} aria-hidden="true" />
              </Link>
            </LandingBentoTile>

            <LandingBentoTile
              span="wide"
              tone="b"
              label="Members"
              title="The member registry"
              body="Email, phone, state, plan, market, advisor and status — one row per member, in the same workspace that runs billing and commissions."
              className={styles.registryTile}
              media={
                <ProductStill
                  {...PRODUCT_STILLS['mms-registry']}
                  alt={REGISTRY_ALT}
                  sizes="(max-width: 768px) 1220px, (max-width: 1080px) 92vw, 1100px"
                  imgClassName={styles.registryShot}
                />
              }
              mediaFit="panel"
              mediaCaption="Admin Enrollment member registry — demo data, invented names"
            />
          </LandingBento>
        </LandingSection>

        {/* ================================ why ==============================
            The same six claims, composed as a register: mono index, a tone
            tick saying which strand the claim belongs to, hairline between
            entries. */}
        <LandingSection band aria-label="Why Double Helix">
          <div className={styles.why}>
            <div className={styles.whyHead}>
              <div className={styles.whyHeadInner}>
                <LandingSectionHead
                  eyebrow="Why Double Helix"
                  heading="Built for benefits — not bent into shape"
                  lede="Most CRMs and enrollment systems weren’t built for benefits. We started from the specifics of this industry — multi-carrier plans, commissions, member portals — and wrapped a clean SaaS platform around them."
                />
              </div>
            </div>

            <ol className={styles.ledger}>
              {WHY.map((entry, i) => (
                <li key={entry.id} className={styles.ledgerItem} data-tone={entry.tone}>
                  <span className={styles.ledgerMark} aria-hidden="true">
                    <span className={styles.ledgerIndex}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={styles.ledgerTick} />
                  </span>
                  <div>
                    <h3 className={styles.ledgerTitle}>{entry.title}</h3>
                    <p className={styles.ledgerBody}>{entry.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </LandingSection>

        {/* =========================== request access ========================
            The id, the form, its field names and its POST /api/leads wiring
            are unchanged — the header, the footer and every other page deep
            link to /#request-access. */}
        <section
          id="request-access"
          className={`lp-close ${styles.close}`}
          aria-label="Request access"
        >
          <div className="lp-close-inner">
            {/* `data-layout` is required, not decoration: landing.css carries a
                legacy `.lp-close-core:not([data-layout]) { display: block }` rule,
                so without it the two columns collapse into one. */}
            <div className={`lp-close-core ${styles.closeCore}`} data-layout="split">
              <div>
                <p className="lp-eyebrow">Early access</p>
                <h2 className="lp-display">Get early access.</h2>
                <p>
                  We&rsquo;re onboarding agencies and TPAs in waves. Tell us what
                  you&rsquo;re running today and what you&rsquo;d like Double Helix to
                  take over — we&rsquo;ll get back within a business day.
                </p>
                <ul className={styles.checks}>
                  {ACCESS_NOTES.map((note) => (
                    <li key={note} className={styles.checkItem}>
                      <Check size={15} className={styles.checkTick} aria-hidden="true" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.formCard}>
                <LeadForm />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
