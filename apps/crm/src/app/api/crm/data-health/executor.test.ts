/**
 * The sweep connection: where its DSN may come from, and proof that the
 * connection it opens genuinely cannot write.
 *
 * The read-only proof runs against the LOCAL stack (127.0.0.1:54322) and skips
 * itself when that stack is down, exactly like `data-health/local-runner.test.ts`.
 * "Every query is a SELECT" is a claim; `default_transaction_read_only` is the
 * enforcement, and this test is the receipt.
 */
import { describe, expect, it } from 'vitest';
import { LOCAL_SWEEP_DB_URL, resolveSweepDbUrl, withSweepExecutor } from './executor';

describe('resolveSweepDbUrl', () => {
  it('prefers an explicit SUPABASE_DB_URL', () => {
    expect(
      resolveSweepDbUrl({
        SUPABASE_DB_URL: 'postgresql://somewhere/db',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      } as NodeJS.ProcessEnv),
    ).toBe('postgresql://somewhere/db');
  });

  it('falls back to the local stack ONLY when the Supabase API is loopback', () => {
    for (const api of ['http://127.0.0.1:54321', 'http://localhost:54321/', 'http://[::1]:54321']) {
      expect(resolveSweepDbUrl({ NEXT_PUBLIC_SUPABASE_URL: api } as NodeJS.ProcessEnv)).toBe(
        LOCAL_SWEEP_DB_URL,
      );
    }
  });

  it('never guesses a DSN for a hosted project', () => {
    expect(
      resolveSweepDbUrl({
        NEXT_PUBLIC_SUPABASE_URL: 'https://sffisarikcreyyjzdjvb.supabase.co',
      } as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(resolveSweepDbUrl({} as NodeJS.ProcessEnv)).toBeNull();
    // A blank env var is not a configuration.
    expect(
      resolveSweepDbUrl({ SUPABASE_DB_URL: '   ' } as NodeJS.ProcessEnv),
    ).toBeNull();
  });
});

async function localStackUp(): Promise<boolean> {
  try {
    await withSweepExecutor(LOCAL_SWEEP_DB_URL, async (exec) => exec('select 1 as ok'));
    return true;
  } catch {
    return false;
  }
}

const up = await localStackUp();

describe.skipIf(!up)('withSweepExecutor against the local stack', () => {
  it('reads, and REFUSES to write', async () => {
    await withSweepExecutor(LOCAL_SWEEP_DB_URL, async (exec) => {
      const rows = await exec('select count(*)::int as total from crm_records');
      expect(typeof rows[0]?.total).toBe('number');

      // A write must fail at the server, not by convention: 25006 =
      // read_only_sql_transaction. `where false` touches nothing even if it ran.
      await expect(
        exec("update crm_records set status = status where false"),
      ).rejects.toThrow(/read-only|read only/i);
    });
  }, 30_000);
});

describe.runIf(!up)('local stack unavailable', () => {
  it.skip('local Supabase stack is not running on 54322 — read-only proof skipped', () => {});
});
