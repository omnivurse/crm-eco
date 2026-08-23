// @vitest-environment jsdom
/**
 * RP-M2 — the record page never fails open silently. The layout fetch is a
 * server-side Supabase call (the browser cannot throttle it in the walk), so
 * this pins the banner contract instead: transient error → alert + working
 * Retry (router.refresh); missing layout row → configuration notice naming
 * the module with a door to Settings → Layouts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, replace: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { RecordLayoutNotice, recordLayoutNoticeCopy } from './RecordLayoutNotice';
import { toastCopy } from '@/lib/crm/toast-copy';

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe('recordLayoutNoticeCopy', () => {
  it('error copy is in the toastCopy voice with a Retry action', () => {
    const copy = recordLayoutNoticeCopy('error', 'Contacts');
    expect(copy.title).toBe(toastCopy.failed("load this record's layout"));
    expect(copy.description).toBe('Fields are shown in one section until it loads.');
    expect(copy.action).toBe('Retry');
  });

  it('missing copy names the module and points at Settings → Layouts', () => {
    const copy = recordLayoutNoticeCopy('missing', 'Contacts');
    expect(copy.title).toBe('No default layout for Contacts');
    expect(copy.action).toBe('Open Layouts');
  });
});

describe('RecordLayoutNotice', () => {
  it("error: renders role=alert and Retry calls router.refresh (no silent fail-open)", () => {
    render(<RecordLayoutNotice kind="error" moduleName="Contacts" />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(toastCopy.failed("load this record's layout"));
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('missing: renders role=status with the Layouts door', () => {
    render(<RecordLayoutNotice kind="missing" moduleName="Members" />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('No default layout for Members');
    const door = screen.getByRole('link', { name: 'Open Layouts' });
    expect(door.getAttribute('href')).toBe('/crm/settings/layouts');
  });
});
