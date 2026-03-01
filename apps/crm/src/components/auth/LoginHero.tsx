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
        sizes="(min-width: 1280px) 58vw, (min-width: 1024px) 55vw, 0vw"
      />

      {/* Brand gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#003560]/80 via-[#069B9A]/60 to-[#027343]/50" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.3)_100%)]" />

      {/* Bottom branding */}
      <div className="absolute bottom-12 left-12 z-10">
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
          Pay It Forward
        </h1>
        <p className="text-white/70 text-lg max-w-md">
          Empowering healthier communities, together
        </p>
      </div>
    </div>
  );
}
