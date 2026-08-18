'use client';

/**
 * AuthRail — the record rail, calm edition.
 *
 * Same signature as `LandingRail` (packages/ui/src/components/landing-rail.tsx):
 * two strands that cross exactly midway between stations and sit at maximum
 * separation ON each station, so every station reads as a rung and every rung
 * reads as a record. Same geometry constants, same `--auth-strand-*` /
 * `--lp-strand-dim` tokens, same `tone` / `stations` / `orientation` /
 * `showStations` / `fade` vocabulary.
 *
 * TWO deliberate differences from the landing rail, both because auth is a
 * product surface and not a marketing page:
 *
 *  1. It is FINISHED, not scroll-charged. `LandingRail` derives its charge
 *     from `useScrollProgress`; the auth shell is a single 100dvh screen that
 *     does not scroll, so that rail would sit permanently ~55% lit — it would
 *     look like a bug. Here every station is on and nothing animates.
 *  2. It STRETCHES to its container (`preserveAspectRatio="none"` +
 *     `vector-effect: non-scaling-stroke`), so the spine spans the whole brand
 *     panel at any viewport height instead of being sized by station count.
 *     The stroke widths stay in real pixels, so nothing smears.
 *
 * It carries its own `.auth-rail-*` classes rather than `.lp-spine-*` because
 * `landing.css` is not loaded on auth surfaces and must not be — see the
 * header comment in packages/ui/src/styles/auth.css.
 *
 * The SVG is aria-hidden; station labels, when shown, are real text in an <ol>.
 */

import { useId, type CSSProperties } from 'react';

export interface AuthRailStation {
  id: string;
  label: string;
  caption?: string;
}

export interface AuthRailProps {
  /**
   * Force a lead colour. The default, 'inherit', takes whatever the
   * surrounding `[data-auth-variant]` set — so the rail can never disagree
   * with the page about which product this is.
   */
  tone?: 'cyan' | 'emerald' | 'inherit';
  stations: AuthRailStation[];
  orientation?: 'vertical' | 'horizontal';
  /** Render the station text. Off = structural strand only. */
  showStations?: boolean;
  /** Accessible name for the station list. */
  label?: string;
  /** 'ends' dissolves both ends so the strand threads through the panel. */
  fade?: 'none' | 'ends';
  className?: string;
}

/* ---- geometry (identical to LandingRail) -------------------------------- */

const STEP = 132;
const CROSS = 132;
const CENTER = CROSS / 2;
const AMP = 41;
const SAMPLE = 2;
/** Vertical padding of the horizontal viewBox, so round caps are not clipped. */
const H_PAD = 8;

/** theta advances by PI per station: one full turn per two stations. */
const theta = (s: number, phase: number) => (Math.PI * s) / STEP + phase;

interface Pt {
  x: number;
  y: number;
  z: number;
}

function pointAt(s: number, phase: number, horizontal: boolean): Pt {
  const t = theta(s, phase);
  const off = CENTER + Math.sin(t) * AMP;
  return horizontal ? { x: s, y: off, z: Math.cos(t) } : { x: off, y: s, z: Math.cos(t) };
}

interface Strand {
  front: string[];
  back: string[];
}

/**
 * Splits the strand into the segments in front of the axis and the segments
 * behind it, so the two ribbons read as one twisting object rather than two
 * crossing lines.
 */
function buildStrand(total: number, phase: number, horizontal: boolean): Strand {
  const front: string[] = [];
  const back: string[] = [];
  let buffer = '';
  let wasFront: boolean | null = null;
  let prevToken: string | null = null;

  for (let s = 0; s <= total; s += SAMPLE) {
    const p = pointAt(s, phase, horizontal);
    const token = `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    const isFront = p.z >= 0;

    if (wasFront === isFront) {
      buffer += `L${token}`;
    } else {
      if (buffer && wasFront !== null) (wasFront ? front : back).push(buffer);
      // Start at the previous point so front and back meet with no gap at
      // the depth seam.
      buffer = prevToken ? `M${prevToken}L${token}` : `M${token}`;
    }
    wasFront = isFront;
    prevToken = token;
  }
  if (buffer && wasFront !== null) (wasFront ? front : back).push(buffer);

  return { front, back };
}

interface Rung {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  primary: boolean;
}

const MINOR_OFFSETS = [-0.4, -0.22, 0.22, 0.4];

function buildRungs(count: number, horizontal: boolean): Rung[] {
  const rungs: Rung[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = (i + 0.5) * STEP;
    const push = (s: number, key: string, primary: boolean) => {
      const a = pointAt(s, 0, horizontal);
      const b = pointAt(s, Math.PI, horizontal);
      rungs.push({ key, x1: a.x, y1: a.y, x2: b.x, y2: b.y, primary });
    };
    MINOR_OFFSETS.forEach((o, j) => push(base + o * STEP, `m-${i}-${j}`, false));
    push(base, `p-${i}`, true);
  }
  return rungs;
}

/* ---- component ---------------------------------------------------------- */

export function AuthRail({
  tone = 'inherit',
  stations,
  orientation = 'vertical',
  showStations = false,
  label = 'Record stations',
  fade = 'ends',
  className,
}: AuthRailProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const horizontal = orientation === 'horizontal';

  const count = Math.max(stations.length, 1);
  const total = count * STEP;
  const strandA = buildStrand(total, 0, horizontal);
  const strandB = buildStrand(total, Math.PI, horizontal);
  const rungs = buildRungs(count, horizontal);

  const viewBox = horizontal
    ? `0 ${CENTER - AMP - H_PAD} ${total} ${2 * (AMP + H_PAD)}`
    : `0 0 ${CROSS} ${total}`;

  const gradId = `authRailA${uid}`;
  const gradBId = `authRailB${uid}`;

  const stationTone = (index: number) =>
    index / Math.max(count - 1, 1) < 0.5 ? 'a' : 'b';

  return (
    <div
      className={['auth-rail', className].filter(Boolean).join(' ')}
      data-tone={tone === 'inherit' ? undefined : tone}
      data-orientation={orientation}
      data-fade={fade === 'none' ? undefined : fade}
      data-stations={showStations ? 'true' : undefined}
    >
      <div className="auth-rail-canvas">
        <svg
          className="auth-rail-svg"
          viewBox={viewBox}
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient
              id={gradId}
              x1="0"
              y1="0"
              x2={horizontal ? '1' : '0'}
              y2={horizontal ? '0' : '1'}
            >
              <stop offset="0%" style={{ stopColor: 'var(--auth-strand-a)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--auth-strand-b)' }} />
            </linearGradient>
            <linearGradient
              id={gradBId}
              x1="0"
              y1="0"
              x2={horizontal ? '1' : '0'}
              y2={horizontal ? '0' : '1'}
            >
              <stop offset="0%" style={{ stopColor: 'var(--auth-strand-b)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--auth-strand-a)' }} />
            </linearGradient>
          </defs>

          <g className="auth-rail-back">
            {strandA.back.map((d, i) => (
              <path
                key={`ab${i}`}
                className="auth-rail-strand"
                data-strand="a"
                d={d}
                stroke={`url(#${gradId})`}
              />
            ))}
            {strandB.back.map((d, i) => (
              <path
                key={`bb${i}`}
                className="auth-rail-strand"
                data-strand="b"
                d={d}
                stroke={`url(#${gradBId})`}
              />
            ))}
          </g>

          <g className="auth-rail-rungs">
            {rungs.map((r) => (
              <line
                key={r.key}
                className="auth-rail-rung"
                data-primary={r.primary ? 'true' : undefined}
                x1={r.x1.toFixed(2)}
                y1={r.y1.toFixed(2)}
                x2={r.x2.toFixed(2)}
                y2={r.y2.toFixed(2)}
              />
            ))}
          </g>

          <g className="auth-rail-front">
            {strandA.front.map((d, i) => (
              <path
                key={`af${i}`}
                className="auth-rail-strand"
                data-strand="a"
                d={d}
                stroke={`url(#${gradId})`}
              />
            ))}
            {strandB.front.map((d, i) => (
              <path
                key={`bf${i}`}
                className="auth-rail-strand"
                data-strand="b"
                d={d}
                stroke={`url(#${gradBId})`}
              />
            ))}
          </g>
        </svg>

        {showStations ? (
          <ol className="auth-rail-stations" aria-label={label}>
            {stations.map((station, i) => (
              <li
                key={station.id}
                className="auth-rail-station"
                data-tone={stationTone(i)}
                style={
                  {
                    '--auth-station-t': `${(((i + 0.5) / count) * 100).toFixed(3)}%`,
                  } as CSSProperties
                }
              >
                <span className="auth-rail-station-dot" aria-hidden="true" />
                <span className="auth-rail-station-text">
                  <span className="auth-rail-station-index">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="auth-rail-station-label">{station.label}</span>
                  {station.caption ? (
                    <span className="auth-rail-station-caption">{station.caption}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
