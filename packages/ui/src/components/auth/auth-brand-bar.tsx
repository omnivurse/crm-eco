/**
 * AuthBrandBar — the phone's identity.
 *
 * v1's brand side was `hidden lg:flex`: below 1024px the entire product
 * identity disappeared and the page became a bare form on a white card. Most
 * sign-ins happen on a phone, so that was the wrong half to drop.
 *
 * This is the compact replacement: a masthead the height of a nav bar with
 * the strand running edge to edge and the product wordline sitting on it like
 * a station. It is ~5.25rem tall, so the email field is still above the fold
 * on a 667px viewport, and it deliberately carries NO logo — every auth form
 * already renders the wordmark directly beneath it.
 */

import { AuthRail } from './auth-rail';
import {
  AUTH_RAIL_STATIONS,
  AUTH_VARIANT_LABEL,
  type AuthVariant,
} from './auth-variant';

export interface AuthBrandBarProps {
  variant?: AuthVariant;
  /** Product wordline. Defaults to the variant's name. */
  label?: string;
  className?: string;
}

export function AuthBrandBar({
  variant = 'default',
  label,
  className,
}: AuthBrandBarProps) {
  const stations = AUTH_RAIL_STATIONS[variant] ?? AUTH_RAIL_STATIONS.default;

  return (
    <div
      className={['auth-brandbar', className].filter(Boolean).join(' ')}
      data-auth-variant={variant}
    >
      <AuthRail
        className="auth-brandbar-rail"
        orientation="horizontal"
        stations={stations}
        showStations={false}
        fade="ends"
      />
      <p className="auth-brandbar-inner">
        <span className="auth-brandbar-dot" aria-hidden="true" />
        <span className="auth-brandbar-label">{label ?? AUTH_VARIANT_LABEL[variant]}</span>
      </p>
    </div>
  );
}
