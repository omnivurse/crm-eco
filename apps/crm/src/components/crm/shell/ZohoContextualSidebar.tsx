'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { clearOfflineState } from '@/lib/offline/reset';
import { cn } from '@crm-eco/ui/lib/utils';
import {
    LayoutDashboard,
    UserPlus,
    Users,
    Building,
    Building2,
    DollarSign,
    Activity,
    CheckSquare,
    CheckCircle,
    FileText,
    Package,
    FileCheck,
    Receipt,
    PieChart,
    Home,
    Mail,
    Phone,
    Calendar,
    MessageCircle,
    Hash,
    Webhook,
    ScrollText,
    Inbox,
    MessageSquare,
    Megaphone,
    TrendingUp,
    TrendingDown,
    BookOpen,
    ClipboardCheck,
    Heart,
    HeartPulse,
    Award,
    Layers,
    List,
    Layout,
    Zap,
    Upload,
    Download,
    Settings,
    ChevronLeft,
    ChevronRight,
    Video,
    Repeat,
    FolderOpen,
    FileSignature,
    Globe,
    FileUp,
    GitBranch,
    GitMerge,
    MailPlus,
    X,
    UserCog,
    UsersRound,
    Target,
    Calculator,
    ShieldPlus,
    ShieldCheck,
    Shield,
    Lock,
    Key,
    Star,
    Clock,
    Bot,
    Gauge,
    Trophy,
    KanbanSquare,
    Workflow,
    Link2,
    RefreshCw,
    Database,
    Radio,
    Bell,
    CreditCard,
    Wallet,
    Puzzle,
    Code,
    SlidersHorizontal,
    type LucideIcon,
} from 'lucide-react';
import { Lightbulb, Search, LogOut } from 'lucide-react';
import {
  useModule,
  getNavItemsForModule,
  resolveTopModuleFromPathname,
  TOP_MODULE_TITLES,
  type NavItem,
} from '@/contexts/ModuleContext';
import { ModuleSwitcherRail } from './ModuleSwitcherRail';
import { openCrmCommandPalette } from '@/lib/crm/command-palette-bus';
import { useGizmoSafe } from '@/components/crm/gizmo';

/** Compact search box that opens the global search overlay via Cmd+K event */
function SidebarSearchTrigger({ collapsed }: { collapsed?: boolean }) {
    const handleClick = () => {
        openCrmCommandPalette();
    };

    if (collapsed) {
        return (
            <button
                onClick={handleClick}
                className="flex items-center justify-center w-full h-8 rounded-md text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title="Search Contacts (⌘K)"
            >
                <Search className="w-4 h-4" />
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            className="flex items-center gap-1.5 w-full h-7 px-2.5 rounded-md border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-[12px]"
        >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 text-left truncate">Search or workflow…</span>
            <kbd className="hidden sm:inline-flex text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded px-1 py-0.5">
                ⌘K
            </kbd>
        </button>
    );
}

// Icon mapping for all nav items
const iconMap: Record<string, LucideIcon> = {
    'layout-dashboard': LayoutDashboard,
    'user-plus': UserPlus,
    'users': Users,
    'building': Building,
    'building-2': Building2,
    'dollar-sign': DollarSign,
    'activity': Activity,
    'check-square': CheckSquare,
    'check-circle': CheckCircle,
    'file-text': FileText,
    'package': Package,
    'file-check': FileCheck,
    'receipt': Receipt,
    'pie-chart': PieChart,
    'home': Home,
    'mail': Mail,
    'phone': Phone,
    'calendar': Calendar,
    'message-circle': MessageCircle,
    'hash': Hash,
    'webhook': Webhook,
    'scroll-text': ScrollText,
    'inbox': Inbox,
    'message-square': MessageSquare,
    'megaphone': Megaphone,
    'trending-up': TrendingUp,
    'trending-down': TrendingDown,
    'chart-line': TrendingUp,
    'book-open': BookOpen,
    'clipboard-check': ClipboardCheck,
    'heart': Heart,
    'heart-pulse': HeartPulse,
    'award': Award,
    'layers': Layers,
    'list': List,
    'layout': Layout,
    'zap': Zap,
    'upload': Upload,
    'download': Download,
    'settings': Settings,
    'video': Video,
    'repeat': Repeat,
    'folder': FolderOpen,
    'folder-users': UsersRound,
    'file-signature': FileSignature,
    'globe': Globe,
    'file-up': FileUp,
    'git-branch': GitBranch,
    'git-merge': GitMerge,
    'mail-plus': MailPlus,
    'user-cog': UserCog,
    'target': Target,
    'calculator': Calculator,
    'shield-plus': ShieldPlus,
    'shield-check': ShieldCheck,
    'shield': Shield,
    'lock': Lock,
    'key': Key,
    'star': Star,
    'clock': Clock,
    'bot': Bot,
    'gauge': Gauge,
    'trophy': Trophy,
    'kanban': KanbanSquare,
    'workflow': Workflow,
    'link-2': Link2,
    'refresh-cw': RefreshCw,
    'database': Database,
    'radio': Radio,
    'bell': Bell,
    'credit-card': CreditCard,
    'wallet': Wallet,
    'puzzle': Puzzle,
    'code': Code,
    'sliders': SlidersHorizontal,
};

function getIcon(iconName: string): LucideIcon {
    return iconMap[iconName] || FileText;
}

interface ZohoContextualSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    mobileMenuOpen?: boolean;
    onMobileClose?: () => void;
}

export function ZohoContextualSidebar({ 
    isOpen, 
    onToggle,
    mobileMenuOpen = false,
    onMobileClose,
}: ZohoContextualSidebarProps) {
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

    const activeTopModule = resolveTopModuleFromPathname(pathname);
    const navItems = getNavItemsForModule(activeTopModule);

    const isActive = (href: string) => {
        if (href === '/crm') {
            return pathname === '/crm';
        }
        return pathname.startsWith(href);
    };

    const moduleTitle = TOP_MODULE_TITLES;

    // Handle link click on mobile
    const handleLinkClick = () => {
        if (onMobileClose) {
            onMobileClose();
        }
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <aside
                data-crm-module={activeTopModule}
                className={cn(
                    'group/sidebar relative hidden lg:flex flex-col border-r border-slate-200/80 dark:border-white/5 bg-white/90 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-200',
                    isOpen ? 'w-52' : 'w-14'
                )}
            >
                {/* Module switcher — icon rail when collapsed; top tab bar handles expanded desktop */}
                {!isOpen && <ModuleSwitcherRail expanded={false} />}

                {isOpen && (
                    <div className="px-3 py-1.5 border-b border-slate-200/80 dark:border-white/5">
                        <h2 className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em]">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--mod-fg)' }} aria-hidden />
                            {moduleTitle[activeTopModule]} menu
                        </h2>
                    </div>
                )}

                {/* Quick Search */}
                <div className={cn('px-2 pt-2 pb-0.5', !isOpen && 'px-1.5')}>
                    <SidebarSearchTrigger collapsed={!isOpen} />
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 px-2 py-2 space-y-px overflow-y-auto scrollbar-thin">
                    {navItems.map((item) => {
                        if (item.separator) {
                            return (
                                <div key={item.key} className="pt-2.5 pb-0.5">
                                    {isOpen && item.sectionTitle ? (
                                        <p className="px-2.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em]">
                                            {item.sectionTitle}
                                        </p>
                                    ) : (
                                        <hr className="border-slate-200/60 dark:border-white/10" />
                                    )}
                                </div>
                            );
                        }

                        const Icon = getIcon(item.icon);
                        const active = isActive(item.href);

                        return (
                            <Link
                                prefetch={false}
                                key={item.key}
                                href={item.href}
                                style={active ? { backgroundColor: 'var(--mod-bg)', color: 'var(--mod-fg)', borderColor: 'var(--mod-border)' } : undefined}
                                className={cn(
                                    'flex items-center gap-2.5 px-2.5 py-[5px] rounded-md text-[13px] font-medium transition-colors',
                                    'hover:bg-slate-100 dark:hover:bg-white/5',
                                    active
                                        ? 'border-l-[3px] pl-[7px]'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                                    !isOpen && 'justify-center px-1.5'
                                )}
                                title={!isOpen ? item.label : undefined}
                            >
                                <Icon
                                    style={active ? { color: 'var(--mod-fg)' } : undefined}
                                    className="w-[15px] h-[15px] flex-shrink-0"
                                />
                                {isOpen && (
                                    <>
                                        <span className="flex-1 truncate">{item.label}</span>
                                        {item.badge === 'new' && (
                                            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 uppercase tracking-wider">
                                                New
                                            </span>
                                        )}
                                        {item.badge === 'beta' && (
                                            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 uppercase tracking-wider">
                                                Beta
                                            </span>
                                        )}
                                    </>
                                )}
                            </Link>
                        );
                    })}

                    {/* Gizmo re-enable (only when hidden) */}
                    <GizmoReEnableButton isOpen={isOpen} />
                </nav>

                {/* Sign Out — pinned to footer for visibility */}
                <div className={cn('border-t border-slate-200/80 dark:border-white/5 px-2 py-2', !isOpen && 'px-1.5')}>
                    <button
                        type="button"
                        onClick={handleSignOut}
                        title={!isOpen ? 'Sign out' : undefined}
                        className={cn(
                            'w-full flex items-center gap-2.5 px-2.5 py-[6px] rounded-md text-[13px] font-medium transition-colors',
                            'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300',
                            !isOpen && 'justify-center px-1.5'
                        )}
                    >
                        <LogOut className="w-[15px] h-[15px] flex-shrink-0" />
                        {isOpen && <span className="flex-1 text-left">Sign out</span>}
                    </button>
                </div>

                {/* Toggle Button */}
                <button
                    onClick={onToggle}
                    className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm z-10 opacity-0 hover:opacity-100 group-hover/sidebar:opacity-100 transition-opacity"
                >
                    {isOpen ? (
                        <ChevronLeft className="w-3 h-3" />
                    ) : (
                        <ChevronRight className="w-3 h-3" />
                    )}
                </button>
            </aside>

            {/* Mobile Sidebar - Slide-in Drawer */}
            <aside
                data-crm-module={activeTopModule}
                className={cn(
                    'fixed top-[5.5rem] left-0 bottom-0 w-72 z-40 lg:hidden',
                    'flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/10',
                    'transform transition-transform duration-300 ease-in-out',
                    mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                {/* Mobile Module switcher */}
                <ModuleSwitcherRail expanded />

                <div className="px-4 py-2 border-b border-slate-200 dark:border-white/5">
                    <h2 className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.14em]">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'var(--mod-fg)' }} aria-hidden />
                        {moduleTitle[activeTopModule]} menu
                    </h2>
                </div>

                {/* Mobile Quick Search */}
                <div className="px-3 pt-3 pb-1">
                    <SidebarSearchTrigger />
                </div>

                {/* Mobile Navigation Items */}
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
                    {navItems.map((item) => {
                        if (item.separator) {
                            return (
                                <div key={item.key} className="pt-4 pb-1">
                                    {item.sectionTitle ? (
                                        <p className="px-4 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em]">
                                            {item.sectionTitle}
                                        </p>
                                    ) : (
                                        <hr className="border-slate-200 dark:border-white/10" />
                                    )}
                                </div>
                            );
                        }

                        const Icon = getIcon(item.icon);
                        const active = isActive(item.href);

                        return (
                            <Link
                                prefetch={false}
                                key={item.key}
                                href={item.href}
                                onClick={handleLinkClick}
                                style={active ? { backgroundColor: 'var(--mod-bg)', color: 'var(--mod-fg)', borderColor: 'var(--mod-border)' } : undefined}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                                    'hover:bg-slate-100 dark:hover:bg-white/5',
                                    'active:scale-[0.98]',
                                    active
                                        ? 'border-l-[3px]'
                                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                )}
                            >
                                <Icon
                                    style={active ? { color: 'var(--mod-fg)' } : undefined}
                                    className="w-5 h-5 flex-shrink-0"
                                />
                                <span className="flex-1">{item.label}</span>
                                {item.badge === 'new' && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 uppercase">
                                        New
                                    </span>
                                )}
                                {item.badge === 'beta' && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 uppercase">
                                        Beta
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Mobile Footer - Quick Actions */}
                <div className="p-4 border-t border-slate-200 dark:border-white/5 space-y-2">
                    <Link
                        prefetch={false}
                        href="/crm/settings"
                        onClick={handleLinkClick}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                        <Settings className="w-5 h-5" />
                        <span>Settings</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => {
                            handleSignOut();
                            handleLinkClick();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Sign out</span>
                    </button>
                </div>
            </aside>
        </>
    );
}

/** Small button shown at bottom of sidebar nav when Gizmo is globally disabled */
function GizmoReEnableButton({ isOpen }: { isOpen: boolean }) {
    const gizmo = useGizmoSafe();

    // If GizmoProvider isn't mounted yet or Gizmo is enabled, don't show
    if (!gizmo || gizmo.enabled) return null;

    return (
        <button
            onClick={() => gizmo.setEnabled(true)}
            className={cn(
                'flex items-center gap-2.5 px-3 py-2 mt-4 rounded-lg text-sm font-medium transition-colors',
                'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10',
                !isOpen && 'justify-center px-2'
            )}
            title="Show Gizmo page tips"
        >
            <Lightbulb className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span>Show Gizmo Tips</span>}
        </button>
    );
}
