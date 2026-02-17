'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Package,
  FileText,
  Settings,
  CreditCard,
  BarChart3,
  Layers,
  Link as LinkIcon,
  Mail,
  Shield,
  Sparkles,
  Building2,
  Terminal,
  Zap,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
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

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: 'Members', href: '/members', icon: <Users className="h-5 w-5" /> },
      { label: 'Agents', href: '/agents', icon: <UserCog className="h-5 w-5" /> },
      { label: 'Products', href: '/products', icon: <Package className="h-5 w-5" /> },
      { label: 'Enrollments', href: '/enrollments', icon: <FileText className="h-5 w-5" /> },
      { label: 'Vendors', href: '/vendors', icon: <Building2 className="h-5 w-5" /> },
    ],
  },
  {
    title: 'Operations',
    collapsible: true,
    items: [
      {
        label: 'Ops Dashboard',
        href: '/ops',
        icon: <Zap className="h-5 w-5" />,
      },
      {
        label: 'Eligibility',
        href: '/ops/eligibility',
        icon: <Shield className="h-5 w-5" />,
      },
      {
        label: 'Job History',
        href: '/ops/jobs',
        icon: <BarChart3 className="h-5 w-5" />,
      },
      {
        label: 'Scheduler',
        href: '/ops/scheduler',
        icon: <Settings className="h-5 w-5" />,
      },
    ],
  },
  {
    title: 'Enrollment Links',
    collapsible: true,
    items: [
      {
        label: 'Landing Pages',
        href: '/enrollment-links',
        icon: <LinkIcon className="h-5 w-5" />,
      },
      {
        label: 'Agent Links',
        href: '/enrollment-links/agents',
        icon: <UserCog className="h-5 w-5" />,
      },
    ],
  },
  {
    title: 'Billing',
    collapsible: true,
    items: [
      {
        label: 'Overview',
        href: '/billing',
        icon: <CreditCard className="h-5 w-5" />,
      },
      {
        label: 'Transactions',
        href: '/billing/transactions',
        icon: <FileText className="h-5 w-5" />,
      },
      {
        label: 'Failed Payments',
        href: '/billing/failures',
        icon: <Shield className="h-5 w-5" />,
      },
    ],
  },
  {
    title: 'Commissions',
    collapsible: true,
    items: [
      {
        label: 'Overview',
        href: '/commissions',
        icon: <Layers className="h-5 w-5" />,
      },
      {
        label: 'Tiers',
        href: '/commissions/tiers',
        icon: <BarChart3 className="h-5 w-5" />,
      },
      {
        label: 'Transactions',
        href: '/commissions/transactions',
        icon: <FileText className="h-5 w-5" />,
      },
      {
        label: 'Payouts',
        href: '/commissions/payouts',
        icon: <CreditCard className="h-5 w-5" />,
      },
    ],
  },
  {
    title: 'Communications',
    collapsible: true,
    items: [
      {
        label: 'Dashboard',
        href: '/communications',
        icon: <Mail className="h-5 w-5" />,
      },
      {
        label: 'Templates',
        href: '/communications/templates',
        icon: <FileText className="h-5 w-5" />,
      },
      {
        label: 'History',
        href: '/communications/history',
        icon: <BarChart3 className="h-5 w-5" />,
      },
      {
        label: 'Compose',
        href: '/communications/compose',
        icon: <Mail className="h-5 w-5" />,
      },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Reports', href: '/reports', icon: <BarChart3 className="h-5 w-5" /> },
    ],
  },
  {
    title: 'Settings',
    collapsible: true,
    items: [
      {
        label: 'General',
        href: '/settings',
        icon: <Settings className="h-5 w-5" />,
      },
      {
        label: 'User Security',
        href: '/settings/security',
        icon: <Shield className="h-5 w-5" />,
      },
      {
        label: 'Automations',
        href: '/settings/automations',
        icon: <Zap className="h-5 w-5" />,
      },
      {
        label: 'Audit Logs',
        href: '/settings/audit-logs',
        icon: <FileText className="h-5 w-5" />,
      },
    ],
  },
  {
    title: 'Resources',
    collapsible: true,
    items: [
      {
        label: 'Features',
        href: '/features',
        icon: <Sparkles className="h-5 w-5" />,
      },
      {
        label: 'Learn',
        href: '/learn',
        icon: <BookOpen className="h-5 w-5" />,
      },
      {
        label: 'Help',
        href: '/learn/getting-started',
        icon: <HelpCircle className="h-5 w-5" />,
      },
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
  const { toggle: toggleTerminal } = useTerminal();
  
  // State for collapsed sections - always start with empty set on server,
  // then hydrate from localStorage on mount to avoid hydration mismatch
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [sidebarReady, setSidebarReady] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('admin-sidebar-collapsed');
    if (stored) {
      try {
        setCollapsedSections(new Set(JSON.parse(stored)));
      } catch {
        // Ignore parse errors
      }
    }
    setSidebarReady(true);
  }, []);

  // Persist collapsed state to localStorage (only after initial hydration)
  useEffect(() => {
    if (sidebarReady) {
      localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(Array.from(collapsedSections)));
    }
  }, [collapsedSections, sidebarReady]);

  // Auto-expand section when navigating to a page within it
  useEffect(() => {
    navSections.forEach((section) => {
      if (section.collapsible) {
        const isActiveSection = section.items.some(
          (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
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
      if (next.has(sectionTitle)) {
        next.delete(sectionTitle);
      } else {
        next.add(sectionTitle);
      }
      return next;
    });
  };

  // Handle link click on mobile - close the menu
  const handleLinkClick = () => {
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const sidebarContent = (forMobile: boolean = false) => (
    <>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#003560] via-[#003560] to-[#002848] pointer-events-none" />

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Logo with gradient accent stripe */}
        <div className="relative">
          {/* Gradient top stripe */}
          <div className="h-1 bg-gradient-to-r from-[#047474] via-[#069B9A] to-[#027343]" />

          <div className={cn(
            "h-16 flex items-center border-b border-white/10 transition-all duration-300",
            !forMobile && isCollapsed ? "justify-center px-2" : "justify-between px-4"
          )}>
            <Link href="/dashboard" className="flex items-center group flex-1 min-w-0" onClick={handleLinkClick}>
              <div className="bg-white rounded-lg p-1.5 shadow-sm w-full">
                {!forMobile && isCollapsed ? (
                  <Image
                    src="/logo-icon.png"
                    alt="PIF"
                    width={32}
                    height={32}
                    className="object-contain"
                    priority
                  />
                ) : (
                  <Image
                    src="/logo-pif-full.png"
                    alt="Pay It Forward HealthShare"
                    width={200}
                    height={44}
                    className="object-contain h-9 w-full"
                    priority
                  />
                )}
              </div>
            </Link>
            {/* Mobile close button */}
            {forMobile && (
              <button
                onClick={onMobileClose}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 py-4 overflow-y-auto scrollbar-thin transition-all duration-300",
          !forMobile && isCollapsed ? "px-2" : "px-3"
        )}>
          {navSections.map((section) => {
            const isSectionCollapsed = section.collapsible && collapsedSections.has(section.title);
            const isActiveSection = section.items.some(
              (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
            );

            return (
              <div key={section.title} className="mb-4">
                {/* Section Header - hidden when sidebar is collapsed */}
                {(!forMobile && isCollapsed) ? (
                  // Show a divider line when collapsed
                  section.title !== 'Main' && (
                    <div className="h-px bg-white/10 my-3 mx-1" />
                  )
                ) : section.collapsible ? (
                  <button
                    onClick={() => toggleSection(section.title)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all',
                      isActiveSection
                        ? 'text-[#E9B61F] bg-white/5'
                        : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                    )}
                  >
                    <span>{section.title}</span>
                    {isSectionCollapsed ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  section.title !== 'Main' && (
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                      {section.title}
                    </div>
                  )
                )}

                {/* Section Items */}
                <div
                  className={cn(
                    'space-y-1 overflow-hidden transition-all duration-300',
                    // Only collapse sections when sidebar is expanded
                    (!forMobile && isCollapsed) ? 'max-h-[500px] opacity-100' : (
                      isSectionCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
                    ),
                    section.title !== 'Main' && !section.collapsible && 'mt-1'
                  )}
                >
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleLinkClick}
                        title={(!forMobile && isCollapsed) ? item.label : undefined}
                        className={cn(
                          'flex items-center rounded-lg text-sm font-medium transition-all duration-200 group relative',
                          !forMobile && isCollapsed
                            ? 'justify-center p-2.5'
                            : 'gap-3 px-3 py-2.5',
                          isActive
                            ? 'bg-[#047474] text-white shadow-lg shadow-teal-900/20'
                            : 'text-white/70 hover:bg-[#002848] hover:text-white'
                        )}
                      >
                        <span className={cn(
                          'transition-colors flex-shrink-0',
                          isActive ? 'text-white' : 'text-white/50'
                        )}>
                          {item.icon}
                        </span>
                        {/* Label - hidden when collapsed */}
                        {(forMobile || !isCollapsed) && (
                          <>
                            <span className="truncate">{item.label}</span>
                            {isActive && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E9B61F] flex-shrink-0" />
                            )}
                          </>
                        )}
                        {/* Tooltip on hover when collapsed */}
                        {!forMobile && isCollapsed && (
                          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
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

        {/* Command Center Button */}
        <div className={cn("pb-2 transition-all duration-300", !forMobile && isCollapsed ? "px-2" : "px-3")}>
          <button
            onClick={() => {
              toggleTerminal();
              handleLinkClick();
            }}
            className={cn(
              "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 text-cyan-400 hover:bg-cyan-900/30 hover:text-cyan-300 group relative",
              !forMobile && isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
            )}
            title="Command Center (Ctrl+K)"
          >
            <Terminal className="w-5 h-5 flex-shrink-0" />
            {(forMobile || !isCollapsed) && (
              <>
                <span>Command Center</span>
                <kbd className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded hidden sm:inline">^K</kbd>
              </>
            )}
            {/* Tooltip when collapsed */}
            {!forMobile && isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                Command Center
              </div>
            )}
          </button>
        </div>

        {/* Collapse Toggle Button - Desktop only */}
        {!forMobile && onToggleCollapse && (
          <div className={cn("pb-2 transition-all duration-300", isCollapsed ? "px-2" : "px-3")}>
            <button
              onClick={onToggleCollapse}
              className={cn(
                "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 text-white/50 hover:bg-white/10 hover:text-white",
                isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
              )}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <PanelLeft className="w-5 h-5" />
              ) : (
                <>
                  <PanelLeftClose className="w-5 h-5" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className={cn(
          "border-t border-white/10 transition-all duration-300",
          !forMobile && isCollapsed ? "p-2" : "p-4"
        )}>
          {(!forMobile && isCollapsed) ? (
            <div className="flex justify-center">
              <Sparkles className="w-5 h-5 text-[#E9B61F]" />
            </div>
          ) : (
            <div className="px-3 py-3 bg-[#002848] rounded-xl border border-white/5">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#E9B61F]" />
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">System</p>
              </div>
              <p className="text-sm font-bold text-white">Admin <span className="text-[#069B9A]">· v1.0.0</span></p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar - always visible */}
      <aside
        className={cn(
          "hidden lg:flex bg-[#003560] text-white flex-col relative overflow-hidden transition-all duration-300",
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Mobile Sidebar - slide-in drawer */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] z-50',
          'bg-[#003560] text-white flex flex-col overflow-hidden',
          'transform transition-transform duration-300 ease-in-out',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent(true)}
      </aside>
    </>
  );
}
