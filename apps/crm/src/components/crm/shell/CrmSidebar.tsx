'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { ScrollArea } from '@crm-eco/ui/components/scroll-area';
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

interface CrmSidebarProps {
  modules: CrmModule[];
  organizationName?: string;
}

export function CrmSidebar({ modules, organizationName }: CrmSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Tools': true,
    'Health Sharing': true,
    'Vendors': true,
    'Email': true,
    'Communication': false,
    'Automation': false,
    'Integrations': false,
    'Settings': false,
  });
  const pathname = usePathname();

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

  // Build navigation sections
  const navSections: NavSection[] = [
    {
      title: 'Tools',
      collapsible: true,
      defaultOpen: true,
      items: [
        { name: 'Import Data', href: '/crm/import', icon: Upload },
        { name: 'Sales Pipeline', href: '/crm/pipeline', icon: KanbanSquare },
        { name: 'Deals', href: '/crm/deals', icon: Briefcase },
        { name: 'Reports', href: '/crm/reports', icon: BarChart3 },
        { name: 'Analytics', href: '/crm/analytics', icon: PieChart },
        { name: 'Commissions', href: '/crm/commissions', icon: Wallet },
        { name: 'Activities', href: '/crm/activities', icon: Activity },
        { name: 'Tasks', href: '/crm/activities?type=tasks', icon: CheckCircle2 },
        { name: 'Calendar', href: '/crm/scheduling', icon: CalendarDays },
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
        { name: 'Payments', href: '/crm/commissions', icon: CircleDollarSign },
      ],
    },
    {
      title: 'Vendors',
      collapsible: true,
      defaultOpen: true,
      items: [
        { name: 'Vendor Hub', href: '/crm/vendors', icon: Building2, isNew: true },
        { name: 'Upload Files', href: '/crm/vendors/upload', icon: FileUp },
        { name: 'Review Changes', href: '/crm/vendors/changes', icon: GitBranch },
        { name: 'Connectors', href: '/crm/vendors/connectors', icon: Link2 },
        { name: 'Processing Jobs', href: '/crm/vendors/jobs', icon: RefreshCcw },
      ],
    },
    {
      title: 'Email',
      collapsible: true,
      defaultOpen: true,
      items: [
        { name: 'Email Campaigns', href: '/crm/campaigns', icon: Send, isNew: true },
        { name: 'Sequences', href: '/crm/sequences', icon: Repeat },
        { name: 'Templates', href: '/crm/settings/templates', icon: LayoutTemplate },
        { name: 'Asset Library', href: '/crm/email/assets', icon: FolderOpen, isNew: true },
        { name: 'Signatures', href: '/crm/settings/signatures', icon: FileText },
        { name: 'Domains', href: '/crm/settings/email-domains', icon: Globe },
      ],
    },
    {
      title: 'Communication',
      collapsible: true,
      defaultOpen: false,
      items: [
        { name: 'Inbox', href: '/crm/inbox', icon: Inbox },
        { name: 'SMS Campaigns', href: '/crm/communications?tab=sms', icon: MessageSquare, isBeta: true },
        { name: 'Call Logs', href: '/crm/activities?type=calls', icon: Phone },
        { name: 'Notifications', href: '/crm/settings/comms', icon: Bell },
      ],
    },
    {
      title: 'Automation',
      collapsible: true,
      defaultOpen: false,
      items: [
        { name: 'Workflows', href: '/crm/settings/automations', icon: Workflow },
        { name: 'Blueprints', href: '/crm/settings/blueprints', icon: GitBranch },
        { name: 'Playbooks', href: '/crm/playbooks', icon: BookOpen, isNew: true },
        { name: 'Scoring Rules', href: '/crm/settings/scorecards', icon: Star },
        { name: 'Assignment Rules', href: '/crm/settings/automations/assignment', icon: UserCog },
        { name: 'Auto-Responses', href: '/crm/settings/automations/responses', icon: Bot },
      ],
    },
    {
      title: 'Integrations',
      collapsible: true,
      defaultOpen: false,
      items: [
        { name: 'All Integrations', href: '/crm/integrations', icon: Link2 },
        { name: 'Webhooks', href: '/crm/integrations/webhooks', icon: Webhook },
        { name: 'API Keys', href: '/crm/integrations/api', icon: Key },
        { name: 'Zoho Sync', href: '/crm/integrations/zoho', icon: RefreshCcw },
        { name: 'Email Integration', href: '/crm/integrations/email', icon: Mail },
        { name: 'Calendar Sync', href: '/crm/integrations/calendar', icon: Calendar },
      ],
    },
    {
      title: 'Settings',
      collapsible: true,
      defaultOpen: false,
      items: [
        { name: 'General', href: '/crm/settings', icon: Settings },
        { name: 'Users & Teams', href: '/crm/settings/users', icon: Users2 },
        { name: 'Roles & Permissions', href: '/crm/settings/users?tab=roles', icon: Shield },
        { name: 'Modules', href: '/crm/settings/modules', icon: Grid3x3 },
        { name: 'Fields', href: '/crm/settings/fields', icon: Columns3 },
        { name: 'Layouts', href: '/crm/settings/layouts', icon: LayoutTemplate },
        { name: 'Customization', href: '/crm/settings/customization', icon: Palette },
        { name: 'Data Admin', href: '/crm/settings/system-health', icon: Database },
        { name: 'Landing Pages', href: '/crm/settings/landing-pages', icon: Globe, isBeta: true },
      ],
    },
  ];


  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link key={item.href} href={item.href}>
        <Button
          variant="ghost"
          className={cn(
            'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
            'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
            active &&
            'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-transparent text-teal-700 dark:text-white border-l-2 border-teal-500 dark:border-teal-400',
            collapsed ? 'justify-center px-2' : 'justify-start px-3'
          )}
          title={collapsed ? item.name : undefined}
        >
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
        </Button>
      </Link>
    );
  };

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
        <Link href="/crm" className="flex items-center gap-3 min-w-0 group">
          <div className="relative flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden group-hover:shadow-lg transition-all duration-300">
            <img
              src="/logo.png"
              alt="Pay It Forward HealthShare"
              className="w-full h-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="min-w-0 animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight">
                {organizationName || 'Pay It Forward'}
              </h1>
              <p className="text-[10px] font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                Healthshare CRM
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
            <Link href="/crm">
              <Button
                variant="ghost"
                className={cn(
                  'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                  'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-11',
                  isActive('/crm') && pathname === '/crm' &&
                  'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-emerald-500/10 text-teal-700 dark:text-white border border-teal-200 dark:border-teal-500/30',
                  collapsed ? 'justify-center px-2' : 'justify-start px-3'
                )}
              >
                <LayoutDashboard className={cn(
                  'w-5 h-5 flex-shrink-0 transition-colors',
                  isActive('/crm') && pathname === '/crm' && 'text-teal-600 dark:text-teal-400'
                )} />
                {!collapsed && <span className="font-medium">Dashboard</span>}
              </Button>
            </Link>
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
                    <Link key={module.id} href={path}>
                      <Button
                        variant="ghost"
                        className={cn(
                          'w-full gap-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200',
                          'hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl h-10',
                          isActive(path) &&
                          'bg-teal-50 dark:bg-gradient-to-r dark:from-teal-500/20 dark:to-transparent text-teal-700 dark:text-white border-l-2 border-teal-500 dark:border-teal-400',
                          collapsed ? 'justify-center px-2' : 'justify-start px-3'
                        )}
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
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Dynamic Nav Sections */}
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
                    {section.items.map(renderNavItem)}
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
            <p className="text-[10px] text-slate-400">CRM v2.0 • Phase 2</p>
          </div>
        )}
      </div>
    </aside>
  );
}
