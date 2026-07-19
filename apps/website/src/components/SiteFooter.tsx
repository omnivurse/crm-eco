import Link from 'next/link';
import Image from 'next/image';
import { Phone, EnvelopeSimple, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import { BRAND, PORTAL_URL, PHONE, EMAIL, SOCIAL } from '@/lib/site';

const columns = [
  {
    heading: 'How It Works',
    links: [
      { name: 'How Sharing Works', href: '/how-it-works' },
      { name: 'Member Guidelines', href: '/legal/sharing-guidelines' },
      { name: 'FAQs', href: '/faq' },
      { name: 'About Us', href: '/about' },
    ],
  },
  {
    heading: 'Memberships',
    links: [
      { name: 'Individuals & Families', href: '/memberships/individuals' },
      { name: 'Companies & Teams', href: '/memberships/employers' },
      { name: 'Direct Primary Care', href: '/direct-primary-care' },
      { name: 'Plans & Pricing', href: '/plans' },
      { name: 'Member Services', href: '/services' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { name: 'Blog & Stories', href: '/blog' },
      { name: 'Member Reviews', href: '/reviews' },
      { name: 'Medical Advocacy', href: '/medical-advocacy' },
      { name: 'Giving Fund', href: '/giving-fund' },
      { name: 'For Advisors', href: '/for-advisors' },
    ],
  },
] as const;

const socialIcons = [
  { href: SOCIAL.facebook, label: 'Facebook', path: 'M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z' },
  { href: SOCIAL.twitter, label: 'X', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  { href: SOCIAL.linkedin, label: 'LinkedIn', path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
  { href: SOCIAL.instagram, label: 'Instagram', path: 'M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z' },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-8 overflow-hidden text-white">
      <div className="mx-4 mb-4 overflow-hidden rounded-[2rem] pif-grad-deep sm:mx-6 md:mx-8">
        {/* Pre-footer CTA strip */}
        <div className="border-b border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 py-14 sm:px-10 lg:flex-row lg:items-center lg:px-12">
            <div className="max-w-xl">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-pif-teal-200">
                Join the community
              </p>
              <h2 className="font-heading text-2xl font-medium tracking-[-0.02em] text-white sm:text-3xl">
                Healthcare you can actually afford — and a community that has your back.
              </h2>
              <p className="mt-3 text-white/65">Join in minutes. No open-enrollment window, ever.</p>
            </div>
            <Link
              href="/enroll"
              className="group inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 font-semibold text-pif-navy-800 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
            >
              Become a Member
              <span className="grid h-8 w-8 place-items-center rounded-full bg-pif-navy-800/5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
                <ArrowUpRight weight="light" className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>

        {/* Columns */}
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-14 sm:px-10 lg:px-12">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="col-span-2 lg:col-span-4">
              <Link href="/" className="mb-5 inline-flex items-center">
                <Image
                  src="/logo.png"
                  alt={BRAND.name}
                  width={200}
                  height={48}
                  className="h-10 w-auto object-contain brightness-0 invert"
                  loading="lazy"
                />
              </Link>
              <p className="mb-6 max-w-xs text-sm leading-relaxed text-white/65">
                A caring community where members share one another&apos;s medical costs — an affordable
                alternative to traditional health insurance. Welcoming to all, with no networks and no
                enrollment windows.
              </p>
              <div className="space-y-2 text-sm">
                <a href={`tel:${PHONE.tel}`} className="flex items-center gap-2 text-white/75 transition-colors hover:text-white">
                  <Phone weight="light" className="h-4 w-4 text-pif-teal-200" />
                  {PHONE.display}
                </a>
                <a href={`mailto:${EMAIL.general}`} className="flex items-center gap-2 text-white/75 transition-colors hover:text-white">
                  <EnvelopeSimple weight="light" className="h-4 w-4 text-pif-teal-200" />
                  {EMAIL.general}
                </a>
              </div>
              <div className="mt-6 flex items-center gap-2">
                {socialIcons.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/20 hover:text-white"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d={s.path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {columns.map((col) => (
              <div key={col.heading} className="lg:col-span-2">
                <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">{col.heading}</h3>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.name}>
                      <Link href={link.href} className="text-sm text-white/60 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white">
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="lg:col-span-2">
              <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90">Members</h3>
              <ul className="space-y-3">
                <li>
                  <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-white/60 transition-colors hover:text-white">
                    Member Portal
                  </a>
                </li>
                <li><Link href="/enroll" className="text-sm text-white/60 transition-colors hover:text-white">Become a Member</Link></li>
                <li><Link href="/contact" className="text-sm text-white/60 transition-colors hover:text-white">Contact Us</Link></li>
                <li><Link href="/legal/privacy" className="text-sm text-white/60 transition-colors hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/legal/terms" className="text-sm text-white/60 transition-colors hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Disclaimer + copyright */}
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
            <div className="mb-6 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
              <p className="text-xs leading-relaxed text-white/55">
                <strong className="font-semibold text-white/80">Important Notice:</strong> {BRAND.name} is a
                health care sharing program — it is <strong>NOT insurance</strong>. Members voluntarily share
                one another&apos;s eligible medical expenses. Participation is not a contract of insurance and
                does not guarantee that medical bills will be paid. The program is not subject to state
                insurance regulation and may not meet ACA / individual-mandate requirements in some states.
                Please review our{' '}
                <Link href="/legal/sharing-guidelines" className="text-white/80 underline underline-offset-2 hover:text-white">
                  Member Guidelines
                </Link>{' '}
                for complete details.
              </p>
            </div>
            <div className="flex flex-col items-center justify-between gap-2 text-xs text-white/45 sm:flex-row">
              <p>&copy; {year} {BRAND.name}. All rights reserved.</p>
              <p>A caring community, built on {BRAND.platform}.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
