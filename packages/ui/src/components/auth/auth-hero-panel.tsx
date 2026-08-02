import { BrandLogo } from '../brand-logo';
import { AuthGradientMesh, type AuthVariant } from './auth-gradient-mesh';
import { AuthQuoteRotator } from './auth-quote-rotator';

interface AuthHeroPanelProps {
  headline: React.ReactNode;
  subtitle: string;
  badge?: string;
  showQuotes?: boolean;
  variant?: AuthVariant;
  quotes?: Array<{ text: string; author: string }>;
  children?: React.ReactNode;
}

export function AuthHeroPanel({
  headline,
  subtitle,
  badge,
  showQuotes = true,
  variant = 'default',
  quotes,
  children,
}: AuthHeroPanelProps) {
  const accentDot =
    variant === 'admin'
      ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_0_3px_rgba(5,150,105,0.2)]'
      : 'bg-cyan-500 dark:bg-cyan-400 shadow-[0_0_0_3px_rgba(6,182,212,0.18)]';

  return (
    <div className="relative flex h-full w-full flex-col justify-center">
      <AuthGradientMesh variant={variant} />

      <div className="relative z-10 px-12 xl:px-16">
        {badge && (
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--auth-hairline)] bg-[var(--auth-input-bg)] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--auth-muted)]">
            <span className={`h-1.5 w-1.5 rounded-full ${accentDot}`} />
            {badge}
          </span>
        )}
        <h1 className="mb-5 font-heading text-5xl font-bold leading-[1.05] tracking-[-0.04em] text-[var(--auth-text)] xl:text-6xl">
          {headline}
        </h1>
        <p className="mb-10 max-w-md text-lg leading-relaxed text-[var(--auth-muted)]">{subtitle}</p>
        {children}
        {showQuotes && <AuthQuoteRotator quotes={quotes} />}
      </div>

      <div className="absolute bottom-12 left-12 z-10 flex flex-col gap-2 xl:left-16">
        <BrandLogo variant="full" size="sm" tone="auto" />
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--auth-muted)]">
          Double Helix Software
        </p>
      </div>
    </div>
  );
}
