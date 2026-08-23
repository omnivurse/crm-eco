// @vitest-environment jsdom
/**
 * LS-10 — one sheet for mobile filters.
 *
 * ModuleShell now renders the filter rail INSIDE this drawer instead of a
 * trigger that opened a second sheet on top of it. The rail carries its own
 * "Filter {Module} by" header, so a section may omit its label — a labelled
 * section must still print its heading (View mode / Columns / Density).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // Radix Dialog measures/locks the body scroll on open.
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
});

import { MobileToolbarDrawer } from './MobileToolbarDrawer';

afterEach(cleanup);

function open(sections: Array<{ id: string; label?: string; content: React.ReactNode }>) {
  return render(
    <MobileToolbarDrawer
      open
      onOpenChange={vi.fn()}
      activeCount={2}
      sections={sections}
    />,
  );
}

describe('MobileToolbarDrawer (LS-10)', () => {
  it('prints a heading for a labelled section', () => {
    open([{ id: 'viewmode', label: 'View mode', content: <div data-testid="c" /> }]);
    expect(screen.getByText('View mode')).toBeTruthy();
    expect(screen.getByTestId('c')).toBeTruthy();
  });

  it('omits the heading for an unlabelled section but still renders its content', () => {
    const { container } = open([
      { id: 'filters', content: <div data-testid="rail">Filter Contacts by</div> },
    ]);
    expect(screen.getByTestId('rail')).toBeTruthy();
    const headings = container.ownerDocument.querySelectorAll(
      '.text-\\[11px\\].font-semibold.uppercase',
    );
    expect(headings).toHaveLength(0);
  });

  it('is a single overlay — one dialog with the shared "Filters & View" title', () => {
    open([
      { id: 'filters', content: <div /> },
      { id: 'viewmode', label: 'View mode', content: <div /> },
    ]);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByTestId('crm-mobile-toolbar-sheet')).toBeTruthy();
    expect(screen.getByText(/Filters & View/)).toBeTruthy();
  });
});
