// @vitest-environment jsdom
/**
 * PERM-viewer-gated-link — /crm/import bounces a crm_viewer to
 * /crm?error=no_import_permission. This pins the reader on the other end:
 * the desk announces the refusal politely, dismissing clears both the banner
 * and the param, and an unknown ?error= value is never echoed into the page.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const replace = vi.fn();
let currentSearch = 'error=no_import_permission';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { DashboardGateNotice } from './DashboardGateNotice';
import { CRM_GATE_REASON, crmGateNoticeCopy } from '@/lib/crm/gate-notice-copy';

afterEach(() => {
  cleanup();
  replace.mockClear();
  currentSearch = 'error=no_import_permission';
});

describe('DashboardGateNotice', () => {
  it('announces the import gate in one voice', () => {
    render(<DashboardGateNotice reason={CRM_GATE_REASON.noImportPermission} />);
    const copy = crmGateNoticeCopy(CRM_GATE_REASON.noImportPermission)!;
    const notice = screen.getByTestId('crm-dashboard-gate-notice');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toContain(copy.title);
    expect(notice.textContent).toContain(copy.description);
    // What the walk looks for on the landing page.
    expect(notice.textContent).toMatch(/permission|read-only|no access/i);
  });

  it('renders nothing without a reason, or with one it does not know', () => {
    const { container } = render(<DashboardGateNotice reason={null} />);
    expect(container.innerHTML).toBe('');
    cleanup();
    const unknown = render(<DashboardGateNotice reason="made_up_reason" />);
    expect(unknown.container.innerHTML).toBe('');
  });

  it('dismissing hides the banner and drops the error param, keeping the rest', () => {
    currentSearch = 'error=no_import_permission&tab=today';
    render(<DashboardGateNotice reason={CRM_GATE_REASON.noImportPermission} />);
    fireEvent.click(screen.getByTestId('crm-dashboard-gate-notice-dismiss'));
    expect(screen.queryByTestId('crm-dashboard-gate-notice')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/crm?tab=today', { scroll: false });
  });

  it('dismissing with no other params lands on a clean /crm', () => {
    render(<DashboardGateNotice reason={CRM_GATE_REASON.noImportPermission} />);
    fireEvent.click(screen.getByTestId('crm-dashboard-gate-notice-dismiss'));
    expect(replace).toHaveBeenCalledWith('/crm', { scroll: false });
  });
});
