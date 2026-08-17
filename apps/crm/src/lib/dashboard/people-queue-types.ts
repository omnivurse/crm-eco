/**
 * Dashboard "command desk" — the today queue of PEOPLE.
 *
 * The dashboard used to be a widget wall (tasks, deals, funnels). Reps work
 * differently: find a member, understand coverage in one glance, act, move
 * on. The queue is a ranked list of records (contacts / members / leads)
 * that need attention today, each carrying the member-brief facts the client
 * asked for (city, plan, who enrolled, referring member, member ID,
 * effective date) plus a concrete next action.
 *
 * Pure types only — safe to import from client components.
 */

export type PeopleQueueReason =
  /** An open task on this record is past due. */
  | 'overdue_task'
  /** An open task on this record is due today. */
  | 'task_today'
  /** Coverage starts within the next 30 days. */
  | 'starting_soon'
  /** Contact / sharing status is Pending (hand-entered enrollment waiting on activation). */
  | 'pending'
  /** Deterministic record signals say this record needs attention. */
  | 'needs_attention'
  /** Created in the last 30 days (the client's paste-in workflow). */
  | 'new'
  /** Recently opened by this user (pick up where you left off). */
  | 'recent';

export interface PeopleQueueAction {
  /** Short imperative label, e.g. "Call to confirm start date". */
  label: string;
  /** Where the action happens; defaults to the record page. */
  href: string;
  /** Icon hint for the UI. */
  kind: 'call' | 'email' | 'note' | 'task' | 'open' | 'review';
}

export interface PeopleQueueItem {
  /** crm_records.id */
  recordId: string;
  moduleKey: string;
  /** Display name (title / first + last). */
  name: string;
  /** Initials for the avatar tile. */
  initials: string;
  href: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  /** Health-share vs insurance vs unknown — drives the accent. */
  marketType: string | null;
  city: string | null;
  state: string | null;
  dateOfBirth: string | null;
  plan: string | null;
  enrolledBy: string | null;
  referringMember: string | null;
  memberId: string | null;
  /** ISO date (YYYY-MM-DD) or null. */
  effectiveDate: string | null;
  /** Why this person is in the queue (primary reason, highest priority wins). */
  reason: PeopleQueueReason;
  /** All reasons that matched, for chips. */
  reasons: PeopleQueueReason[];
  /** Human line under the name, e.g. "Task overdue 3d · Starts Sep 1". */
  reasonLabel: string;
  nextAction: PeopleQueueAction;
  /** Optional linked task (for overdue/today reasons). */
  task: { id: string; title: string; dueAt: string | null } | null;
  /** Deterministic attention score 0-100 (lib/crm/ai/signals). */
  attentionScore: number;
  /** ISO timestamp used for tie-breaks / "last touched". */
  updatedAt: string | null;
  /** ISO timestamp the record was created (drives "Added 4d ago" + 'new' ordering). Optional for callers building mock items. */
  createdAt?: string | null;
  /** ISO timestamp this user last opened the record (crm_recently_viewed). Optional. */
  lastViewedAt?: string | null;
}

export interface PeopleQueueCounts {
  tasksToday: number;
  overdue: number;
  pending: number;
  startingSoon: number;
  /**
   * Raw `status` spellings (contacts + members) that bucket to the pending
   * lane and were counted into `pending` ("Pending", "Approved Pending",
   * "Pending Activation", …). Every "Review pending" link builds its list
   * filter from these (command-desk-format `pendingContactsHref`) so the
   * list a link opens matches the number it sits next to. Optional so mock /
   * degraded callers still type-check; the server builder always supplies it.
   */
  pendingStatusValues?: string[];
}

export interface PeopleQueue {
  items: PeopleQueueItem[];
  counts: PeopleQueueCounts;
  /** Records the user opened most recently (for the right rail). */
  recentlyViewed: Array<Pick<PeopleQueueItem, 'recordId' | 'moduleKey' | 'name' | 'initials' | 'href' | 'status' | 'city' | 'plan'>>;
  /** True when a source failed and the queue is partial. */
  degraded: boolean;
}
