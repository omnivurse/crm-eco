'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import {
    LayoutDashboard,
    UserPlus,
    Users,
    Building,
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
    BookOpen,
    ClipboardCheck,
    Heart,
    Award,
    Layers,
    List,
    Layout,
    Zap,
    Upload,
    Settings,
    ChevronLeft,
    ChevronRight,
    Video,
    type LucideIcon,
} from 'lucide-react';
import { useModule, getNavItemsForModule, TopModule } from '@/contexts/ModuleContext';

// Icon mapping for all nav items
const iconMap: Record<string, LucideIcon> = {
    'layout-dashboard': LayoutDashboard,
    'user-plus': UserPlus,
    'users': Users,
    'building': Building,
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
    'chart-line': TrendingUp,
    'book-open': BookOpen,
    'clipboard-check': ClipboardCheck,
    'heart': Heart,
    'award': Award,
    'layers': Layers,
    'list': List,
    'layout': Layout,
    'zap': Zap,
    'upload': Upload,
    'settings': Settings,
    'video': Video,
};

function getIcon(iconName: string): LucideIcon {
    return iconMap[iconName] || FileText;
}

interface ZohoContextualSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
}

export function ZohoContextualSidebar({ isOpen, onToggle }: ZohoContextualSidebarProps) {
    const pathname = usePathname();

    // Determine active module from pathname - order matters (more specific first)
    const getActiveFromPath = (): TopModule => {
        // Settings routes (most specific)
        if (pathname.startsWith('/crm/settings')) return 'settings';

        // Integrations
        if (pathname.startsWith('/crm/integrations')) return 'integrations';

        // Analytics & Reports
        if (pathname.startsWith('/crm/analytics')) return 'analytics';

        // Operations: scheduling, playbooks, enrollment, needs, approvals
        if (pathname.startsWith('/crm/operations') ||
            pathname.startsWith('/crm/scheduling') ||
            pathname.startsWith('/crm/playbooks') ||
            pathname.startsWith('/crm/enrollment') ||
            pathname.startsWith('/crm/needs') ||
            pathname.startsWith('/crm/approvals')) return 'operations';

        // Revenue: products, quotes, invoices, documents, forecasting, commissions, revenue overview
        if (pathname.startsWith('/crm/revenue') ||
            pathname.startsWith('/crm/products') ||
            pathname.startsWith('/crm/quotes') ||
            pathname.startsWith('/crm/invoices') ||
            pathname.startsWith('/crm/documents') ||
            pathname.startsWith('/crm/forecasting') ||
            pathname.startsWith('/crm/commissions')) return 'revenue';

        // Communications: inbox, communications
        if (pathname.startsWith('/crm/communications') ||
            pathname.startsWith('/crm/inbox')) return 'communications';

        // Default to CRM for: dashboard, modules (leads/contacts/deals), accounts, pipeline, activities, tasks, reports
        return 'crm';
    };

    const activeTopModule = getActiveFromPath();
    const navItems = getNavItemsForModule(activeTopModule);

    const isActive = (href: string) => {
        if (href === '/crm') {
            return pathname === '/crm';
        }
        return pathname.startsWith(href);
    };

    // Module titles
    const moduleTitle: Record<TopModule, string> = {
        crm: 'CRM',
        communications: 'Communications',
        revenue: 'Revenue',
        operations: 'Operations',
        analytics: 'Analytics',
        integrations: 'Integrations',
        settings: 'Settings',
    };

    return (
        <aside
            className={cn(
                'relative flex flex-col border-r border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-200',
                isOpen ? 'w-56' : 'w-16'
            )}
        >
            {/* Module Title */}
            {isOpen && (
                <div className="px-4 py-3 border-b border-slate-200 dark:border-white/5">
                    <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {moduleTitle[activeTopModule]}
                    </h2>
                </div>
            )}

            {/* Navigation Items */}
            <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = getIcon(item.icon);
                    const active = isActive(item.href);

                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                                'hover:bg-slate-100 dark:hover:bg-white/5',
                                active
                                    ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-l-2 border-teal-500'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                                !isOpen && 'justify-center px-2'
                            )}
                            title={!isOpen ? item.label : undefined}
                        >
                            <Icon className={cn(
                                'w-5 h-5 flex-shrink-0',
                                active && 'text-teal-600 dark:text-teal-400'
                            )} />
                            {isOpen && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white shadow-sm z-10"
            >
                {isOpen ? (
                    <ChevronLeft className="w-4 h-4" />
                ) : (
                    <ChevronRight className="w-4 h-4" />
                )}
            </button>
        </aside>
    );
}
