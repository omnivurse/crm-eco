import { describe, expect, it } from 'vitest';
import {
  buildCrmProjectionFromActivatedPlan,
  projectActivatedPlanToCrmRecords,
} from './project-membership-to-crm';

describe('buildCrmProjectionFromActivatedPlan', () => {
  it('flips product, keeps start dates, marks the scheduled entry applied', () => {
    const next = buildCrmProjectionFromActivatedPlan({
      data: {
        product: 'Care+',
        monthly_contribution: '360',
        iua_amount: '2500',
        start_date: '2024-11-01',
        original_start_date: '2024-11-01',
        product_type: 'Care Plus 2024 (42644)',
        membership_changes: [
          {
            id: 'chg-1',
            type: 'upgrade',
            date: '2026-10-01',
            to_plan: 'Secure HSA',
            change_status: 'scheduled',
          },
        ],
        scheduled_plan_change: {
          change_id: 'chg-1',
          effective_date: '2026-10-01',
          to_plan: 'Secure HSA',
          to_monthly: '390',
        },
      },
      planName: 'PIFH Secure HSA',
      monthly: 390,
      iua: 2500,
      effectiveDate: '2026-10-01',
    });

    expect(next.product).toBe('PIFH Secure HSA');
    expect(next.previous_product).toBe('Care+');
    expect(next.product_type).toBe('PIFH Secure HSA');
    expect(next.monthly_contribution).toBe('390');
    expect(next.iua_amount).toBe('2500');
    expect(next.sharing_effective_date).toBe('2026-10-01');
    expect(next.start_date).toBe('2024-11-01');
    expect(next.scheduled_plan_change).toBeUndefined();
    expect((next.membership_changes as { change_status?: string }[])[0].change_status).toBe(
      'applied',
    );
  });
});

describe('projectActivatedPlanToCrmRecords', () => {
  it('selects only non-deleted CRM records with the PostgREST is-null operator', async () => {
    const filters: Array<{ method: string; column: string; value: unknown }> = [];
    const query: Record<string, unknown> = {};
    query.select = () => query;
    query.eq = (column: string, value: unknown) => {
      filters.push({ method: 'eq', column, value });
      return query;
    };
    query.is = (column: string, value: unknown) => {
      filters.push({ method: 'is', column, value });
      return query;
    };
    query.then = (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null });

    const result = await projectActivatedPlanToCrmRecords({ from: () => query } as never, {
      memberId: 'member-1',
      organizationId: 'org-1',
      planName: 'Premium Care',
      effectiveDate: '2026-10-01',
    });

    expect(result).toEqual({ updated: 0 });
    expect(filters).toContainEqual({
      method: 'is',
      column: 'deleted_at',
      value: null,
    });
    expect(filters).not.toContainEqual({
      method: 'eq',
      column: 'deleted_at',
      value: null,
    });
  });
});
