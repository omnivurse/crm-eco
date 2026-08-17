import Image from 'next/image';
import Link from 'next/link';
import { LandingNav } from '@crm-eco/ui/components/landing-nav';
import { LandingFooter } from '@crm-eco/ui/components/landing-footer';
import { LandingMedia } from '@crm-eco/ui/components/landing-media';
import { ThemeToggle } from '@/components/crm/shell/ThemeToggle';
import '@crm-eco/ui/styles/landing.css';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  {
    href: 'https://doublehelixhub.com',
    label: 'Platform',
    external: true,
  },
];

const CAPABILITIES = [
  {
    title: 'Book of business',
    body: 'Keep every lead and member on one record, with the fields benefits work actually uses.',
  },
  {
    title: 'Enrollment handoff',
    body: 'Send applicants into branded enrollment without leaving the CRM.',
  },
  {
    title: 'Commissions',
    body: 'See payouts as enrollments bind, not in a side spreadsheet.',
  },
  {
    title: 'HIPAA controls',
    body: 'Encryption, audit logs, and role access are part of the product, not an add-on.',
  },
];

const STEPS = [
  {
    title: 'Connect the book',
    body: 'Bring contacts, carriers, and open work into one place your team already knows.',
  },
  {
    title: 'Run enrollments',
    body: 'Move a household from quote to submitted application without a second system.',
  },
  {
    title: 'See commissions',
    body: 'Track what bound and what is owed without rebuilding the month in Excel.',
  },
];

export default function CrmLandingPage() {
  return (
    <div className="lp-root">
      <LandingNav
        links={NAV_LINKS}
        authHref="/crm-login"
        authLabel="Log in"
        themeToggle={<ThemeToggle variant="icon" className="lp-theme-btn !h-11 !w-11" />}
      />

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>
            The CRM built for{' '}
            <span className="lp-gradient">health benefits</span>
          </h1>
          <p>Contacts, enrollments, and commissions in one place for benefits agencies.</p>
          <div className="lp-hero-actions">
            <Link href="/crm-login" className="lp-btn-primary">
              Log in
            </Link>
            <a href="#how-it-works" className="lp-btn-secondary">
              How it works
            </a>
          </div>
        </div>
        <LandingMedia aspect="4/3">
          <Image
            src="/landing/hero.jpg"
            alt="Quiet advisor desk with folders and a closed laptop"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="lp-media-img"
          />
        </LandingMedia>
      </section>

      <section className="lp-claim">
        <LandingMedia aspect="16/9">
          <Image
            src="/landing/desk.jpg"
            alt="Empty office workbench after hours"
            fill
            sizes="(max-width: 768px) 100vw, 72rem"
            className="lp-media-img"
          />
        </LandingMedia>
        <h2>The book of business lives in one place.</h2>
      </section>

      <section id="features" className="lp-section">
        <h2>What the desk actually runs on</h2>
        <div className="lp-editorial">
          {CAPABILITIES.map((item) => (
            <article key={item.title} className="lp-editorial-row">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="lp-section">
        <h2>How agencies start</h2>
        <div className="lp-sequence">
          {STEPS.map((step) => (
            <article key={step.title} className="lp-sequence-item">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-close">
        <h2>Log in to run the book</h2>
        <p>Use your Double Helix CRM account to open the workspace.</p>
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
