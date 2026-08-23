// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ENROLLED_BY_ADD_AS_TYPED_LABEL,
  ENROLLED_BY_ERROR_MESSAGE,
  ENROLLED_BY_SEARCH_DEBOUNCE_MS,
  EnrolledByPicker,
  producerOptionsFor,
  type ProducerPick,
} from './EnrolledByPicker';

function Harness({ initial = '', onSelect }: { initial?: string; onSelect?: (p: ProducerPick) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <EnrolledByPicker id="producer" aria-label="Enrolled by" value={value} onChange={setValue} onSelect={onSelect} />
      <span data-testid="value">{value}</span>
    </form>
  );
}

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function okJson(rows: unknown[]) {
  return Promise.resolve(
    new Response(JSON.stringify({ data: rows }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const flush = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('EnrolledByPicker (debounced, lazy producers fetch)', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not fetch on mount; first fetch happens after focus + debounce', async () => {
    fetchMock.mockImplementation(() => okJson([{ advisor_name: 'Wen Producer' }]));
    render(<Harness />);
    await flush(ENROLLED_BY_SEARCH_DEBOUNCE_MS * 3);
    expect(fetchMock).not.toHaveBeenCalled();

    const input = screen.getByRole('combobox', { name: 'Enrolled by' });
    fireEvent.focus(input);
    // visible loading state before the debounce fires
    expect(screen.getByRole('status').textContent).toContain('Searching…');
    await flush(ENROLLED_BY_SEARCH_DEBOUNCE_MS - 1);
    expect(fetchMock).not.toHaveBeenCalled();
    await flush(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/crm/advisors?');
    expect(url).toContain('is_active=true');
    expect(url).not.toContain('search=');
    expect(screen.getByRole('option', { name: 'Wen Producer' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('debounces typing to one request carrying the final query', async () => {
    fetchMock.mockImplementation(() => okJson([{ first_name: 'Wen', last_name: 'Producer' }]));
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Enrolled by' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'W' } });
    await flush(50);
    fireEvent.change(input, { target: { value: 'We' } });
    await flush(50);
    fireEvent.change(input, { target: { value: 'Wen' } });
    await flush(ENROLLED_BY_SEARCH_DEBOUNCE_MS + 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('search=Wen');
    expect(screen.getByRole('option', { name: 'Wen Producer' })).toBeTruthy();
  });

  it('shows "Couldn\'t load producers" when the request fails', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('nope', { status: 500 })));
    render(<Harness />);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Enrolled by' }));
    await flush(ENROLLED_BY_SEARCH_DEBOUNCE_MS + 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain(ENROLLED_BY_ERROR_MESSAGE);
    expect(status.textContent).toContain("Couldn't load producers");
  });

  it('shows "No match" when the server returns nothing', async () => {
    fetchMock.mockImplementation(() => okJson([]));
    render(<Harness />);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Enrolled by' }));
    await flush(ENROLLED_BY_SEARCH_DEBOUNCE_MS + 5);
    expect(screen.getByRole('status').textContent).toContain('No match');
  });

  it('ArrowDown + Enter commits a producer without submitting the form', async () => {
    fetchMock.mockImplementation(() => okJson([{ advisor_name: 'Wen Producer' }, { advisor_name: 'Pat Producer' }]));
    const onSubmit = vi.fn();
    const { container } = render(<Harness />);
    container.querySelector('form')!.addEventListener('submit', onSubmit);
    const input = screen.getByRole('combobox', { name: 'Enrolled by' });
    fireEvent.focus(input);
    await flush(ENROLLED_BY_SEARCH_DEBOUNCE_MS + 5);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const enter = fireEvent.keyDown(input, { key: 'Enter' });
    // preventDefault() was called → the browser would not submit
    expect(enter).toBe(false);
    expect(screen.getByTestId('value').textContent).toBe('Pat Producer');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('public.advisors rows: commits {name,id} through onSelect and de-duplicates by id', async () => {
    fetchMock.mockImplementation(() =>
      okJson([
        { id: 'adv-1', name: 'Wen Producer', full_name: 'Wen Producer', first_name: 'Wen', last_name: 'Producer' },
        { id: 'adv-1', name: 'Wen Producer' }, // duplicate row → one option
        { id: 'adv-2', full_name: null, first_name: 'Pat', last_name: 'Producer' }, // name from parts
      ]),
    );
    const onSelect = vi.fn<(p: ProducerPick) => void>();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: 'Enrolled by' });
    fireEvent.focus(input);
    await flush(ENROLLED_BY_SEARCH_DEBOUNCE_MS + 5);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Wen Producer', 'Pat Producer']);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('value').textContent).toBe('Wen Producer');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ name: 'Wen Producer', id: 'adv-1' });
  });

  it('offers "Not in list — add as typed" for an unmatched query and commits it with id=null', async () => {
    fetchMock.mockImplementation(() => okJson([{ id: 'adv-1', name: 'Wen Producer' }]));
    const onSelect = vi.fn<(p: ProducerPick) => void>();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: 'Enrolled by' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Wendy New' } });
    await flush(ENROLLED_BY_SEARCH_DEBOUNCE_MS + 5);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options[0]).toBe('Wen Producer');
    expect(options[1]).toContain(ENROLLED_BY_ADD_AS_TYPED_LABEL);
    expect(options[1]).toContain('Wendy New');
    // last row = add as typed
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('value').textContent).toBe('Wendy New');
    expect(onSelect).toHaveBeenCalledWith({ name: 'Wendy New', id: null });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not offer the escape row when the query matches a producer exactly (case-insensitive)', () => {
    const rows: ProducerPick[] = [{ name: 'Wen Producer', id: 'adv-1' }];
    expect(producerOptionsFor('wen producer', rows)).toEqual([{ name: 'Wen Producer', id: 'adv-1' }]);
    expect(producerOptionsFor('', rows)).toEqual([{ name: 'Wen Producer', id: 'adv-1' }]);
    expect(producerOptionsFor('Wen', rows)).toEqual([
      { name: 'Wen Producer', id: 'adv-1' },
      { name: 'Wen', id: null, addAsTyped: true },
    ]);
  });
});
