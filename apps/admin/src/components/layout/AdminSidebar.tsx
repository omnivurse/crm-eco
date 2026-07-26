'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { cn, BrandLogo } from '@crm-eco/ui';
import {
  SquaresFour,
  Users,
  UserCircleGear,
  Package,
  FileText,
  GearSix,
  CreditCard,
  ChartBar,
  Stack,
  Link as LinkIcon,
  EnvelopeSimple,
  ShieldCheck,
  Sparkle,
  Buildings,
  TerminalWindow,
  Lightning,
  X,
  CaretDown,
  CaretRight,
  CaretLeft,
  ChartPie,
  Pulse,
  Funnel,
  SignOut,
  ChatCircle,
} from '@phosphor-icons/react';
import { useTerminal } from '@/components/terminal';

interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavChild[];
  section?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
}

const icon = (node: React.ReactNode) => node;

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: icon(<SquaresFour weight="light" className="h-5 w-5" />) },
      { label: 'Members', href: '/members', icon: icon(<Users weight="light" className="h-5 w-5" />) },
      { label: 'Support', href: '/support', icon: icon(<ChatCircle weight="light" className="h-5 w-5" />) },
      { label: 'Agents', href: '/agents', icon: icon(<UserCircleGear weight="light" className="h-5 w-5" />) },
    ],
  },
  {
    title: 'Products',
    collapsible: true,
    items: [
      { label: 'Products', href: '/products', icon: icon(<Package weight="light" className="h-5 w-5" />) },
      { label: 'Carriers', href: '/carriers', icon: icon(<ShieldCheck weight="light" className="h-5 w-5" />) },
    ],
  },
  {
    title: 'Enrollment',
    collapsible: true,
    items: [
      { label: 'Enrollments', href: '/enrollments', icon: icon(<FileText weight="light" className="h-5 w-5" />) },
      { label: 'Landing Pages', href: '/enrollment-links', icon: icon(<LinkIcon weight="light" className="h-5 w-5" />) },
      { label: 'Agent Links', href: '/enrollment-links/agents', icon: icon(<UserCircleGear weight="light" className="h-5 w-5" />) },
    ],
  },
  {
    title: 'Billing',
    collapsible: true,
    items: [
      { label: 'Overview', href: '/billing', icon: icon(<CreditCard weight="light" className="h-5 w-5" />) },
      { label: 'Transactions', href: '/billing/transactions', icon: icon(<FileText weight="light" className="h-5 w-5" />) },
      { label: 'Failed Payments', href: '/billing/failures', icon: icon(<ShieldCheck weight="light" className="h-5 w-5" />) },
    ],
  },
  {
    title: 'Commissions',
    collapsible: true,
    items: [
      { label: 'Overview', href: '/commissions', icon: icon(<Stack weight="light" className="h-5 w-5" />) },
      { label: 'Tiers', href: '/commissions/tiers', icon: icon(<ChartBar weight="light" className="h-5 w-5" />) },
      { label: 'Transactions', href: '/commissions/transactions', icon: icon(<FileText weight="light" className="h-5 w-5" />) },
      { label: 'Payouts', href: '/commissions/payouts', icon: icon(<CreditCard weight="light" className="h-5 w-5" />) },
    ],
  },
  {
    title: 'Operations',
    collapsible: true,
    items: [
      { label: 'Ops Dashboard', href: '/ops', icon: icon(<Lightning weight="light" className="h-5 w-5" />) },
      { label: 'Eligibility', href: '/ops/eligibility', icon: icon(<ShieldCheck weight="light" className="h-5 w-5" />) },
      { label: 'Job History', href: '/ops/jobs', icon: icon(<ChartBar weight="light" className="h-5 w-5" />) },
      { label: 'Scheduler', href: '/ops/scheduler', icon: icon(<GearSix weight="light" className="h-5 w-5" />) },
      { label: 'Vendors', href: '/vendors', icon: icon(<Buildings weight="light" className="h-5 w-5" />) },
      { label: 'Documents', href: '/documents', icon: icon(<FileText weight="light" className="h-5 w-5" />) },
    ],
  },
  {
    title: 'Communications',
    collapsible: true,
    items: [
      { label: 'Inbox', href: '/communications/inbox', icon: icon(<ChatCircle weight="light" className="h-5 w-5" />) },
      { label: 'Compose', href: '/communications/compose', icon: icon(<EnvelopeSimple weight="light" className="h-5 w-5" />) },
      { label: 'Templates', href: '/communications/templates', icon: icon(<FileText weight="light" className="h-5 w-5" />) },
      { label: 'History', href: '/communications/history', icon: icon(<ChartBar weight="light" className="h-5 w-5" />) },
    ],
  },
  {
    title: 'Analytics',
    collapsible: true,
    items: [
      { label: 'Reports', href: '/reports', icon: icon(<ChartBar weight="light" className="h-5 w-5" />) },
      { label: 'Enrollment Funnel', href: '/analytics/funnel', icon: icon(<Funnel weight="light" className="h-5 w-5" />) },
      { label: 'Demographics', href: '/analytics/demographics', icon: icon(<ChartPie weight="light" className="h-5 w-5" />) },
      { label: 'Actuarial Data', href: '/analytics/actuarial', icon: icon(<Pulse weight="light" className="h-5 w-5" />) },
    ],
  },
  {
    title: 'Settings',
    collapsible: true,
    items: [
      { label: 'General', href: '/settings', icon: icon(<GearSix weight="light" className="h-5 w-5" />) },
      { label: 'User Security', href: '/settings/security', icon: icon(<ShieldCheck weight="light" className="h-5 w-5" />) },
      { label: 'Automations', href: '/settings/automations', icon: icon(<Lightning weight="light" className="h-5 w-5" />) },
      { label: 'Audit Logs', href: '/settings/audit-logs', icon: icon(<FileText weight="light" className="h-5 w-5" />) },
    ],
  },
];

interface AdminSidebarProps {
  mobileMenuOpen?: boolean;
  onMobileClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AdminSidebar({
  mobileMenuOpen = false,
  onMobileClose,
  isCollapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggle: toggleTerminal } = useTerminal();

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        await fetch('/api/auth/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout', email: user.email }),
        });
      }
    } catch (err) {
      console.error('Failed to log logout:', err);
    }
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [sidebarReady, setSidebarReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('admin-sidebar-collapsed');
    queueMicrotask(() => {
      if (stored) {
        try {
          setCollapsedSections(new Set(JSON.parse(stored)));
        } catch {
          /* ignore */
        }
      }
      setSidebarReady(true);
    });
  }, []);

  useEffect(() => {
    if (sidebarReady) {
      localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(Array.from(collapsedSections)));
    }
  }, [collapsedSections, sidebarReady]);

  useEffect(() => {
    navSections.forEach((section) => {
      if (section.collapsible) {
        const isActiveSection = section.items.some(
          (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
        );
        if (isActiveSection && collapsedSections.has(section.title)) {
          setCollapsedSections((prev) => {
            const next = new Set(prev);
            next.delete(section.title);
            return next;
          });
        }
      }
    });
  }, [pathname]);

  const toggleSection = (sectionTitle: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionTitle)) next.delete(sectionTitle);
      else next.add(sectionTitle);
      return next;
    });
  };

  const handleLinkClick = () => {
    onMobileClose?.();
  };

  const sidebarContent = (forMobile: boolean = false) => (
    <div className="flex h-full flex-col">
      {(forMobile || !isCollapsed) && (
        <div className="border-b border-[var(--adm-hairline)] px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              prefetch={false}
              className="group flex min-w-0 flex-1 flex-col"
              onClick={handleLinkClick}
            >
              <BrandLogo variant="full" size="md" priority />
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-cyan)]">
                MMS · Admin
              </span>
            </Link>
            {forMobile && (
              <button
                type="button"
                onClick={onMobileClose}
                className="rounded-full p-2 text-[var(--adm-muted)] transition-colors hover:bg-[rgba(11,109,133,0.08)] hover:text-[var(--adm-ink)]"
                aria-label="Close menu"
              >
                <X weight="light" className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {!forMobile && isCollapsed && (
        <div className="flex justify-center border-b border-[var(--adm-hairline)] py-3">
          <Link href="/dashboard" prefetch={false} className="flex items-center" onClick={handleLinkClick}>
            <BrandLogo variant="icon" size="xs" priority />
          </Link>
        </div>
      )}

      <nav
        className={cn(
          'flex-1 overflow-y-auto py-3 scrollbar-thin transition-all duration-500 ease-[var(--adm-ease)]',
          'px-2',
        )}
      >
        {navSections.map((section) => {
          const isSectionCollapsed = section.collapsible && collapsedSections.has(section.title);
          const isActiveSection = section.items.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
          );

          return (
            <div key={section.title} className="mb-2">
              {!forMobile && isCollapsed ? (
                section.title !== 'Main' && (
                  <div className="mx-1 my-3 h-px bg-[var(--adm-hairline)]" />
                )
              ) : section.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-full px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wider transition-all duration-500 ease-[var(--adm-ease)]',
                    isActiveSection
                      ? 'bg-[rgba(11,109,133,0.08)] text-[var(--adm-cyan)]'
                      : 'text-[var(--adm-muted)] hover:bg-[rgba(11,109,133,0.05)] hover:text-[var(--adm-ink)]',
                  )}
                >
                  <span>{section.title}</span>
                  {isSectionCollapsed ? (
                    <CaretRight weight="light" className="h-4 w-4" />
                  ) : (
                    <CaretDown weight="light" className="h-4 w-4" />
                  )}
                </button>
              ) : (
                section.title !== 'Main' && (
                  <div className="px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--adm-muted)]">
                    {section.title}
                  </div>
                )
              )}

              <div
                className={cn(
                  'space-y-0.5 overflow-hidden transition-all duration-500 ease-[var(--adm-ease)]',
                  !forMobile && isCollapsed
                    ? 'max-h-[500px] opacity-100'
                    : isSectionCollapsed
                      ? 'max-h-0 opacity-0'
                      : 'max-h-[500px] opacity-100',
                )}
              >
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      onClick={handleLinkClick}
                      title={!forMobile && isCollapsed ? item.label : undefined}
                      className={cn(
                        'adm-nav-link group relative',
                        !forMobile && isCollapsed && 'justify-center px-0 py-2.5',
                        isActive && 'adm-nav-link-active',
                      )}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {(forMobile || !isCollapsed) && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {!forMobile && isCollapsed && (
                        <div className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-full bg-[var(--adm-ink)] px-2.5 py-1 text-xs text-[var(--adm-void)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={cn('space-y-1 pb-2', !forMobile && isCollapsed ? 'px-2' : 'px-2')}>
        <button
          type="button"
          onClick={() => {
            handleSignOut();
            handleLinkClick();
          }}
          className={cn(
            'adm-nav-link w-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10',
            !forMobile && isCollapsed && 'justify-center px-0 py-2.5',
          )}
          title="Sign out"
        >
          <SignOut weight="light" className="h-5 w-5 flex-shrink-0" />
          {(forMobile || !isCollapsed) && <span>Sign out</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            toggleTerminal();
            handleLinkClick();
          }}
          className={cn(
            'adm-nav-link w-full text-[var(--adm-teal)]',
            !forMobile && isCollapsed && 'justify-center px-0 py-2.5',
          )}
          title="Command Center (Ctrl+K)"
        >
          <TerminalWindow weight="light" className="h-5 w-5 flex-shrink-0" />
          {(forMobile || !isCollapsed) && (
            <>
              <span>Command Center</span>
              <kbd className="ml-auto hidden rounded-md bg-[rgba(11,109,133,0.08)] px-1.5 py-0.5 text-[10px] text-[var(--adm-muted)] sm:inline">
                ^K
              </kbd>
            </>
          )}
        </button>
      </div>

      <div className={cn('border-t border-[var(--adm-hairline)]', !forMobile && isCollapsed ? 'p-2' : 'p-3')}>
        {!forMobile && isCollapsed ? (
          <div className="flex justify-center">
            <Sparkle weight="light" className="h-5 w-5 text-[var(--adm-cyan)]" />
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--adm-hairline)] bg-[rgba(11,109,133,0.04)] px-3 py-3 dark:bg-white/5">
            <div className="mb-1 flex items-center gap-2">
              <Sparkle weight="light" className="h-3.5 w-3.5 text-[var(--adm-cyan)]" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--adm-muted)]">
                System
              </p>
            </div>
            <p className="text-sm font-bold text-[var(--adm-ink)]">
              Admin <span className="text-[var(--adm-cyan)]">· v1.0.0</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'relative hidden self-stretch lg:block',
          'transition-all duration-500 ease-[var(--adm-ease)]',
          isCollapsed ? 'w-[4.75rem]' : 'w-[15.5rem]',
        )}
      >
        <div className="adm-rail sticky top-0 h-full">
          <div className="adm-rail-inner flex h-full min-h-[calc(100dvh-8rem)] flex-col">
            {sidebarContent(false)}
          </div>
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="absolute -right-3 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--adm-hairline)] bg-[var(--adm-panel)] text-[var(--adm-muted)] shadow-sm transition-colors hover:text-[var(--adm-ink)]"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <CaretRight weight="light" className="h-4 w-4" />
            ) : (
              <CaretLeft weight="light" className="h-4 w-4" />
            )}
          </button>
        )}
      </aside>

      <aside
        className={cn(
          'fixed bottom-3 left-3 top-[4.5rem] z-40 w-72 lg:hidden',
          'transform transition-transform duration-500 ease-[var(--adm-ease)]',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%]',
        )}
      >
        <div className="adm-rail h-full">
          <div className="adm-rail-inner flex h-full flex-col">{sidebarContent(true)}</div>
        </div>
      </aside>
    </>
  );
}
