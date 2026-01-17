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
    DollarSign,
    CheckSquare,
    Calendar,
    FileCheck,
    Receipt,
    Package,
    Upload,
    type LucideIcon,
} from 'lucide-react';

interface CreateOption {
    label: string;
    description?: string;
    href: string;
    icon: LucideIcon;
    color: string;
}

const RECORD_OPTIONS: CreateOption[] = [
    {
        label: 'Lead',
        description: 'Add a potential customer',
        href: '/crm/modules/leads/new',
        icon: UserPlus,
        color: 'text-blue-600 dark:text-blue-400',
    },
    {
        label: 'Contact',
        description: 'Add a contact record',
        href: '/crm/modules/contacts/new',
        icon: Users,
        color: 'text-indigo-600 dark:text-indigo-400',
    },
    {
        label: 'Account',
        description: 'Add a company',
        href: '/crm/accounts/new',
        icon: Building,
        color: 'text-purple-600 dark:text-purple-400',
    },
    {
        label: 'Deal',
        description: 'Create a sales opportunity',
        href: '/crm/modules/deals/new',
        icon: DollarSign,
        color: 'text-emerald-600 dark:text-emerald-400',
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
    defaultHref?: string;
    defaultLabel?: string;
    size?: 'sm' | 'default' | 'lg';
}

export function SplitCreateButton({
    className,
    defaultHref = '/crm/modules/leads/new',
    defaultLabel = 'Create',
    size = 'sm',
}: SplitCreateButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={cn('flex items-center', className)}>
            {/* Primary Create Button */}
            <Link href={defaultHref}>
                <Button
                    size={size}
                    className={cn(
                        'rounded-r-none bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium shadow-sm',
                        size === 'sm' && 'h-9 px-3'
                    )}
                >
                    <Plus className="w-4 h-4 mr-1.5" />
                    {defaultLabel}
                </Button>
            </Link>

            {/* Dropdown Trigger */}
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        size={size}
                        className={cn(
                            'rounded-l-none border-l border-white/20 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white shadow-sm px-2',
                            size === 'sm' && 'h-9'
                        )}
                    >
                        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
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
                    {RECORD_OPTIONS.map((option) => (
                        <DropdownMenuItem key={option.label} asChild className="cursor-pointer">
                            <Link href={option.href} className="flex items-center gap-3 py-2">
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

                    {/* Activities Section */}
                    <DropdownMenuLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Activities
                    </DropdownMenuLabel>
                    {ACTIVITY_OPTIONS.map((option) => (
                        <DropdownMenuItem key={option.label} asChild className="cursor-pointer">
                            <Link href={option.href} className="flex items-center gap-3 py-2">
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
                            <Link href={option.href} className="flex items-center gap-3 py-2">
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
                        <Link href="/crm/import" className="flex items-center gap-3 py-2">
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
