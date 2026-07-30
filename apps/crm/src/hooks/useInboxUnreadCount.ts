'use client';

/**
 * Live count of unread inbox conversations for the current org.
 *
 * Counted in the database with a head-only query rather than by fetching rows
 * and measuring the array: the sidebar needs one integer, and pulling every
 * unread conversation into the client to length-check it would not survive
 * production volume.
 *
 * Kept as a hook (not context) because only the sidebar needs it today.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

/** Conversations in these states are actionable; the rest are history. */
const ACTIVE_STATUSES = ['open', 'pending'];

export function useInboxUnreadCount(organizationId: string | null): number | null {
  // null means "not loaded yet" so the badge can stay hidden rather than
  // flashing a 0 on every page load.
  const [count, setCount] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!organizationId) return;

    const { count: rows, error } = await supabase
      .from('inbox_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', organizationId)
      .gt('unread_count', 0)
      .in('status', ACTIVE_STATUSES);

    if (error) {
      // A failed count must not blank an already-good badge.
      console.warn('Inbox unread count unavailable:', error.message);
      return;
    }
    setCount(rows ?? 0);
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;

    void refresh();

    // Mail arriving and threads being read both fire here. Coalesced because a
    // single inbound email triggers several row events (conversation upsert
    // plus message insert) and each would otherwise be its own count query.
    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void refresh(), 400);
    };

    const channel = supabase
      .channel(`crm-inbox-unread-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inbox_conversations',
          filter: `org_id=eq.${organizationId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, refresh]);

  return count;
}
