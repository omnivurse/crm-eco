import { describe, expect, it } from 'vitest';
import { planAbandonedEnrollmentReminders } from './abandonedReminders';

describe('planAbandonedEnrollmentReminders', () => {
  const staleBefore = '2026-09-11T00:00:00.000Z';
  const rows = [
    {
      id: 'e1',
      organization_id: 'org',
      status: 'draft',
      updated_at: '2026-09-01T00:00:00.000Z',
      email: 'a@example.com',
    },
    {
      id: 'e2',
      organization_id: 'org',
      status: 'submitted',
      updated_at: '2026-09-01T00:00:00.000Z',
      email: 'b@example.com',
    },
  ];

  it('lists stale drafts in dry-run without enrolling', () => {
    const planned = planAbandonedEnrollmentReminders(rows, {
      staleBeforeIso: staleBefore,
      sendEnabled: false,
    });
    expect(planned.dryRun).toBe(true);
    expect(planned.stale).toBe(1);
    expect(planned.toEnroll).toEqual([]);
  });

  it('enrolls stale drafts with email when send is enabled', () => {
    const planned = planAbandonedEnrollmentReminders(rows, {
      staleBeforeIso: staleBefore,
      sendEnabled: true,
    });
    expect(planned.toEnroll.map((row) => row.id)).toEqual(['e1']);
  });
});
