// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InboxFilters } from './InboxFilters';

afterEach(() => {
  cleanup();
});

const baseProps = {
  filter: 'all' as const,
  onFilterChange: vi.fn(),
  channelFilter: 'all' as const,
  onChannelFilterChange: vi.fn(),
  stats: null,
  conversationCount: 3,
};

describe('InboxFilters reading rail', () => {
  it('keeps folders mounted and collapsed behind a reopen control', () => {
    const onCollapsedChange = vi.fn();
    render(
      <InboxFilters
        {...baseProps}
        collapsed
        onCollapsedChange={onCollapsedChange}
      />,
    );

    const tab = screen.getByRole('button', { name: 'Show folders', hidden: true });
    expect(tab.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(tab);
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
  });

  it('does not offer a collapse control when nothing is reading', () => {
    render(<InboxFilters {...baseProps} />);
    expect(screen.queryByRole('button', { name: /folders/i })).toBeNull();
  });
});
