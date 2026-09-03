import { describe, expect, it } from 'vitest';
import {
  attachUnreadForUser,
  conversationIsUnreadForUser,
  cursorByConversation,
  latestInboundAt,
  latestInboundId,
  shouldWriteReadCursorOnOpen,
} from './inbox-reads';

describe('conversationIsUnreadForUser', () => {
  it('is unread when there is inbound and no cursor', () => {
    expect(
      conversationIsUnreadForUser({
        latestInboundAt: '2026-09-03T15:49:59.000Z',
        lastReadAt: null,
      }),
    ).toBe(true);
  });

  it('stays unread until the cursor is after the latest inbound', () => {
    expect(
      conversationIsUnreadForUser({
        latestInboundAt: '2026-09-03T15:49:59.000Z',
        lastReadAt: '2026-09-03T15:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      conversationIsUnreadForUser({
        latestInboundAt: '2026-09-03T15:49:59.000Z',
        lastReadAt: '2026-09-03T17:06:07.000Z',
      }),
    ).toBe(false);
  });

  it('does not treat outbound-only threads as unread', () => {
    expect(conversationIsUnreadForUser({ latestInboundAt: null, lastReadAt: null })).toBe(false);
  });
});

describe('shouldWriteReadCursorOnOpen', () => {
  it('never writes a cursor just because the thread was selected or deep-linked', () => {
    expect(shouldWriteReadCursorOnOpen()).toBe(false);
  });
});

describe('latest inbound helpers', () => {
  const msgs = [
    { id: 'dawn', direction: 'inbound', sent_at: '2026-09-01T22:48:36.000Z' },
    { id: 'wendy', direction: 'outbound', sent_at: '2026-09-02T18:50:46.000Z' },
    { id: 'frank', direction: 'inbound', sent_at: '2026-09-03T15:49:59.000Z' },
    { id: 'reply', direction: 'outbound', sent_at: '2026-09-03T17:10:30.000Z' },
  ];

  it('finds the latest inbound, not the newest outbound', () => {
    expect(latestInboundId(msgs)).toBe('frank');
    expect(latestInboundAt(msgs)).toBe('2026-09-03T15:49:59.000Z');
  });
});

describe('attachUnreadForUser', () => {
  it('marks only the conversations in this user\'s unread set', () => {
    const rows = attachUnreadForUser(
      [{ id: 'a' }, { id: 'b' }],
      ['b'],
    );
    expect(rows[0].is_unread_for_user).toBe(false);
    expect(rows[1].is_unread_for_user).toBe(true);
  });
});

describe('cursorByConversation', () => {
  it('indexes one cursor per conversation; user A cannot see user B', () => {
    const map = cursorByConversation([
      { conversation_id: 'c1', last_read_at: '2026-09-03T17:00:00.000Z' },
    ]);
    expect(map.get('c1')?.last_read_at).toBe('2026-09-03T17:00:00.000Z');
    expect(map.get('c2')).toBeUndefined();
  });
});
