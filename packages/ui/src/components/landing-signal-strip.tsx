import type { ReactNode } from 'react';

/**
 * LandingSignalStrip — three short truth items.
 *
 * Rules: each item must be something the product actually does. No invented
 * metrics, no certification badges, no logos. If you cannot say it plainly,
 * it does not belong here.
 */
export interface LandingSignalItem {
  id: string;
  /** Mono micro-label, e.g. "ACCESS". */
  label: string;
  /** The claim, in plain words. One short line. */
  value: ReactNode;
  /**
   * Money moment (commissions / payouts / billing). Paints the semantic amber
   * accent. Semantic only.
   */
  signal?: boolean;
}

export interface LandingSignalStripProps {
  items: LandingSignalItem[];
  /** 'inline' sits inside the hero column; 'band' spans a full section. */
  variant?: 'inline' | 'band';
  /** Accessible name for the list. */
  label?: string;
  className?: string;
}

export function LandingSignalStrip({
  items,
  variant = 'inline',
  label = 'What is built in',
  className,
}: LandingSignalStripProps) {
  return (
    <ul
      className={['lp-signals', className].filter(Boolean).join(' ')}
      data-variant={variant}
      aria-label={label}
    >
      {items.map((item) => (
        <li
          key={item.id}
          className="lp-signal"
          data-signal={item.signal ? 'true' : undefined}
        >
          <span className="lp-signal-tick" aria-hidden="true" />
          <span className="lp-signal-body">
            <span className="lp-signal-label">{item.label}</span>
            <span className="lp-signal-value">{item.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
