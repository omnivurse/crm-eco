import LoginHero from '@/components/auth/LoginHero';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-row" style={{ background: '#030712' }}>
      {/* Left: Hero — hidden on mobile, 55-58% on desktop */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[58%] relative" style={{ background: '#030712' }}>
        <LoginHero />
      </div>

      {/* Right: form panel — full width mobile, 45-42% desktop */}
      <div className="w-full lg:w-[45%] xl:w-[42%] flex items-center justify-center p-8" style={{ background: '#0a1628' }}>
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
