import TwoPathsScene from '@/components/auth/TwoPathsScene';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-row">
      {/* Left: Two Paths illustration — hidden on mobile, 55-58% on desktop */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[58%] relative bg-[#0f0f1a]">
        <TwoPathsScene />
      </div>

      {/* Right: form panel — full width mobile, 45-42% desktop */}
      <div className="w-full lg:w-[45%] xl:w-[42%] flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
