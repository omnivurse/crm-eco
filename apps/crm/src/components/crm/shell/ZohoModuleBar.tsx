'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import {
    Users,
    MessageSquare,
    DollarSign,
    Settings2,
    BarChart3,
    Plug,
    Settings,
    type LucideIcon,
} from 'lucide-react';
import { useModule, TopModule, TOP_MODULES } from '@/contexts/ModuleContext';

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
    'users': Users,
    'message-square': MessageSquare,
    'dollar-sign': DollarSign,
    'settings-2': Settings2,
    'bar-chart-3': BarChart3,
    'plug': Plug,
    'settings': Settings,
};

function getIcon(iconName: string): LucideIcon {
    return iconMap[iconName] || Users;
}

export function ZohoModuleBar() {
    const { activeModule, setActiveModule } = useModule();
    const pathname = usePathname();

    const handleModuleClick = (moduleKey: TopModule) => {
        setActiveModule(moduleKey);
    };

    // Determine active module from pathname
    const getActiveFromPath = (): TopModule => {
        if (pathname.startsWith('/crm/settings')) return 'settings';
        if (pathname.startsWith('/crm/integrations')) return 'integrations';
        if (pathname.startsWith('/crm/analytics') || pathname.startsWith('/crm/reports')) return 'analytics';
        if (pathname.startsWith('/crm/operations') || pathname.startsWith('/crm/scheduling') || pathname.startsWith('/crm/playbooks') || pathname.startsWith('/crm/enrollment') || pathname.startsWith('/crm/needs')) return 'operations';
        if (pathname.startsWith('/crm/revenue') || pathname.startsWith('/crm/pipeline') || pathname.startsWith('/crm/quotes') || pathname.startsWith('/crm/invoices') || pathname.startsWith('/crm/forecasting')) return 'revenue';
        if (pathname.startsWith('/crm/communications') || pathname.startsWith('/crm/inbox')) return 'communications';
        return 'crm';
    };

    const currentActive = getActiveFromPath();

    return (
        <nav className="flex items-center gap-1">
            {TOP_MODULES.map((module) => {
                const Icon = getIcon(module.icon);
                const isActive = currentActive === module.key;

                return (
                    <Link
                        key={module.key}
                        href={module.href}
                        onClick={() => handleModuleClick(module.key)}
                        className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                            'hover:bg-slate-100 dark:hover:bg-white/10',
                            isActive
                                ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        )}
                    >
                        <Icon className={cn(
                            'w-4 h-4',
                            isActive && 'text-teal-600 dark:text-teal-400'
                        )} />
                        <span className="hidden lg:inline">{module.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
