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

  it('calls onFilterChange when Sent is clicked and marks it active', () => {
    const onFilterChange = vi.fn();
    const { rerender } = render(
      <InboxFilters {...baseProps} onFilterChange={onFilterChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^sent$/i }));
    expect(onFilterChange).toHaveBeenCalledWith('sent');

    rerender(<InboxFilters {...baseProps} filter="sent" onFilterChange={onFilterChange} />);
    expect(screen.getByRole('button', { name: /^sent$/i }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('calls onFilterChange when Drafts is clicked and marks it active', () => {
    const onFilterChange = vi.fn();
    const { rerender } = render(
      <InboxFilters
        {...baseProps}
        draftsCount={4}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /drafts/i }));
    expect(onFilterChange).toHaveBeenCalledWith('drafts');

    rerender(
      <InboxFilters
        {...baseProps}
        filter="drafts"
        draftsCount={4}
        onFilterChange={onFilterChange}
      />,
    );
    expect(screen.getByRole('button', { name: /drafts/i }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('makes collapsed folders inert and blurs a focused folder', () => {
    const { rerender } = render(
      <InboxFilters {...baseProps} collapsed={false} onCollapsedChange={vi.fn()} />,
    );

    const inbox = screen.getByRole('button', { name: /inbox/i });
    inbox.focus();
    expect(document.activeElement).toBe(inbox);

    rerender(
      <InboxFilters {...baseProps} collapsed onCollapsedChange={vi.fn()} />,
    );

    const folderPane = inbox.closest('[inert]');
    expect(folderPane).not.toBeNull();
    expect(folderPane?.hasAttribute('inert')).toBe(true);
    expect(document.activeElement === inbox).toBe(false);
  });
});
