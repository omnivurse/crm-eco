// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InboxListHeader } from './InboxListHeader';
import type { ConversationSort, QuickFilterKey } from '@/lib/inbox/inbox-prefs';

afterEach(() => {
  cleanup();
});

const baseProps = {
  sort: { field: 'date', direction: 'desc' } as ConversationSort,
  onSortChange: vi.fn(),
  quickFilters: [] as QuickFilterKey[],
  onQuickFiltersChange: vi.fn(),
  onMarkAllRead: vi.fn(),
};

/**
 * Radix opens on pointerdown, which jsdom does not synthesise faithfully; the
 * keyboard path is both reliable here and the one a11y actually depends on.
 */
function openMenu(name: RegExp) {
  fireEvent.keyDown(screen.getByRole('button', { name }), { key: 'Enter' });
}

/** Live state, so a second toggle sees what the first one produced. */
function FilterHarness({ onChange }: { onChange: (next: QuickFilterKey[]) => void }) {
  const [filters, setFilters] = useState<QuickFilterKey[]>([]);
  return (
    <InboxListHeader
      {...baseProps}
      quickFilters={filters}
      onQuickFiltersChange={(next) => {
        setFilters(next);
        onChange(next);
      }}
    />
  );
}

describe('InboxListHeader sort menu', () => {
  it('flips direction when the active field is chosen again', () => {
    const onSortChange = vi.fn();
    render(<InboxListHeader {...baseProps} onSortChange={onSortChange} />);

    openMenu(/^sort by date/i);
    fireEvent.click(screen.getByRole('menuitem', { name: /^date/i }));

    expect(onSortChange).toHaveBeenCalledWith({ field: 'date', direction: 'asc' });
  });

  it('flips back to descending from an ascending list', () => {
    const onSortChange = vi.fn();
    render(
      <InboxListHeader
        {...baseProps}
        sort={{ field: 'subject', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );

    openMenu(/^sort by subject/i);
    fireEvent.click(screen.getByRole('menuitem', { name: /^subject/i }));

    expect(onSortChange).toHaveBeenCalledWith({ field: 'subject', direction: 'desc' });
  });

  it('selects a different field descending rather than inheriting the direction', () => {
    const onSortChange = vi.fn();
    render(
      <InboxListHeader
        {...baseProps}
        sort={{ field: 'date', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );

    openMenu(/^sort by date/i);
    fireEvent.click(screen.getByRole('menuitem', { name: /^from$/i }));

    expect(onSortChange).toHaveBeenCalledWith({ field: 'from', direction: 'desc' });
  });

  it('offers every ConversationSortField and names the current one on the trigger', () => {
    render(<InboxListHeader {...baseProps} sort={{ field: 'importance', direction: 'desc' }} />);

    const trigger = screen.getByRole('button', { name: /^sort by importance/i });
    expect(trigger.textContent).toContain('Importance');

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent?.split(/(?=[A-Z])/)[0])).toEqual([
      'Date',
      'From',
      'Subject',
      'Unread',
      'Attachments',
      'Importance',
    ]);
  });

  it('says which end of the list the direction puts on top', () => {
    const { rerender } = render(<InboxListHeader {...baseProps} />);
    expect(screen.getByRole('button', { name: /^sort by date/i }).getAttribute('title')).toContain(
      'Newest on top',
    );

    rerender(<InboxListHeader {...baseProps} sort={{ field: 'date', direction: 'asc' }} />);
    expect(screen.getByRole('button', { name: /^sort by date/i }).getAttribute('title')).toContain(
      'Oldest on top',
    );
  });
});

describe('InboxListHeader filter menu', () => {
  it('intersects filters instead of replacing them', () => {
    const onChange = vi.fn();
    render(<FilterHarness onChange={onChange} />);

    openMenu(/^filter$/i);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /^unread$/i }));
    expect(onChange).toHaveBeenLastCalledWith(['unread']);

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /has attachments/i }));
    expect(onChange).toHaveBeenLastCalledWith(['unread', 'attachments']);
  });

  it('unticks a filter that is already on', () => {
    const onQuickFiltersChange = vi.fn();
    render(
      <InboxListHeader
        {...baseProps}
        quickFilters={['unread', 'flagged']}
        onQuickFiltersChange={onQuickFiltersChange}
      />,
    );

    openMenu(/^filter, 2 active$/i);
    const flagged = screen.getByRole('menuitemcheckbox', { name: /^flagged$/i });
    expect(flagged.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(flagged);
    expect(onQuickFiltersChange).toHaveBeenCalledWith(['unread']);
  });

  it('reflects the active filters as checked menu items', () => {
    render(<InboxListHeader {...baseProps} quickFilters={['important']} />);

    openMenu(/^filter, 1 active$/i);
    const checked = screen
      .getAllByRole('menuitemcheckbox')
      .filter((item) => item.getAttribute('aria-checked') === 'true')
      .map((item) => item.textContent);
    expect(checked).toEqual(['Important']);
  });

  it('resets to no filters from the chip and reports what was hidden', () => {
    const onQuickFiltersChange = vi.fn();
    render(
      <InboxListHeader
        {...baseProps}
        quickFilters={['unread', 'attachments']}
        filteredOutCount={12}
        onQuickFiltersChange={onQuickFiltersChange}
      />,
    );

    expect(screen.getByText(/12 hidden/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onQuickFiltersChange).toHaveBeenCalledWith([]);
  });

  it('hides the chip when nothing is filtered', () => {
    render(<InboxListHeader {...baseProps} />);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('clears filters from inside the menu too', () => {
    const onQuickFiltersChange = vi.fn();
    render(
      <InboxListHeader
        {...baseProps}
        quickFilters={['to_me']}
        onQuickFiltersChange={onQuickFiltersChange}
      />,
    );

    openMenu(/^filter, 1 active$/i);
    fireEvent.click(screen.getByRole('menuitem', { name: /clear filters/i }));
    expect(onQuickFiltersChange).toHaveBeenCalledWith([]);
  });
});

describe('InboxListHeader mark all read', () => {
  it('fires the callback', () => {
    const onMarkAllRead = vi.fn();
    render(<InboxListHeader {...baseProps} onMarkAllRead={onMarkAllRead} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it('gives every control a real accessible name', () => {
    render(<InboxListHeader {...baseProps} quickFilters={['unread']} />);

    const names = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim());
    expect(names.every((name) => Boolean(name && name.length > 0))).toBe(true);
    expect(screen.getByRole('toolbar', { name: 'Conversation list options' })).toBeTruthy();
  });
});
