import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';

export function SiteFooter() {
  return (
    <footer className="relative z-[1] px-4 pb-6 sm:px-6 md:px-8">
      <div className="dh-bezel mx-auto max-w-6xl">
        <div className="dh-bezel-inner">
          <div className="flex flex-col gap-10 px-6 py-12 sm:px-10 md:flex-row md:items-start md:justify-between md:px-12">
            <div className="max-w-sm">
              <img
                src="/logo.svg"
                alt="Double Helix"
                width={140}
                height={32}
                className="dh-logo !h-8"
              />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                The operating system for health benefits. Licensed SaaS for advisors, agencies, and TPAs.
              </p>
              <Link
                href="/#request-access"
                className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:gap-3"
              >
                Request access
                <ArrowUpRight weight="light" className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Products</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li><Link href="/products/crm" className="transition-colors hover:text-foreground">CRM Core</Link></li>
                  <li><Link href="/products/admin" className="transition-colors hover:text-foreground">Admin Enrollment</Link></li>
                  <li><Link href="/pricing" className="transition-colors hover:text-foreground">Pricing</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Company</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li><Link href="/about" className="transition-colors hover:text-foreground">About</Link></li>
                  <li><Link href="/contact" className="transition-colors hover:text-foreground">Contact</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/80">Legal</h4>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li><Link href="/legal/privacy" className="transition-colors hover:text-foreground">Privacy</Link></li>
                  <li><Link href="/legal/sms-privacy" className="transition-colors hover:text-foreground">SMS Privacy</Link></li>
                  <li><Link href="/legal/terms" className="transition-colors hover:text-foreground">Terms</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-border px-6 py-4 sm:px-10 md:px-12">
            <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground/80 sm:flex-row">
              <span>© {new Date().getFullYear()} Double Helix Software. All rights reserved.</span>
              <span>doublehelixhub.com</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
