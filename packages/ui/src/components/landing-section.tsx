import type { ElementType, ReactNode } from 'react';

/**
 * LandingSectionHead — eyebrow + display heading + optional lede.
 *
 * The eyebrow is the "ledger" micro-label (mono, uppercase, tracked): it is
 * the texture that tells you this software is about records, dates and
 * amounts. Every landing section opens with one so the page has a rhythm.
 */
export interface LandingSectionHeadProps {
  /** Mono micro-label. Keep it 1-3 words. */
  eyebrow?: ReactNode;
  heading: ReactNode;
  /** One short paragraph. Kept to <= 62ch by the stylesheet. */
  lede?: ReactNode;
  /** Heading level. Defaults to h2 — sections sit under the page h1. */
  as?: Extract<ElementType, 'h1' | 'h2' | 'h3'>;
  /** 'start' (default) or 'center'. */
  align?: 'start' | 'center';
  /** Optional trailing slot, e.g. a link. Sits opposite the heading at >= md. */
  aside?: ReactNode;
  className?: string;
}

export function LandingSectionHead({
  eyebrow,
  heading,
  lede,
  as: Heading = 'h2',
  align = 'start',
  aside,
  className,
}: LandingSectionHeadProps) {
  return (
    <header
      className={['lp-head', className].filter(Boolean).join(' ')}
      data-align={align}
    >
      <div className="lp-head-main">
        {eyebrow ? <p className="lp-eyebrow">{eyebrow}</p> : null}
        <Heading className="lp-display">{heading}</Heading>
        {lede ? <p className="lp-lede">{lede}</p> : null}
      </div>
      {aside ? <div className="lp-head-aside">{aside}</div> : null}
    </header>
  );
}

/**
 * LandingSection — the standard section shell (max width, rhythm, anchor id).
 * Optional so pages can hand-roll a section, but using it keeps the vertical
 * rhythm identical across both landings.
 */
export interface LandingSectionProps {
  id?: string;
  children: ReactNode;
  /** 'default' | 'tight' | 'loose' vertical rhythm. */
  rhythm?: 'default' | 'tight' | 'loose';
  /** Paints a faint panel behind the section so it reads as its own band. */
  band?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function LandingSection({
  id,
  children,
  rhythm = 'default',
  band = false,
  className,
  ...aria
}: LandingSectionProps) {
  return (
    <section
      id={id}
      className={['lp-section', className].filter(Boolean).join(' ')}
      data-rhythm={rhythm}
      data-band={band ? 'true' : undefined}
      {...aria}
    >
      {children}
    </section>
  );
}
