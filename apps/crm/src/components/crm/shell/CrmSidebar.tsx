'use client';

import { useState, memo, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { ScrollArea } from '@crm-eco/ui/components/scroll-area';
import { supabase } from '@/lib/supabase-client';
import { clearOfflineState } from '@/lib/offline/reset';
import type { CrmModule } from '@/lib/crm/types';
import {
  Users,
  UserPlus,
  DollarSign,
  Building,
  LayoutDashboard,
  Settings,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Target,
  Briefcase,
  Heart,
  TrendingUp,
  BarChart3,
  ClipboardList,
  HeartHandshake,
  PieChart,
  Wallet,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  CalendarDays,
  CalendarCheck,
  Bell,
  Zap,
  GitBranch,
  Workflow,
  Link2,
  Globe,
  Webhook,
  Key,
  Shield,
  UserCog,
  Users2,
  Building2,
  Database,
  Columns3,
  LayoutTemplate,
  Palette,
  FileCode,
  Activity,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Search,
  Filter,
  Tags,
  Bookmark,
  Star,
  Archive,
  Inbox,
  Send,
  Clock,
  Award,
  Gift,
  Receipt,
  CreditCard,
  Banknote,
  CircleDollarSign,
  FileSpreadsheet,
  FileDown,
  FileUp,
  Bot,
  Sparkles,
  Brain,
  Megaphone,
  Share2,
  Rss,
  FolderOpen,
  Layers,
  Grid3x3,
  List,
  KanbanSquare,
  Map,
  MapPin,
  Route,
  RefreshCcw,
  Repeat,
  Copy,
  Trash2,
  MoreHorizontal,
  HelpCircle,
  LifeBuoy,
  BookOpen,
  GraduationCap,
  Video,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

// Icon mapping for modules
const iconMap: Record<string, LucideIcon> = {
  'user': Users,
  'user-plus': UserPlus,
  'users': Users,
  'dollar-sign': DollarSign,
  'building': Building,
  'file': FileText,
  'file-text': FileText,
  'target': Target,
  'briefcase': Briefcase,
  'heart': Heart,
  'trending-up': TrendingUp,
  'bar-chart': BarChart3,
  'clipboard': ClipboardList,
  'calendar-check': CalendarCheck,
  'calendar': Calendar,
  'inbox': Inbox,
};

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  isNew?: boolean;
  isBeta?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultOpen?: boolean;
}

// Alias for Handshake icon (not in lucide-react)
const Handshake = Briefcase;

// Memoized nav item — only re-renders when its own active state or collapsed state changes
const MemoNavItem = memo(function MemoNavItem({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Button
      key={item.href}
      asChild
      variant="ghost"
      className={cn(
        'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
        'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
        active &&
        'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-transparent text-teal-700 dark:text-white border-l-2 border-teal-500 dark:border-teal-400',
        collapsed ? 'justify-center px-2' : 'justify-start px-3'
      )}
    >
      <Link prefetch={false} href={item.href} title={collapsed ? item.name : undefined}>
        <Icon className={cn(
          'w-5 h-5 flex-shrink-0 transition-colors',
          active && 'text-teal-600 dark:text-teal-400'
        )} />
        {!collapsed && (
          <span className="font-medium truncate flex-1 text-left">
            {item.name}
          </span>
        )}
        {!collapsed && item.badge && (
          <Badge variant={item.badgeVariant || 'secondary'} className="ml-auto text-xs">
            {item.badge}
          </Badge>
        )}
        {!collapsed && item.isNew && (
          <Badge className="ml-auto text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
            NEW
          </Badge>
        )}
        {!collapsed && item.isBeta && (
          <Badge className="ml-auto text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400">
            BETA
          </Badge>
        )}
      </Link>
    </Button>
  );
});

interface CrmSidebarProps {
  modules: CrmModule[];
  organizationName?: string;
}

export const CrmSidebar = memo(function CrmSidebar({ modules, organizationName }: CrmSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Work': true,
    'Health Sharing': true,
    'Outreach': true,
    'Insights': false,
    'Data': false,
    'System': false,
  });
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
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
    try {
      await clearOfflineState();
    } catch (err) {
      console.error('Failed to clear offline state on sign-out:', err);
    }
    await supabase.auth.signOut();
    router.push('/crm-login');
    router.refresh();
  };

  const getIcon = (iconName: string): LucideIcon => {
    return iconMap[iconName] || FileText;
  };

  const isActive = (path: string) => {
    if (path === '/crm') {
      return pathname === '/crm';
    }
    return pathname.startsWith(path);
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Build navigation sections — ordered by CRM power-user workflow priority
  const navSections: NavSection[] = [
    // ── Daily drivers: always visible, always expanded ──
    {
      title: 'Work',
      collapsible: true,
      defaultOpen: true,
      items: [
        { name: 'Pipeline', href: '/crm/pipeline', icon: KanbanSquare },
        { name: 'Deals', href: '/crm/deals', icon: Briefcase },
        { name: 'Activities', href: '/crm/activities', icon: Activity },
        { name: 'Tasks', href: '/crm/activities?type=tasks', icon: CheckCircle2 },
        { name: 'Calendar', href: '/crm/calendar', icon: CalendarDays },
      ],
    },
    {
      title: 'Health Sharing',
      collapsible: true,
      defaultOpen: true,
      items: [
        { name: 'Enrollment', href: '/crm/enrollment', icon: ClipboardList },
        { name: 'Needs', href: '/crm/needs', icon: HeartHandshake },
        { name: 'Approvals', href: '/crm/approvals', icon: CheckCircle2 },
      ],
    },
    // ── Communication: merged Email + Communication into one section ──
    {
      title: 'Outreach',
      collapsible: true,
      defaultOpen: true,
      items: [
        { name: 'Inbox', href: '/crm/inbox', icon: Inbox },
        { name: 'Campaigns', href: '/crm/campaigns', icon: Send },
        { name: 'Sequences', href: '/crm/sequences', icon: Repeat },
        { name: 'SMS', href: '/crm/communications?tab=sms', icon: MessageSquare, isBeta: true },
        { name: 'Templates', href: '/crm/settings/templates', icon: LayoutTemplate },
      ],
    },
    // ── Analysis: collapsed by default — not daily actions ──
    {
      title: 'Insights',
      collapsible: true,
      defaultOpen: false,
      items: [
        { name: 'Reports', href: '/crm/reports', icon: BarChart3 },
        { name: 'Analytics', href: '/crm/analytics', icon: PieChart },
        { name: 'Commissions', href: '/crm/commissions', icon: Wallet },
      ],
    },
    // ── Data management: collapsed — periodic tasks ──
    {
      title: 'Data',
      collapsible: true,
      defaultOpen: false,
      items: [
        { name: 'Import', href: '/crm/import', icon: Upload },
        { name: 'Documents', href: '/crm/documents', icon: FileText },
        { name: 'Vendors', href: '/crm/vendors', icon: Building2 },
      ],
    },
    // ── System: collapsed — admin/config tasks ──
    {
      title: 'System',
      collapsible: true,
      defaultOpen: false,
      items: [
        { name: 'Automations', href: '/crm/settings/automations', icon: Workflow },
        { name: 'Playbooks', href: '/crm/playbooks', icon: BookOpen, isNew: true },
        { name: 'My Carriers', href: '/crm/settings/my-carriers', icon: Shield, isNew: true },
        { name: 'Integrations', href: '/crm/integrations', icon: Link2 },
        { name: 'Users & Teams', href: '/crm/settings/users', icon: Users2 },
        { name: 'Settings', href: '/crm/settings', icon: Settings },
      ],
    },
  ];



  return (
    <aside
      className={cn(
        'relative flex flex-col transition-all duration-300 ease-in-out border-r bg-white dark:bg-transparent',
        'dark:glass-strong',
        collapsed ? 'w-[72px]' : 'w-[280px]'
      )}
    >
      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] gradient-primary opacity-60" />

      {/* Logo / Org Name */}
      <div className="flex items-center h-16 px-4 border-b border-slate-200 dark:border-white/5">
        <Link prefetch={false} href="/crm" className="flex items-center gap-3 min-w-0 group">
          <div className="relative flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden group-hover:shadow-lg transition-all duration-300">
            <Image
              src="/logo.svg"
              alt="Double Helix Hub"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              loading="lazy"
              quality={80}
            />
          </div>
          {!collapsed && (
            <div className="min-w-0" style={{ animationDuration: '0.2s' }}>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight">
                {organizationName || 'Double Helix Hub'}
              </h1>
              <p className="text-[10px] font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                Management Platform
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="py-4 px-3">
          {/* Dashboard */}
          <div className="mb-4">
            <Button
              asChild
              variant="ghost"
              className={cn(
                'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-11',
                isActive('/crm') && pathname === '/crm' &&
                'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-emerald-500/10 text-teal-700 dark:text-white border border-teal-200 dark:border-teal-500/30',
                collapsed ? 'justify-center px-2' : 'justify-start px-3'
              )}
            >
              <Link prefetch={false} href="/crm">
                <LayoutDashboard className={cn(
                  'w-5 h-5 flex-shrink-0 transition-colors',
                  isActive('/crm') && pathname === '/crm' && 'text-teal-600 dark:text-teal-400'
                )} />
                {!collapsed && <span className="font-medium">Dashboard</span>}
              </Link>
            </Button>
          </div>

          {/* Modules Section */}
          {modules.length > 0 && (
            <>
              {!collapsed && (
                <div className="mb-2 px-1 flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em]">
                    Modules
                  </p>
                  <span className="text-[10px] text-slate-400">{modules.length}</span>
                </div>
              )}
              <div className="space-y-1 mb-6">
                {modules.map((module, index) => {
                  const Icon = getIcon(module.icon);
                  const path = `/crm/modules/${module.key}`;
                  return (
                    <Button
                      key={module.id}
                      asChild
                      variant="ghost"
                      className={cn(
                        'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                        'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                        isActive(path) &&
                        'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-transparent text-teal-700 dark:text-white border-l-2 border-teal-500 dark:border-teal-400',
                        collapsed ? 'justify-center px-2' : 'justify-start px-3'
                      )}
                    >
                      <Link
                        prefetch={false}
                        href={path}
                        title={collapsed ? module.name : undefined}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <Icon className={cn(
                          'w-5 h-5 flex-shrink-0 transition-colors',
                          isActive(path) && 'text-teal-600 dark:text-teal-400'
                        )} />
                        {!collapsed && (
                          <span className="font-medium truncate">
                            {module.name_plural || module.name + 's'}
                          </span>
                        )}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </>
          )}

          {/* Nav Sections */}
          {navSections.map((section) => {
            const isOpen = openSections[section.title] ?? section.defaultOpen ?? true;

            return (
              <div key={section.title} className="mb-4">
                {!collapsed && (
                  <button
                    onClick={() => section.collapsible && toggleSection(section.title)}
                    className="w-full mb-2 px-1 flex items-center justify-between group"
                  >
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                      {section.title}
                    </p>
                    {section.collapsible && (
                      <ChevronDown
                        className={cn(
                          'w-3 h-3 text-slate-400 transition-transform duration-200',
                          isOpen && 'rotate-180'
                        )}
                      />
                    )}
                  </button>
                )}
                {collapsed && <div className="mt-4" />}

                {(isOpen || collapsed) && (
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <MemoNavItem
                        key={item.href}
                        item={item}
                        active={isActive(item.href)}
                        collapsed={collapsed}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Help & Support */}
          {!collapsed && (
            <div className="mt-8 p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <LifeBuoy className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Need Help?</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Check out our guides and tutorials.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7 flex-1">
                  <BookOpen className="w-3 h-3 mr-1" />
                  Docs
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7 flex-1">
                  <Video className="w-3 h-3 mr-1" />
                  Videos
                </Button>
              </div>
            </div>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-white/5 p-3 space-y-2">
        {/* Quick Actions */}
        {!collapsed && (
          <div className="flex gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
            >
              <Search className="w-3 h-3 mr-1" />
              Search
              <kbd className="ml-auto text-[10px] text-slate-400">⌘K</kbd>
            </Button>
          </div>
        )}

        {/* Sign Out */}
        <Button
          variant="ghost"
          onClick={handleSignOut}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'w-full h-9 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200',
            'hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg',
            collapsed ? 'justify-center px-2' : 'justify-start px-3 gap-2',
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sign out</span>}
        </Button>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full h-9 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
            'hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg',
            collapsed ? 'justify-center' : 'justify-center'
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </Button>

        {/* Version */}
        {!collapsed && (
          <div className="px-2 py-2 text-center">
            <p className="text-[10px] text-slate-400">Double Helix Hub v2.0</p>
          </div>
        )}
      </div>
    </aside>
  );
});
