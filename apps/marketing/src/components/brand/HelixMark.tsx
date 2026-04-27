import { cn } from '@/lib/cn';

type HelixMarkProps = {
  className?: string;
  tone?: 'duo' | 'cyan' | 'violet' | 'mono';
};

/**
 * HelixMark
 *
 * Brand mark for Double Helix software. Two intertwined sinusoidal
 * strands suggesting a DNA helix from the side, with three connecting
 * "rungs" representing the platform's product surface points
 * (Admin, CRM, API).
 *
 * Pure SVG, scales to any size, no external assets.
 */
export function HelixMark({ className, tone = 'duo' }: HelixMarkProps) {
  const cyan = tone === 'mono' ? 'currentColor' : '#3DD6FF';
  const violet =
    tone === 'mono'
      ? 'currentColor'
      : tone === 'cyan'
        ? '#3DD6FF'
        : tone === 'violet'
          ? '#937DFF'
          : '#937DFF';

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="helix-stroke-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cyan} stopOpacity="0.95" />
          <stop offset="100%" stopColor={cyan} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="helix-stroke-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={violet} stopOpacity="0.55" />
          <stop offset="100%" stopColor={violet} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Rungs (base pairs) */}
      <line x1="11" y1="9" x2="21" y2="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="16" x2="23" y2="16" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="23" x2="21" y2="23" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />

      {/* Strand A — front */}
      <path
        d="M9 4 C 23 9, 9 16, 23 16 C 9 23, 23 28, 23 28"
        stroke="url(#helix-stroke-a)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Strand B — back */}
      <path
        d="M23 4 C 9 9, 23 16, 9 16 C 23 23, 9 28, 9 28"
        stroke="url(#helix-stroke-b)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Bead accents on the strand crossovers */}
      <circle cx="16" cy="16" r="1.6" fill={cyan} />
      <circle cx="16" cy="9" r="1.1" fill={violet} opacity="0.85" />
      <circle cx="16" cy="23" r="1.1" fill={violet} opacity="0.85" />
    </svg>
  );
}
