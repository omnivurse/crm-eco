/**
 * PERM-viewer-gated-link — a role gate that redirects has to say why.
 *
 * The key is what /crm/import puts in the query; the copy is what /crm shows.
 * Both live here so the redirect and the banner cannot drift, and the walk's
 * "the landing page must explain the refused route" regex is pinned as part
 * of the contract.
 */
import { describe, expect, it } from 'vitest';
import { CRM_GATE_REASON, crmGateNoticeCopy } from './gate-notice-copy';
import { toastCopy } from './toast-copy';

/** apps/crm/e2e/specs/walk-roles.spec.ts › PERM-viewer-gated-link. */
const WALK_EXPLANATION =
  /permission|not available to your role|read-only|no access|can't import|cannot import/i;

describe('crmGateNoticeCopy', () => {
  it('the import gate key is the one /crm/import redirects with', () => {
    expect(CRM_GATE_REASON.noImportPermission).toBe('no_import_permission');
  });

  it('names Import / Export in the toastCopy voice and says what to do next', () => {
    const copy = crmGateNoticeCopy(CRM_GATE_REASON.noImportPermission);
    expect(copy).not.toBeNull();
    expect(copy!.title).toBe(
      toastCopy.failed('open Import / Export', 'importing is limited to managers and admins'),
    );
    expect(copy!.title).toContain('Import / Export');
    // The generic no-access family talks about "this record" — not this gate.
    expect(copy!.title).not.toContain('this record');
    expect(copy!.description).toMatch(/dashboard/i);
    expect(copy!.description).toMatch(/admin/i);
  });

  it('satisfies the walk row: the landing page explains the refused route', () => {
    const copy = crmGateNoticeCopy('no_import_permission')!;
    expect(`${copy.title} ${copy.description}`).toMatch(WALK_EXPLANATION);
  });

  it('every key a CRM page redirects with has copy — no silent bounces left', () => {
    // Grep for `/crm?error=` in src/app/crm: import, r/new, imports/update,
    // duplicates. Each one lands on the desk, so each one has to speak.
    const keys = ['no_import_permission', 'no_create_permission', 'insufficient_permissions', 'admin_only'];
    expect(Object.values(CRM_GATE_REASON).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      const copy = crmGateNoticeCopy(key);
      expect(copy, key).not.toBeNull();
      expect(copy!.title.startsWith("Couldn't "), key).toBe(true);
      expect(copy!.title, key).not.toContain('this record');
      expect(`${copy!.title} ${copy!.description}`, key).toMatch(WALK_EXPLANATION);
    }
  });

  it('renders nothing for a missing, unknown or non-string reason', () => {
    for (const reason of [null, undefined, '', 'nope', '<script>alert(1)</script>', 42 as unknown as string]) {
      expect(crmGateNoticeCopy(reason)).toBeNull();
    }
  });

  it('takes the first known value of a repeated ?error= param', () => {
    expect(crmGateNoticeCopy(['nope', 'no_import_permission'])).toEqual(
      crmGateNoticeCopy('no_import_permission'),
    );
    expect(crmGateNoticeCopy(['nope', 'still-nope'])).toBeNull();
  });

  it('tolerates whitespace around the key', () => {
    expect(crmGateNoticeCopy(' no_import_permission ')).not.toBeNull();
  });
});
