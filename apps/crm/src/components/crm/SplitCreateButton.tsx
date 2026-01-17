'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import {
    Plus,
    ChevronDown,
    Users,
    UserPlus,
    DollarSign,
    Building2,
    FileText,
    Receipt,
    Package,
    CalendarPlus,
    Mail,
    Phone,
    ClipboardList,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface CreateOption {
    key: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    href?: string;
    onClick?: () => void;
    shortcut?: string;
}

export interface SplitCreateButtonProps {
    /** Primary action when main button is clicked */
    primaryAction?: CreateOption;
    /** Additional options in dropdown */
    options?: CreateOption[];
    /** Size variant */
    size?: 'default' | 'sm' | 'lg';
    /** Custom className */
    className?: string;
    /** Whether to show keyboard shortcuts */
    showShortcuts?: boolean;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: CreateOption[] = [
    {
        key: 'contact',
        label: 'Contact',
        description: 'Add a new contact',
        icon: <Users className="w-4 h-4" />,
        href: '/crm/modules/contacts/new',
        shortcut: 'C',
    },
    {
        key: 'lead',
        label: 'Lead',
        description: 'Create a new lead',
        icon: <UserPlus className="w-4 h-4" />,
        href: '/crm/modules/leads/new',
        shortcut: 'L',
    },
    {
        key: 'deal',
        label: 'Deal',
        description: 'Start a new deal',
        icon: <DollarSign className="w-4 h-4" />,
        href: '/crm/modules/deals/new',
        shortcut: 'D',
    },
    {
        key: 'account',
        label: 'Account',
        description: 'Add a company',
        icon: <Building2 className="w-4 h-4" />,
        href: '/crm/modules/accounts/new',
        shortcut: 'A',
    },
];

const SECONDARY_OPTIONS: CreateOption[] = [
    {
        key: 'quote',
        label: 'Quote',
        description: 'Create a quote',
        icon: <FileText className="w-4 h-4" />,
        href: '/crm/quotes/new',
    },
    {
        key: 'invoice',
        label: 'Invoice',
        description: 'Create an invoice',
        icon: <Receipt className="w-4 h-4" />,
        href: '/crm/invoices/new',
    },
    {
        key: 'product',
        label: 'Product',
        description: 'Add a product',
        icon: <Package className="w-4 h-4" />,
        href: '/crm/products/new',
    },
    {
        key: 'task',
        label: 'Task',
        description: 'Create a task',
        icon: <ClipboardList className="w-4 h-4" />,
        href: '/crm/tasks/new',
    },
    {
        key: 'meeting',
        label: 'Meeting',
        description: 'Schedule a meeting',
        icon: <CalendarPlus className="w-4 h-4" />,
        href: '/crm/scheduling/new',
    },
];

// ============================================================================
// Component
// ============================================================================

export function SplitCreateButton({
    primaryAction,
    options = DEFAULT_OPTIONS,
    size = 'default',
    className,
    showShortcuts = true,
}: SplitCreateButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const primary = primaryAction || options[0];
    const dropdownOptions = primaryAction ? options : options.slice(1);

    const handleOptionClick = (option: CreateOption) => {
        if (option.onClick) {
            option.onClick();
        } else if (option.href) {
            router.push(option.href);
        }
        setOpen(false);
    };

    const sizeClasses = {
        default: 'h-10',
        sm: 'h-9 text-sm',
        lg: 'h-11 text-base',
    };

    return (
        <div className={cn('inline-flex rounded-lg shadow-sm', className)}>
            {/* Primary Button */}
            <Button
                onClick={() => handleOptionClick(primary)}
                className={cn(
                    'rounded-r-none border-r-0',
                    'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400',
                    'text-white font-medium',
                    sizeClasses[size]
                )}
            >
                {primary.icon}
                <span className="ml-2">New {primary.label}</span>
            </Button>

            {/* Dropdown Button */}
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        className={cn(
                            'rounded-l-none px-2',
                            'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500',
                            'text-white border-l border-white/20',
                            sizeClasses[size]
                        )}
                    >
                        <ChevronDown className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    className="w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                >
                    <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
                        Quick Create
                    </DropdownMenuLabel>

                    {/* Primary Options */}
                    {dropdownOptions.map((option) => (
                        <DropdownMenuItem
                            key={option.key}
                            onClick={() => handleOptionClick(option)}
                            className="flex items-center gap-3 py-2.5 cursor-pointer focus:bg-teal-50 dark:focus:bg-teal-500/10"
                        >
                            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {option.icon}
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                    {option.label}
                                </div>
                                {option.description && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {option.description}
                                    </div>
                                )}
                            </div>
                            {showShortcuts && option.shortcut && (
                                <kbd className="hidden sm:inline-flex items-center justify-center w-6 h-6 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700">
                                    {option.shortcut}
                                </kbd>
                            )}
                        </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700" />

                    <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
                        More
                    </DropdownMenuLabel>

                    {/* Secondary Options */}
                    {SECONDARY_OPTIONS.map((option) => (
                        <DropdownMenuItem
                            key={option.key}
                            onClick={() => handleOptionClick(option)}
                            className="flex items-center gap-3 py-2 cursor-pointer focus:bg-teal-50 dark:focus:bg-teal-500/10"
                        >
                            <div className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {option.icon}
                            </div>
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                {option.label}
                            </span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

// ============================================================================
// Compact Version (icon only with dropdown)
// ============================================================================

export function QuickCreateButton({ className }: { className?: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const handleOptionClick = (option: CreateOption) => {
        if (option.onClick) {
            option.onClick();
        } else if (option.href) {
            router.push(option.href);
        }
        setOpen(false);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    size="icon"
                    className={cn(
                        'h-10 w-10 rounded-full',
                        'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400',
                        'text-white shadow-lg hover:shadow-xl transition-shadow',
                        className
                    )}
                >
                    <Plus className="w-5 h-5" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            >
                <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">
                    Create New
                </DropdownMenuLabel>

                {[...DEFAULT_OPTIONS, ...SECONDARY_OPTIONS].map((option) => (
                    <DropdownMenuItem
                        key={option.key}
                        onClick={() => handleOptionClick(option)}
                        className="flex items-center gap-2.5 py-2 cursor-pointer"
                    >
                        <span className="text-slate-500 dark:text-slate-400">
                            {option.icon}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                            {option.label}
                        </span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
