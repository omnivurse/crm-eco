/**
 * Append-only membership period ledger (`member_lifecycle_events`).
 *
 * Cancel / return write `cancelled` / `returned`. The table is the forever
 * history; the History module is only who is cancelled *right now*.
 * Idempotent: no second open `cancelled` without a later `returned`, and no
 * `returned` without an open `cancelled`.
 */

export const LIFECYCLE_EVENT_TYPES = ['enrolled', 'cancelled', 'returned', 'paused'] as const;
export type LifecycleEventType = (typeof LIFECYCLE_EVENT_TYPES)[number];

export interface LifecycleEventLike {
  event_type: string;
  event_date: string;
  created_at?: string | null;
}

function stamp(event: LifecycleEventLike): string {
  return `${event.event_date}T${event.created_at ?? ''}`;
}

/** True when the latest `cancelled` has no later `returned`. */
export function hasOpenCancelledPeriod(events: readonly LifecycleEventLike[]): boolean {
  const ordered = [...events].sort((a, b) => stamp(b).localeCompare(stamp(a)));
  for (const event of ordered) {
    if (event.event_type === 'returned') return false;
    if (event.event_type === 'cancelled') return true;
  }
  return false;
}

export function shouldAppendCancelled(events: readonly LifecycleEventLike[]): boolean {
  return !hasOpenCancelledPeriod(events);
}

export function shouldAppendReturned(events: readonly LifecycleEventLike[]): boolean {
  return hasOpenCancelledPeriod(events);
}

export function hasEverCancelled(events: readonly { event_type?: string }[]): boolean {
  return events.some((event) => event.event_type === 'cancelled');
}

export interface CancellationPeriod {
  cancelled: LifecycleEventLike;
  returned: LifecycleEventLike | null;
}

/** Pair cancelled → returned into periods. Newest first. Orphan returned events are dropped. */
export function pairCancellationPeriods(
  events: readonly LifecycleEventLike[],
): CancellationPeriod[] {
  const ordered = [...events]
    .filter((event) => event.event_type === 'cancelled' || event.event_type === 'returned')
    .sort((a, b) => stamp(a).localeCompare(stamp(b)));
  const periods: CancellationPeriod[] = [];
  let open: CancellationPeriod | null = null;
  for (const event of ordered) {
    if (event.event_type === 'cancelled') {
      if (open) periods.push(open);
      open = { cancelled: event, returned: null };
    } else if (event.event_type === 'returned' && open && !open.returned) {
      open.returned = event;
      periods.push(open);
      open = null;
    }
  }
  if (open) periods.push(open);
  return periods.reverse();
}

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

type LedgerClient = {
  from: (table: string) => any;
};

export async function fetchLifecycleEventsForContact(
  supabase: LedgerClient,
  orgId: string,
  contactId: string,
): Promise<LifecycleEventLike[]> {
  const { data, error } = await supabase
    .from('member_lifecycle_events')
    .select('event_type, event_date, created_at')
    .eq('organization_id', orgId)
    .eq('contact_id', contactId)
    .order('event_date', { ascending: false });
  if (error) {
    throw new Error(`lifecycle ledger read failed: ${error.message}`);
  }
  return data ?? [];
}

export async function appendLifecycleEvent(
  supabase: LedgerClient,
  input: {
    organizationId: string;
    contactId: string;
    eventType: 'cancelled' | 'returned';
    eventDate?: string;
    createdBy?: string | null;
    source: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('member_lifecycle_events').insert({
    organization_id: input.organizationId,
    contact_id: input.contactId,
    event_type: input.eventType,
    event_date: input.eventDate ?? todayIsoDate(),
    created_by: input.createdBy ?? null,
    source: input.source,
    metadata: input.metadata ?? {},
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Write `cancelled` or `returned` when the period state requires it.
 * Safe to call from the reactivate route after the SQL trigger — no duplicate
 * open period.
 */
export async function appendLifecycleTransition(input: {
  supabase: LedgerClient;
  organizationId: string;
  contactId: string;
  eventType: 'cancelled' | 'returned';
  eventDate?: string;
  createdBy?: string | null;
  source: string;
  metadata?: Record<string, unknown>;
}): Promise<{ written: boolean; error?: string }> {
  const events = await fetchLifecycleEventsForContact(
    input.supabase,
    input.organizationId,
    input.contactId,
  );
  const shouldWrite =
    input.eventType === 'cancelled'
      ? shouldAppendCancelled(events)
      : shouldAppendReturned(events);
  if (!shouldWrite) return { written: false };

  const result = await appendLifecycleEvent(input.supabase, {
    organizationId: input.organizationId,
    contactId: input.contactId,
    eventType: input.eventType,
    eventDate: input.eventDate,
    createdBy: input.createdBy,
    source: input.source,
    metadata: input.metadata,
  });
  if (!result.ok) return { written: false, error: result.error };
  return { written: true };
}
