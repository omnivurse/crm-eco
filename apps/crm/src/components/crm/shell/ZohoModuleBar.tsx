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
        if (pathname.startsWith('/crm/analytics') || pathname.startsWith('/crm/reports') || pathname.startsWith('/crm/executive')) return 'analytics';
        if (pathname.startsWith('/crm/operations') || pathname.startsWith('/crm/scheduling') || pathname.startsWith('/crm/playbooks') || pathname.startsWith('/crm/enrollment') || pathname.startsWith('/crm/needs') || pathname.startsWith('/crm/approvals') || pathname.startsWith('/crm/vendors')) return 'operations';
        if (pathname.startsWith('/crm/revenue') || pathname.startsWith('/crm/products') || pathname.startsWith('/crm/quotes') || pathname.startsWith('/crm/invoices') || pathname.startsWith('/crm/forecasting') || pathname.startsWith('/crm/commissions')) return 'revenue';
        if (pathname.startsWith('/crm/communications') || pathname.startsWith('/crm/inbox') || pathname.startsWith('/crm/campaigns') || pathname.startsWith('/crm/sequences') || pathname.startsWith('/crm/email')) return 'communications';
        return 'crm';
    };

    const currentActive = getActiveFromPath();

    return (
        <nav className="flex items-center gap-px">
            {TOP_MODULES.map((module) => {
                const Icon = getIcon(module.icon);
                const isActive = currentActive === module.key;

                return (
                    <Link
                        key={module.key}
                        href={module.href}
                        onClick={() => handleModuleClick(module.key)}
                        className={cn(
                            'relative flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap',
                            'hover:text-teal-700 dark:hover:text-teal-300',
                            isActive
                                ? 'text-teal-700 dark:text-teal-300'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                        )}
                    >
                        <Icon className={cn(
                            'w-3.5 h-3.5',
                            isActive ? 'text-teal-600 dark:text-teal-400' : ''
                        )} />
                        <span className="hidden xl:inline">{module.label}</span>
                        {isActive && (
                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-[2px] rounded-full bg-teal-500 dark:bg-teal-400" />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
