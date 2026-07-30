import { BrandLogo } from '@crm-eco/ui';
import GradientMeshHero from './GradientMeshHero';
import QuoteRotator from './QuoteRotator';

export default function LoginHero() {
  return (
    <div className="relative w-full h-full flex flex-col justify-center">
      {/* Animated gradient mesh background */}
      <GradientMeshHero />

      {/* Content overlay */}
      <div className="relative z-10 px-12 xl:px-16">
        {/* Large bold headline */}
        <h1 className="text-5xl xl:text-6xl font-bold text-white mb-4 tracking-tight leading-[1.1] font-heading">
          <span className="block">Empowering</span>
          <span className="block bg-gradient-to-r from-[#5fb3bd] to-[#a5cdd1] bg-clip-text text-transparent">
            Healthier Lives
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-white/70 text-lg max-w-md mb-10 leading-relaxed">
          Building stronger communities through shared health and compassionate care.
        </p>

        {/* Rotating healthcare quotes */}
        <QuoteRotator />
      </div>

      {/* Bottom branding */}
      <div className="absolute bottom-12 left-12 xl:left-16 z-10">
        <BrandLogo variant="full" size="sm" tone="white" />
      </div>
    </div>
  );
}
