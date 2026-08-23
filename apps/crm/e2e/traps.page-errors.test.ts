/**
 * page-errors trap (EV-3). The graded operator run shipped "0 failures" beside
 * a screenshot of the Next dev overlay reporting "1 Issue" — nothing in the
 * harness listened to the browser. These tests pin the grading rules so the
 * trap cannot quietly become a no-op again.
 */
import { describe, expect, it } from 'vitest';
import type { Page } from '@playwright/test';
import { armPageIssueTrap, hasUntrackedPageIssue, pageIssuesSince, pageIssuesSoFar, splitPageIssues, trapNoPageIssues } from './traps';

type Handler = (arg: unknown) => void;

/** The two Page members the collectors touch: `on` and `url`. */
function fakePage(url = 'http://localhost:3000/crm/r/abc'): {
  page: Page;
  emitPageError: (name: string, message: string) => void;
  emitConsole: (type: string, text: string) => void;
  onCalls: string[];
} {
  const handlers = new Map<string, Handler[]>();
  const onCalls: string[] = [];
  const page = {
    url: () => url,
    on: (event: string, fn: Handler) => {
      onCalls.push(event);
      const list = handlers.get(event) ?? [];
      list.push(fn);
      handlers.set(event, list);
    },
  } as unknown as Page;
  const emit = (event: string, arg: unknown) => {
    for (const fn of handlers.get(event) ?? []) fn(arg);
  };
  return {
    page,
    onCalls,
    emitPageError: (name, message) => emit('pageerror', { name, message }),
    emitConsole: (type, text) => emit('console', { type: () => type, text: () => text }),
  };
}

describe('page-errors trap', () => {
  it('fails when it was never armed — a silent trap is worse than none', () => {
    const { page } = fakePage();
    const result = trapNoPageIssues(page, 'a walk nobody watched');
    expect(result.pass).toBe(false);
    expect(result.detail).toMatch(/never armed/);
  });

  it('passes on a clean page and records the graded window', () => {
    const { page } = fakePage();
    armPageIssueTrap(page);
    const result = trapNoPageIssues(page, 'the record page');
    expect(result.pass).toBe(true);
    expect(result.detail).toContain('the record page');
  });

  it('fails on an uncaught exception, naming the page it happened on', () => {
    const { page, emitPageError } = fakePage('http://localhost:3000/crm/modules/contacts?page=2');
    armPageIssueTrap(page);
    emitPageError('TypeError', 'Cannot read properties of undefined (reading "id")');
    const result = trapNoPageIssues(page, 'the list');
    expect(result.pass).toBe(false);
    expect(result.detail).toMatch(/1 browser error/);
    expect(result.detail).toContain('/crm/modules/contacts?page=2');
    expect(result.detail).toContain('TypeError');
  });

  it('fails on console.error (a React key/hydration warning is a defect, not noise)', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', 'Warning: Each child in a list should have a unique "key" prop.');
    expect(trapNoPageIssues(page, 'w').pass).toBe(false);
  });

  it('ignores console.warn / log / info — only `error` is graded', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole('warning', 'something cosmetic');
    emitConsole('log', 'hello');
    emitConsole('info', 'hydrated');
    expect(pageIssuesSoFar(page)).toHaveLength(0);
    expect(trapNoPageIssues(page, 'w').pass).toBe(true);
  });

  it('suppresses only the named dev-server entries, and names each reason it dropped', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', 'WebSocket connection to \'ws://localhost:3000/_next/webpack-hmr\' failed');
    emitConsole('error', 'Failed to load resource: the server responded with a status of 404 (favicon.ico)');
    const result = trapNoPageIssues(page, 'the list');
    expect(result.pass).toBe(true);
    expect(result.detail).toMatch(/2 suppressed:/);
    expect(result.detail).toContain('dev-only HMR socket');
    expect(result.detail).toContain('dev-only icon probe 404');
  });

  it('does not let a dev-only entry mask a real one in the same run', () => {
    const { page, emitConsole, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', 'WebSocket connection to \'ws://localhost:3000/_next/webpack-hmr\' failed');
    emitPageError('Error', 'boom');
    const result = trapNoPageIssues(page, 'the list');
    expect(result.pass).toBe(false);
    expect(result.detail).toMatch(/1 browser error/);
    expect(result.detail).toMatch(/1 suppressed:/);
    expect(result.detail).toContain('dev-only HMR socket');
  });

  it('is idempotent — arming twice binds one pair of listeners, not two', () => {
    const { page, onCalls, emitPageError } = fakePage();
    const first = armPageIssueTrap(page);
    const second = armPageIssueTrap(page);
    expect(second).toBe(first);
    expect(onCalls).toEqual(['pageerror', 'console']);
    emitPageError('Error', 'boom');
    expect(pageIssuesSoFar(page)).toHaveLength(1);
  });

  it('keeps the message WHOLE but truncates the trap detail (a hydration diff lives in the tail)', () => {
    const { page, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitPageError('Error', `${'x'.repeat(5_000)}THE-ACTUAL-DIFF`);
    // Whole in the ledger…
    expect(pageIssuesSoFar(page)[0].text).toContain('THE-ACTUAL-DIFF');
    // …preview in the one-line detail.
    const detail = trapNoPageIssues(page, 'w').detail;
    expect(detail).not.toContain('THE-ACTUAL-DIFF');
    expect(detail.length).toBeLessThan(700);
  });

  it('caps the detail listing at 8 entries and counts the rest', () => {
    const { page, emitPageError } = fakePage();
    armPageIssueTrap(page);
    for (let i = 0; i < 11; i += 1) emitPageError('Error', `boom-${i}`);
    const result = trapNoPageIssues(page, 'the walk');
    expect(result.detail).toMatch(/11 browser error/);
    expect(result.detail).toMatch(/…and 3 more/);
    expect(result.detail).not.toContain('boom-8');
  });

  // ── PI-1: the defect this trap was built to find ──
  it('does NOT suppress the diagnosed Radix useId hydration mismatch — a known defect is still a red row', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.\n" +
        '  <button type="button"\n+ id="radix-_R_ke7cmitplb_"\n- id="radix-_R_2hotiqbn6lb_"\n aria-haspopup="menu">',
    );
    const result = trapNoPageIssues(page, 'the record page');
    // Allowlisting it would rebuild the very false result this trap exists to
    // kill: a green row printed beside a red dev-overlay badge.
    expect(result.pass).toBe(false);
    expect(result.detail).toMatch(/1 browser error/);
    // …and the reader is told what it is instead of re-diagnosing it.
    expect(result.detail).toContain('PI-1');
    expect(result.detail).toContain('SplitCreateButton.tsx:185');
  });

  it('staples the PI-n diagnosis onto the graded issue for walk.json', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.\n id=\"radix-_R_1a_\"",
    );
    const split = splitPageIssues(pageIssuesSoFar(page));
    expect(split.suppressed).toHaveLength(0);
    expect(split.real).toHaveLength(1);
    expect(split.real[0].known).toMatch(/^PI-1 /);
  });

  it('an unknown error carries no PI-n label — the tag is evidence, not decoration', () => {
    const { page, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitPageError('TypeError', 'x is not a function');
    expect(splitPageIssues(pageIssuesSoFar(page)).real[0].known).toBeUndefined();
  });

  it('PI-1 is matched narrowly — a hydration mismatch WITHOUT a radix id is an unlabelled failure', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.\n" +
        '  <time\n+ dateTime="2026-08-23"\n- dateTime="2026-08-22">',
    );
    const result = trapNoPageIssues(page, 'the record page');
    expect(result.pass).toBe(false);
    expect(result.detail).toMatch(/1 browser error/);
    expect(result.detail).not.toContain('PI-1');
  });

  it('PI-2 labels the resolve-record uuid console.error — and still fails the trap', () => {
    const { page, emitConsole } = fakePage('http://localhost:3000/crm/r/not-a-uuid');
    armPageIssueTrap(page);
    emitConsole('error', '%c%s%c [resolve-record] audit entity_id_tombstone: Server invalid input syntax for type uuid: "not-a-uuid"');
    const result = trapNoPageIssues(page, 'the malformed-id door');
    expect(result.pass).toBe(false);
    expect(result.detail).toContain('PI-2');
    expect(result.detail).toContain('resolve-record.ts:169');
  });

  it('PI-2 still matches when next-dev interleaves %c CSS between the colon and the postgres error', () => {
    const { page, emitConsole } = fakePage('http://localhost:3000/crm/r/not-a-uuid');
    armPageIssueTrap(page);
    emitConsole(
      'error',
      '[resolve-record] audit entity_id_tombstone: background: #e6e6e6;border-radius: 2px Server invalid input syntax for type uuid: "not-a-uuid"',
    );
    const result = trapNoPageIssues(page, 'the malformed-id door');
    expect(result.pass).toBe(false);
    expect(result.detail).toContain('PI-2');
    expect(hasUntrackedPageIssue(page)).toBe(false);
  });

  it('a hydration line with no radix id is unlabelled and still aborts — PI-n is not a mute button', () => {
    const { page, emitPageError } = fakePage('http://localhost:3000/crm/modules/contacts');
    armPageIssueTrap(page);
    emitPageError(
      'Error',
      "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.\n" +
        '    <ModulePage>\n      <ModuleShell>',
    );
    const result = trapNoPageIssues(page, 'the contacts module');
    expect(result.pass).toBe(false);
    expect(result.detail).not.toContain('PI-1');
    expect(result.detail).not.toContain('PI-3');
    expect(hasUntrackedPageIssue(page)).toBe(true);
  });

  it('a suppressed line is still carried whole, with its reason, for walk.json', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', "WebSocket connection to 'ws://localhost:3000/_next/webpack-hmr' failed");
    const { real, suppressed } = splitPageIssues(pageIssuesSoFar(page));
    expect(real).toHaveLength(0);
    expect(suppressed).toHaveLength(1);
    expect(suppressed[0].why).toMatch(/HMR/);
    expect(suppressed[0].text).toContain('webpack-hmr');
  });

  // ── the verdict / abort split ──
  it('a diagnosed PI-n line is RED but does not abort the run', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.\n" +
        '  <button\n+ id="radix-_R_ke7cmitplb_"\n- id="radix-_R_2hotiqbn6lb_">',
    );
    // Verdict: still a failure — the programme cannot claim "0 failures".
    expect(trapNoPageIssues(page, 'w').pass).toBe(false);
    // Abort: no. PI-1 is in the shared shell; throwing here would cost every row.
    expect(hasUntrackedPageIssue(page)).toBe(false);
  });

  it('an UNDIAGNOSED error is red AND aborts', () => {
    const { page, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitPageError('TypeError', 'x.map is not a function');
    expect(trapNoPageIssues(page, 'w').pass).toBe(false);
    expect(hasUntrackedPageIssue(page)).toBe(true);
  });

  it('a PI-n line cannot shield an undiagnosed one in the same run', () => {
    const { page, emitConsole, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', "A tree hydrated but some attributes of the server rendered HTML didn't match\n+ id=\"radix-a\"");
    emitPageError('TypeError', 'boom');
    expect(hasUntrackedPageIssue(page)).toBe(true);
  });

  it('labels a PI-n line with `known` — the field the task row filters on', () => {
    const { page, emitConsole, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', "A tree hydrated but some attributes of the server rendered HTML didn't match\n+ id=\"radix-a\"");
    emitPageError('TypeError', 'boom');
    const { real } = splitPageIssues(pageIssuesSoFar(page));
    expect(real).toHaveLength(2);
    // walk-fixture charges the row with `real.filter(i => !i.known)`.
    const chargeable = real.filter((i) => !i.known);
    const known = real.filter((i) => i.known);
    expect(chargeable.map((i) => i.kind)).toEqual(['pageerror']);
    expect(known).toHaveLength(1);
    expect(known[0].known).toMatch(/PI-1/);
  });

  it('never armed is treated as the loudest failure, not as silence', () => {
    const { page } = fakePage();
    expect(hasUntrackedPageIssue(page)).toBe(true);
  });

  it('a clean page neither fails nor aborts', () => {
    const { page } = fakePage();
    armPageIssueTrap(page);
    expect(trapNoPageIssues(page, 'w').pass).toBe(true);
    expect(hasUntrackedPageIssue(page)).toBe(false);
  });

  it('survives a page whose url() is not parseable (mid-navigation)', () => {
    const { page, emitPageError } = fakePage('');
    armPageIssueTrap(page);
    emitPageError('Error', 'boom');
    expect(pageIssuesSoFar(page)[0].url).toBe('');
    expect(trapNoPageIssues(page, 'w').pass).toBe(false);
  });
});

describe('per-task console evidence', () => {
  it('splitPageIssues keeps the suppressed line AND why it was dropped', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', "WebSocket connection to 'ws://localhost:3000/_next/webpack-hmr' failed");
    emitConsole('error', 'Warning: Each child in a list should have a unique "key" prop.');
    const split = splitPageIssues(pageIssuesSoFar(page));
    expect(split.real.map((i) => i.text)).toEqual([
      'Warning: Each child in a list should have a unique "key" prop.',
    ]);
    // The dropped line survives into walk.json with its justification — a
    // filter whose output nobody can read is indistinguishable from a cover-up.
    expect(split.suppressed).toHaveLength(1);
    expect(split.suppressed[0].text).toMatch(/webpack-hmr/);
    expect(split.suppressed[0].why).toMatch(/HMR/i);
  });

  it('pageIssuesSince windows a task: only what happened after the mark', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', 'before the task');
    const cursor = pageIssuesSoFar(page).length;
    emitConsole('error', 'during the task');
    expect(pageIssuesSince(page, cursor).map((i) => i.text)).toEqual(['during the task']);
    // …and the earlier line is still graded by the per-test trap.
    expect(trapNoPageIssues(page, 'the whole test').pass).toBe(false);
  });

  it('an unarmed page yields an empty window instead of throwing', () => {
    const { page } = fakePage();
    expect(pageIssuesSince(page, 0)).toEqual([]);
    expect(splitPageIssues(pageIssuesSince(page, 0)).real).toEqual([]);
  });
});
