'use client';

import { useState } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
    Search,
    Plus,
    ChevronDown,
    Filter,
    Columns3,
    Download,
    MoreHorizontal,
    Check,
    Star,
    Clock,
    Flame,
    User,
    type LucideIcon,
} from 'lucide-react';

export interface ViewOption {
    key: string;
    label: string;
    icon?: LucideIcon;
    isDefault?: boolean;
}

export interface ModuleHeaderProps {
    moduleName: string;
    moduleNamePlural?: string;
    recordCount?: number;
    views?: ViewOption[];
    currentView?: string;
    onViewChange?: (viewKey: string) => void;
    onSearch?: (query: string) => void;
    onCreateClick?: () => void;
    onFilterClick?: () => void;
    onColumnsClick?: () => void;
    onExportClick?: () => void;
    createLabel?: string;
}

const DEFAULT_VIEWS: ViewOption[] = [
    { key: 'all', label: 'All Records', icon: Columns3, isDefault: true },
    { key: 'my', label: 'My Records', icon: User },
    { key: 'recent', label: 'Recently Updated', icon: Clock },
    { key: 'starred', label: 'Starred', icon: Star },
    { key: 'hot', label: 'Hot Leads', icon: Flame },
];

export function ModuleHeader({
    moduleName,
    moduleNamePlural,
    recordCount,
    views = DEFAULT_VIEWS,
    currentView = 'all',
    onViewChange,
    onSearch,
    onCreateClick,
    onFilterClick,
    onColumnsClick,
    onExportClick,
    createLabel,
}: ModuleHeaderProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const currentViewOption = views.find(v => v.key === currentView) || views[0];
    const pluralName = moduleNamePlural || moduleName + 's';

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        onSearch?.(value);
    };

    return (
        <div className="space-y-4 mb-6">
            {/* Title Row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {pluralName}
                    </h1>
                    {recordCount !== undefined && (
                        <span className="px-2.5 py-0.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                            {recordCount.toLocaleString()}
                        </span>
                    )}
                </div>

                <Button
                    onClick={onCreateClick}
                    className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    {createLabel || `Create ${moduleName}`}
                </Button>
            </div>

            {/* Toolbar Row */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    {/* Views Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="h-9 px-3 gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                {currentViewOption?.icon && (
                                    <currentViewOption.icon className="w-4 h-4" />
                                )}
                                <span>{currentViewOption?.label || 'All Records'}</span>
                                <ChevronDown className="w-3 h-3 ml-1 text-slate-400" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 bg-white dark:bg-slate-900">
                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">
                                Views
                            </div>
                            {views.map((view) => (
                                <DropdownMenuItem
                                    key={view.key}
                                    onClick={() => onViewChange?.(view.key)}
                                    className={cn(
                                        'flex items-center gap-2 cursor-pointer',
                                        currentView === view.key && 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400'
                                    )}
                                >
                                    {view.icon && <view.icon className="w-4 h-4" />}
                                    <span>{view.label}</span>
                                    {currentView === view.key && (
                                        <Check className="w-4 h-4 ml-auto" />
                                    )}
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="flex items-center gap-2 text-teal-600 dark:text-teal-400 cursor-pointer">
                                <Plus className="w-4 h-4" />
                                Save Current View
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Filter Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onFilterClick}
                        className="h-9 px-3 gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline">Filters</span>
                    </Button>

                    {/* Columns Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onColumnsClick}
                        className="h-9 px-3 gap-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <Columns3 className="w-4 h-4" />
                        <span className="hidden sm:inline">Columns</span>
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder={`Search ${pluralName.toLowerCase()}...`}
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9 h-9 w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                        />
                    </div>

                    {/* More Actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900">
                            <DropdownMenuItem
                                onClick={onExportClick}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <Download className="w-4 h-4" />
                                Export to CSV
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
