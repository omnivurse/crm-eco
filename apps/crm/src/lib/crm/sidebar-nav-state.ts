/**
 * Route-aware state for the CRM navigation rail.
 *
 * The inbox is a workspace, not a page: folders, the conversation list and the
 * reading pane each need width, and a 240px CRM menu beside them leaves the
 * email itself the narrowest column on screen. So the rail collapses on
 * workspace routes and comes back exactly as the user left it everywhere else.
 *
 * Only two things are genuinely remembered — the rail's state on ordinary
 * pages, and a manual override for the current workspace visit. Whether the
 * rail is open *right now* is derived from those plus the route, never stored:
 * a stored copy has to be corrected during render as the route or the saved
 * preference changes, and that extra render pass desynchronises `useId`
 * between the server and client trees (Radix ids in the top bar came back
 * mismatched on every inbox load).
 *
 * Kept as pure functions rather than a pile of effects in `CrmShell` because
 * the interesting behaviour is the interaction between three inputs — the
 * route, the saved preference, and a manual toggle — and that is only worth
 * trusting if it can be tested without a browser.
 */

import { isCrmFullBleedPath } from './full-bleed-main';

/** The remembered half: everything else about the rail is derived from this. */
export interface SidebarNavState {
  /**
   * Rail state for ordinary pages. This is what the user comes back to after
   * a workspace visit, so a rail they had already collapsed stays collapsed.
   */
  pageOpen: boolean;
  /**
   * The user toggled the rail during this workspace visit. Their choice then
   * outranks both the route and a late-arriving saved preference — otherwise
   * the rail would snap shut under their cursor the moment the profile fetch
   * resolved. `null` until they touch it.
   */
  workspaceOverride: boolean | null;
}

/** What the shell renders this frame. Derived, never stored. */
export interface SidebarNavView {
  open: boolean;
  /** The current route collapses the rail by default. */
  workspace: boolean;
}

export interface SidebarNavOptions {
  /** `inbox_prefs.collapse_nav_on_inbox`. */
  autoCollapse: boolean;
}

/** Workspace routes hand their full width to the page. Today: the inbox. */
export function isWorkspaceRoute(pathname: string | null | undefined): boolean {
  return isCrmFullBleedPath(pathname);
}

/** Nothing remembered yet: the rail is open on ordinary pages. */
export function initialSidebarNavState(): SidebarNavState {
  return { pageOpen: true, workspaceOverride: null };
}

/**
 * The rail for this route. Pure, so a navigation, a late preference and a
 * re-render all resolve to the same answer without a state write.
 */
export function resolveSidebarNav(
  state: SidebarNavState,
  pathname: string | null | undefined,
  options: SidebarNavOptions,
): SidebarNavView {
  const workspace = isWorkspaceRoute(pathname);
  if (!workspace) return { open: state.pageOpen, workspace: false };
  return { open: state.workspaceOverride ?? !options.autoCollapse, workspace: true };
}

/** The user clicked the collapse handle. */
export function sidebarNavForToggle(
  state: SidebarNavState,
  pathname: string | null | undefined,
  options: SidebarNavOptions,
): SidebarNavState {
  const { open, workspace } = resolveSidebarNav(state, pathname, options);
  // Inside the workspace the toggle is an override for this visit; outside it
  // *is* the rail's remembered state, and so also the restore point.
  return workspace
    ? { ...state, workspaceOverride: !open }
    : { ...state, pageOpen: !open };
}

/**
 * Drop a workspace override once the user has left the workspace, so the next
 * visit honours the saved preference again.
 *
 * Safe to apply after paint: `resolveSidebarNav` ignores the override on every
 * non-workspace route, so clearing it is unobservable until the user navigates
 * back — long after the effect has run.
 */
export function sidebarNavForRoute(
  state: SidebarNavState,
  pathname: string | null | undefined,
): SidebarNavState {
  if (isWorkspaceRoute(pathname) || state.workspaceOverride === null) return state;
  return { ...state, workspaceOverride: null };
}
