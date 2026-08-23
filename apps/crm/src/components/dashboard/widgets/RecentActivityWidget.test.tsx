// @vitest-environment jsdom
/**
 * A11Y-2 — the wave-4 chrome sweep audited the command desk for the first time
 * and axe returned one serious violation: `scrollable-region-focusable` on the
 * Recent Activity list. The list caps at 400px and scrolls, and an ActivityItem
 * contains no link, button or input — so keyboard-only users could not reach
 * anything below the fold. These tests pin the remedy.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import RecentActivityWidget from './RecentActivityWidget';
import type { CrmAuditLog } from '@/lib/crm/types';

function log(id: string): CrmAuditLog {
  return {
    id,
    action: 'update',
    entity: 'contact',
    created_at: '2026-08-23T12:00:00.000Z',
  } as unknown as CrmAuditLog;
}

function scroller(): HTMLElement {
  return screen.getByTestId('crm-widget-recent-activity-scroll');
}

describe('RecentActivityWidget scroll region (A11Y-2)', () => {
  it('the capped, scrolling list is reachable by keyboard', () => {
    render(<RecentActivityWidget data={[log('a'), log('b')]} size="medium" />);
    const el = scroller();
    expect(el.getAttribute('tabindex')).toBe('0');
    cleanup();
  });

  it('and announces itself — a bare tabindex would be an unnamed stop', () => {
    render(<RecentActivityWidget data={[log('a')]} size="medium" />);
    const el = scroller();
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Recent activity');
    // `role=region` with no name is itself an axe violation, so the two must
    // never be separated.
    expect(screen.getByRole('region', { name: 'Recent activity' })).toBe(el);
    cleanup();
  });

  it('keeps the cap that made it scrollable in the first place', () => {
    render(<RecentActivityWidget data={[log('a')]} size="medium" />);
    expect(scroller().className).toContain('max-h-[400px]');
    expect(scroller().className).toContain('overflow-y-auto');
    cleanup();
  });

  it('renders no scroll region at all when there is nothing to scroll', () => {
    render(<RecentActivityWidget data={[]} size="medium" />);
    expect(screen.queryByTestId('crm-widget-recent-activity-scroll')).toBeNull();
    expect(screen.getByText('No activity yet')).toBeTruthy();
    cleanup();
  });

  it('null data is the empty state, not a crash', () => {
    render(<RecentActivityWidget data={null} size="small" />);
    expect(screen.queryByTestId('crm-widget-recent-activity-scroll')).toBeNull();
    cleanup();
  });
});
