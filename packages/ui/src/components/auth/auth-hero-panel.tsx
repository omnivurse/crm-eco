import { BrandLogo } from '../brand-logo';
import { AuthGradientMesh } from './auth-gradient-mesh';
import { AuthQuoteRotator } from './auth-quote-rotator';

interface AuthHeroPanelProps {
  headline: React.ReactNode;
  subtitle: string;
  badge?: string;
  showQuotes?: boolean;
  children?: React.ReactNode;
}

export function AuthHeroPanel({ headline, subtitle, badge, showQuotes = true, children }: AuthHeroPanelProps) {
  return (
    <div className="relative w-full h-full flex flex-col justify-center">
      <AuthGradientMesh />

      <div className="relative z-10 px-12 xl:px-16">
        <h1 className="text-5xl xl:text-6xl font-bold text-white mb-4 tracking-tight leading-[1.1] font-heading">
          {headline}
        </h1>
        <p className="text-white/70 text-lg max-w-md mb-10 leading-relaxed">{subtitle}</p>
        {children}
        {showQuotes && <AuthQuoteRotator />}
      </div>

      <div className="absolute bottom-12 left-12 xl:left-16 z-10 flex flex-col gap-2">
        <BrandLogo variant="full" size="sm" tone="white" />
        {badge && (
          <p className="text-white/40 text-xs font-medium tracking-wider uppercase">{badge}</p>
        )}
      </div>
    </div>
  );
}
