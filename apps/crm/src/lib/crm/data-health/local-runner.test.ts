/**
 * Integration runner: executes the WHOLE catalog against the local Supabase
 * stack (postgresql://127.0.0.1:54322) through a real psql executor — the
 * same executor shape the service-role route uses. Read-only by construction.
 *
 * Skips itself when the local stack is not running (CI safety); on the walk
 * fixture it proves every rule's SQL actually parses and runs.
 */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { RULE_CATALOG } from './score';
import { runRules } from './rules';
import type { SqlExecutor } from './types';

const LOCAL_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function psqlJson(sql: string): Array<Record<string, unknown>> {
  const wrapped = `select coalesce(json_agg(row_to_json(rows)), '[]'::json) from (${sql}) rows`;
  const out = execFileSync('psql', [LOCAL_DB, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
    input: wrapped,
    encoding: 'utf8',
    timeout: 30_000,
  });
  return JSON.parse(out.trim() || '[]') as Array<Record<string, unknown>>;
}

function localStackUp(): boolean {
  try {
    psqlJson('select 1 as ok');
    return true;
  } catch {
    return false;
  }
}

const up = localStackUp();

describe.skipIf(!up)('data-health catalog against the local stack', () => {
  it('every rule runs read-only and returns a sane count', async () => {
    const executor: SqlExecutor = async (sql) => psqlJson(sql);
    const report = await runRules(executor);

    // Every rule executed — none fell into errors (SQL parses, schema real).
    expect(report.errors).toEqual([]);
    expect(report.rules).toHaveLength(RULE_CATALOG.length);
    expect(report.bookSize).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);

    for (const result of report.rules) {
      expect(Number.isInteger(result.count), result.key).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.sampleIds.length).toBeLessThanOrEqual(20);
      expect(result.sampleIds.length).toBeLessThanOrEqual(Math.max(result.count, 0));
    }

    // Visible evidence for the acceptance log.
    console.log(
      `[data-health local] book=${report.bookSize} score=${report.score}\n` +
        report.rules
          .map((r) => `  ${r.key.padEnd(26)} ${String(r.count).padStart(5)} (${r.severity})`)
          .join('\n'),
    );
  }, 60_000);
});

describe.runIf(!up)('data-health local stack unavailable', () => {
  it.skip('local Supabase stack is not running on 54322 — runner skipped', () => {});
});
