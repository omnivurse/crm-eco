/**
 * DE-M1 backstop — the UI hides every create affordance from crm_viewer
 * (walk-drawer "viewer persona"), and the API still refuses the write:
 * POST /api/crm/records → 403 for the viewer session (route.ts role list ==
 * lib/crm/can-create-records). Uses the project's storageState (the WALK_ROLE
 * session cookies), so `request` is the viewer. Valid org/module ids are read
 * from GET /api/crm/modules so the 403 is the ROLE check, not a 400.
 */
import { expect, test } from '../walk-fixture';
import { walkRole } from '../env';
import { runSuffix } from '../walk-helpers';

test.describe('viewer persona API backstop (DE-M1)', () => {
  test('crm_viewer POST /api/crm/records is refused with 403', async ({ request, walk }) => {
    test.skip(walkRole() !== 'viewer', 'run with WALK_ROLE=viewer');
    await walk.task(
      'DE-viewer-post-403',
      'crm_viewer POST /api/crm/records → 403 (nothing created)',
      0,
      async () => {
        const modsRes = await request.get('/api/crm/modules');
        expect(modsRes.status(), 'viewer can still read modules').toBe(200);
        const mods = (await modsRes.json()) as Array<{ id: string; org_id: string; key: string }>;
        const contacts = mods.find((m) => m.key === 'contacts');
        expect(contacts, 'contacts module must exist for the org').toBeTruthy();
        const res = await request.post('/api/crm/records', {
          data: {
            org_id: contacts!.org_id,
            module_id: contacts!.id,
            data: { first_name: 'Viewer', last_name: `Probe${runSuffix()}`, walk_fixture: 'true' },
          },
        });
        walk.note('status', res.status());
        expect(res.status(), 'POST must be refused by the role check').toBe(403);
      },
      { soft: true },
    );
  });
});
