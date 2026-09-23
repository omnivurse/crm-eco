// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CoverageSnapshotMembershipActions } from './CoverageSnapshotMembershipActions';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => cleanup());

describe('CoverageSnapshotMembershipActions', () => {
  it('shows Schedule change when there is no upcoming membership', () => {
    render(
      <CoverageSnapshotMembershipActions
        recordId="rec-1"
        recordTitle="Bailey Johnson"
        data={{ product: 'Care Plus 2024 (42644)' }}
        canEdit
      />,
    );
    expect(screen.getByTestId('crm-schedule-membership-change').textContent).toContain(
      'Schedule change',
    );
  });

  it('shows Upcoming instead of Schedule change when a date is stored', () => {
    render(
      <CoverageSnapshotMembershipActions
        recordId="rec-1"
        recordTitle="Bailey Johnson"
        data={{
          product: 'Care Plus 2024 (42644)',
          scheduled_plan_change: {
            to_plan: 'Secure HSA',
            effective_date: '2026-10-01',
          },
        }}
        canEdit
      />,
    );
    expect(screen.queryByTestId('crm-schedule-membership-change')).toBeNull();
    const chip = screen.getByTestId('crm-snapshot-membership-actions').textContent ?? '';
    expect(chip).toContain('Upcoming: Secure HSA');
    expect(chip).toContain('Oct 1, 2026');
  });

  it('hides scheduling for Members-module rows managed by member sync', () => {
    render(
      <CoverageSnapshotMembershipActions
        recordId="rec-1"
        recordTitle="Bailey Johnson"
        data={{ product: 'Care Plus 2024 (42644)' }}
        canEdit
        managedByMemberSync
      />,
    );
    expect(screen.queryByTestId('crm-schedule-membership-change')).toBeNull();
  });
});
