// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useClientAuth', () => ({
  useClientAuth: () => ({ profile: { crm_role: 'crm_agent' } }),
}));

import { HistoryRosterBanner, PreviouslyCancelledChip } from './HistoryRosterBanner';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HistoryRosterBanner', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes('/lifecycle/')) {
          return {
            ok: true,
            json: async () => ({ events: [{ event_type: 'cancelled', event_date: '2024-01-01' }] }),
          };
        }
        if (url.includes('/reactivate')) {
          return { ok: true, json: async () => ({ success: true }) };
        }
        return { ok: false, json: async () => ({}) };
      }),
    );
  });

  it('shows Reactivate on History and opens the period sheet from the chip', async () => {
    render(<HistoryRosterBanner recordId="rec-1" status="Cancelled" />);
    expect(screen.getByTestId('crm-history-reactivate').textContent).toContain('Reactivate');
    const chip = await screen.findByTestId('crm-previously-cancelled-chip');
    fireEvent.click(chip);
    expect(await screen.findByTestId('crm-period-ledger-sheet')).toBeTruthy();
  });

  it('uses Members copy without hopping language', async () => {
    render(<HistoryRosterBanner recordId="rec-2" status="Terminated" variant="members" />);
    expect(screen.getByTestId('crm-members-cancelled-banner').textContent).toContain(
      'cancelled on Members',
    );
    await waitFor(() => expect(screen.getByTestId('crm-previously-cancelled-chip')).toBeTruthy());
  });
});

describe('PreviouslyCancelledChip', () => {
  it('stays hidden when the ledger has no cancelled event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ events: [{ event_type: 'enrolled', event_date: '2024-01-01' }] }),
      })),
    );
    const { container } = render(<PreviouslyCancelledChip recordId="rec-3" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="crm-previously-cancelled-chip"]')).toBeNull();
  });
});
