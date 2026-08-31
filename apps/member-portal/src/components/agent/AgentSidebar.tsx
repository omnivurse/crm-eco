'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { cn } from '@crm-eco/ui';
import {
  SquaresFour,
  Users,
  FileText,
  CurrencyDollar,
  ShareNetwork,
  User,
  Gear,
  Link as LinkIcon,
  ChartBar,
  Heart,
  Sparkle,
  X,
  SignOut,
} from '@phosphor-icons/react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/agent', icon: <SquaresFour weight="light" className="h-5 w-5" /> },
  { label: 'My Members', href: '/agent/members', icon: <Users weight="light" className="h-5 w-5" /> },
  { label: 'Enrollments', href: '/agent/enrollments', icon: <FileText weight="light" className="h-5 w-5" /> },
  { label: 'Commissions', href: '/agent/commissions', icon: <CurrencyDollar weight="light" className="h-5 w-5" /> },
  { label: 'Enrollment Links', href: '/agent/links', icon: <LinkIcon weight="light" className="h-5 w-5" /> },
  { label: 'Downline', href: '/agent/downline', icon: <ShareNetwork weight="light" className="h-5 w-5" /> },
  { label: 'Reports', href: '/agent/reports', icon: <ChartBar weight="light" className="h-5 w-5" /> },
];

const bottomNavItems: NavItem[] = [
  { label: 'Profile', href: '/agent/profile', icon: <User weight="light" className="h-5 w-5" /> },
  { label: 'Settings', href: '/agent/settings', icon: <Gear weight="light" className="h-5 w-5" /> },
];

interface AgentSidebarProps {
  agent?: {
    id: string;
    first_name: string;
    last_name: string;
    company_name?: string | null;
    logo_url?: string | null;
    primary_color?: string;
  };
  mobileMenuOpen?: boolean;
  onMobileClose?: () => void;
}

export function AgentSidebar({ agent, mobileMenuOpen = false, onMobileClose }: AgentSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLinkClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/signin');
    router.refresh();
  };

  const sidebarContent = (
    <div className="relative z-10 flex h-full min-h-0 flex-col">
      <div className="relative">
        <div className="h-1 bg-gradient-to-r from-[var(--mp-teal)] via-[var(--mp-teal-soft)] to-[#12a065]" />

        <div className="flex h-16 items-center justify-between border-b border-[rgba(11,109,133,0.08)] px-5">
          <Link href="/agent" className="group flex items-center gap-3" onClick={handleLinkClick}>
            {agent?.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element -- dynamic external logo, unoptimized is appropriate */
              <img
                src={agent.logo_url}
                alt={agent.company_name || 'Agent'}
                className="h-10 w-10 rounded-xl object-contain bg-white p-1 shadow-sm"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--mp-teal)] shadow-[0_8px_20px_rgba(11,109,133,0.18)] transition-shadow group-hover:shadow-[0_10px_24px_rgba(11,109,133,0.24)]">
                <Heart weight="light" className="h-5 w-5 text-white" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="max-w-[140px] truncate text-lg font-bold tracking-tight text-[var(--mp-ink)]">
                {agent?.company_name || 'Agent Portal'}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--mp-teal)]">
                Portal
              </span>
            </div>
          </Link>
          <button
            onClick={onMobileClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-[rgba(11,109,133,0.08)] hover:text-[var(--mp-teal)] lg:hidden"
            aria-label="Close menu"
          >
            <X weight="light" className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/agent' && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-[var(--mp-teal)] text-white shadow-[0_8px_20px_rgba(11,109,133,0.2)]'
                  : 'text-slate-600 hover:bg-[rgba(11,109,133,0.06)] hover:text-[var(--mp-ink)]',
              )}
            >
              <span
                className={cn(
                  'transition-colors',
                  isActive ? 'text-white' : 'text-slate-400',
                )}
              >
                {item.icon}
              </span>
              {item.label}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white/90" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-[rgba(11,109,133,0.08)] px-3 py-4">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-[var(--mp-teal)] text-white shadow-[0_8px_20px_rgba(11,109,133,0.2)]'
                  : 'text-slate-600 hover:bg-[rgba(11,109,133,0.06)] hover:text-[var(--mp-ink)]',
              )}
            >
              <span
                className={cn(
                  'transition-colors',
                  isActive ? 'text-white' : 'text-slate-400',
                )}
              >
                {item.icon}
              </span>
              {item.label}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white/90" />
              )}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => {
            handleSignOut();
            handleLinkClick();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-50 hover:text-red-700"
        >
          <span className="text-red-500/80">
            <SignOut weight="light" className="h-5 w-5" />
          </span>
          Sign out
        </button>
      </div>

      {agent && (
        <div className="border-t border-[rgba(11,109,133,0.08)] p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[rgba(11,109,133,0.08)] bg-[rgba(11,109,133,0.04)] px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--mp-teal)] text-sm font-semibold text-white shadow-[0_6px_16px_rgba(11,109,133,0.2)]">
              {agent.first_name.charAt(0)}
              {agent.last_name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--mp-ink)]">
                {agent.first_name} {agent.last_name}
              </p>
              <p className="truncate text-xs font-medium text-[var(--mp-teal)]">
                ID: {agent.id}
              </p>
            </div>
            <Sparkle weight="light" className="h-4 w-4 flex-shrink-0 text-[var(--mp-teal-soft)]" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside className="sticky top-3 m-3 hidden h-[calc(100vh-1.5rem)] w-64 flex-col overflow-hidden rounded-[1.75rem] border border-[rgba(11,109,133,0.08)] bg-white/85 text-[var(--mp-ink)] shadow-[var(--mp-shadow-soft)] backdrop-blur-xl lg:flex">
        {sidebarContent}
      </aside>

      <aside
        className={cn(
          'fixed bottom-0 left-0 top-0 z-50 flex w-[280px] max-w-[85vw] flex-col overflow-hidden',
          'border-r border-[rgba(11,109,133,0.08)] bg-white/95 text-[var(--mp-ink)] shadow-[var(--mp-shadow-soft)] backdrop-blur-xl',
          'transform transition-transform duration-300 ease-in-out lg:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
