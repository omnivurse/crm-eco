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
];

interface AdminSidebarProps {
  mobileMenuOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({ mobileMenuOpen = false, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { toggle: toggleTerminal } = useTerminal();
  
  // State for collapsed sections - persisted in localStorage
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem('admin-sidebar-collapsed');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(Array.from(collapsedSections)));
  }, [collapsedSections]);

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

  const sidebarContent = (
    <>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#003560] via-[#003560] to-[#002848] pointer-events-none" />
      
      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Logo with gradient accent stripe */}
        <div className="relative">
          {/* Gradient top stripe */}
          <div className="h-1 bg-gradient-to-r from-[#047474] via-[#069B9A] to-[#027343]" />

          <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
            <Link href="/dashboard" className="flex items-center group" onClick={handleLinkClick}>
              <Image
                src="/logo-pif-full.png"
                alt="Pay It Forward HealthShare"
                width={180}
                height={48}
                className="object-contain max-h-10 w-auto"
                priority
              />
            </Link>
            {/* Mobile close button */}
            <button
              onClick={onMobileClose}
              className="lg:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
          {navSections.map((section) => {
            const isCollapsed = section.collapsible && collapsedSections.has(section.title);
            const isActiveSection = section.items.some(
              (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
            );

            return (
              <div key={section.title} className="mb-4">
                {/* Section Header */}
                {section.collapsible ? (
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
                    {isCollapsed ? (
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
                    isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100',
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
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                          isActive
                            ? 'bg-[#047474] text-white shadow-lg shadow-teal-900/20'
                            : 'text-white/70 hover:bg-[#002848] hover:text-white'
                        )}
                      >
                        <span className={cn(
                          'transition-colors',
                          isActive ? 'text-white' : 'text-white/50'
                        )}>
                          {item.icon}
                        </span>
                        {item.label}
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E9B61F]" />
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
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              toggleTerminal();
              handleLinkClick();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-cyan-400 hover:bg-cyan-900/30 hover:text-cyan-300"
            title="Command Center (Ctrl+K)"
          >
            <Terminal className="w-5 h-5" />
            <span>Command Center</span>
            <kbd className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded hidden sm:inline">^K</kbd>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="px-3 py-3 bg-[#002848] rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#E9B61F]" />
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">System</p>
            </div>
            <p className="text-sm font-bold text-white">Admin <span className="text-[#069B9A]">· v1.0.0</span></p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar - always visible */}
      <aside className="hidden lg:flex w-64 bg-[#003560] text-white flex-col relative overflow-hidden">
        {sidebarContent}
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
        {sidebarContent}
      </aside>
    </>
  );
}
