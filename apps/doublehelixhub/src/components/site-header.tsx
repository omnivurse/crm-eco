import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.svg" alt="Double Helix" width={140} height={32} className="h-8 w-auto" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-foreground/80 md:flex">
          <Link href="/products/crm" className="hover:text-foreground">CRM Core</Link>
          <Link href="/products/admin" className="hover:text-foreground">Admin Enrollment</Link>
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/about" className="hover:text-foreground">About</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="https://crm.doublehelixhub.com"
            className="hidden text-sm font-medium text-foreground/80 hover:text-foreground sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="#request-access"
            className="inline-flex h-9 items-center rounded-md gradient-helix px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Request access
          </Link>
        </div>
      </div>
    </header>
  );
}
