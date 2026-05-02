/** A single contextual tip for a CRM page */
export interface GizmoTip {
  /** Unique stable ID for persistence, e.g. "contacts-horizontal-scroll" */
  id: string;
  /** Short title shown in the tip card header */
  title: string;
  /** 1-2 sentence explanation in Gizmo's friendly voice */
  body: string;
  /** Lucide graphic name matching {@link ./gizmo-tip-icon.tsx GIZMO_TIP_ICONS} keys (kebab-case) */
  icon?: string;
  /** Optional link to the full learn page */
  learnMoreHref?: string;
}

/** A route pattern mapped to its tip set */
export interface GizmoTipSet {
  /** Human-readable page name, e.g. "Contacts" */
  pageLabel: string;
  /** Tips for this page, shown in order */
  tips: GizmoTip[];
}

/** Shape of the persisted localStorage state */
export interface GizmoPersistedState {
  /** Global toggle -- if false, Gizmo never shows */
  enabled: boolean;
  /** Set of tip IDs that the user has dismissed */
  dismissedTipIds: string[];
  /** Whether the user has completed the initial welcome */
  welcomeCompleted: boolean;
}

/** Full context shape exposed to consumers */
export interface GizmoContextValue {
  /** Whether Gizmo is globally enabled */
  enabled: boolean;
  /** Toggle Gizmo on/off globally */
  setEnabled: (enabled: boolean) => void;
  /** Tips for the current page (already filtered of dismissed ones) */
  currentTips: GizmoTip[];
  /** All tips for the current page (including dismissed) */
  allCurrentTips: GizmoTip[];
  /** Page label for the current route */
  currentPageLabel: string | null;
  /** Dismiss a single tip by ID */
  dismissTip: (tipId: string) => void;
  /** Dismiss all tips for the current page */
  dismissAllCurrentTips: () => void;
  /** Reset all dismissed tips (show everything again) */
  resetAllTips: () => void;
  /** Whether there are undismissed tips for the current page */
  hasNewTips: boolean;
  /** The popover open/closed state */
  isOpen: boolean;
  /** Control popover */
  setIsOpen: (open: boolean) => void;
}
