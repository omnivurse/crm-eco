import Link from 'next/link';
import { Heart } from 'lucide-react';

const footerLinks = {
  company: [
    { name: 'About Us', href: '/about' },
    { name: 'How It Works', href: '/how-it-works' },
    { name: 'Blog', href: '/blog' },
    { name: 'Contact', href: '/contact' },
  ],
  members: [
    { name: 'Plans & Pricing', href: '/plans' },
    { name: 'Enroll Now', href: '/enroll' },
    { name: 'Member Portal', href: process.env.NEXT_PUBLIC_PORTAL_URL || 'https://members.payitforwardhealth.com' },
    { name: 'FAQ', href: '/faq' },
  ],
  advisors: [
    { name: 'Become an Advisor', href: '/for-advisors' },
    { name: 'Advisor Portal', href: process.env.NEXT_PUBLIC_ADVISOR_PORTAL_URL || 'https://advisors.payitforwardhealth.com' },
  ],
  legal: [
    { name: 'Terms of Service', href: '/legal/terms' },
    { name: 'Privacy Policy', href: '/legal/privacy' },
    { name: 'Sharing Guidelines', href: '/legal/sharing-guidelines' },
  ],
};

export function SiteFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-white leading-tight">
                  Pay It Forward
                </span>
                <span className="text-xs text-teal-400 font-medium -mt-0.5">
                  Health
                </span>
              </div>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              A community of members sharing medical expenses together, promoting
              wellness and caring for one another.
            </p>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Members */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Members</h4>
            <ul className="space-y-2.5">
              {footerLinks.members.map((link) => (
                <li key={link.name}>
                  {link.href.startsWith('http') ? (
                    <a
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Advisors */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Advisors</h4>
            <ul className="space-y-2.5">
              {footerLinks.advisors.map((link) => (
                <li key={link.name}>
                  {link.href.startsWith('http') ? (
                    <a
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Disclaimer + Copyright */}
      <div className="border-t border-slate-800">
        <div className="container mx-auto px-4 py-6">
          <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-300">Important Notice:</strong> Pay It Forward Health
              is a health cost sharing ministry. It is NOT insurance. Members voluntarily share
              each other&apos;s medical expenses. This program does not guarantee payment of any
              medical expense. The ministry is not subject to state insurance regulation and may
              not satisfy ACA/healthcare mandate requirements in some states. Please review our
              Sharing Guidelines for full details.
            </p>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} Pay It Forward Health. All rights reserved.</p>
            <p>
              Built with care for our members and communities.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
