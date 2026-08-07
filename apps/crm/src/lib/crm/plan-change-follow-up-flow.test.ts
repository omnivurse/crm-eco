import { describe, expect, it, vi } from 'vitest';
import {
  persistPlanChangeWithFollowUp,
  type LinkablePlanChange,
} from './plan-change-follow-up-flow';

interface TestChange extends LinkablePlanChange {
  date: string;
}

const change: TestChange = {
  id: 'change-1',
  date: '2026-09-01',
};

describe('persistPlanChangeWithFollowUp', () => {
  it('persists history before creating and linking the reminder', async () => {
    const calls: string[] = [];
    const persistChanges = vi
      .fn()
      .mockImplementationOnce(async (changes: TestChange[]) => {
        calls.push(`history:${changes[0]?.follow_up_task_id ?? 'unlinked'}`);
        return { status: 'saved' as const };
      })
      .mockImplementationOnce(async (changes: TestChange[]) => {
        calls.push(`history:${changes[0]?.follow_up_task_id ?? 'unlinked'}`);
        return { status: 'saved' as const };
      });
    const createFollowUp = vi.fn(async () => {
      calls.push('task');
      return { id: 'task-1' };
    });

    const result = await persistPlanChangeWithFollowUp({
      currentChanges: [],
      change,
      persistChanges,
      createFollowUp,
    });

    expect(calls).toEqual(['history:unlinked', 'task', 'history:task-1']);
    expect(result).toEqual({
      status: 'saved-with-follow-up',
      change: { ...change, follow_up_task_id: 'task-1' },
    });
  });

  it('does not create a reminder when the history conflicts', async () => {
    const createFollowUp = vi.fn(async () => ({ id: 'task-1' }));

    const result = await persistPlanChangeWithFollowUp({
      currentChanges: [],
      change,
      persistChanges: async () => ({
        status: 'error',
        error: 'Record was updated elsewhere',
      }),
      createFollowUp,
    });

    expect(createFollowUp).not.toHaveBeenCalled();
    expect(result.status).toBe('history-error');
  });

  it('does not create a reminder while the source history is only queued', async () => {
    const createFollowUp = vi.fn(async () => ({ id: 'task-1' }));

    const result = await persistPlanChangeWithFollowUp({
      currentChanges: [],
      change,
      persistChanges: async () => ({
        status: 'queued',
        mutationId: 'mutation-1',
      }),
      createFollowUp,
    });

    expect(createFollowUp).not.toHaveBeenCalled();
    expect(result.status).toBe('history-queued');
  });

  it('keeps the saved history when task creation fails', async () => {
    const result = await persistPlanChangeWithFollowUp({
      currentChanges: [],
      change,
      persistChanges: async () => ({ status: 'saved' }),
      createFollowUp: async () => {
        throw new Error('Task service unavailable');
      },
    });

    expect(result).toEqual({
      status: 'saved-task-error',
      change,
      error: 'Task service unavailable',
    });
  });

  it('keeps both records recoverable when linking the created task conflicts', async () => {
    const persistChanges = vi
      .fn()
      .mockResolvedValueOnce({ status: 'saved' })
      .mockResolvedValueOnce({
        status: 'error',
        error: 'Record was updated elsewhere',
      });

    const result = await persistPlanChangeWithFollowUp({
      currentChanges: [],
      change,
      persistChanges,
      createFollowUp: async () => ({ id: 'task-1' }),
    });

    expect(result).toEqual({
      status: 'saved-with-follow-up-unlinked',
      change: { ...change, follow_up_task_id: 'task-1' },
      error: 'Record was updated elsewhere',
    });
  });
});
