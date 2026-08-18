import type { AuthVariant } from './auth-variant';

export type { AuthVariant } from './auth-variant';

export interface AuthGradientMeshProps {
  variant?: AuthVariant;
  className?: string;
}

/**
 * Ambient wash behind the auth brand side.
 *
 * v1 drifted four blurred orbs on infinite 12-20s loops, painted from
 * hard-coded `rgba(6,182,212,…)` literals — a brochure effect on the front
 * door of a production system, and one that could not track the landing
 * palette. This is the same atmosphere read calmly: two fixed radial washes
 * mixed from the variant's own `--auth-tone` / `--auth-counter`, so it moves
 * with the family and does not move on screen at all.
 *
 * Kept as a named export because it is part of the published auth surface;
 * `AuthHeroPanel` renders it for you.
 */
export function AuthGradientMesh({ variant, className }: AuthGradientMeshProps) {
  return (
    <div
      className={['auth-hero-atmos', className].filter(Boolean).join(' ')}
      data-auth-variant={variant}
      aria-hidden="true"
    />
  );
}
