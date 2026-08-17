'use client';

import { useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from './brand-logo';

export interface LandingNavLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface LandingNavProps {
  links: LandingNavLink[];
  authHref: string;
  authLabel: string;
  themeToggle: ReactNode;
  productLabel?: string;
}

export function LandingNav({
  links,
  authHref,
  authLabel,
  themeToggle,
  productLabel,
}: LandingNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={open ? 'lp-nav-wrap lp-nav-open' : 'lp-nav-wrap'}>
      <nav className="lp-nav" aria-label="Primary">
        <a href="/" className="lp-nav-brand">
          <span className="lp-nav-wordmark">
            <BrandLogo variant="full" size="sm" tone="auto" priority />
            {productLabel ? (
              <span className="lp-nav-wordmark-sub">{productLabel}</span>
            ) : null}
          </span>
        </a>
        <div className="lp-nav-links">
          {links.map((link) => (
            <a
              key={link.href + link.label}
              href={link.href}
              {...(link.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="lp-nav-actions">
          {themeToggle}
          <a href={authHref} className="lp-nav-cta">
            {authLabel}
          </a>
          <button
            type="button"
            className="lp-nav-menu-btn"
            aria-expanded={open}
            aria-controls="lp-nav-panel"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </nav>
      <div id="lp-nav-panel" className="lp-nav-panel">
        {links.map((link) => (
          <a
            key={`m-${link.href}-${link.label}`}
            href={link.href}
            onClick={() => setOpen(false)}
            {...(link.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
