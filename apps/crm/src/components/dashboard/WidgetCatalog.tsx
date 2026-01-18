'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Check } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@crm-eco/ui/components/dialog';
import { Input } from '@crm-eco/ui/components/input';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  WIDGET_REGISTRY,
  WIDGET_CATEGORIES,
  type WidgetDefinition,
} from '@/lib/dashboard/widget-registry';
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext';

export function WidgetCatalog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { addWidget, layout } = useDashboardLayout();

  const filteredWidgets = useMemo(() => {
    return Object.values(WIDGET_REGISTRY).filter((widget) => {
      const matchesSearch =
        widget.name.toLowerCase().includes(search.toLowerCase()) ||
        widget.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        !selectedCategory || widget.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  const activeWidgetTypes = useMemo(
    () => new Set(layout.widgets.map((w) => w.type)),
    [layout.widgets]
  );

  const handleAddWidget = (widget: WidgetDefinition) => {
    addWidget(widget.id, widget.defaultSize);
    setOpen(false);
    setSearch('');
    setSelectedCategory(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Widget
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Widget Catalog</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Browse and add widgets to customize your dashboard
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search widgets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 flex-wrap py-2">
          <Button
            variant={!selectedCategory ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="h-8"
          >
            All
          </Button>
          {WIDGET_CATEGORIES.map((cat) => {
            const Icon = (
              LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>
            )[cat.icon];
            return (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="h-8 gap-1.5"
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {cat.label}
              </Button>
            );
          })}
        </div>

        {/* Widget Grid */}
        <div className="grid grid-cols-2 gap-3 overflow-y-auto flex-1 pr-2 py-2">
          {filteredWidgets.map((widget) => {
            const Icon = (
              LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>
            )[widget.icon];
            const isActive = activeWidgetTypes.has(widget.id);

            return (
              <button
                key={widget.id}
                onClick={() => handleAddWidget(widget)}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all',
                  'hover:border-teal-500/50 hover:bg-teal-50/50 dark:hover:bg-teal-500/10',
                  'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
                  isActive
                    ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-700'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'p-2.5 rounded-lg',
                      isActive
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : 'bg-slate-100 dark:bg-slate-800'
                    )}
                  >
                    {Icon && (
                      <Icon
                        className={cn(
                          'w-5 h-5',
                          isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-400'
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm text-slate-900 dark:text-white">
                        {widget.name}
                      </h4>
                      {isActive && (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {widget.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {widget.category}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {widget.defaultSize}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filteredWidgets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">
              No widgets found matching your search
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
