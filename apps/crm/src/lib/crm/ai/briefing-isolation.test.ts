/**
 * Isolation / fail-closed contracts for the briefing module.
 * These assert interface invariants without hitting production DB.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('briefing fail-closed contracts', () => {
  it('loadAiRecordContext scopes by org_id and excludes trashed', () => {
    const src = readFileSync(
      join(__dirname, '../ai-context.ts'),
      'utf8',
    );
    expect(src).toMatch(/\.eq\('org_id',\s*orgId\)/);
    expect(src).toMatch(/\.is\('deleted_at',\s*null\)/);
  });

  it('briefing API requires crm roles and returns 404 when missing', () => {
    const src = readFileSync(
      join(__dirname, '../../../app/api/crm/ai/briefing/route.ts'),
      'utf8',
    );
    expect(src).toContain('crm_admin');
    expect(src).toContain('crm_manager');
    expect(src).toContain('crm_agent');
    expect(src).toContain('status: 404');
    expect(src).toContain('status: 403');
  });

  it('invokeCrmAi never logs prompt bodies', () => {
    const src = readFileSync(join(__dirname, 'invoke.ts'), 'utf8');
    expect(src).toContain("console.info('[crm-ai]'");
    expect(src).not.toMatch(/console\.(info|log|warn).*args\.user/);
    expect(src).not.toMatch(/console\.(info|log|warn).*args\.system/);
  });

  it('audit migration enables RLS', () => {
    const src = readFileSync(
      join(
        __dirname,
        '../../../../../../supabase/migrations/20260811220000_crm_ai_audit.sql',
      ),
      'utf8',
    );
    expect(src).toContain('ENABLE ROW LEVEL SECURITY');
    expect(src).toContain('crm_ai_audit_select_org');
    expect(src).toContain('crm_ai_audit_insert_org');
  });
});
