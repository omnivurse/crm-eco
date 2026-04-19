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
  /** Field keys this participant currently holds a soft lock on. */
  lockedFields: string[];
  /** When this session joined — used to sort by arrival. */
  joinedAt: string;
  /** Internal presence_ref (unique per tab). Helpful for keys. */
  presenceRef: string;
}

export interface UseRecordPresenceResult {
  participants: RecordPresenceEntry[];
  myIntent: PresenceIntent;
  setIntent: (intent: PresenceIntent) => Promise<void>;
  /**
   * Map of field key -> participant holding the lock (*other* users only).
   * When two tabs from different users race the same field we take the
   * latest joiner as the lock owner; either way the UI shows "someone
   * else is editing".
   */
  fieldLocks: Record<string, RecordPresenceEntry>;
  /** Announce we've started editing a field; disconnects auto-release. */
  acquireFieldLock: (field: string) => Promise<void>;
  /** Announce we've released a field lock. */
  releaseFieldLock: (field: string) => Promise<void>;
  connected: boolean;
}

interface TrackPayload {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  intent: PresenceIntent;
  locked_fields: string[];
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
  // Mutable sources of truth for the current tab's payload so repeated
  // track() calls don't drop previously-set state (intent vs locks).
  const intentRef = useRef<PresenceIntent>('viewing');
  const lockedFieldsRef = useRef<Set<string>>(new Set());

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

    const buildPayload = (): TrackPayload => ({
      user_id: profile.id,
      full_name: profile.full_name,
      email: user.email ?? null,
      avatar_url:
        (user.user_metadata as Record<string, unknown> | undefined)?.avatar_url as
          | string
          | undefined
          ?? null,
      intent: intentRef.current,
      locked_fields: Array.from(lockedFieldsRef.current),
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
          lockedFields: Array.isArray(latest.locked_fields) ? latest.locked_fields : [],
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
            intentRef.current = 'viewing';
            await channel.track(buildPayload());
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

  const trackCurrent = useCallback(async () => {
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
        intent: intentRef.current,
        locked_fields: Array.from(lockedFieldsRef.current),
        joined_at: joinedAtRef.current,
      } satisfies TrackPayload);
    } catch (err) {
      console.warn('[useRecordPresence] track failed:', err);
    }
  }, [user, profile]);

  const setIntent = useCallback(
    async (intent: PresenceIntent) => {
      intentRef.current = intent;
      setMyIntentState(intent);
      await trackCurrent();
    },
    [trackCurrent],
  );

  const acquireFieldLock = useCallback(
    async (field: string) => {
      if (lockedFieldsRef.current.has(field)) return;
      lockedFieldsRef.current.add(field);
      await trackCurrent();
    },
    [trackCurrent],
  );

  const releaseFieldLock = useCallback(
    async (field: string) => {
      if (!lockedFieldsRef.current.has(field)) return;
      lockedFieldsRef.current.delete(field);
      await trackCurrent();
    },
    [trackCurrent],
  );

  // Derive field -> owner map from participants (self is already excluded).
  // If multiple users claim the same field we keep the latest joiner so the
  // UI has a single deterministic owner to display.
  const fieldLocks: Record<string, RecordPresenceEntry> = {};
  for (const p of participants) {
    for (const f of p.lockedFields) {
      const existing = fieldLocks[f];
      if (!existing || p.joinedAt > existing.joinedAt) {
        fieldLocks[f] = p;
      }
    }
  }

  return {
    participants,
    myIntent,
    setIntent,
    fieldLocks,
    acquireFieldLock,
    releaseFieldLock,
    connected,
  };
}
