// @vitest-environment jsdom
/**
 * Road to Ten toast vocabulary — the record tags row speaks the one offline
 * wording (`toastCopy.queued`) when a PATCH is queued, keeps the optimistic
 * tags, and still rolls back on a terminal error.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toastCopy } from '@/lib/crm/toast-copy';

const queuedSend = vi.fn();
vi.mock('@/lib/offline/queued-send', () => ({
  queuedSend: (...a: unknown[]) => queuedSend(...a),
}));

const toastInfo = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    info: (...a: unknown[]) => toastInfo(...a),
    error: (...a: unknown[]) => toastError(...a),
    success: vi.fn(),
  },
}));

import { RecordTagsRow } from './RecordTagsRow';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function addTag(value: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Add Tags|^Add$/ }));
  });
  const input = screen.getByPlaceholderText('Tag name, Enter to save');
  await act(async () => {
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter' });
  });
}

describe('RecordTagsRow — queued save wording', () => {
  it('toasts toastCopy.queued("tags") and keeps the optimistic tag when the PATCH is queued offline', async () => {
    queuedSend.mockResolvedValueOnce({ ok: false, queued: true, queuedId: 'q-1' });
    const onChange = vi.fn();
    render(<RecordTagsRow recordId="rec-1" recordData={{ tags: ['vip'] }} onChange={onChange} />);

    await addTag('renewal');

    await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1));
    const expected = toastCopy.queued('tags');
    expect(toastInfo).toHaveBeenCalledWith(expected.title, { description: expected.description });
    expect(toastInfo.mock.calls[0][0]).toBe('Queued — will sync when reconnected');
    expect(toastInfo.mock.calls[0][1]).toEqual({
      description: "Tags saved on this device — it will sync when you're back online.",
    });
    // Optimistic state is kept and the parent hears the new array.
    expect(onChange).toHaveBeenCalledWith(['vip', 'renewal']);
    expect(screen.getByText('renewal')).toBeTruthy();
    expect(toastError).not.toHaveBeenCalled();
    // The old ad-hoc wording is gone.
    expect(toastInfo).not.toHaveBeenCalledWith('Tags saved offline — will sync when reconnected');
  });

  it('sends a single-key PATCH body and rolls back with the failure copy on a terminal error', async () => {
    queuedSend.mockResolvedValueOnce({ ok: false, queued: false, error: 'boom' });
    render(<RecordTagsRow recordId="rec-1" recordData={{ tags: ['vip'] }} />);

    await addTag('renewal');

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(queuedSend.mock.calls[0][0]).toMatchObject({
      method: 'PATCH',
      url: '/api/crm/records/rec-1',
      body: { data: { tags: ['vip', 'renewal'] } },
    });
    expect(toastError).toHaveBeenCalledWith(toastCopy.failed('save the tags', 'boom', 'Try again'));
    expect(screen.queryByText('renewal')).toBeNull();
    expect(toastInfo).not.toHaveBeenCalled();
  });
});

describe('RecordTagsRow — inline validation (FB-6)', () => {
  it('shows a role=alert helper instead of a toast when the tag cap is reached', async () => {
    const full = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    render(<RecordTagsRow recordId="rec-2" recordData={{ tags: full }} />);

    await addTag('one-too-many');

    expect(screen.getByRole('alert').textContent).toBe('You can add up to 20 tags per record');
    expect(toastError).not.toHaveBeenCalled();
    expect(queuedSend).not.toHaveBeenCalled();
    // Typing again clears the message.
    const input = screen.getByPlaceholderText('Tag name, Enter to save');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'x' } });
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
