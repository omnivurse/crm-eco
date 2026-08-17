import type { ReactNode } from 'react';

export interface LandingFooterLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface LandingFooterColumn {
  heading: string;
  links: LandingFooterLink[];
}

export interface LandingFooterProps {
  brand: string;
  description: ReactNode;
  columns: LandingFooterColumn[];
  homeHref?: string;
  homeLabel?: string;
}

function FooterAnchor({ href, label, external }: LandingFooterLink) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }
  return <a href={href}>{label}</a>;
}

export function LandingFooter({
  brand,
  description,
  columns,
  homeHref = 'https://doublehelixhub.com',
  homeLabel = 'doublehelixhub.com',
}: LandingFooterProps) {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-grid">
        <div>
          <div className="lp-footer-brand">{brand}</div>
          <div className="lp-footer-desc">{description}</div>
        </div>
        {columns.map((col) => (
          <div key={col.heading} className="lp-footer-col">
            <h4>{col.heading}</h4>
            {col.links.map((link) => (
              <FooterAnchor key={link.href + link.label} {...link} />
            ))}
          </div>
        ))}
      </div>
      <div className="lp-footer-bottom">
        <span>© 2026 Double Helix Software. All rights reserved.</span>
        <span>
          <a
            href={homeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="lp-inline-link"
          >
            {homeLabel}
          </a>
        </span>
      </div>
    </footer>
  );
}
