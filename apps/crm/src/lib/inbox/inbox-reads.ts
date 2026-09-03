export type InboxReadCursor = {
  conversation_id: string;
  last_read_at: string | null;
  last_seen_message_id?: string | null;
};

export function latestInboundAt(
  messages: Array<{ direction: string; sent_at?: string | null }>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].direction === 'inbound' && messages[i].sent_at) {
      return messages[i].sent_at ?? null;
    }
  }
  return null;
}

export function latestInboundId(
  messages: Array<{ id: string; direction: string }>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].direction === 'inbound') return messages[i].id;
  }
  return null;
}

/** A thread is unread for this user until they have seen the latest inbound. */
export function conversationIsUnreadForUser(opts: {
  latestInboundAt: string | null | undefined;
  lastReadAt: string | null | undefined;
}): boolean {
  if (!opts.latestInboundAt) return false;
  if (!opts.lastReadAt) return true;
  return new Date(opts.latestInboundAt).getTime() > new Date(opts.lastReadAt).getTime();
}

/** Opening a thread, including via ?c=, must not write a read cursor. */
export function shouldWriteReadCursorOnOpen(): boolean {
  return false;
}

export function attachUnreadForUser<T extends { id: string }>(
  conversations: T[],
  unreadIds: Iterable<string>,
): Array<T & { is_unread_for_user: boolean }> {
  const unread = new Set(unreadIds);
  return conversations.map((conversation) => ({
    ...conversation,
    is_unread_for_user: unread.has(conversation.id),
  }));
}

export function cursorByConversation(
  rows: Array<InboxReadCursor> | null | undefined,
): Map<string, InboxReadCursor> {
  const map = new Map<string, InboxReadCursor>();
  for (const row of rows ?? []) map.set(row.conversation_id, row);
  return map;
}
