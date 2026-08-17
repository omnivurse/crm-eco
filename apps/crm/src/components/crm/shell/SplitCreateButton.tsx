'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from '@crm-eco/ui/components/dropdown-menu';
import {
    Plus,
    ChevronDown,
    UserPlus,
    Users,
    Building,
    Zap,
    CheckSquare,
    Calendar,
    FileCheck,
    Receipt,
    Package,
    Upload,
    type LucideIcon,
} from 'lucide-react';

import type { CrmModule } from '@/lib/crm/types';
import type { QuickCreateModuleKey } from '@/lib/crm/quick-create-config';

interface CreateOption {
    label: string;
    description?: string;
    href: string;
    icon: LucideIcon;
    color: string;
}

/**
 * Record entries. `quick` opens the QuickCreateDrawer for that module (the
 * ~12-field one-screen path); `href` entries go to the full form. `moduleKey`
 * gates the entry on the org having that module enabled.
 */
interface RecordOption extends Omit<CreateOption, 'href'> {
    href?: string;
    quick?: QuickCreateModuleKey;
    moduleKey: string;
}

const RECORD_OPTIONS: RecordOption[] = [
    {
        label: 'Member',
        description: 'Quick add — the essentials from an enrollment',
        quick: 'contacts',
        moduleKey: 'contacts',
        icon: Zap,
        color: 'text-teal-600 dark:text-teal-400',
    },
    {
        label: 'Lead',
        description: 'Quick add a potential member',
        quick: 'leads',
        moduleKey: 'leads',
        icon: UserPlus,
        color: 'text-blue-600 dark:text-blue-400',
    },
    {
        label: 'Contact — full form',
        description: 'Every field, sectioned',
        href: '/crm/modules/contacts/new',
        moduleKey: 'contacts',
        icon: Users,
        color: 'text-indigo-600 dark:text-indigo-400',
    },
    {
        label: 'Lead — full form',
        description: 'Every field, sectioned',
        href: '/crm/modules/leads/new',
        moduleKey: 'leads',
        icon: UserPlus,
        color: 'text-slate-600 dark:text-slate-400',
    },
    {
        label: 'Account',
        description: 'Add a company or group',
        href: '/crm/modules/accounts/new',
        moduleKey: 'accounts',
        icon: Building,
        color: 'text-purple-600 dark:text-purple-400',
    },
];

const ACTIVITY_OPTIONS: CreateOption[] = [
    {
        label: 'Task',
        description: 'Add a to-do item',
        href: '/crm/tasks/new',
        icon: CheckSquare,
        color: 'text-amber-600 dark:text-amber-400',
    },
    {
        label: 'Meeting',
        description: 'Schedule a meeting',
        href: '/crm/scheduling/new',
        icon: Calendar,
        color: 'text-teal-600 dark:text-teal-400',
    },
];

const FINANCIAL_OPTIONS: CreateOption[] = [
    {
        label: 'Quote',
        description: 'Create a quote',
        href: '/crm/quotes/new',
        icon: FileCheck,
        color: 'text-blue-600 dark:text-blue-400',
    },
    {
        label: 'Invoice',
        description: 'Generate an invoice',
        href: '/crm/invoices/new',
        icon: Receipt,
        color: 'text-green-600 dark:text-green-400',
    },
    {
        label: 'Product',
        description: 'Add to catalog',
        href: '/crm/products/new',
        icon: Package,
        color: 'text-orange-600 dark:text-orange-400',
    },
];

interface SplitCreateButtonProps {
    className?: string;
    /** Fallback for the primary click when `onQuickCreate` is not provided. */
    defaultHref?: string;
    defaultLabel?: string;
    size?: 'sm' | 'default' | 'lg';
    /**
     * Opens the QuickCreateDrawer. When provided, the primary click opens
     * Add Member (contacts) and the quick menu entries call this too.
     */
    onQuickCreate?: (module: QuickCreateModuleKey) => void;
    /** Enabled org modules — record entries for disabled modules are hidden. */
    modules?: Pick<CrmModule, 'key' | 'is_enabled'>[];
}

export function SplitCreateButton({
    className,
    defaultHref = '/crm/modules/contacts/new',
    defaultLabel = 'Create',
    size = 'sm',
    onQuickCreate,
    modules,
}: SplitCreateButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    const isModuleEnabled = (key: string) =>
        !modules || modules.some((m) => m.key === key && m.is_enabled !== false);
    const recordOptions = RECORD_OPTIONS.filter((o) => isModuleEnabled(o.moduleKey));

    return (
        <div className={cn('flex items-center', className)}>
            {/* Primary Create Button — one click to Add Member */}
            {onQuickCreate ? (
                <Button
                    size={size}
                    className={cn(
                        'rounded-r-none font-medium shadow-sm',
                        size === 'sm' && 'h-8 px-3'
                    )}
                    onClick={() => onQuickCreate('contacts')}
                    aria-label="Add Member (quick create)"
                    title="Add Member — quick create"
                >
                    <Plus className="w-4 h-4 mr-1.5" />
                    {defaultLabel}
                </Button>
            ) : (
                <Button
                    size={size}
                    className={cn(
                        'rounded-r-none font-medium shadow-sm',
                        size === 'sm' && 'h-8 px-3'
                    )}
                    asChild
                >
                    <Link prefetch={false} href={defaultHref}>
                        <Plus className="w-4 h-4 mr-1.5" />
                        {defaultLabel}
                    </Link>
                </Button>
            )}

            {/* Dropdown Trigger */}
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        size={size}
                        className={cn(
                            'rounded-l-none border-l border-primary-foreground/20 shadow-sm px-2',
                            size === 'sm' && 'h-8'
                        )}
                    >
                        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
                        <span className="sr-only">More create options</span>
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    className="w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl"
                    sideOffset={8}
                >
                    {/* Records Section */}
                    <DropdownMenuLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Records
                    </DropdownMenuLabel>
                    {recordOptions.map((option) => {
                        const body = (
                            <>
                                <div className={cn('p-1.5 rounded-md bg-slate-100 dark:bg-slate-800', option.color)}>
                                    <option.icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                                        {option.label}
                                    </div>
                                    {option.description && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {option.description}
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                        // Quick entries open the drawer when the host wires it;
                        // otherwise they degrade to the full form for that module.
                        if (option.quick && onQuickCreate) {
                            const quick = option.quick;
                            return (
                                <DropdownMenuItem
                                    key={option.label}
                                    className="cursor-pointer flex items-center gap-3 py-2"
                                    onSelect={() => onQuickCreate(quick)}
                                >
                                    {body}
                                </DropdownMenuItem>
                            );
                        }
                        const href = option.href ?? `/crm/modules/${option.moduleKey}/new`;
                        return (
                            <DropdownMenuItem key={option.label} asChild className="cursor-pointer">
                                <Link prefetch={false} href={href} className="flex items-center gap-3 py-2">
                                    {body}
                                </Link>
                            </DropdownMenuItem>
                        );
                    })}

                    <DropdownMenuSeparator />

                    {/* Activities Section */}
                    <DropdownMenuLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Activities
                    </DropdownMenuLabel>
                    {ACTIVITY_OPTIONS.map((option) => (
                        <DropdownMenuItem key={option.label} asChild className="cursor-pointer">
                            <Link prefetch={false} href={option.href} className="flex items-center gap-3 py-2">
                                <div className={cn('p-1.5 rounded-md bg-slate-100 dark:bg-slate-800', option.color)}>
                                    <option.icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                                        {option.label}
                                    </div>
                                    {option.description && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {option.description}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />

                    {/* Financial Section */}
                    <DropdownMenuLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Financial
                    </DropdownMenuLabel>
                    {FINANCIAL_OPTIONS.map((option) => (
                        <DropdownMenuItem key={option.label} asChild className="cursor-pointer">
                            <Link prefetch={false} href={option.href} className="flex items-center gap-3 py-2">
                                <div className={cn('p-1.5 rounded-md bg-slate-100 dark:bg-slate-800', option.color)}>
                                    <option.icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                                        {option.label}
                                    </div>
                                    {option.description && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {option.description}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />

                    {/* Import Option */}
                    <DropdownMenuItem asChild className="cursor-pointer">
                        <Link prefetch={false} href="/crm/import" className="flex items-center gap-3 py-2">
                            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                <Upload className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                    Import Data
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    Bulk import from CSV
                                </div>
                            </div>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
