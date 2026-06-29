import { describe, expect, it } from 'vitest';
import { resolveDefaultDashboardLayout } from './role-default-layout';
import { DEFAULT_LAYOUT } from './widget-registry';

describe('resolveDefaultDashboardLayout', () => {
  it('returns agent-focused widgets for crm_agent', () => {
    const layout = resolveDefaultDashboardLayout('crm_agent');
    const types = layout.widgets.map((w) => w.type);
    expect(types).toContain('todays-tasks');
    expect(types).toContain('at-risk-deals');
    expect(types).not.toContain('member-kpi-stats');
  });

  it('returns manager widgets with advisor visibility', () => {
    const layout = resolveDefaultDashboardLayout('crm_manager');
    const types = layout.widgets.map((w) => w.type);
    expect(types).toContain('advisor-contacts');
    expect(types).toContain('sales-command-tiles');
  });

  it('returns read-only layout for crm_viewer', () => {
    const layout = resolveDefaultDashboardLayout('crm_viewer');
    const types = layout.widgets.map((w) => w.type);
    expect(types).toContain('module-stats');
    expect(types).not.toContain('quick-actions');
  });

  it('falls back to DEFAULT_LAYOUT for admin and unknown roles', () => {
    expect(resolveDefaultDashboardLayout('crm_admin')).toEqual(DEFAULT_LAYOUT);
    expect(resolveDefaultDashboardLayout(null)).toEqual(DEFAULT_LAYOUT);
  });
});
