// @vitest-environment jsdom
/**
 * EV-5F follow-up to CLOSE-1: the md–lg (tablet 1024–1279) filter sheet went
 * out with `trimSurface` unwired, so `crm.lists.trim_surface` was inert at
 * exactly that breakpoint while the docked rail and the mobile drawer both
 * honoured it. These pin the forward — the defect was a missing prop, so the
 * test asserts the prop that reaches FilterSidebar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const sidebarProps: Array<Record<string, unknown>> = [];
vi.mock('./FilterSidebar', () => ({
  FilterSidebar: (props: Record<string, unknown>) => {
    sidebarProps.push(props);
    return <div data-testid="stub-filter-sidebar" />;
  },
}));

import { FilterSidebarTrigger } from './FilterSidebarTrigger';

const open = () => fireEvent.click(screen.getByTestId('crm-filter-trigger'));

beforeEach(() => {
  sidebarProps.length = 0;
});
afterEach(cleanup);

describe('FilterSidebarTrigger — trimSurface forward (LS-9)', () => {
  it('hands the flag to the sheet rail when the org has it on', () => {
    render(
      <FilterSidebarTrigger fields={[]} filters={[]} onFiltersChange={() => {}} trimSurface />,
    );
    open();
    expect(sidebarProps.at(-1)?.trimSurface).toBe(true);
  });

  it('keeps today’s full surface when the flag is off', () => {
    render(
      <FilterSidebarTrigger
        fields={[]}
        filters={[]}
        onFiltersChange={() => {}}
        trimSurface={false}
      />,
    );
    open();
    expect(sidebarProps.at(-1)?.trimSurface).toBe(false);
  });

  it('fails closed when the prop is omitted (flag-table outage → full surface)', () => {
    render(<FilterSidebarTrigger fields={[]} filters={[]} onFiltersChange={() => {}} />);
    open();
    expect(sidebarProps.at(-1)?.trimSurface).toBe(false);
  });
});
