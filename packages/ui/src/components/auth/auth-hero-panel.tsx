import { BrandLogo } from '../brand-logo';
import { AuthGradientMesh } from './auth-gradient-mesh';
import { AuthQuoteRotator } from './auth-quote-rotator';
import { AuthRail, type AuthRailStation } from './auth-rail';
import { AUTH_RAIL_STATIONS, type AuthVariant } from './auth-variant';

export interface AuthHeroPanelProps {
  /* --- unchanged contract (four apps depend on these) --- */
  headline: React.ReactNode;
  subtitle: string;
  badge?: string;
  showQuotes?: boolean;
  variant?: AuthVariant;
  quotes?: Array<{ text: string; author: string }>;
  children?: React.ReactNode;

  /* --- added, all optional --- */
  /**
   * The record types the strand turns through. Fixes the rail's geometry.
   * Defaults to the variant's set (AUTH_RAIL_STATIONS).
   */
  stations?: AuthRailStation[];
  /**
   * Render the station names beside the strand. OFF by default: the labels
   * would be new copy on a production sign-in page, and below 1280px there is
   * no room for them anyway (auth.css hides them there).
   */
  showRailStations?: boolean;
  /** Drop the strand entirely. */
  showRail?: boolean;
  /** Small print under the wordmark. Defaults to 'Double Helix Software'. */
  footNote?: string;
  className?: string;
}

/**
 * The brand side of an auth split, in the landing family.
 *
 * Built on `--lp-*` (through the derived `--auth-*` tokens) and the landing
 * display/mono faces, so it genuinely matches the marketing pages instead of
 * approximating them with Tailwind literals — which it could never do anyway,
 * since the CRM and Admin consoles remap Tailwind's `cyan` scale onto Muted
 * Spruce (packages/ui/tailwind.preset.ts).
 *
 * The record rail is the panel's structural left gutter: it runs the full
 * height and dissolves at both ends, so it reads as threading through the
 * page. It is finished and motionless — see auth-rail.tsx.
 *
 * Shown at lg and up. `AuthSplitLayout` renders `AuthBrandBar` below that.
 */
export function AuthHeroPanel({
  headline,
  subtitle,
  badge,
  showQuotes = true,
  variant = 'default',
  quotes,
  children,
  stations,
  showRailStations = false,
  showRail = true,
  footNote = 'Double Helix Software',
  className,
}: AuthHeroPanelProps) {
  const railStations =
    stations ?? AUTH_RAIL_STATIONS[variant] ?? AUTH_RAIL_STATIONS.default;

  return (
    <div
      className={['auth-hero', className].filter(Boolean).join(' ')}
      data-auth-variant={variant}
    >
      <AuthGradientMesh variant={variant} />

      {showRail ? (
        <AuthRail
          className="auth-hero-rail"
          orientation="vertical"
          stations={railStations}
          showStations={showRailStations}
          fade="ends"
          label="Record types on this strand"
        />
      ) : null}

      <div className="auth-hero-col">
        <div className="auth-hero-body">
          {badge ? <p className="auth-hero-eyebrow">{badge}</p> : null}
          <h1 className="auth-hero-display">{headline}</h1>
          <p className="auth-hero-lede">{subtitle}</p>
          {children ? <div className="auth-hero-slot">{children}</div> : null}
          {showQuotes ? <AuthQuoteRotator quotes={quotes} /> : null}
        </div>

        <div className="auth-hero-foot">
          <BrandLogo variant="full" size="sm" tone="auto" />
          {footNote ? <p className="auth-hero-footline">{footNote}</p> : null}
        </div>
      </div>
    </div>
  );
}
