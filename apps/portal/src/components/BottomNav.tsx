'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Shield,
  Heart,
  MessageSquare,
  Stethoscope,
  DollarSign,
} from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

const navItems = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Coverage', href: '/coverage', icon: Shield },
  { label: 'Services', href: '/services', icon: Stethoscope },
  { label: 'Pricing', href: '/pricing', icon: DollarSign },
  { label: 'Needs', href: '/needs', icon: Heart },
  { label: 'Support', href: '/support', icon: MessageSquare },
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
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (shouldHide) return null;

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        'bg-white/95 backdrop-blur-sm border-t border-slate-200',
        'pb-[max(0.5rem,env(safe-area-inset-bottom))]'
      )}
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5',
                'text-xs font-medium transition-colors',
                isActive
                  ? 'text-teal-700'
                  : 'text-slate-400 active:text-slate-600'
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5',
                  isActive ? 'text-teal-700' : 'text-slate-400'
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
