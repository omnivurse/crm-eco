'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  ShieldCheck,
  Heart,
  ChatCircle,
  Stethoscope,
  CreditCard,
} from '@phosphor-icons/react';
import { cn } from '@crm-eco/ui/lib/utils';

const navItems = [
  { label: 'Home', href: '/', icon: House },
  { label: 'Coverage', href: '/coverage', icon: ShieldCheck },
  { label: 'Services', href: '/services', icon: Stethoscope },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Needs', href: '/needs', icon: Heart },
  { label: 'Support', href: '/support', icon: ChatCircle },
];

const excludedPrefixes = [
  '/agent',
  '/signin',
  '/signup',
  '/login',
  '/enroll',
  '/reset-password',
  '/update-password',
  '/access-denied',
  '/accept-invite',
];

export function BottomNav() {
  const pathname = usePathname();

  const shouldHide = excludedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (shouldHide) return null;

  return (
    <nav className="mp-dock md:hidden" aria-label="Mobile">
      {navItems.map((item) => {
        const isActive =
          item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-0.5 px-1.5 py-0.5 text-[0.6rem] font-semibold transition-colors duration-400',
              isActive ? 'text-[var(--mp-teal)]' : 'text-slate-500',
            )}
          >
            <Icon
              weight="light"
              aria-hidden
              className={cn('h-5 w-5', isActive ? 'text-[var(--mp-teal)]' : 'text-slate-500')}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
