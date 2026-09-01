import assert from 'node:assert/strict';
import test from 'node:test';
import type { DataSource, ListQuery } from './types';
import { loadAllRows } from './load-all-rows';

test('loads every filtered page before export', async () => {
  const sourceRows = Array.from({ length: 1_205 }, (_, id) => ({ id }));
  const queries: ListQuery[] = [];
  const dataSource: DataSource<{ id: number }> = {
    kind: 'fetcher',
    async load(query) {
      queries.push(query);
      const from = (query.page - 1) * query.pageSize;
      return {
        rows: sourceRows.slice(from, from + query.pageSize),
        total: sourceRows.length,
      };
    },
  };

  const rows = await loadAllRows(
    dataSource,
    {
      search: 'vendor',
      filters: [{ key: 'status', operator: 'equals', value: 'pending' }],
      sort: { key: 'created_at', dir: 'desc' },
    },
    500,
  );

  assert.deepEqual(rows, sourceRows);
  assert.deepEqual(
    queries.map(({ page, pageSize }) => ({ page, pageSize })),
    [
      { page: 1, pageSize: 500 },
      { page: 2, pageSize: 500 },
      { page: 3, pageSize: 500 },
    ],
  );
  assert.ok(
    queries.every(
      (query) =>
        query.search === 'vendor' &&
        query.filters[0]?.value === 'pending' &&
        query.sort?.key === 'created_at',
    ),
  );
});

test('stops on an empty page when the source count becomes stale', async () => {
  let calls = 0;
  const dataSource: DataSource<{ id: number }> = {
    kind: 'fetcher',
    async load() {
      calls += 1;
      return calls === 1 ? { rows: [{ id: 1 }], total: 2 } : { rows: [], total: 1 };
    },
  };

  const rows = await loadAllRows(dataSource, { filters: [] }, 1);

  assert.deepEqual(rows, [{ id: 1 }]);
  assert.equal(calls, 2);
});
