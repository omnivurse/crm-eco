'use client';

import type { ReactNode } from 'react';
import { LandingRail, type LandingRailStation } from './landing-rail';

/**
 * LandingJourney — the record journey: horizontal stations on the strand.
 *
 * This is the "how it works" section done as a progression rather than three
 * columns of text. Below `md` the rail flips to a vertical spine so the steps
 * read as a list without losing the strand.
 */
export interface LandingJourneyProps {
  stations: LandingRailStation[];
  tone?: 'cyan' | 'emerald';
  /** Rendered above the rail (usually a LandingSectionHead). */
  header?: ReactNode;
  /** Rendered under the rail — e.g. a caveat or a link. */
  footnote?: ReactNode;
  /** Accessible name for the station list. */
  label?: string;
  className?: string;
}

export function LandingJourney({
  stations,
  tone = 'cyan',
  header,
  footnote,
  label = 'How a record moves',
  className,
}: LandingJourneyProps) {
  return (
    <div className={['lp-journey', className].filter(Boolean).join(' ')}>
      {header ? <div className="lp-journey-head">{header}</div> : null}
      <div className="lp-journey-rail">
        {/*
          Two orientations of the same rail: CSS shows exactly one. Rendering
          both keeps the SVG geometry correct for each axis without measuring
          the viewport in JS (no layout thrash, no hydration mismatch).
        */}
        <LandingRail
          className="lp-journey-h"
          tone={tone}
          stations={stations}
          orientation="horizontal"
          label={label}
        />
        <LandingRail
          className="lp-journey-v"
          tone={tone}
          stations={stations}
          orientation="vertical"
          showStations
          label={label}
        />
      </div>
      {footnote ? <p className="lp-journey-note">{footnote}</p> : null}
    </div>
  );
}
