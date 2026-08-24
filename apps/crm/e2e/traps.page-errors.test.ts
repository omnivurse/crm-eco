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

/**
 * A faithful replica of the line `next dev` really logs (captured from
 * /crm/modules/contacts, 2026-08-23). Two details matter and both are load
 * bearing: React's PROSE bullets also start with "- ", and the real diff only
 * begins after the docs link. A rule that scanned the whole message would read
 * "- Invalid HTML tag nesting." as a diff line and never fire.
 */
const DEV_TREE_ID_SHIFT = [
  "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up.",
  '',
  "- A server/client branch `if (typeof window !== 'undefined')`.",
  '- Invalid HTML tag nesting.',
  '',
  '%s%s https://react.dev/link/hydration-mismatch',
  '',
  '  <button type="button"',
  '+                 id="radix-_R_ke7cmitplb_"',
  '-                 id="radix-_R_2hotiqbn6lb_"',
  '+                 aria-controls="radix-_R_2scmitplb_"',
  '-                 aria-controls="radix-_R_bhiqbn6lb_"',
  '    aria-haspopup="menu">',
].join('\n');

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
  it('suppresses the dev-overlay tree-id shift — and says so, with the reason, in the row', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      DEV_TREE_ID_SHIFT,
    );
    const result = trapNoPageIssues(page, 'the record page');
    // Every +/- line React printed is a React tree id on a radix attribute —
    // a value no application data can produce. `next build && next start` never
    // emits it (136 cold loads, 0 occurrences), so it cannot reach a user.
    expect(result.pass).toBe(true);
    expect(result.detail).toContain('1 suppressed');
    expect(result.detail).toMatch(/next-dev only/);
    expect(hasUntrackedPageIssue(page)).toBe(false);
  });

  it('turns that allowance OFF when the walk drives a production build', () => {
    const previous = process.env.WALK_SERVER_MODE;
    process.env.WALK_SERVER_MODE = 'prod';
    try {
      const { page, emitConsole } = fakePage();
      armPageIssueTrap(page);
      emitConsole(
        'error',
        DEV_TREE_ID_SHIFT,
      );
      const result = trapNoPageIssues(page, 'the record page');
      expect(result.pass).toBe(false);
      expect(result.detail).toMatch(/1 browser error/);
      expect(hasUntrackedPageIssue(page)).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.WALK_SERVER_MODE;
      else process.env.WALK_SERVER_MODE = previous;
    }
  });

  it('does NOT excuse a hydration mismatch that changes anything other than a tree id', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      DEV_TREE_ID_SHIFT.replace(
        '    aria-haspopup="menu">',
        '+                 title="Saved 2 minutes ago"\n-                 title="Saved just now">',
      ),
    );
    const result = trapNoPageIssues(page, 'the record page');
    expect(result.pass).toBe(false);
    expect(hasUntrackedPageIssue(page)).toBe(true);
  });

  it('excuses the composed Radix id family too (Tabs stamps one useId into three)', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      DEV_TREE_ID_SHIFT.replace(
        '+                 aria-controls="radix-_R_2scmitplb_"\n-                 aria-controls="radix-_R_bhiqbn6lb_"',
        '+                 aria-controls="radix-_R_1l5esnebnacmitplb_-content-overview"\n' +
          '-                 aria-controls="radix-_R_6klritpet9iqbn6lb_-content-overview"\n' +
          '+                 aria-labelledby="radix-_R_p95esnebnacmitplb_"\n' +
          '-                 aria-labelledby="radix-_R_354lritpet9iqbn6lb_"',
      ),
    );
    expect(trapNoPageIssues(page, 'w').pass).toBe(true);
    expect(hasUntrackedPageIssue(page)).toBe(false);
  });

  it('does NOT excuse a className or title difference — that is not an id', () => {
    // Observed on /crm/modules/contacts in dev: two DIFFERENT buttons compared
    // at one tree position. Production shows zero hydration errors, so this is
    // dev-runtime too — but "probably the same thing" is not evidence, and the
    // rule only excuses what it can prove is a tree id.
    const { page, emitConsole } = fakePage('http://localhost:3000/crm/modules/contacts');
    armPageIssueTrap(page);
    emitConsole(
      'error',
      DEV_TREE_ID_SHIFT.replace(
        '    aria-haspopup="menu">',
        '+                 className="inline-flex items-center justify-center whitespace-nowrap text-sm font-me..."\n' +
          '-                 className="inline-flex items-center justify-center whitespace-nowrap rounded-md text..."\n' +
          '+                 title="Add Member — quick create (more options in the menu)">',
      ),
    );
    expect(trapNoPageIssues(page, 'w').pass).toBe(false);
    expect(hasUntrackedPageIssue(page)).toBe(true);
  });

  it('does NOT excuse a client-only `_r_` id — that is the server HTML being thrown away', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      DEV_TREE_ID_SHIFT.replace('radix-_R_ke7cmitplb_', 'radix-_r_4_'),
    );
    expect(trapNoPageIssues(page, 'w').pass).toBe(false);
    expect(hasUntrackedPageIssue(page)).toBe(true);
  });

  it('excuses React\u2019s companion umbrella only when the same page logged a qualifying line', () => {
    const alone = fakePage();
    armPageIssueTrap(alone.page);
    alone.emitPageError(
      'Error',
      "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.",
    );
    expect(trapNoPageIssues(alone.page, 'w').pass).toBe(false);
    expect(hasUntrackedPageIssue(alone.page)).toBe(true);

    const paired = fakePage();
    armPageIssueTrap(paired.page);
    paired.emitConsole(
      'error',
      DEV_TREE_ID_SHIFT,
    );
    paired.emitPageError(
      'Error',
      "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.",
    );
    expect(trapNoPageIssues(paired.page, 'w').pass).toBe(true);
    expect(hasUntrackedPageIssue(paired.page)).toBe(false);
  });

  it('carries both suppressed lines whole into walk.json, each with its reason', () => {
    const { page, emitConsole, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      DEV_TREE_ID_SHIFT,
    );
    emitPageError(
      'Error',
      "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.",
    );
    const { real, suppressed } = splitPageIssues(pageIssuesSoFar(page));
    expect(real).toHaveLength(0);
    expect(suppressed).toHaveLength(2);
    expect(suppressed.every((s) => /next-dev only/.test(s.why))).toBe(true);
    expect(suppressed[0].text).toContain('radix-_R_2hotiqbn6lb_');
  });

  it('PAGE_ISSUE_KNOWN is empty — a fixed defect keeps no standing excuse', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      DEV_TREE_ID_SHIFT.replace(
        '  <button type="button"\n+                 id="radix-_R_ke7cmitplb_"\n-                 id="radix-_R_2hotiqbn6lb_"\n+                 aria-controls="radix-_R_2scmitplb_"\n-                 aria-controls="radix-_R_bhiqbn6lb_"\n    aria-haspopup="menu">',
        '  <time\n+                 dateTime="2026-08-23"\n-                 dateTime="2026-08-22">',
      ),
    );
    const { real } = splitPageIssues(pageIssuesSoFar(page));
    expect(real).toHaveLength(1);
    expect(real[0].known).toBeUndefined();
  });

  it('an unknown error carries no PI-n label — the tag is evidence, not decoration', () => {
    const { page, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitPageError('TypeError', 'x is not a function');
    expect(splitPageIssues(pageIssuesSoFar(page)).real[0].known).toBeUndefined();
  });

  it('the resolve-record uuid error is now UNKNOWN — the product guard landed, so it aborts', () => {
    // PI-2 is fixed (lib/crm/resolve-record.ts isUuid()). A line that reappears
    // is a NEW regression and must stop the run, not arrive pre-excused.
    const { page, emitConsole } = fakePage('http://localhost:3000/crm/r/not-a-uuid');
    armPageIssueTrap(page);
    emitConsole(
      'error',
      '%c%s%c [resolve-record] audit entity_id_tombstone: Server invalid input syntax for type uuid: "not-a-uuid"',
    );
    const result = trapNoPageIssues(page, 'the malformed-id door');
    expect(result.pass).toBe(false);
    expect(result.detail).not.toContain('PI-2');
    expect(hasUntrackedPageIssue(page)).toBe(true);
  });

  it('a hydration umbrella on its own is unlabelled and still aborts', () => {
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
  it('a suppressed line is neither red nor aborting; everything else is both', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', 'WebSocket connection to ws://localhost:3000/_next/webpack-hmr failed');
    expect(trapNoPageIssues(page, 'w').pass).toBe(true);
    expect(hasUntrackedPageIssue(page)).toBe(false);
  });

  it('an UNDIAGNOSED error is red AND aborts', () => {
    const { page, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitPageError('TypeError', 'x.map is not a function');
    expect(trapNoPageIssues(page, 'w').pass).toBe(false);
    expect(hasUntrackedPageIssue(page)).toBe(true);
  });

  it('a suppressed line cannot shield an undiagnosed one in the same run', () => {
    const { page, emitConsole, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', 'WebSocket connection to ws://localhost:3000/_next/webpack-hmr failed');
    emitPageError('TypeError', 'boom');
    expect(hasUntrackedPageIssue(page)).toBe(true);
    expect(trapNoPageIssues(page, 'w').pass).toBe(false);
  });

  it('charges the task row with every graded line — nothing carries a `known` pass any more', () => {
    const { page, emitConsole, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitConsole(
      'error',
      DEV_TREE_ID_SHIFT.replace(
        '  <button type="button"\n+                 id="radix-_R_ke7cmitplb_"\n-                 id="radix-_R_2hotiqbn6lb_"\n+                 aria-controls="radix-_R_2scmitplb_"\n-                 aria-controls="radix-_R_bhiqbn6lb_"\n    aria-haspopup="menu">',
        '  <time\n+                 dateTime="2026-08-23"\n-                 dateTime="2026-08-22">',
      ),
    );
    emitPageError('TypeError', 'boom');
    const { real } = splitPageIssues(pageIssuesSoFar(page));
    expect(real).toHaveLength(2);
    // walk-fixture charges the row with `real.filter(i => !i.known)`.
    expect(real.filter((i) => !i.known)).toHaveLength(2);
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
