'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import type {
  DashboardLayoutConfig,
  WidgetInstance,
  WidgetSize,
} from '@/lib/dashboard/types';
import { DEFAULT_LAYOUT, WIDGET_REGISTRY } from '@/lib/dashboard/widget-registry';
import { saveDashboardLayout } from '@/app/crm/dashboard-actions';

interface DashboardLayoutContextValue {
  layout: DashboardLayoutConfig;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isEditMode: boolean;
  setEditMode: (editMode: boolean) => void;
  addWidget: (type: string, size?: WidgetSize) => void;
  removeWidget: (widgetId: string) => void;
  reorderWidgets: (activeId: string, overId: string) => void;
  resizeWidget: (widgetId: string, size: WidgetSize) => void;
  saveLayout: () => Promise<void>;
  resetToDefault: () => void;
  discardChanges: () => void;
}

const DashboardLayoutContext = createContext<DashboardLayoutContextValue | undefined>(
  undefined
);

export function DashboardLayoutProvider({
  children,
  initialLayout,
}: {
  children: ReactNode;
  initialLayout?: DashboardLayoutConfig;
}) {
  const [layout, setLayout] = useState<DashboardLayoutConfig>(
    initialLayout || DEFAULT_LAYOUT
  );
  const [originalLayout, setOriginalLayout] = useState<DashboardLayoutConfig>(
    initialLayout || DEFAULT_LAYOUT
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setEditModeState] = useState(false);

  const setEditMode = useCallback((editMode: boolean) => {
    setEditModeState(editMode);
    if (editMode) {
      setOriginalLayout(layout);
    }
  }, [layout]);

  const addWidget = useCallback(
    (type: string, size?: WidgetSize) => {
      const definition = WIDGET_REGISTRY[type];
      if (!definition) {
        toast.error(`Unknown widget type: ${type}`);
        return;
      }

      const newWidget: WidgetInstance = {
        id: `widget-${crypto.randomUUID()}`,
        type,
        position: layout.widgets.length,
        size: size || definition.defaultSize,
      };

      setLayout((prev) => ({
        widgets: [...prev.widgets, newWidget],
      }));
      setIsDirty(true);
      toast.success(`Added "${definition.name}" widget`);
    },
    [layout.widgets.length]
  );

  const removeWidget = useCallback((widgetId: string) => {
    setLayout((prev) => ({
      widgets: prev.widgets
        .filter((w) => w.id !== widgetId)
        .map((w, index) => ({ ...w, position: index })),
    }));
    setIsDirty(true);
  }, []);

  const reorderWidgets = useCallback((activeId: string, overId: string) => {
    setLayout((prev) => {
      const oldIndex = prev.widgets.findIndex((w) => w.id === activeId);
      const newIndex = prev.widgets.findIndex((w) => w.id === overId);

      if (oldIndex === -1 || newIndex === -1) return prev;

      const newWidgets = [...prev.widgets];
      const [removed] = newWidgets.splice(oldIndex, 1);
      newWidgets.splice(newIndex, 0, removed);

      return {
        widgets: newWidgets.map((w, index) => ({ ...w, position: index })),
      };
    });
    setIsDirty(true);
  }, []);

  const resizeWidget = useCallback((widgetId: string, size: WidgetSize) => {
    setLayout((prev) => ({
      widgets: prev.widgets.map((w) =>
        w.id === widgetId ? { ...w, size } : w
      ),
    }));
    setIsDirty(true);
  }, []);

  const saveLayout = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await saveDashboardLayout(layout);
      if (result.success) {
        setIsDirty(false);
        setOriginalLayout(layout);
        setEditModeState(false);
        toast.success('Dashboard layout saved');
      } else {
        toast.error(result.error || 'Failed to save layout');
      }
    } catch (error) {
      toast.error('Failed to save layout');
      console.error('Save layout error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [layout]);

  const resetToDefault = useCallback(async () => {
    setLayout(DEFAULT_LAYOUT);
    setIsDirty(true);
    toast.info('Reset to default layout - click Save to apply');
  }, []);

  const discardChanges = useCallback(() => {
    setLayout(originalLayout);
    setIsDirty(false);
    setEditModeState(false);
    toast.info('Changes discarded');
  }, [originalLayout]);

  return (
    <DashboardLayoutContext.Provider
      value={{
        layout,
        isDirty,
        isLoading,
        isSaving,
        isEditMode,
        setEditMode,
        addWidget,
        removeWidget,
        reorderWidgets,
        resizeWidget,
        saveLayout,
        resetToDefault,
        discardChanges,
      }}
    >
      {children}
    </DashboardLayoutContext.Provider>
  );
}

export function useDashboardLayout() {
  const context = useContext(DashboardLayoutContext);
  if (!context) {
    throw new Error(
      'useDashboardLayout must be used within DashboardLayoutProvider'
    );
  }
  return context;
}
