/**
 * Durable orchestration for plan-change history and its dependent reminder.
 *
 * The history is always persisted first. This prevents a reminder from
 * existing without the plan change that explains it. Callers supply transport
 * functions so the ordering and failure behavior remain unit-testable.
 */

export type DurableSaveOutcome =
  | { status: 'saved' }
  | { status: 'queued'; mutationId: string }
  | { status: 'error'; error: string }
  | { status: 'superseded' };

export interface LinkablePlanChange {
  id: string;
  follow_up_task_id?: string;
}

export type PlanChangeFollowUpFlowResult<T extends LinkablePlanChange> =
  | { status: 'saved'; change: T }
  | { status: 'history-queued'; change: T }
  | { status: 'history-error'; change: T; error: string }
  | { status: 'saved-task-error'; change: T; error: string }
  | { status: 'saved-with-follow-up'; change: T }
  | { status: 'saved-with-follow-up-link-queued'; change: T }
  | { status: 'saved-with-follow-up-unlinked'; change: T; error: string };

export interface PersistPlanChangeWithFollowUpInput<T extends LinkablePlanChange> {
  currentChanges: T[];
  change: T;
  createFollowUp?: () => Promise<{ id?: string }>;
  persistChanges: (changes: T[]) => Promise<DurableSaveOutcome>;
}

/** Replace an existing change by id, or append a newly logged change. */
export function upsertPlanChange<T extends LinkablePlanChange>(changes: T[], change: T): T[] {
  const next = [...changes];
  const index = next.findIndex((candidate) => candidate.id === change.id);
  if (index >= 0) next[index] = change;
  else next.push(change);
  return next;
}

/**
 * Persist the source history before creating its dependent task.
 *
 * If the first write is merely queued, the task is intentionally skipped: a
 * later queue conflict must not leave an operational reminder with no history.
 */
export async function persistPlanChangeWithFollowUp<T extends LinkablePlanChange>({
  currentChanges,
  change,
  createFollowUp,
  persistChanges,
}: PersistPlanChangeWithFollowUpInput<T>): Promise<PlanChangeFollowUpFlowResult<T>> {
  const history = upsertPlanChange(currentChanges, change);
  const historyOutcome = await persistChanges(history);

  if (historyOutcome.status === 'queued') {
    return { status: 'history-queued', change };
  }
  if (historyOutcome.status === 'error') {
    return {
      status: 'history-error',
      change,
      error: historyOutcome.error,
    };
  }
  if (historyOutcome.status === 'superseded') {
    return {
      status: 'history-error',
      change,
      error: 'A newer plan-change save replaced this request',
    };
  }
  if (!createFollowUp) {
    return { status: 'saved', change };
  }

  let task: { id?: string };
  try {
    task = await createFollowUp();
  } catch (error) {
    return {
      status: 'saved-task-error',
      change,
      error: error instanceof Error ? error.message : 'Failed to create follow-up',
    };
  }

  if (!task.id) {
    return {
      status: 'saved-task-error',
      change,
      error: 'Task response did not include an id',
    };
  }

  const linkedChange = { ...change, follow_up_task_id: task.id } as T;
  const linkedHistory = upsertPlanChange(history, linkedChange);
  const linkOutcome = await persistChanges(linkedHistory);

  if (linkOutcome.status === 'saved') {
    return { status: 'saved-with-follow-up', change: linkedChange };
  }
  if (linkOutcome.status === 'queued') {
    return {
      status: 'saved-with-follow-up-link-queued',
      change: linkedChange,
    };
  }

  return {
    status: 'saved-with-follow-up-unlinked',
    change: linkedChange,
    error:
      linkOutcome.status === 'error'
        ? linkOutcome.error
        : 'A newer plan-change save replaced the reminder link',
  };
}
