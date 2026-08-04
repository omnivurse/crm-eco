import { describe, it, expect, vi } from 'vitest';
import { fetchAllForDedup, DEDUP_PAGE_SIZE, type PagedResult } from './paged-lookup';

interface Row {
  id: string;
  email: string;
}

/**
 * Stand-in for PostgREST: serves an inclusive [from, to] slice and, like the
 * real thing, never signals that more rows exist beyond the requested window.
 * That silence is the whole bug — the caller has to page until it sees a short
 * page.
 */
function makeSource(total: number) {
  const rows: Row[] = Array.from({ length: total }, (_, i) => ({
    id: String(i).padStart(6, '0'),
    email: `person${i}@example.com`,
  }));

  const fetchPage = vi.fn(
    async (from: number, to: number): Promise<PagedResult<Row>> => ({
      data: rows.slice(from, to + 1),
      error: null,
    }),
  );

  return { rows, fetchPage };
}

describe('fetchAllForDedup', () => {
  it('reads every row when the result set exceeds one page', async () => {
    // 15,628 is the live PIFH count of email-bearing crm_records that the
    // unpaginated dedup query was truncating to 1,000.
    const total = 15_628;
    const { fetchPage } = makeSource(total);

    const result = await fetchAllForDedup<Row>('email', fetchPage);

    expect(result).toHaveLength(total);
    expect(fetchPage).toHaveBeenCalledTimes(Math.ceil(total / DEDUP_PAGE_SIZE));
  });

  it('builds a dedup map that matches records past the first page', async () => {
    const total = 1_500;
    const { rows, fetchPage } = makeSource(total);

    const all = await fetchAllForDedup<Row>('email', fetchPage);
    const emailToId = new Map(all.map((r) => [r.email.toLowerCase(), r.id]));

    // Rows 1000..1499 are exactly the ones the old unbounded query never saw,
    // so every one of them was re-inserted as a "new" record on import.
    const beyondFirstPage = rows.slice(DEDUP_PAGE_SIZE);
    expect(beyondFirstPage).toHaveLength(500);
    for (const row of beyondFirstPage) {
      expect(emailToId.get(row.email.toLowerCase())).toBe(row.id);
    }
  });

  it('stops after one request when the result set fits in a page', async () => {
    const { fetchPage } = makeSource(42);

    const result = await fetchAllForDedup<Row>('email', fetchPage);

    expect(result).toHaveLength(42);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('requests a second page when the first is exactly full', async () => {
    // Boundary: a full page is indistinguishable from "there is more", so the
    // pager must ask again and only stop on the empty follow-up.
    const { fetchPage } = makeSource(DEDUP_PAGE_SIZE);

    const result = await fetchAllForDedup<Row>('email', fetchPage);

    expect(result).toHaveLength(DEDUP_PAGE_SIZE);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('handles an empty result set', async () => {
    const { fetchPage } = makeSource(0);

    await expect(fetchAllForDedup<Row>('email', fetchPage)).resolves.toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('throws rather than returning a partial map', async () => {
    // Fail closed: a half-built dedup map looks exactly like "no duplicates
    // found", which would let the import insert rows it could not check.
    const fetchPage = vi
      .fn<[number, number], Promise<PagedResult<Row>>>()
      .mockResolvedValueOnce({
        data: Array.from({ length: DEDUP_PAGE_SIZE }, (_, i) => ({
          id: String(i),
          email: `a${i}@example.com`,
        })),
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'statement timeout' } });

    await expect(fetchAllForDedup<Row>('name+dob', fetchPage)).rejects.toThrow(
      'Import dedup lookup (name+dob) failed: statement timeout',
    );
  });

  it('requests contiguous, non-overlapping inclusive ranges', async () => {
    const { fetchPage } = makeSource(2_500);

    await fetchAllForDedup<Row>('phone', fetchPage);

    expect(fetchPage.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });
});
