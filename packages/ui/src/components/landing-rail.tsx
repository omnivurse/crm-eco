'use client';

/**
 * LandingRail — the signature.
 *
 * ONE inline SVG double helix used as the page spine. The two strands are the
 * two sides of the business (agent <-> member / sales <-> operations) and the
 * rungs are the records. A pulse travels the strand as you scroll, passing
 * through the record stations.
 *
 * Rules it keeps:
 *  - dependency-free (no framer-motion in @crm-eco/ui)
 *  - animates transform/opacity/stroke-dash only
 *  - the static composition is the finished design; the pulse is enhancement,
 *    so it looks right with JS off and under prefers-reduced-motion
 *  - the SVG is aria-hidden; station labels are real text
 */

import { useId, type CSSProperties } from 'react';
import {
  useMounted,
  usePrefersReducedMotion,
  useScrollProgress,
} from '../lib/landing-motion';

export interface LandingRailStation {
  id: string;
  label: string;
  caption?: string;
  /**
   * Money moment (commission / payout / billing). Paints the semantic amber
   * signal accent. Semantic only — never decoration.
   */
  signal?: boolean;
}

export interface LandingRailProps {
  /** CRM leads cyan, MMS leads emerald. */
  tone?: 'cyan' | 'emerald';
  stations: LandingRailStation[];
  orientation?: 'vertical' | 'horizontal';
  /** Render the station text. Off = decorative strand only. */
  showStations?: boolean;
  /** Accessible name for the station list. */
  label?: string;
  /**
   * 'ends' dissolves the strand at both ends so it reads as threading through
   * the page rather than as a floating object with two cut edges. Use it
   * wherever the rail runs behind other content (the hero).
   */
  fade?: 'none' | 'ends';
  className?: string;
}

/* ---- geometry ---------------------------------------------------------- */

const STEP = 132; // distance along the axis between stations
const CROSS = 132; // cross-axis extent of the viewBox
const CENTER = CROSS / 2;
const AMP = 41; // strand amplitude
const SAMPLE = 2; // px between samples

/**
 * Horizontal only: each record station grows a stem off the primary rung and
 * the station dot is docked to its end, so the labels hang FROM the strand
 * instead of floating in a row underneath it. The viewBox is cropped to the
 * strand + stem, which makes the SVG's bottom edge exactly the stem end — the
 * stylesheet then pulls the dot up by half its size to sit on it.
 */
const STEM = 30;
const H_TOP = CENTER - AMP - 6;
const H_HEIGHT = CENTER + AMP + STEM - H_TOP;

/**
 * theta advances by PI per station, so:
 *  - strands are at maximum separation exactly at each station (a readable rung)
 *  - strands cross exactly midway between stations (one full turn per two stations)
 */
const theta = (s: number, phase: number) => (Math.PI * s) / STEP + phase;

type Pt = { x: number; y: number; z: number };

function pointAt(s: number, phase: number, horizontal: boolean): Pt {
  const t = theta(s, phase);
  const off = CENTER + Math.sin(t) * AMP;
  return horizontal ? { x: s, y: off, z: Math.cos(t) } : { x: off, y: s, z: Math.cos(t) };
}

interface Strand {
  front: string[];
  back: string[];
  full: string;
  length: number;
}

function buildStrand(total: number, phase: number, horizontal: boolean): Strand {
  const front: string[] = [];
  const back: string[] = [];
  let buffer = '';
  let wasFront: boolean | null = null;
  let full = '';
  let length = 0;
  let prev: Pt | null = null;
  let prevToken: string | null = null;

  for (let s = 0; s <= total; s += SAMPLE) {
    const p = pointAt(s, phase, horizontal);
    const token = `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    full += prev ? `L${token}` : `M${token}`;
    if (prev) length += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;

    const isFront = p.z >= 0;
    if (wasFront === isFront) {
      buffer += `L${token}`;
    } else {
      if (buffer && wasFront !== null) (wasFront ? front : back).push(buffer);
      // Start the new segment at the previous point so front/back meet
      // without a visible gap at the depth seam.
      buffer = prevToken ? `M${prevToken}L${token}` : `M${token}`;
    }
    wasFront = isFront;
    prevToken = token;
  }
  if (buffer && wasFront !== null) (wasFront ? front : back).push(buffer);

  return { front, back, full, length };
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

/* ---- component --------------------------------------------------------- */

export function LandingRail({
  tone = 'cyan',
  stations,
  orientation = 'vertical',
  showStations = true,
  label = 'Record stations',
  fade = 'none',
  className,
}: LandingRailProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduced = usePrefersReducedMotion();
  const mounted = useMounted();
  const horizontal = orientation === 'horizontal';

  const { ref, progress } = useScrollProgress<HTMLDivElement>({
    disabled: reduced,
    start: horizontal ? 0.82 : 0.92,
    end: horizontal ? 0.42 : 0.24,
  });

  const count = Math.max(stations.length, 1);
  const total = count * STEP;
  const strandA = buildStrand(total, 0, horizontal);
  const strandB = buildStrand(total, Math.PI, horizontal);
  const rungs = buildRungs(count, horizontal);

  const viewBox = horizontal
    ? `0 ${H_TOP} ${total} ${H_HEIGHT}`
    : `0 0 ${CROSS} ${total}`;
  const gradId = `lpRailGrad${uid}`;
  const gradBId = `lpRailGradB${uid}`;
  const glowId = `lpRailGlow${uid}`;

  // Under reduced motion the strand reads as fully charged: a finished,
  // intentional static composition rather than a half-drawn animation.
  const charge = reduced ? 1 : mounted ? progress : 0;
  const pulseOn = mounted && !reduced;
  const len = strandA.length;
  const tail = len * 0.11;
  const head = len * charge;

  const stationTone = (station: LandingRailStation, index: number) => {
    if (station.signal) return 'signal';
    return index / Math.max(count - 1, 1) < 0.5 ? 'a' : 'b';
  };

  const stationAt = (index: number) => (index + 0.5) / count;
  const isActive = (index: number) => charge >= stationAt(index) - 0.02;

  return (
    <div
      ref={ref}
      className={['lp-spine', className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-orientation={orientation}
      data-fade={fade === 'none' ? undefined : fade}
      data-stations={count}
      style={{ '--lp-spine-steps': count } as CSSProperties}
    >
      <div className="lp-spine-canvas">
        <svg
          className="lp-spine-svg"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
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
              <stop offset="0%" style={{ stopColor: 'var(--lp-strand-a)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--lp-strand-b)' }} />
            </linearGradient>
            <linearGradient
              id={gradBId}
              x1="0"
              y1="0"
              x2={horizontal ? '1' : '0'}
              y2={horizontal ? '0' : '1'}
            >
              <stop offset="0%" style={{ stopColor: 'var(--lp-strand-b)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--lp-strand-a)' }} />
            </linearGradient>
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g className="lp-spine-back">
            {strandA.back.map((d, i) => (
              <path key={`ab${i}`} className="lp-spine-strand" d={d} stroke={`url(#${gradId})`} />
            ))}
            {strandB.back.map((d, i) => (
              <path key={`bb${i}`} className="lp-spine-strand" d={d} stroke={`url(#${gradBId})`} />
            ))}
          </g>

          <g className="lp-spine-rungs">
            {rungs.map((r) => (
              <line
                key={r.key}
                className="lp-spine-rung"
                data-primary={r.primary ? 'true' : undefined}
                x1={r.x1.toFixed(2)}
                y1={r.y1.toFixed(2)}
                x2={r.x2.toFixed(2)}
                y2={r.y2.toFixed(2)}
              />
            ))}
          </g>

          <g className="lp-spine-front">
            {strandA.front.map((d, i) => (
              <path key={`af${i}`} className="lp-spine-strand" d={d} stroke={`url(#${gradId})`} />
            ))}
            {strandB.front.map((d, i) => (
              <path key={`bf${i}`} className="lp-spine-strand" d={d} stroke={`url(#${gradBId})`} />
            ))}
          </g>

          {horizontal ? (
            <g className="lp-spine-stems">
              {stations.map((station, i) => {
                const x = ((i + 0.5) * STEP).toFixed(2);
                return (
                  <line
                    key={`stem-${station.id}`}
                    className="lp-spine-stem"
                    data-tone={stationTone(station, i)}
                    data-active={isActive(i) ? 'true' : undefined}
                    x1={x}
                    y1={(CENTER + AMP).toFixed(2)}
                    x2={x}
                    y2={(CENTER + AMP + STEM).toFixed(2)}
                  />
                );
              })}
            </g>
          ) : null}

          {pulseOn ? (
            <g className="lp-spine-pulse" filter={`url(#${glowId})`}>
              <path
                className="lp-spine-comet"
                d={strandA.full}
                strokeDasharray={`${tail.toFixed(2)} ${(len + 1).toFixed(2)}`}
                strokeDashoffset={(tail - head).toFixed(2)}
              />
              <path
                className="lp-spine-bead"
                d={strandA.full}
                strokeDasharray={`0.01 ${(len + 1).toFixed(2)}`}
                strokeDashoffset={(0.01 - head).toFixed(2)}
              />
            </g>
          ) : null}
        </svg>

        {showStations ? (
          <ol className="lp-spine-stations" aria-label={label}>
            {stations.map((station, i) => {
              const t = stationAt(i);
              const active = isActive(i);
              return (
                <li
                  key={station.id}
                  className="lp-spine-station"
                  data-active={active ? 'true' : undefined}
                  data-tone={stationTone(station, i)}
                  style={{ '--lp-station-t': `${(t * 100).toFixed(3)}%` } as CSSProperties}
                >
                  <span className="lp-spine-station-dot" aria-hidden="true" />
                  <span className="lp-spine-station-text">
                    <span className="lp-spine-station-index">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="lp-spine-station-label">{station.label}</span>
                    {station.caption ? (
                      <span className="lp-spine-station-caption">{station.caption}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
