const TURNS = 3.2;
const CX = 200;
const RADIUS = 118;
const Y0 = 18;
const Y1 = 502;

type Point = { x: number; y: number; z: number };

function pointAt(y: number, phase: number): Point {
  const t = ((y - Y0) / (Y1 - Y0)) * Math.PI * 2 * TURNS + phase;
  return {
    x: CX + Math.sin(t) * RADIUS,
    y,
    z: Math.cos(t),
  };
}

function buildSegments(phase: number): { front: string[]; back: string[] } {
  const front: string[] = [];
  const back: string[] = [];
  let buffer = '';
  let lastFront: boolean | null = null;

  for (let y = Y0; y <= Y1; y += 2) {
    const point = pointAt(y, phase);
    const isFront = point.z >= 0;
    const token = `${point.x.toFixed(1)} ${point.y}`;
    if (lastFront === isFront) {
      buffer += `L${token}`;
    } else {
      if (buffer && lastFront !== null) {
        (lastFront ? front : back).push(buffer);
      }
      buffer = `M${token}`;
    }
    lastFront = isFront;
  }

  if (buffer && lastFront !== null) {
    (lastFront ? front : back).push(buffer);
  }

  return { front, back };
}

function buildRungs(): Array<{ y: number; x1: string; x2: string }> {
  const rungs: Array<{ y: number; x1: string; x2: string }> = [];
  for (let y = Y0 + 30; y <= Y1 - 24; y += 34) {
    const a = pointAt(y, 0);
    const b = pointAt(y, Math.PI);
    rungs.push({
      y,
      x1: a.x.toFixed(1),
      x2: b.x.toFixed(1),
    });
  }
  return rungs;
}

const STRAND_A = buildSegments(0);
const STRAND_B = buildSegments(Math.PI);
const RUNGS = buildRungs();

export interface LandingHelixProps {
  /** CRM leans cyan. MMS leans emerald. */
  tone?: 'cyan' | 'emerald';
  atmosphereSrc?: string;
}

export function LandingHelix({ tone = 'cyan', atmosphereSrc }: LandingHelixProps) {
  const glowId = `lpHelixGlow-${tone}`;

  return (
    <div className={`lp-helix-well lp-helix-${tone}`}>
      <div className="lp-helix-well-inner">
        {atmosphereSrc ? (
          <img
            src={atmosphereSrc}
            alt=""
            className="lp-helix-atmosphere"
            fetchPriority="high"
          />
        ) : null}
        <svg
          className="lp-helix-svg"
          viewBox="0 0 400 520"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {STRAND_A.back.map((d, i) => (
            <path key={`a-back-${i}`} className="lp-helix-strand lp-helix-strand-a lp-helix-strand-back" d={d} />
          ))}
          {STRAND_B.back.map((d, i) => (
            <path key={`b-back-${i}`} className="lp-helix-strand lp-helix-strand-b lp-helix-strand-back" d={d} />
          ))}
          {RUNGS.map((rung) => (
            <line
              key={rung.y}
              className="lp-helix-rung"
              x1={rung.x1}
              y1={rung.y}
              x2={rung.x2}
              y2={rung.y}
            />
          ))}
          {STRAND_A.front.map((d, i) => (
            <path
              key={`a-front-${i}`}
              className="lp-helix-strand lp-helix-strand-a lp-helix-strand-front"
              d={d}
              filter={`url(#${glowId})`}
            />
          ))}
          {STRAND_B.front.map((d, i) => (
            <path
              key={`b-front-${i}`}
              className="lp-helix-strand lp-helix-strand-b lp-helix-strand-front"
              d={d}
              filter={`url(#${glowId})`}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
