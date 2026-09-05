// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationList } from './ConversationList';
import type { InboxConversation } from '@/lib/inbox/types';
import type { ConversationSort, QuickFilterKey } from '@/lib/inbox/inbox-prefs';

afterEach(() => {
  cleanup();
});

function makeConversation(
  id: string,
  overrides: Partial<InboxConversation> = {},
): InboxConversation {
  return {
    id,
    org_id: 'org-1',
    channel: 'email',
    thread_id: `thread-${id}`,
    subject: `Subject ${id}`,
    preview: `Preview ${id}`,
    mailbox_address: 'billing@example.com',
    contact_id: null,
    contact_email: `${id}@outside.test`,
    contact_phone: null,
    contact_name: `Sender ${id}`,
    linked_lead_id: null,
    linked_deal_id: null,
    linked_account_id: null,
    status: 'open',
    priority: 'normal',
    assigned_to: null,
    assigned_at: null,
    unread_count: 0,
    last_read_at: null,
    last_read_by: null,
    message_count: 1,
    last_message_at: '2026-09-01T10:00:00.000Z',
    first_message_at: '2026-09-01T10:00:00.000Z',
    snoozed_until: null,
    resolved_at: null,
    tags: [],
    labels: [],
    metadata: {},
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

function baseProps() {
  return {
    conversations: [] as InboxConversation[],
    pinnedIds: [] as readonly string[],
    selectedConversationId: null,
    onSelectConversation: vi.fn(),
    searchQuery: '',
    onSearchChange: vi.fn(),
    mobileView: 'list' as const,
    density: 'cozy' as const,
    sort: { field: 'date', direction: 'desc' } as ConversationSort,
    onSortChange: vi.fn(),
    quickFilters: [] as readonly QuickFilterKey[],
    onQuickFiltersChange: vi.fn(),
    filteredOutCount: 0,
    onTogglePin: vi.fn(),
    onToggleFlag: vi.fn(),
    onToggleRead: vi.fn(),
    onArchive: vi.fn(),
    onTrash: vi.fn(),
    onBulkStatus: vi.fn(),
    onBulkRead: vi.fn(),
    onMarkAllRead: vi.fn(),
    verifiedDomains: ['example.com'] as readonly string[],
    senderAddresses: [] as readonly string[],
  };
}

/** The row click target — an overlay sibling, so it is queryable by its label. */
function rowLabels(): string[] {
  return screen
    .getAllByRole('button', { name: /^open conversation from/i })
    .map((button) => button.textContent ?? '');
}

describe('ConversationList rows', () => {
  it('renders in exactly the order the page supplied', () => {
    // Deliberately not date order: the page owns sorting, the list must not
    // second-guess it.
    render(
      <ConversationList
        {...baseProps()}
        conversations={[
          makeConversation('c', { last_message_at: '2026-01-01T00:00:00.000Z' }),
          makeConversation('a', { last_message_at: '2026-09-03T00:00:00.000Z' }),
          makeConversation('b', { last_message_at: '2026-05-01T00:00:00.000Z' }),
        ]}
      />,
    );

    expect(rowLabels()).toEqual([
      'Open conversation from Sender c: Subject c',
      'Open conversation from Sender a: Subject a',
      'Open conversation from Sender b: Subject b',
    ]);
  });

  it('opens a conversation on row click', () => {
    const props = baseProps();
    const conversation = makeConversation('a');
    render(<ConversationList {...props} conversations={[conversation]} />);

    fireEvent.click(screen.getByRole('button', { name: /^open conversation from Sender a/i }));
    expect(props.onSelectConversation).toHaveBeenCalledWith(conversation);
  });

  it('never nests a button inside a button', () => {
    // A <button> inside a <button> is invalid HTML and breaks hydration; the
    // overlay-sibling row pattern exists to prevent exactly this.
    const { container } = render(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a'), makeConversation('b')]}
        pinnedIds={['a']}
      />,
    );

    expect(container.querySelectorAll('button button').length).toBe(0);
  });

  it('drops the preview line at compact density and keeps it at cozy', () => {
    const { rerender } = render(
      <ConversationList
        {...baseProps()}
        density="compact"
        conversations={[makeConversation('a')]}
      />,
    );
    expect(screen.queryByText('Preview a')).toBeNull();
    expect(screen.getByText('Subject a')).toBeTruthy();

    rerender(
      <ConversationList {...baseProps()} density="cozy" conversations={[makeConversation('a')]} />,
    );
    expect(screen.getByText('Preview a')).toBeTruthy();
  });

  it('shows a status chip only when the status is not open', () => {
    const { rerender } = render(
      <ConversationList {...baseProps()} conversations={[makeConversation('a')]} />,
    );
    expect(screen.queryByText('Open')).toBeNull();

    rerender(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a', { status: 'pending' })]}
      />,
    );
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('badges an external sender and leaves a verified domain alone', () => {
    const { rerender } = render(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a', { contact_email: 'stranger@elsewhere.test' })]}
      />,
    );
    expect(screen.getByText('External')).toBeTruthy();

    rerender(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a', { contact_email: 'colleague@example.com' })]}
      />,
    );
    expect(screen.queryByText('External')).toBeNull();
  });

  it('marks attachments, importance and flags from the shared view model', () => {
    render(
      <ConversationList
        {...baseProps()}
        conversations={[
          makeConversation('a', {
            metadata: { has_attachments: true },
            priority: 'high',
            tags: ['starred'],
          }),
        ]}
      />,
    );

    expect(screen.getByText('Has attachments')).toBeTruthy();
    expect(screen.getByText('High importance')).toBeTruthy();
    expect(screen.getByText('Flagged')).toBeTruthy();
  });
});

describe('ConversationList pinned band', () => {
  it('heads the band when a rendered row is pinned', () => {
    render(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('b'), makeConversation('a')]}
        pinnedIds={['b']}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pinned' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Everything else' })).toBeTruthy();
  });

  it('stays silent when nothing is pinned', () => {
    render(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a'), makeConversation('b')]}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Pinned' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Everything else' })).toBeNull();
  });

  it('stays silent when the pinned thread is not in this list', () => {
    // A pin survives a folder switch, so pinnedIds routinely names rows that
    // are nowhere near the current list.
    render(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a')]}
        pinnedIds={['somewhere-else']}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Pinned' })).toBeNull();
  });

  it('omits the second divider when every rendered row is pinned', () => {
    render(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a'), makeConversation('b')]}
        pinnedIds={['a', 'b']}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pinned' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Everything else' })).toBeNull();
  });
});

describe('ConversationList row actions', () => {
  it('calls the matching callback with the right conversation and does not select the row', () => {
    const props = baseProps();
    const first = makeConversation('a');
    const second = makeConversation('b');
    render(<ConversationList {...props} conversations={[first, second]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Archive: Sender b' }));
    expect(props.onArchive).toHaveBeenCalledTimes(1);
    expect(props.onArchive).toHaveBeenCalledWith(second);

    fireEvent.click(screen.getByRole('button', { name: 'Delete: Sender a' }));
    expect(props.onTrash).toHaveBeenCalledWith(first);

    fireEvent.click(screen.getByRole('button', { name: 'Flag: Sender a' }));
    expect(props.onToggleFlag).toHaveBeenCalledWith(first);

    // Row a is read, so the action it offers is the opposite one.
    fireEvent.click(screen.getByRole('button', { name: 'Mark unread: Sender a' }));
    expect(props.onToggleRead).toHaveBeenCalledWith(first);

    fireEvent.click(screen.getByRole('button', { name: 'Pin: Sender b' }));
    expect(props.onTogglePin).toHaveBeenCalledWith('b');

    // The whole point of the overlay pattern: none of that opened a thread.
    expect(props.onSelectConversation).not.toHaveBeenCalled();
  });

  it('labels read and flag actions by current state', () => {
    render(
      <ConversationList
        {...baseProps()}
        conversations={[
          makeConversation('a', { is_unread_for_user: true, tags: ['starred'] }),
        ]}
        pinnedIds={['a']}
      />,
    );

    expect(screen.getByRole('button', { name: 'Mark read: Sender a' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear flag: Sender a' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unpin: Sender a' })).toBeTruthy();
  });
});

describe('ConversationList bulk selection', () => {
  it('acts only on ids that are still on screen', () => {
    const props = baseProps();
    const a = makeConversation('a');
    const b = makeConversation('b');
    const { rerender } = render(<ConversationList {...props} conversations={[a, b]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select: Sender a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select: Sender b' }));
    expect(screen.getByText('2 selected')).toBeTruthy();

    // A filter change drops b out of the list while it is still selected.
    rerender(<ConversationList {...props} conversations={[a]} />);
    expect(screen.getByText('1 selected')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Archive selected' }));
    expect(props.onBulkStatus).toHaveBeenCalledWith(['a'], 'archived');
  });

  it('passes read state changes through and keeps the batch selected', () => {
    const props = baseProps();
    render(
      <ConversationList {...props} conversations={[makeConversation('a'), makeConversation('b')]} />,
    );

    // The bulk bar (and its Select all) appears once a first row is ticked.
    fireEvent.click(screen.getByRole('button', { name: 'Select: Sender a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark unread' }));
    expect(props.onBulkRead).toHaveBeenCalledWith(['a', 'b'], false);

    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    expect(props.onBulkRead).toHaveBeenLastCalledWith(['a', 'b'], true);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });

  it('moves a batch to trash and then drops the selection', () => {
    const props = baseProps();
    render(<ConversationList {...props} conversations={[makeConversation('a')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select: Sender a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    expect(props.onBulkStatus).toHaveBeenCalledWith(['a'], 'trash');
    expect(screen.queryByText('1 selected')).toBeNull();
  });

  it('only flags the rows that are not flagged yet', () => {
    const props = baseProps();
    const plain = makeConversation('a');
    const already = makeConversation('b', { tags: ['starred'] });
    render(<ConversationList {...props} conversations={[plain, already]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select: Sender a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flag selected' }));

    expect(props.onToggleFlag).toHaveBeenCalledTimes(1);
    expect(props.onToggleFlag).toHaveBeenCalledWith(plain);
  });

  it('extends the batch instead of opening a thread while selecting', () => {
    const props = baseProps();
    render(
      <ConversationList {...props} conversations={[makeConversation('a'), makeConversation('b')]} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select: Sender a' }));
    // Mid-selection the row announces what it will actually do, not "open".
    fireEvent.click(screen.getByRole('button', { name: 'Add to selection: Sender b' }));

    expect(screen.getByText('2 selected')).toBeTruthy();
    expect(props.onSelectConversation).not.toHaveBeenCalled();
  });

  it('cancels back to the sort and filter header', () => {
    const props = baseProps();
    render(<ConversationList {...props} conversations={[makeConversation('a')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select: Sender a' }));
    expect(screen.queryByRole('button', { name: /^sort by/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /^sort by date/i })).toBeTruthy();
  });
});

describe('ConversationList empty, loading and paging states', () => {
  it('explains a filtered-empty list and offers to clear the filters', () => {
    const props = baseProps();
    render(
      <ConversationList
        {...props}
        conversations={[]}
        quickFilters={['unread']}
        filteredOutCount={3}
      />,
    );

    expect(screen.getByText(/nothing matches these filters/i)).toBeTruthy();
    expect(screen.getByText(/3 conversations hidden by the Filter menu/i)).toBeTruthy();

    fireEvent.click(screen.getByText('Clear filters'));
    expect(props.onQuickFiltersChange).toHaveBeenCalledWith([]);
  });

  it('falls back to the supplied empty copy when nothing is filtered', () => {
    render(
      <ConversationList
        {...baseProps()}
        conversations={[]}
        emptyTitle="No sent mail"
        emptyDescription="Messages you send will show up here"
      />,
    );

    expect(screen.getByText('No sent mail')).toBeTruthy();
    expect(screen.queryByText('Clear filters')).toBeNull();
  });

  it('stands in skeleton rows rather than a spinner on the first load', () => {
    const { container } = render(
      <ConversationList {...baseProps()} conversations={[]} loading emptyTitle="No conversations" />,
    );

    expect(screen.getByText('Loading conversations…')).toBeTruthy();
    expect(screen.queryByText('No conversations')).toBeNull();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(6);
  });

  it('keeps rows on screen while a refresh is in flight', () => {
    render(<ConversationList {...baseProps()} conversations={[makeConversation('a')]} loading />);
    expect(screen.getByText('Subject a')).toBeTruthy();
  });

  it('loads older conversations from a real button', () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a')]}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load older conversations' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a')]}
        hasMore={false}
        onLoadMore={onLoadMore}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Load older conversations' })).toBeNull();
  });

  it('says how many rows the filter is hiding below a non-empty list', () => {
    render(
      <ConversationList
        {...baseProps()}
        conversations={[makeConversation('a')]}
        quickFilters={['unread']}
        filteredOutCount={1}
      />,
    );

    expect(screen.getByText(/1 conversation hidden by the Filter menu/i)).toBeTruthy();
  });
});

describe('ConversationList header wiring', () => {
  it('passes search text through', () => {
    const props = baseProps();
    render(<ConversationList {...props} searchQuery="invoice" />);

    const input = screen.getByRole('searchbox', { name: 'Search conversations' });
    expect((input as HTMLInputElement).value).toBe('invoice');

    fireEvent.change(input, { target: { value: 'refund' } });
    expect(props.onSearchChange).toHaveBeenCalledWith('refund');
  });

  it('hands sort and mark-all-read up to the page', () => {
    const props = baseProps();
    render(<ConversationList {...props} conversations={[makeConversation('a')]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(props.onMarkAllRead).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('button', { name: /^sort by date/i }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: /^subject/i }));
    expect(props.onSortChange).toHaveBeenCalledWith({ field: 'subject', direction: 'desc' });
  });
});
