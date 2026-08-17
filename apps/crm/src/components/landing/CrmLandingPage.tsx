import Link from 'next/link';
import { LandingNav } from '@crm-eco/ui/components/landing-nav';
import { LandingFooter } from '@crm-eco/ui/components/landing-footer';
import { LandingHelix } from '@crm-eco/ui/components/landing-helix';
import { ThemeToggle } from '@/components/crm/shell/ThemeToggle';
import '@crm-eco/ui/styles/landing.css';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: 'https://doublehelixhub.com', label: 'Platform', external: true },
];

const LEAD = {
  title: 'Book of business',
  body: 'Every lead and member on one record, with the fields benefits work actually uses.',
};

const TILES = [
  {
    title: 'Enrollment handoff',
    body: 'Send a household into branded enrollment without leaving the CRM.',
  },
  {
    title: 'Commissions',
    body: 'See what bound and what is owed without rebuilding the month in Excel.',
  },
  {
    title: 'HIPAA controls',
    body: 'Encryption, audit logs, and role access are built in, not bolted on.',
  },
];

const STEPS = [
  {
    title: 'Connect the book',
    body: 'Bring contacts, carriers, and open work into one workspace.',
  },
  {
    title: 'Run enrollments',
    body: 'Move a household from quote to a submitted application.',
  },
  {
    title: 'See commissions',
    body: 'Track payouts as enrollments bind, in the same record.',
  },
];

export default function CrmLandingPage() {
  return (
    <div className="lp-root" data-strand="crm">
      <LandingNav
        links={NAV_LINKS}
        authHref="/crm-login"
        authLabel="Log in"
        themeToggle={<ThemeToggle variant="icon" className="lp-theme-btn !h-11 !w-11" />}
      />

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>
            The CRM for{' '}
            <span className="lp-gradient">health benefits</span>
          </h1>
          <p>Contacts, enrollments, and commissions in one workspace for agencies.</p>
          <div className="lp-hero-actions">
            <Link href="/crm-login" className="lp-btn-primary">
              Log in
            </Link>
            <a href="#how-it-works" className="lp-btn-secondary">
              How it works
            </a>
          </div>
        </div>
        <LandingHelix tone="cyan" atmosphereSrc="/landing/strand.jpg" />
      </section>

      <section id="features" className="lp-section">
        <h2>What agencies run</h2>
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
        <h2>How agencies start</h2>
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
            <h2>Log in to run the book</h2>
            <p>Open the workspace with your Double Helix CRM account.</p>
            <Link href="/crm-login" className="lp-btn-primary">
              Log in
            </Link>
            <p className="lp-close-note">
              Operations teams enroll and bill in{' '}
              <a
                href="https://admin.doublehelixhub.com"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-inline-link"
              >
                MMS
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <LandingFooter
        brand="Double Helix CRM"
        description={
          <>
            The agency workspace in the{' '}
            <a
              href="https://doublehelixhub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-inline-link"
            >
              Double Helix
            </a>{' '}
            platform. Pair it with{' '}
            <a
              href="https://admin.doublehelixhub.com"
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
            heading: 'Platform',
            links: [
              { href: 'https://doublehelixhub.com', label: 'Platform', external: true },
              { href: 'https://admin.doublehelixhub.com', label: 'MMS', external: true },
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
