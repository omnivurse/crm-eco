import Link from 'next/link';
import Image from 'next/image';

const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL ||
  'https://members.doublehelixhub.com';

const footerColumns = {
  company: {
    heading: 'Company',
    links: [
      { name: 'About Us', href: '/about' },
      { name: 'How It Works', href: '/how-it-works' },
      { name: 'Blog', href: '/blog' },
      { name: 'Contact', href: '/contact' },
    ],
  },
  members: {
    heading: 'Members',
    links: [
      { name: 'Plans & Pricing', href: '/plans' },
      { name: 'Enroll Now', href: '/enroll' },
      { name: 'Member Portal', href: PORTAL_URL, external: true },
      { name: 'FAQ', href: '/faq' },
    ],
  },
  advisors: {
    heading: 'Advisors',
    links: [
      { name: 'Become an Advisor', href: '/for-advisors' },
    ],
  },
  legal: {
    heading: 'Legal',
    links: [
      { name: 'Terms of Service', href: '/legal/terms' },
      { name: 'Privacy Policy', href: '/legal/privacy' },
      { name: 'Sharing Guidelines', href: '/legal/sharing-guidelines' },
    ],
  },
} as const;

type FooterLink = { name: string; href: string; external?: boolean };

function FooterLinkItem({ link }: { link: FooterLink }) {
  const className =
    'text-sm text-slate-400 hover:text-white transition-colors duration-200';

  if (link.external) {
    return (
      <a
        href={link.href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {link.name}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {link.name}
    </Link>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: readonly FooterLink[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">
        {heading}
      </h4>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.name}>
            <FooterLinkItem link={link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0F1B2D]">
      {/* ─── Upper Section: Columns ─── */}
      <div className="container mx-auto px-4 pt-16 pb-12">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Brand Column (wider) */}
          <div className="col-span-2 lg:col-span-4">
            <Link href="/" className="inline-flex items-center mb-5">
              <Image
                src="/logo.png"
                alt="Double Helix Hub"
                width={180}
                height={48}
                className="h-10 w-auto object-contain brightness-0 invert"
                loading="lazy"
              />
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs mb-6">
              A community of members sharing medical expenses together,
              promoting wellness and caring for one another through faith-based
              health sharing.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                aria-label="Facebook"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                aria-label="X (Twitter)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                aria-label="LinkedIn"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors duration-200"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Link Columns */}
          <div className="lg:col-span-2">
            <FooterColumn heading={footerColumns.company.heading} links={footerColumns.company.links} />
          </div>
          <div className="lg:col-span-2">
            <FooterColumn heading={footerColumns.members.heading} links={footerColumns.members.links} />
          </div>
          <div className="lg:col-span-2">
            <FooterColumn heading={footerColumns.advisors.heading} links={footerColumns.advisors.links} />
          </div>
          <div className="lg:col-span-2">
            <FooterColumn heading={footerColumns.legal.heading} links={footerColumns.legal.links} />
          </div>
        </div>
      </div>

      {/* ─── Lower Section: Disclaimer + Copyright ─── */}
      <div className="border-t border-slate-700/50">
        <div className="container mx-auto px-4 py-8">
          {/* Disclaimer */}
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-300 font-semibold">
                Important Notice:
              </strong>{' '}
              Double Helix Hub is a health cost sharing ministry. It is NOT
              insurance. Members voluntarily share each other&apos;s medical
              expenses. This program does not guarantee payment of any medical
              expense. The ministry is not subject to state insurance regulation
              and may not satisfy ACA/healthcare mandate requirements in some
              states. Please review our{' '}
              <Link
                href="/legal/sharing-guidelines"
                className="text-slate-300 underline underline-offset-2 hover:text-white transition-colors"
              >
                Sharing Guidelines
              </Link>{' '}
              for full details.
            </p>
          </div>

          {/* Copyright */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} Double Helix Hub. All
              rights reserved.
            </p>
            <p>Built with care for our members.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
