import type { ReactNode } from 'react';

/**
 * LandingDevice — the bezel + glow frame a real product still sits in.
 *
 * Pass a `next/image` (or a plain `<img>`) as the child; the frame supplies
 * the bezel, the inner radius, the ambient glow and the caption. The child is
 * responsible for its own dimensions so there is no CLS.
 *
 * HONESTY: this frame is for REAL screenshots of the real product with
 * obviously fictional demo data. Never build a fake UI out of divs and put it
 * in here. If no honest still exists, use `variant="empty"` with a
 * typographic child instead.
 */
export interface LandingDeviceProps {
  children: ReactNode;
  /** 'window' draws a browser-ish top rail; 'plate' is a plain bezel. */
  chrome?: 'window' | 'plate';
  /** Mono label rendered in the top rail, e.g. "CRM / TODAY". */
  chromeLabel?: string;
  /** Short caption under the frame. Say what is on screen. */
  caption?: ReactNode;
  /** Ambient glow behind the frame. */
  glow?: 'cyan' | 'emerald' | 'none';
  /** Slight 3d tilt for hero use. Removed under reduced motion / < md. */
  tilt?: 'none' | 'left' | 'right';
  /** Aspect ratio the frame reserves, e.g. '16 / 10'. */
  ratio?: string;
  className?: string;
}

export function LandingDevice({
  children,
  chrome = 'window',
  chromeLabel,
  caption,
  glow = 'cyan',
  tilt = 'none',
  ratio,
  className,
}: LandingDeviceProps) {
  return (
    <figure
      className={['lp-device', className].filter(Boolean).join(' ')}
      data-glow={glow}
      data-tilt={tilt}
    >
      <div className="lp-device-frame">
        {chrome === 'window' ? (
          <div className="lp-device-chrome" aria-hidden="true">
            <span className="lp-device-dots">
              <i />
              <i />
              <i />
            </span>
            {chromeLabel ? (
              <span className="lp-device-chrome-label">{chromeLabel}</span>
            ) : null}
          </div>
        ) : null}
        <div
          className="lp-device-screen"
          style={ratio ? { aspectRatio: ratio } : undefined}
        >
          {children}
        </div>
      </div>
      {caption ? <figcaption className="lp-device-caption">{caption}</figcaption> : null}
    </figure>
  );
}
