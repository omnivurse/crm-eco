import { describe, expect, it } from 'vitest';
import {
  initialSidebarNavState,
  isWorkspaceRoute,
  resolveSidebarNav,
  sidebarNavForRoute,
  sidebarNavForToggle,
} from './sidebar-nav-state';

const AUTO = { autoCollapse: true };
const MANUAL = { autoCollapse: false };

const INBOX = '/crm/inbox';
const PAGE = '/crm/contacts';

/** The rail as the shell would render it for a given route. */
const openAt = (
  state: Parameters<typeof resolveSidebarNav>[0],
  pathname: string,
  options = AUTO,
) => resolveSidebarNav(state, pathname, options).open;

describe('isWorkspaceRoute', () => {
  it('treats the inbox as a workspace and normal pages as not', () => {
    expect(isWorkspaceRoute(INBOX)).toBe(true);
    expect(isWorkspaceRoute('/crm/inbox?c=abc')).toBe(true);
    expect(isWorkspaceRoute(PAGE)).toBe(false);
    expect(isWorkspaceRoute(null)).toBe(false);
  });
});

describe('resolveSidebarNav', () => {
  it('lands on the inbox already collapsed', () => {
    expect(openAt(initialSidebarNavState(), INBOX)).toBe(false);
  });

  it('leaves the rail open elsewhere', () => {
    expect(openAt(initialSidebarNavState(), PAGE)).toBe(true);
  });

  it('respects a user who turned auto-collapse off', () => {
    expect(openAt(initialSidebarNavState(), INBOX, MANUAL)).toBe(true);
  });

  it('collapses on the way in and restores on the way out', () => {
    const state = initialSidebarNavState();
    expect(openAt(state, PAGE)).toBe(true);
    expect(openAt(state, INBOX)).toBe(false);
    expect(openAt(state, PAGE)).toBe(true);
  });

  it('restores a rail the user had already collapsed, not a forced-open one', () => {
    // User collapsed it on a normal page.
    const state = sidebarNavForToggle(initialSidebarNavState(), PAGE, AUTO);
    expect(openAt(state, PAGE)).toBe(false);
    expect(openAt(state, INBOX)).toBe(false);
    expect(openAt(state, PAGE)).toBe(false);
  });

  it('is a no-op when only the query string changes', () => {
    const opened = sidebarNavForToggle(initialSidebarNavState(), INBOX, AUTO);
    expect(openAt(opened, INBOX)).toBe(openAt(opened, '/crm/inbox?c=abc'));
  });

  it('applies a preference that arrives after first paint', () => {
    // The profile fetch resolves a beat after mount; the rail must follow it
    // with no state write, so the same stored state yields both answers.
    const state = initialSidebarNavState();
    expect(openAt(state, INBOX, AUTO)).toBe(false);
    expect(openAt(state, INBOX, MANUAL)).toBe(true);
  });

  it('never lets a late preference override a rail the user just toggled', () => {
    const openedByUser = sidebarNavForToggle(initialSidebarNavState(), INBOX, AUTO);
    expect(openAt(openedByUser, INBOX, AUTO)).toBe(true);
    expect(openAt(openedByUser, INBOX, MANUAL)).toBe(true);
  });
});

describe('sidebarNavForToggle', () => {
  it('flips the rail inside the workspace and records the choice', () => {
    const state = sidebarNavForToggle(initialSidebarNavState(), INBOX, AUTO);
    expect(openAt(state, INBOX)).toBe(true);
    expect(state.workspaceOverride).toBe(true);
  });

  it('updates what gets restored when toggled off a workspace route', () => {
    const state = sidebarNavForToggle(initialSidebarNavState(), PAGE, AUTO);
    expect(state.pageOpen).toBe(false);
    expect(openAt(state, PAGE)).toBe(false);
  });

  it('does not disturb the restore point while inside the workspace', () => {
    const state = sidebarNavForToggle(initialSidebarNavState(), INBOX, AUTO);
    expect(state.pageOpen).toBe(true);
    expect(openAt(state, PAGE)).toBe(true);
  });
});

describe('sidebarNavForRoute', () => {
  it('forgets the manual override once the user leaves the workspace', () => {
    let state = sidebarNavForToggle(initialSidebarNavState(), INBOX, AUTO);
    expect(openAt(state, INBOX)).toBe(true);

    state = sidebarNavForRoute(state, PAGE);
    expect(state.workspaceOverride).toBeNull();
    expect(openAt(state, INBOX)).toBe(false);
  });

  it('keeps the override while the user is still in the workspace', () => {
    const toggled = sidebarNavForToggle(initialSidebarNavState(), INBOX, AUTO);
    expect(sidebarNavForRoute(toggled, '/crm/inbox?c=abc')).toBe(toggled);
  });

  it('returns the same object when there is nothing to forget', () => {
    const state = initialSidebarNavState();
    expect(sidebarNavForRoute(state, PAGE)).toBe(state);
  });
});
