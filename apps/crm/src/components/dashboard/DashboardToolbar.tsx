'use client';

import { Settings2, Save, RotateCcw, X, Loader2 } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext';
import { WidgetCatalog } from './WidgetCatalog';

export function DashboardToolbar() {
  const {
    isEditMode,
    setEditMode,
    isDirty,
    isSaving,
    saveLayout,
    resetToDefault,
    discardChanges,
  } = useDashboardLayout();

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-xl border transition-all duration-300',
        isEditMode
          ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800'
          : 'bg-white dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-700/50'
      )}
    >
      <div className="flex items-center gap-3">
        {isEditMode ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100 dark:bg-teal-800/50 text-teal-700 dark:text-teal-300">
              <Settings2 className="w-4 h-4 animate-spin-slow" />
              <span className="text-sm font-medium">Edit Mode</span>
            </div>
            <WidgetCatalog />
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Customize your dashboard layout
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isEditMode ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefault}
              className="gap-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={discardChanges}
              className="gap-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveLayout}
              disabled={!isDirty || isSaving}
              className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Layout
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditMode(true)}
            className="gap-1.5"
          >
            <Settings2 className="w-4 h-4" />
            Customize
          </Button>
        )}
      </div>
    </div>
  );
}
