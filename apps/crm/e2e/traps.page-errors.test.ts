/**
 * page-errors trap (EV-3). The graded operator run shipped "0 failures" beside
 * a screenshot of the Next dev overlay reporting "1 Issue" — nothing in the
 * harness listened to the browser. These tests pin the grading rules so the
 * trap cannot quietly become a no-op again.
 */
import { describe, expect, it } from 'vitest';
import type { Page } from '@playwright/test';
import { armPageIssueTrap, pageIssuesSoFar, trapNoPageIssues } from './traps';

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

  it('ignores only the two named dev-server entries, and says how many it dropped', () => {
    const { page, emitConsole } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', 'WebSocket connection to \'ws://localhost:3000/_next/webpack-hmr\' failed');
    emitConsole('error', 'Failed to load resource: the server responded with a status of 404 (favicon.ico)');
    const result = trapNoPageIssues(page, 'the list');
    expect(result.pass).toBe(true);
    expect(result.detail).toMatch(/2 dev-only entries ignored/);
  });

  it('does not let a dev-only entry mask a real one in the same run', () => {
    const { page, emitConsole, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitConsole('error', 'WebSocket connection to \'ws://localhost:3000/_next/webpack-hmr\' failed');
    emitPageError('Error', 'boom');
    const result = trapNoPageIssues(page, 'the list');
    expect(result.pass).toBe(false);
    expect(result.detail).toMatch(/1 browser error/);
    expect(result.detail).toMatch(/1 dev-only entry ignored/);
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

  it('truncates a giant message instead of pasting a stack into walk.json', () => {
    const { page, emitPageError } = fakePage();
    armPageIssueTrap(page);
    emitPageError('Error', 'x'.repeat(5_000));
    expect(pageIssuesSoFar(page)[0].text.length).toBeLessThanOrEqual(400);
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

  it('survives a page whose url() is not parseable (mid-navigation)', () => {
    const { page, emitPageError } = fakePage('');
    armPageIssueTrap(page);
    emitPageError('Error', 'boom');
    expect(pageIssuesSoFar(page)[0].url).toBe('');
    expect(trapNoPageIssues(page, 'w').pass).toBe(false);
  });
});
