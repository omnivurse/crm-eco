# PIFH Deploy Safety — Multi-Tenancy + Marketing Rebrand

Written: Apr 27 2026
Project: `sffisarikcreyyjzdjvb` (PIFH)
Live PIFH org id: `00000000-0000-0000-0000-000000000001`

This is the pre-flight checklist + rollback playbook for shipping the
admin multi-tenancy refactor (`apps/admin`), the new marketing site
(`apps/marketing`), and the CRM rebrand (`apps/crm`).

The goal: **zero downtime, zero data loss, zero broken sessions for the
two existing PIFH owner accounts.**

---

## 1. Pre-flight findings (verified against live DB)

```
auth.users                = 2
profiles                  = 2   (both PIFH, role='owner', is_super_admin=true)
organization_members      = 2   (both backfilled, is_active=true, is_default=true)
profiles → org_members    = 100% match
members                   = 1062  (all PIFH-scoped)
advisors                  = 692   (all PIFH-scoped)
enrollments               = 1098  (all PIFH-scoped)
organizations             = 2     (PIFH + System Administration)
```

Impersonated PIFH owner via `set local request.jwt.claims = '{"sub":"<uuid>"}'`:

```
members_visible      = 1062  ✓ full dataset
advisors_visible     = 692   ✓
enrollments_visible  = 1098  ✓
my_organizations     = 1 row (Pay It Forward Health, role=owner, default=true)
```

### Migration data-safety audit

| Migration | Operation type | Risk |
|---|---|---|
| `202604260001` foundation | `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING` | None — purely additive |
| `202604260002` hardening | `CREATE POLICY` only | None |
| `202604260003` taxonomy | `INSERT ... ON CONFLICT` | None |
| `202604260004` drop legacy policies | `DROP POLICY IF EXISTS` on 4 single-tenant policies, replaced with multi-tenant equivalents | **Tightens** access — verified PIFH owners still see all 1062/692/1098 rows |
| `202604260005` health pt 1 | `DROP INDEX IF EXISTS` on duplicates, `ALTER FUNCTION SET search_path` | None — duplicate indexes are by definition redundant |
| `202604260006` health pt 2 | `DROP/CREATE VIEW` (definitions copied verbatim from `pg_get_viewdef`), `ALTER POLICY` (semantics preserved) | None |
| `202604260007` always-true RLS | Tightens 9 broken `USING (true)` policies on `crm_api_logs` + `crm_contact_groups*` | **Tightens** access — PIFH still has full visibility because `user_organization_ids()` returns PIFH for both owners |
| `202604270001` autosync (NEW) | `CREATE TRIGGER` on profiles → `INSERT ON CONFLICT DO NOTHING` into `organization_members` | None — forward-looking only |

**No `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, `ALTER TYPE` or destructive
schema change is performed in any of these migrations.**

---

## 2. Code-path audit — what could break PIFH at runtime

| Path | Verdict | Why |
|---|---|---|
| `apps/admin` middleware → profile lookup | ✅ Unchanged | Still queries `profiles.role` for the edge gate |
| `apps/admin` `getAdminProfile()` | ✅ Safe | Sources `organization_id` from `getActiveTenant()`. Verified: both PIFH owners have a default membership → returns PIFH |
| `apps/admin` `requireAdminRole()` | ✅ Safe | `tenant.role = 'owner'` is in the admin allowlist |
| `apps/admin` codemodded server routes (38 files) | ✅ Safe | Same single-org user → identical behaviour |
| `apps/admin` `OrganizationSwitcher` UI | ✅ Safe | Single-org user sees one entry, switcher is a no-op |
| `apps/admin` legacy domain `admin.doublehelixhub.com` | ✅ Safe | Now in `ROOT_DOMAINS` → resolver falls back to default membership |
| `apps/crm`, `apps/portal`, `apps/advisor-portal`, `apps/website`, `apps/server` | ✅ Untouched | None of these query `organization_members` or use `getActiveTenant()`. Continue reading `profiles.organization_id` directly |
| Supabase RLS for `members`, `advisors`, `enrollments` | ✅ Safe | Existing RLS predicates unchanged; PIFH owners still pass them via `is_org_member()` / `is_super_admin()` |

### Why the legacy CRM/portal/website/server apps cannot break

Search results for `organization_members` outside `apps/admin`:
none. Those apps still rely on the original `profiles.organization_id`
column, which we did **not** drop, modify, or migrate. The new column on
`organizations` (`subdomain`, `status`, `branding`, `plan`, `domain`,
`owner_user_id`) all default to `NULL` / sane defaults and no existing
code reads them.

---

## 3. Pre-deploy steps (run in this order)

```bash
# 1. Confirm the linked project is still PIFH
cat supabase/.temp/project-ref          # must be sffisarikcreyyjzdjvb

# 2. Push the autosync trigger migration
supabase db push                         # applies 202604270001

# 3. Re-run the live-data probe and assert counts haven't drifted
supabase db query --linked --output table "
  select
    (select count(*) from public.profiles)              as profiles,
    (select count(*) from public.organization_members)  as org_members,
    (select count(*) from public.members)               as members,
    (select count(*) from public.advisors)              as advisors,
    (select count(*) from public.enrollments)           as enrollments;
"
# Expected: 2 / 2 / 1062 / 692 / 1098

# 4. Impersonation smoke test
supabase db query --linked --output table "
  set local role authenticated;
  set local request.jwt.claims = '{\"sub\":\"411d27b9-9b9e-4d4e-8535-b0c431c57ddc\",\"role\":\"authenticated\"}';
  select count(*) as members_visible from public.members;
  select count(*) as memberships from public.organization_members where user_id = auth.uid();
"
# Expected: 1062 members, 1 membership row.

# 5. Build all apps locally
pnpm -w build
```

If any count drifts or the build fails, **STOP** and triage before
deploying.

---

## 4. Vercel deploy order

1. **`apps/admin`** — ship first. The new code is backwards compatible
   with the old admin middleware: a session created before deploy still
   works because the multi-tenancy resolver falls back to the user's
   default membership, which was backfilled hours ago.
2. **`apps/marketing`** — independent app, no shared session with
   admin. Wire `RESEND_API_KEY`, `SALES_FROM_EMAIL`, `SALES_INBOX_EMAIL`
   in Vercel before deploy.
3. **`apps/crm`** — visual-only rebrand for the consumer landing. No
   auth or data layer changes.

PIFH-facing apps (`apps/portal`, `apps/advisor-portal`, `apps/website`,
`apps/server`) need no redeploy — their code didn't change.

---

## 5. Post-deploy smoke tests

Run these as **each** PIFH owner:

| Step | URL | Expected |
|---|---|---|
| 1 | `https://admin.doublehelixhub.com/login` → sign in | Redirect to `/dashboard`, no flash of `/access-denied` |
| 2 | Dashboard widgets render | Member counts, recent activity all present |
| 3 | `/members` page | Lists all 1062 members |
| 4 | `/advisors` (or equivalent) | Lists all 692 advisors |
| 5 | `/audit-logs` | Returns rows scoped to org `00000000-...-0001` |
| 6 | Navbar → Account menu | Shows owner identity, no "switch org" prompts (single-tenant user) |
| 7 | `apps/crm` consumer landing | Loads, navigation links to `doublehelix.com` work |
| 8 | `apps/website` (PIFH consumer) | Members can still self-serve enrol — completely untouched |

If any check fails, jump to §6.

---

## 6. Rollback playbook

The migrations are additive, so a clean revert means **rolling back the
code, not the database**. The new tables and columns can be left in
place; they are unused by the old code.

### Step 6.1 — Vercel rollback (under 60s)

```bash
# In each Vercel project (admin, marketing, crm) hit the previous
# successful deployment and click "Promote to Production".
# This reinstates the pre-rebrand admin code, which still talks to the
# same Supabase project safely.
```

### Step 6.2 — If RLS turns out to be the problem (unlikely)

```sql
-- Restore the legacy single-tenant SELECT on profiles
DROP POLICY IF EXISTS profiles_select_org_members ON public.profiles;

CREATE POLICY "Users can view profiles in their organization"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (organization_id = (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));
```

This is the exact statement that `202604260004` removed — paste it back
and PIFH is at the previous behaviour.

### Step 6.3 — If the autosync trigger misbehaves

```sql
DROP TRIGGER IF EXISTS profiles_sync_to_org_members ON public.profiles;
DROP FUNCTION IF EXISTS public._sync_profile_to_org_member();
```

The `organization_members` rows already created stay — they are
identical to what the original backfill produced.

### Step 6.4 — Hard rollback (do NOT use unless directed)

`organization_members` and `tenant_audit_log` can be safely dropped:

```sql
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.tenant_audit_log CASCADE;
DROP VIEW  IF EXISTS public.my_organizations;
DROP FUNCTION IF EXISTS public.user_organization_ids();
DROP FUNCTION IF EXISTS public.user_role_in(uuid);
```

The `organizations` table additive columns are harmless to leave in place.

---

## 7. Known no-ops (intentional)

* PIFH org has `subdomain = NULL` and `domain = NULL`. The resolver
  therefore always falls through to `is_default = true` → PIFH.
  There is no need to set a subdomain for PIFH — they are the default
  tenant for every PIFH owner.
* `apps/website` (PIFH consumer site) is **unchanged** by this work and
  should be migrated to its own Supabase project on a separate ticket.
  Until then, both apps share `sffisarikcreyyjzdjvb` and that's fine.
* Both PIFH owners have `is_super_admin = true`. They will see the
  "System Administration" org in the switcher (correct — that's the
  Double Helix HQ tenant). Non-super-admin members of PIFH would only
  see PIFH.

---

## 8. Automated deploy gate

`scripts/pifh-deploy-gate.mjs` runs the §1 invariants live and exits
non-zero if anything drifts. Wire it into every layer of your pipeline:

| Layer | How |
|---|---|
| **Manual** | `npm run pifh:gate` |
| **GitHub Actions** | `.github/workflows/pifh-deploy-gate.yml` runs on every PR + push to `main`. Add `PIFH_SUPABASE_DB_URL` (Session-Pooler URL) under repo Settings → Secrets → Actions. |
| **Vercel** | In each project (admin / marketing / crm) → Settings → Git → Ignored Build Step, set `bash scripts/vercel-ignore-pifh-gate.sh` and add `SUPABASE_DB_URL` to the project env. The wrapper inverts the exit code so the deploy is skipped when the gate fails. |

Last gate run (Apr 27 2026):

```
✓ counts.members ≥ 1062 — actual=1062
✓ counts.advisors ≥ 692 — actual=692
✓ counts.enrollments ≥ 1098 — actual=1098
✓ profiles ↔ org_members count match — profiles=2 org_members=2
✓ every PIFH profile has an active org_members row — matched=2/2
✓ profiles_sync_to_org_members trigger exists
✓ _sync_profile_to_org_member function exists
✓ PIFH owner 411d27b9… — role=owner active=true default=true
✓ PIFH owner 46be4d37… — role=owner active=true default=true
✓ migrations 202604260001 → 202604270001 all applied
✓ All 17 checks passed — deploy is safe.
```

## 9. Resend setup for `doublehelix.com`

The marketing site's `/api/contact` endpoint sends through Resend. Use
the turnkey script:

```bash
RESEND_API_KEY=re_xxx npm run resend:setup
# or with a live deliverability check:
RESEND_API_KEY=re_xxx node scripts/resend-domain-setup.mjs --to you@yourdomain.com
```

The script:

1. Looks up `doublehelix.com` in the Resend account.
2. Creates it (us-east-1) if missing.
3. Prints the SPF / DKIM / DMARC / return-path DNS records to publish.
4. Polls verification every 10s for ~5 min once you confirm DNS is live.
5. Optionally fires a test email to `--to <email>`.

**Manual fallback** (if you'd rather click through):

1. https://resend.com/domains → "Add Domain" → `doublehelix.com`
2. Copy the SPF, DKIM, DMARC records into your DNS provider.
3. Click "Verify DNS Records".
4. Once verified, set on the **`apps/marketing` Vercel project** (Production scope):
   - `RESEND_API_KEY` — the production API key
   - `SALES_FROM_EMAIL` — `Double Helix <noreply@doublehelix.com>`
   - `SALES_INBOX_EMAIL` — the inbox you actually monitor
5. Redeploy `apps/marketing` and submit a test through `/contact`.

## 10. Sign-off

- [x] Migration `202604270001_org_members_autosync.sql` pushed
- [x] Live-data probe matches expected counts
- [x] Impersonation smoke test passes for both PIFH owners
- [x] `npm run pifh:gate` returns exit 0 (17/17 checks)
- [x] GitHub Action `pifh-deploy-gate.yml` committed
- [x] Vercel ignored-build wrapper committed
- [ ] `PIFH_SUPABASE_DB_URL` secret added in GitHub
- [ ] `SUPABASE_DB_URL` env added in each Vercel project
- [ ] `pnpm -w build` succeeds locally
- [ ] `doublehelix.com` verified in Resend (`npm run resend:setup`)
- [ ] `RESEND_API_KEY` / `SALES_FROM_EMAIL` / `SALES_INBOX_EMAIL` set on marketing Vercel project
- [ ] Admin / marketing / CRM Vercel deploys queued in order
- [ ] Post-deploy smoke tests passed for owner #1
- [ ] Post-deploy smoke tests passed for owner #2
