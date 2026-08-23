// @vitest-environment jsdom
/**
 * LS-5 — truthful lane-chip counts: one promise cache per module (+ narrowing),
 * `invalidateStatusValues(moduleKey)` evicts that module and makes every
 * mounted `useStatusValues` refetch on the next paint, keeping the previous
 * rows on screen until the new ones land (no flash back to "loading").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import {
  __resetStatusValuesCache,
  __statusValuesCacheSize,
  fetchStatusValues,
  invalidateStatusValues,
  useStatusValues,
} from './status-values-client';

function jsonResponse(values: Array<{ value: string; count: number; lane?: string }>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ values }),
  } as unknown as Response;
}

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  __resetStatusValuesCache();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => jsonResponse([{ value: 'Pending', count: 3, lane: 'pending' }]));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('fetchStatusValues cache', () => {
  it('one request per module; the endpoint is asked with no-store', async () => {
    await fetchStatusValues('contacts');
    await fetchStatusValues('contacts');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/crm/records/status-values?module_key=contacts');
    expect(init?.cache).toBe('no-store');
  });

  it('the cache key includes the narrowing query, which is forwarded to the endpoint', async () => {
    await fetchStatusValues('contacts');
    await fetchStatusValues('contacts', { narrowing: 'search=wen&scope=mine' });
    await fetchStatusValues('contacts', { narrowing: 'search=wen&scope=mine' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const narrowedUrl = new URL(String(fetchMock.mock.calls[1][0]), 'http://x');
    expect(narrowedUrl.searchParams.get('search')).toBe('wen');
    expect(narrowedUrl.searchParams.get('scope')).toBe('mine');
    expect(narrowedUrl.searchParams.get('module_key')).toBe('contacts');
    expect(__statusValuesCacheSize()).toBe(2);
  });

  it('invalidateStatusValues(moduleKey) evicts every narrowing of that module only', async () => {
    await fetchStatusValues('contacts');
    await fetchStatusValues('contacts', { narrowing: 'scope=mine' });
    await fetchStatusValues('leads');
    expect(__statusValuesCacheSize()).toBe(3);
    invalidateStatusValues('contacts');
    expect(__statusValuesCacheSize()).toBe(1);
    await fetchStatusValues('leads');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await fetchStatusValues('contacts');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('invalidateStatusValues() with no module clears everything', async () => {
    await fetchStatusValues('contacts');
    await fetchStatusValues('leads');
    invalidateStatusValues();
    expect(__statusValuesCacheSize()).toBe(0);
  });

  it('a failed fetch is evicted so the next call retries', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response);
    await expect(fetchStatusValues('contacts')).rejects.toThrow('status-values 500');
    expect(__statusValuesCacheSize()).toBe(0);
    await fetchStatusValues('contacts');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('useStatusValues + invalidation', () => {
  it('refetches after invalidate, keeping the previous rows visible until the new ones land', async () => {
    const { result } = renderHook(() => useStatusValues('contacts'));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.values).toEqual([{ value: 'Pending', count: 3, lane: 'pending' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The bulk status change lands: 3 Pending → Active.
    let release: (() => void) | null = null;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(jsonResponse([{ value: 'Active', count: 3, lane: 'active' }]));
        }),
    );
    act(() => {
      invalidateStatusValues('contacts');
    });
    // Refetch in flight: still ready with the OLD rows (stale-while-revalidate).
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('ready');
    expect(result.current.values[0]?.value).toBe('Pending');

    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(result.current.values[0]?.value).toBe('Active'));
    expect(result.current.status).toBe('ready');
  });

  it('an invalidate for another module does not refetch this one', async () => {
    const { result } = renderHook(() => useStatusValues('contacts'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => {
      invalidateStatusValues('leads');
    });
    // The version bump re-runs the effect, but the contacts promise is still cached.
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('disabled / no module key → idle, no request', () => {
    const { result } = renderHook(() => useStatusValues(undefined));
    expect(result.current.status).toBe('idle');
    const off = renderHook(() => useStatusValues('contacts', false));
    expect(off.result.current.status).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
