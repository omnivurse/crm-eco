import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container-page flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <img src="/logo.svg" alt="Double Helix" width={140} height={32} className="h-8 w-auto" />
          <p className="mt-4 text-sm text-muted-foreground">
            The operating system for health benefits. Licensed SaaS for advisors, agencies, and
            TPAs.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Products</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/products/crm" className="hover:text-foreground">CRM Core</Link></li>
              <li><Link href="/products/admin" className="hover:text-foreground">Admin Enrollment</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link href="/legal/terms" className="hover:text-foreground">Terms</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Double Helix Software. All rights reserved.</span>
          <span>doublehelixhub.com</span>
        </div>
      </div>
    </footer>
  );
}
