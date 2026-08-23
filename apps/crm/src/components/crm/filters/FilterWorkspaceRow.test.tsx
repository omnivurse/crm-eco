// @vitest-environment jsdom
/**
 * LS-10 — no phantom rail column on a phone.
 *
 * The workspace is a two-column grid whose first cell holds the docked filter
 * rail. `FilterRailFrame` is `lg:flex`, so below `lg` that cell is
 * `display:none` and a column gap there is pure dead space against the left
 * edge of the table pane. The gap must therefore be `lg`-only.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

beforeAll(() => {
  // jsdom has no ResizeObserver; useRemainingViewportHeight observes the row.
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import { FilterWorkspaceRow } from './FilterWorkspaceRow';

afterEach(cleanup);

function row(extra?: { pending?: boolean }) {
  render(
    <FilterWorkspaceRow rail={<aside data-testid="rail" />} pending={extra?.pending}>
      <div data-testid="pane" />
    </FilterWorkspaceRow>,
  );
  return document.querySelector('[data-filter-workspace]') as HTMLElement;
}

describe('FilterWorkspaceRow (LS-10)', () => {
  it('gaps the rail column only from lg up', () => {
    const classes = row().className.split(/\s+/);
    expect(classes).toContain('gap-0');
    expect(classes).toContain('lg:gap-3');
    // The unconditional gap was the phantom column below lg.
    expect(classes).not.toContain('gap-3');
  });

  it('keeps the two-column grid and the explicit height (rail + pane share one)', () => {
    const el = row();
    expect(el.className).toContain('grid-cols-[auto_minmax(0,1fr)]');
    expect(el.style.height).not.toBe('');
    expect(screen.getByTestId('rail')).toBeTruthy();
    expect(screen.getByTestId('pane')).toBeTruthy();
  });

  it('still reports aria-busy while a list navigation is in flight', () => {
    row({ pending: true });
    expect(document.querySelector('[data-list-pending="true"]')).toBeTruthy();
  });
});
