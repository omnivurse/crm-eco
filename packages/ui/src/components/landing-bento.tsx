import type { ReactNode } from 'react';

/**
 * LandingBento — the asymmetric tile grid.
 *
 * The grid is 6 columns at >= lg, 4 at md, 1 below. Tiles claim space with
 * `span`, so the two landings can share the system while running different
 * rhythms (CRM weights the desk, MMS weights registry/billing).
 *
 * Tiles hold product truth: a still image, a caption and an optional mono
 * label. Media must be a REAL screenshot or photograph — never a UI faked out
 * of divs. A tile with no honest still simply omits `media` and reads as a
 * typographic tile on the strand.
 */

export type LandingBentoSpan = 'lead' | 'tall' | 'wide' | 'half' | 'unit';

export interface LandingBentoProps {
  children: ReactNode;
  className?: string;
}

export function LandingBento({ children, className }: LandingBentoProps) {
  return (
    <div className={['lp-bento', className].filter(Boolean).join(' ')}>{children}</div>
  );
}

export interface LandingBentoTileProps {
  /** How much of the 6-column grid this tile claims. */
  span?: LandingBentoSpan;
  /** Mono micro-label, e.g. "TODAY QUEUE". */
  label?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** A real still: `next/image`, or an `<img>`. */
  media?: ReactNode;
  /** 'fill' floods the tile behind the text; 'panel' insets it above the text. */
  mediaFit?: 'fill' | 'panel';
  /** Short caption for the still — say what is on screen. */
  mediaCaption?: ReactNode;
  /**
   * 'a' cyan wash, 'b' emerald wash, 'signal' amber wash (money moments ONLY),
   * 'plain' no wash, 'dark' an ink tile for a hero-weight still.
   */
  tone?: 'plain' | 'a' | 'b' | 'signal' | 'dark';
  /** Extra content under the body (links, a mini list). */
  children?: ReactNode;
  className?: string;
}

export function LandingBentoTile({
  span = 'unit',
  label,
  title,
  body,
  media,
  mediaFit = 'panel',
  mediaCaption,
  tone = 'plain',
  children,
  className,
}: LandingBentoTileProps) {
  const flooded = Boolean(media) && mediaFit === 'fill';

  return (
    <article
      className={['lp-tile', className].filter(Boolean).join(' ')}
      data-span={span}
      data-tone={flooded ? 'dark' : tone}
      data-media={media ? mediaFit : undefined}
    >
      <div className="lp-tile-inner">
        {flooded ? <div className="lp-tile-flood">{media}</div> : null}
        {media && !flooded ? (
          <div className="lp-tile-media">
            {media}
            {mediaCaption ? (
              <p className="lp-tile-media-caption">{mediaCaption}</p>
            ) : null}
          </div>
        ) : null}
        <div className="lp-tile-body">
          {label ? <p className="lp-eyebrow lp-tile-label">{label}</p> : null}
          <h3 className="lp-tile-title">{title}</h3>
          {body ? <p className="lp-tile-text">{body}</p> : null}
          {flooded && mediaCaption ? (
            <p className="lp-tile-media-caption">{mediaCaption}</p>
          ) : null}
          {children}
        </div>
      </div>
    </article>
  );
}
