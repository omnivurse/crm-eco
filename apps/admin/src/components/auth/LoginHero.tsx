import Image from 'next/image';

export default function LoginHero() {
  return (
    <div className="relative w-full h-full">
      {/* Background image */}
      <Image
        src="/login-hero.jpg"
        alt="Diverse community together"
        fill
        className="object-cover"
        priority
        sizes="(min-width: 1024px) 50vw, 0vw"
      />

      {/* Brand gradient overlay — purple/blue for admin identity */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#003560]/80 via-purple-600/50 to-blue-500/40" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.3)_100%)]" />

      {/* Bottom branding */}
      <div className="absolute bottom-12 left-12 z-10">
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
          <span className="bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">Admin Portal</span>
          <br />
          <span className="text-white/90">Pay It Forward</span>
        </h1>
        <p className="text-white/60 text-lg max-w-md">
          System administration and management console
        </p>
      </div>
    </div>
  );
}
