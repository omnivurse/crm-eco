import Link from 'next/link';
import { LandingNav } from '@crm-eco/ui/components/landing-nav';
import { LandingFooter } from '@crm-eco/ui/components/landing-footer';
import { LandingHelix } from '@crm-eco/ui/components/landing-helix';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import '@crm-eco/ui/styles/landing.css';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: 'https://doublehelixhub.com', label: 'Platform', external: true },
];

const LEAD = {
  title: 'Enrollment engine',
  body: 'Digital applications, e-sign, and plan selection in one flow, then a live member record.',
};

const TILES = [
  {
    title: 'Member registry',
    body: 'Coverage, dependents, and history sit on a single member record.',
  },
  {
    title: 'Billing and NACHA',
    body: 'Monthly runs stay tied to the coverage that is actually enrolled.',
  },
  {
    title: 'Agent commissions',
    body: 'Accrue payouts when enrollments bind, with a full payout trail.',
  },
];

const STEPS = [
  {
    title: 'Configure plans',
    body: 'Set products, rates, and rules before the next open window.',
  },
  {
    title: 'Enroll',
    body: 'Take an application from signature to an active member.',
  },
  {
    title: 'Bill',
    body: 'Collect against enrolled coverage, then export NACHA when you need the file.',
  },
];

export default function AdminLandingPage() {
  return (
    <div className="lp-root" data-strand="mms">
      <LandingNav
        links={NAV_LINKS}
        authHref="/login"
        authLabel="Sign in"
        productLabel="MMS"
        themeToggle={<ThemeToggle variant="icon" className="lp-theme-btn !h-11 !w-11" />}
      />

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>
            Enroll members.{' '}
            <span className="lp-gradient">Keep them.</span>
          </h1>
          <p>Benefits enrollment and the member registry for health sharing operations.</p>
          <div className="lp-hero-actions">
            <Link href="/login" className="lp-btn-primary">
              Sign in
            </Link>
            <a href="#how-it-works" className="lp-btn-secondary">
              How it works
            </a>
          </div>
        </div>
        <LandingHelix tone="emerald" atmosphereSrc="/landing/strand.jpg" />
      </section>

      <section id="features" className="lp-section">
        <h2>What operations runs</h2>
        <div className="lp-mosaic">
          <article className="lp-tile lp-tile-lead">
            <div className="lp-tile-inner">
              <img src="/landing/strand.jpg" alt="" className="lp-tile-lead-photo" />
              <h3>{LEAD.title}</h3>
              <p>{LEAD.body}</p>
            </div>
          </article>
          {TILES.map((item) => (
            <article key={item.title} className="lp-tile">
              <div className="lp-tile-inner">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="lp-section">
        <h2>How a population gets on the books</h2>
        <div className="lp-rail">
          {STEPS.map((step) => (
            <article key={step.title} className="lp-rail-item">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-close">
        <div className="lp-close-inner">
          <div className="lp-close-core">
            <h2>Sign in to run enrollment</h2>
            <p>Open the member workspace with your MMS account.</p>
            <Link href="/login" className="lp-btn-primary">
              Sign in
            </Link>
            <p className="lp-close-note">
              Agencies run the book in{' '}
              <a
                href="https://crm.doublehelixhub.com"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-inline-link"
              >
                CRM
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <LandingFooter
        brand="Double Helix MMS"
        description={
          <>
            Benefits enrollment and member management for health sharing organizations. Part of the{' '}
            <a
              href="https://doublehelixhub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-inline-link"
            >
              Double Helix
            </a>{' '}
            platform, paired with{' '}
            <a
              href="https://crm.doublehelixhub.com"
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
            heading: 'Platform',
            links: [
              { href: 'https://doublehelixhub.com', label: 'Platform', external: true },
              { href: 'https://crm.doublehelixhub.com', label: 'CRM', external: true },
              { href: '#features', label: 'Features' },
              { href: '#how-it-works', label: 'How it works' },
            ],
          },
          {
            heading: 'Resources',
            links: [
              { href: 'https://doublehelixhub.com/security', label: 'Security', external: true },
              { href: 'https://doublehelixhub.com/integrations', label: 'Integrations', external: true },
            ],
          },
          {
            heading: 'Company',
            links: [
              { href: 'https://doublehelixhub.com', label: 'About', external: true },
              { href: 'mailto:support@doublehelixhub.com', label: 'Contact' },
              { href: '/legal/sms-privacy', label: 'SMS Privacy' },
              { href: 'https://doublehelixhub.com/legal/privacy', label: 'Privacy', external: true },
              { href: 'https://doublehelixhub.com/legal/terms', label: 'Terms', external: true },
            ],
          },
        ]}
      />
    </div>
  );
}
