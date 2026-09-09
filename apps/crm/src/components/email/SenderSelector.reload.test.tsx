// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SenderSelector } from './SenderSelector';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const wendy = {
  id: 'addr-wendy',
  email: 'wendy@payitforwardhealth.com',
  name: 'Wendy Scipione',
  domain: 'payitforwardhealth.com',
  is_default: true,
  is_verified: true,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ addresses: [wendy] }),
    }),
  );
});

describe('SenderSelector', () => {
  it('does not refetch when the parent rebuilds onChange on every keystroke', async () => {
    const { rerender } = render(
      <SenderSelector value={wendy.id} onChange={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Wendy Scipione/)).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Loading senders/)).toBeNull();

    rerender(<SenderSelector value={wendy.id} onChange={vi.fn()} />);
    rerender(<SenderSelector value={wendy.id} onChange={vi.fn()} />);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Loading senders/)).toBeNull();
    expect(screen.getByText(/Wendy Scipione/)).toBeTruthy();
  });
});
