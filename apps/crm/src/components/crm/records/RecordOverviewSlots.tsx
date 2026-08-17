'use client';

/**
 * Slot context between the record detail shell and the overview field stack.
 *
 * The page (a server component) builds `<RecordOverviewPanel …/>` and hands
 * it to the shell as `children.overview`, so the shell cannot add props to it
 * directly. Shell-owned blocks that belong INSIDE the field stack — between
 * the Coverage Snapshot and the section cards (plan-change / dependent /
 * support histories, the recent-notes strip) — travel through this context
 * and are threaded down as an explicit `beforeSections` prop
 * (RecordOverviewPanel → RecordOverviewFields → InlineEditableRecordForm →
 * DynamicRecordForm). Without a provider the slot is empty, so the classic
 * shell and every other DynamicRecordForm caller are unaffected.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface RecordOverviewSlots {
  /** Rendered after the Coverage Snapshot, before the section cards. */
  beforeSections?: ReactNode;
}

const RecordOverviewSlotsContext = createContext<RecordOverviewSlots>({});

export function RecordOverviewSlotsProvider({
  beforeSections,
  children,
}: RecordOverviewSlots & { children: ReactNode }) {
  // Stable value while the slot content is unchanged, so consumers don't
  // re-render on every shell render.
  const value = useMemo(() => ({ beforeSections }), [beforeSections]);
  return (
    <RecordOverviewSlotsContext.Provider value={value}>
      {children}
    </RecordOverviewSlotsContext.Provider>
  );
}

/** Slot content from the nearest shell, or an empty object outside one. */
export function useRecordOverviewSlots(): RecordOverviewSlots {
  return useContext(RecordOverviewSlotsContext);
}
