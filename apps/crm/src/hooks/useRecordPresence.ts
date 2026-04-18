'use client';

/**
 * useRecordPresence — Supabase Realtime presence for the V2 record page.
 *
 * Broadcasts the current user's "viewing" state to a per-record presence
 * channel and returns the list of other participants currently on the
 * same record. Used by the header `PresenceStack` to surface co-viewers.
 *
 * Implementation notes:
 *   - Each record gets its own channel (`record-presence:{id}`) so payloads
 *     stay tiny and presence state doesn't bleed across records.
 *   - The user's own session is filtered out of the returned list so we
 *     only render *other* participants.
 *   - `intent` ("viewing" | "editing") is sent via `track()` and can be
 *     upgraded via `setIntent` — e.g. when an inline edit modal opens —
 *     so observers see a pencil on the avatar.
 *   - Channels are torn down on unmount / when the record id changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';

export type PresenceIntent = 'viewing' | 'editing';

export interface RecordPresenceEntry {
  /** Stable per-user id (profiles.id). */
  userId: string;
  fullName: string | null;
  email: string | null;
  /** Avatar URL if set in user_metadata. */
  avatarUrl: string | null;
  intent: PresenceIntent;
  /** When this session joined — used to sort by arrival. */
  joinedAt: string;
  /** Internal presence_ref (unique per tab). Helpful for keys. */
  presenceRef: string;
}

export interface UseRecordPresenceResult {
  participants: RecordPresenceEntry[];
  myIntent: PresenceIntent;
  setIntent: (intent: PresenceIntent) => Promise<void>;
  connected: boolean;
}

interface TrackPayload {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  intent: PresenceIntent;
  joined_at: string;
}

export function useRecordPresence(
  recordId: string,
  enabled: boolean = true,
): UseRecordPresenceResult {
  const { user, profile } = useClientAuth();
  const [participants, setParticipants] = useState<RecordPresenceEntry[]>([]);
  const [myIntent, setMyIntentState] = useState<PresenceIntent>('viewing');
  const [connected, setConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedAtRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    if (!enabled || !recordId || !user || !profile) return;

    // Use profile.id as the presence key so multiple tabs from the same
    // user dedupe cleanly in the UI (each tab has its own presence_ref,
    // but we aggregate on userId).
    const presenceKey = profile.id;
    const channel = supabase.channel(`record-presence:${recordId}`, {
      config: {
        presence: { key: presenceKey },
      },
    });

    const buildPayload = (intent: PresenceIntent): TrackPayload => ({
      user_id: profile.id,
      full_name: profile.full_name,
      email: user.email ?? null,
      avatar_url:
        (user.user_metadata as Record<string, unknown> | undefined)?.avatar_url as
          | string
          | undefined
          ?? null,
      intent,
      joined_at: joinedAtRef.current,
    });

    const syncState = () => {
      const state = channel.presenceState() as Record<string, TrackPayload[]>;
      const out: RecordPresenceEntry[] = [];
      for (const [key, entries] of Object.entries(state)) {
        // Skip self so the UI only shows co-viewers.
        if (key === presenceKey) continue;
        // Take the newest presence entry per user (last tab to join wins
        // for the intent label).
        const latest = entries[entries.length - 1];
        if (!latest) continue;
        out.push({
          userId: latest.user_id,
          fullName: latest.full_name,
          email: latest.email,
          avatarUrl: latest.avatar_url,
          intent: latest.intent,
          joinedAt: latest.joined_at,
          presenceRef: key,
        });
      }
      out.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
      setParticipants(out);
    };

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, syncState)
      .on('presence', { event: 'leave' }, syncState)
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          try {
            await channel.track(buildPayload('viewing'));
          } catch (err) {
            console.warn('[useRecordPresence] initial track failed:', err);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      setConnected(false);
      setParticipants([]);
      try {
        void channel.untrack();
      } catch {
        /* ignore */
      }
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [recordId, enabled, user, profile]);

  const setIntent = useCallback(
    async (intent: PresenceIntent) => {
      setMyIntentState(intent);
      const ch = channelRef.current;
      if (!ch || !user || !profile) return;
      try {
        await ch.track({
          user_id: profile.id,
          full_name: profile.full_name,
          email: user.email ?? null,
          avatar_url:
            (user.user_metadata as Record<string, unknown> | undefined)?.avatar_url as
              | string
              | undefined
              ?? null,
          intent,
          joined_at: joinedAtRef.current,
        } satisfies TrackPayload);
      } catch (err) {
        console.warn('[useRecordPresence] setIntent track failed:', err);
      }
    },
    [user, profile],
  );

  return { participants, myIntent, setIntent, connected };
}
