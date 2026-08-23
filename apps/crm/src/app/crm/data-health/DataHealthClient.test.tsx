// @vitest-environment jsdom
/**
 * Data Health screen — every state a person can land in.
 *
 * The load-bearing one is the LAST pair: a failed load must never render
 * beside an all-clear. The Review Duplicates page shipped exactly that bug
 * ("no duplicates found" under a red error banner) and it was fixed; this
 * suite is what stops it coming back on this surface.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/crm/data-health',
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a), info: vi.fn() },
}));

import { DataHealthClient } from './DataHealthClient';
import type { DataHealthPayload, DataHealthRule } from './DataHealthClient';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ID_A = '11111111-1111-4111-8111-111111111111';

function rule(overrides: Partial<DataHealthRule> & Pick<DataHealthRule, 'key'>): DataHealthRule {
  return {
    label: 'A check',
    severity: 'warn',
    describe: 'What it means in one sentence.',
    count: 0,
    sampleIds: [],
    ...overrides,
  };
}

function payload(overrides: Partial<DataHealthPayload> = {}): DataHealthPayload {
  return {
    score: 72.7,
    formulaVersion: 1,
    generatedAt: '2026-08-23T20:08:45.093Z',
    asOf: '2026-08-23',
    source: 'live',
    bookSize: 16265,
    rules: [
      rule({
        key: 'refs.orphan-notes',
        label: 'Notes attached to a missing record',
        severity: 'error',
        count: 12,
        sampleIds: [ID_A],
      }),
      rule({
        key: 'vocabulary.product',
        label: 'Product names not on the dropdown list',
        severity: 'warn',
        count: 5,
      }),
      rule({
        key: 'dupes.open-pairs',
        label: 'Possible duplicate pairs awaiting review',
        severity: 'info',
        count: 187,
        context: { label: 'Dismissed pairs', value: 3 },
      }),
    ],
    errors: [],
    ...overrides,
  };
}

const CLEAN = payload({
  score: 100,
  rules: [rule({ key: 'refs.orphan-notes', severity: 'error', count: 0 })],
  errors: [],
});

let responses: Array<() => Response | Promise<Response>> = [];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  responses = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const next = responses.shift();
      if (!next) throw new Error('no response queued');
      return next();
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe('DataHealthClient', () => {
  it('shows a skeleton first, then the score with the book size beside it', async () => {
    responses = [() => json(payload())];
    render(<DataHealthClient />);

    expect(screen.getByTestId('crm-data-health-loading')).toBeTruthy();

    const score = await screen.findByTestId('crm-data-health-score');
    expect(score.textContent).toBe('72.7');
    expect(screen.getByTestId('crm-data-health-book-size').textContent).toContain('16,265');
  });

  it('groups the checks by severity and links each one to where it gets fixed', async () => {
    responses = [() => json(payload())];
    render(<DataHealthClient />);
    await screen.findByTestId('crm-data-health-score');

    expect(screen.getByRole('heading', { name: 'Fix first' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Meaning problems' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Worth watching' })).toBeTruthy();

    // Plain-language label + the one-sentence meaning both render.
    expect(screen.getByText('Notes attached to a missing record')).toBeTruthy();
    expect(screen.getAllByText('What it means in one sentence.').length).toBeGreaterThan(0);

    expect(screen.getByRole('link', { name: /Review the pairs/ }).getAttribute('href')).toBe(
      '/crm/duplicates',
    );
    expect(screen.getByRole('link', { name: /Fix the dropdown list/ }).getAttribute('href')).toBe(
      '/crm/settings/field-options?module=contacts&field=product',
    );
    // Companion number rides along with the duplicates card.
    expect(screen.getByText(/Dismissed pairs: 3/)).toBeTruthy();
  });

  it('links sample ids to their record page (ids only, no names)', async () => {
    responses = [() => json(payload())];
    render(<DataHealthClient />);
    await screen.findByTestId('crm-data-health-score');

    const sample = screen.getByRole('link', { name: 'Record 1' });
    expect(sample.getAttribute('href')).toBe(`/crm/r/${ID_A}`);
  });

  it('explains the scoring in plain language behind a disclosure', async () => {
    responses = [() => json(payload())];
    render(<DataHealthClient />);
    await screen.findByTestId('crm-data-health-score');

    expect(screen.queryByTestId('crm-data-health-formula')).toBeNull();
    const toggle = screen.getByTestId('crm-data-health-formula-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(screen.getByTestId('crm-data-health-formula').textContent).toContain('60 points');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('celebrates only when every check really came back clean', async () => {
    responses = [() => json(CLEAN)];
    render(<DataHealthClient />);
    await screen.findByTestId('crm-data-health-score');

    expect(screen.getByTestId('crm-data-health-clean')).toBeTruthy();
    expect(screen.queryByTestId('crm-data-health-error')).toBeNull();
  });

  it('surfaces checks that could not run instead of scoring around them', async () => {
    responses = [
      () =>
        json(
          payload({
            errors: [
              {
                key: 'dupes.open-pairs',
                label: 'Possible duplicate pairs awaiting review',
                message: 'canceling statement due to statement timeout',
              },
            ],
          }),
        ),
    ];
    render(<DataHealthClient />);
    await screen.findByTestId('crm-data-health-score');

    const panel = screen.getByTestId('crm-data-health-rule-errors');
    expect(panel.textContent).toContain('1 check could not run');
    expect(panel.textContent).toContain('canceling statement due to statement timeout');

    // The broken check is named the way the rest of the page names it. The raw
    // key is a developer identifier and stays behind a tooltip.
    expect(panel.textContent).toContain('Possible duplicate pairs awaiting review');
    expect(panel.textContent).not.toContain('dupes.open-pairs');
    expect(panel.querySelector('[title="dupes.open-pairs"]')).not.toBeNull();
  });

  it('falls back to the key only when the route sent no label', async () => {
    responses = [
      () => json(payload({ errors: [{ key: 'dupes.open-pairs', message: 'timeout' }] })),
    ];
    render(<DataHealthClient />);
    await screen.findByTestId('crm-data-health-score');

    // Naming it badly beats not naming it at all.
    expect(screen.getByTestId('crm-data-health-rule-errors').textContent).toContain(
      'dupes.open-pairs',
    );
  });

  it('says out loud when the numbers are the last recorded sweep, not a live one', async () => {
    responses = [() => json(payload({ source: 'recorded' }))];
    render(<DataHealthClient />);
    await screen.findByTestId('crm-data-health-score');

    const source = screen.getByTestId('crm-data-health-source');
    expect(source.textContent).toContain('Last recorded sweep');
    expect(source.textContent).toContain('2026-08-23');
  });

  // -------------------------------------------------------------------------
  // The honesty pair
  // -------------------------------------------------------------------------

  it('shows an error with Try again — and NEVER an all-clear beside it', async () => {
    responses = [() => json({ error: 'Sweep connection is not configured' }, 500)];
    render(<DataHealthClient />);

    const banner = await screen.findByTestId('crm-data-health-error');
    expect(banner.textContent).toContain('Sweep connection is not configured');
    expect(banner.getAttribute('role')).toBe('alert');

    // Not a score, not a rule list, and above all not "every check came back clean".
    expect(screen.queryByTestId('crm-data-health-clean')).toBeNull();
    expect(screen.queryByTestId('crm-data-health-score')).toBeNull();
    expect(screen.queryByTestId('crm-data-health-loading')).toBeNull();

    // Try again re-asks and renders the report.
    responses = [() => json(payload())];
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByTestId('crm-data-health-score');
    expect(screen.queryByTestId('crm-data-health-error')).toBeNull();
  });

  it('does not say "Try again" twice — the banner has the button, the toast has the words', async () => {
    responses = [() => Promise.reject(new TypeError('Failed to fetch'))];
    render(<DataHealthClient />);

    const banner = await screen.findByTestId('crm-data-health-error');
    // The sentence and the button beside it were both saying it.
    const said = banner.textContent?.match(/Try again/g) ?? [];
    expect(said).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();

    // The toast keeps the instruction, because a toast has no button to press.
    responses = [() => Promise.reject(new TypeError('Failed to fetch'))];
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls.at(-1)?.[0])).toContain('Try again');
  });

  it('keeps the clean panel hidden when a refresh fails over a clean report', async () => {
    responses = [() => json(CLEAN)];
    render(<DataHealthClient />);
    await screen.findByTestId('crm-data-health-clean');

    responses = [() => Promise.reject(new TypeError('Failed to fetch'))];
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));

    await screen.findByTestId('crm-data-health-error');
    // The all-clear vanishes the moment we can no longer stand behind it…
    expect(screen.queryByTestId('crm-data-health-clean')).toBeNull();
    // …and the stale numbers still on screen are labelled as stale.
    expect(screen.getByTestId('crm-data-health-error').textContent).toContain(
      'from the last check that worked',
    );
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('refuses a payload it does not understand rather than rendering garbage', async () => {
    responses = [() => json({ hello: 'world' })];
    render(<DataHealthClient />);

    const banner = await screen.findByTestId('crm-data-health-error');
    expect(banner.textContent).toContain('shape this page does not understand');
    expect(screen.queryByTestId('crm-data-health-score')).toBeNull();
  });
});
