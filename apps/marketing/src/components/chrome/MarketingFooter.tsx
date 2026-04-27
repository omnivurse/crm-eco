import Link from 'next/link';
import { HelixMark } from '@/components/brand/HelixMark';

const columns = [
  {
    heading: 'Products',
    links: [
      { name: 'Admin Platform', href: '/admin' },
      { name: 'Sales & Enrollment CRM', href: '/crm' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'Changelog', href: '/changelog' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { name: 'Multi-tenancy', href: '/#platform' },
      { name: 'Security', href: '/#security' },
      { name: 'Integrations', href: '/#integrations' },
      { name: 'API & Webhooks', href: '/developers' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { name: 'About', href: '/about' },
      { name: 'Customers', href: '/#customers' },
      { name: 'Careers', href: '/careers' },
      { name: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { name: 'Terms', href: '/legal/terms' },
      { name: 'Privacy', href: '/legal/privacy' },
      { name: 'Trust & Compliance', href: '/legal/trust' },
      { name: 'DPA', href: '/legal/dpa' },
    ],
  },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-ink-950">
      <div aria-hidden="true" className="aurora-soft" />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Top brand row */}
        <div className="grid gap-12 py-16 lg:grid-cols-12 lg:gap-10 lg:py-20">
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <HelixMark className="h-8 w-8" />
              <span className="font-display text-[18px] font-semibold tracking-tight text-white">
                Double Helix
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-helix-mist">
              The two-strand operating system for modern healthcare
              organizations. Member management and sales automation, engineered
              to work as one.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="num-pill">SOC 2 in progress</span>
              <span className="num-pill">HIPAA-ready</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8 lg:gap-10">
            {columns.map((col) => (
              <div key={col.heading}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-helix-fog">
                  {col.heading}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.name}>
                      <Link
                        href={l.href}
                        className="text-sm text-white/75 transition-colors hover:text-white"
                      >
                        {l.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="hairline" />

        {/* Bottom bar */}
        <div className="flex flex-col gap-3 py-6 text-xs text-helix-fog sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Double Helix Software, Inc. All rights reserved.</p>
          <p className="font-mono tracking-tight">
            Built for healthcare operations · v1.0
          </p>
        </div>
      </div>
    </footer>
  );
}
