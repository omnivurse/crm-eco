import Image from 'next/image';
import Link from 'next/link';
import { LandingNav } from '@crm-eco/ui/components/landing-nav';
import { LandingFooter } from '@crm-eco/ui/components/landing-footer';
import { LandingMedia } from '@crm-eco/ui/components/landing-media';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
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
    title: 'Enrollment engine',
    body: 'Digital applications, e-sign, and plan selection in one flow.',
  },
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
    body: 'Set products, rates, and enrollment rules before the next open window.',
  },
  {
    title: 'Enroll',
    body: 'Take an application from signature to an active member record.',
  },
  {
    title: 'Bill',
    body: 'Run collections against enrolled coverage, then export NACHA when you need the file.',
  },
];

export default function AdminLandingPage() {
  return (
    <div className="lp-root">
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
            <span className="lp-gradient">Manage them for life.</span>
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
        <LandingMedia aspect="4/3">
          <Image
            src="/landing/hero.jpg"
            alt="Enrollment packet being filed into a steel cabinet"
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
            src="/landing/registry.jpg"
            alt="Quiet member operations room with steel filing cabinets"
            fill
            sizes="(max-width: 768px) 100vw, 72rem"
            className="lp-media-img"
          />
        </LandingMedia>
        <h2>Approved applications land in one registry.</h2>
      </section>

      <section id="features" className="lp-section">
        <h2>What operations runs every month</h2>
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
        <h2>How a population gets on the books</h2>
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
        <h2>Sign in to run enrollment</h2>
        <p>Use your MMS account to open the member workspace.</p>
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
