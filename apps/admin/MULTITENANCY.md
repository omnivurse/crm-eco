# Admin multi-tenancy contract

This document describes the multi-tenancy guarantees of the Admin app
and the contract every route / page / server action must follow.

> Audience: anyone touching `apps/admin`. Read this before adding new
> queries, server actions, or API routes.

---

## TL;DR

1. **Never** read `organization_id` from `profiles`. Always source it
   from the active tenant resolver.
2. Three blessed ways to get the active tenant id:
   - `requireActiveTenant()` — throws if none in scope (server
     components, server actions, route handlers).
   - `getActiveTenant()` — returns `null` if none (anywhere we want
     to fall back gracefully).
   - `getAdminProfile()` — returns the profile *with*
     `organization_id` overridden to the active tenant id.
3. **Either** use the tenant-scoped query helper (`tenantSupabase()`)
   **or** call `.eq('organization_id', tenant.organizationId)`
   explicitly. Don't rely on RLS alone — it's a defense-in-depth
   layer, not the application contract.
4. `requireAdminRole()` already does the right thing — it returns
   the active tenant id as `profile.organization_id`.

---

## Resolution chain

The active tenant is resolved per-request in this priority order
(see `src/lib/tenant.ts → getActiveTenant`):

| # | Source              | Notes                                                |
|---|---------------------|------------------------------------------------------|
| 1 | `x-active-org` header | Set by middleware after host-based routing.          |
| 2 | `dh_active_org` cookie | Set by the OrganizationSwitcher server action.       |
| 3 | Subdomain (`acme.admin.doublehelix.com`) | Looked up via `organizations.subdomain`. |
| 4 | Vanity domain (`organizations.domain`) | Custom-mapped tenant domains.                |
| 5 | User's default membership (`organization_members.is_default`) | First active membership otherwise. |

Every path verifies that the resolved organization is one the user is
a member of. A header / cookie / subdomain pointing to an org the
user does not belong to is **silently dropped** and we fall through
to the next strategy.

---

## How to scope queries (3 patterns, in order of preference)

### Pattern A — `tenantSupabase()` (preferred for new code)

`tenantSupabase()` returns a tenant-scoped query factory that
automatically applies `.eq('organization_id', ...)` to every read,
update, and delete, and stamps `organization_id` on every insert /
upsert. **Safe by construction.**

```ts
import { tenantSupabase } from '@/lib/tenant-supabase';

export async function GET() {
  const { fromTenant } = await tenantSupabase();

  const { data: members } = await fromTenant('members')
    .select('*')
    .eq('status', 'active'); // already scoped to the active tenant

  return NextResponse.json({ members });
}
```

Inserts & updates are also auto-scoped:

```ts
const { fromTenant } = await tenantSupabase();

await fromTenant('todos').insert({
  title: 'Follow up with Carrington',
  // organization_id is auto-stamped
});
```

> The factory throws if the table is not registered in
> `TENANT_SCOPED_TABLES` — this is intentional. Use plain
> `supabase.from(...)` for global tables (carriers, healthcare
> networks, etc.).

### Pattern B — Explicit `.eq('organization_id', ...)`

Existing routes may keep the explicit pattern as long as they source
the org id from the resolver, never from `profiles`:

```ts
import { getActiveTenant } from '@/lib/tenant';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('organization_id', tenant.organizationId);

  return NextResponse.json({ data });
}
```

### Pattern C — `getAdminProfile()` / `requireAdminRole()` (legacy ✅)

These helpers were rewired in `2026-04-26` so that
`profile.organization_id` is the **active tenant id**, not the user's
default org. Existing code that uses
`profile.organization_id` therefore continues to work — and now
correctly respects the user's tenant choice.

Continue to use these in legacy routes; migrate to Pattern A when
touching the file for other reasons.

---

## What is RLS responsible for?

The new migration `202604260001_admin_multitenancy_foundation.sql`
extends RLS across:

- `organizations` — row visible only to its members.
- `organization_members` — visible only to the member or org admins.
- `tenant_audit_log` — write-once, scoped to org.
- `auth.user_organization_ids()` and `auth.user_role_in(org_id)` —
  SECURITY DEFINER helpers for cheap RLS checks.

Existing tenant-scoped tables (members, agents, products, billing_*,
commissions, etc.) already have RLS policies from earlier migrations
— this PR did **not** rewrite them. The application-layer guard
(`fromTenant`) is a second line of defense in case any policy is
later misconfigured.

---

## Migration status — server side ✅

As of 2026-04-26 every server-rendered page, server action, and
route handler has been migrated to the active-tenant resolver via
the `scripts/codemod-tenant-resolver.mjs` codemod. The remaining
references to `profile.organization_id` in server code all flow
through `getAdminProfile()` / `requireAdminRole()` — and those
helpers were rewired to source the org id from the active tenant.

Re-running the codemod is idempotent:

```bash
node scripts/codemod-tenant-resolver.mjs            # dry-run
node scripts/codemod-tenant-resolver.mjs --write    # apply
```

The codemod intentionally skips files starting with `'use client'`
— see the next section for client-side migration.

## Migration status — client side ⚠️

Client components currently still call
`supabase.from('profiles').select('organization_id')` from the
browser. This works correctly *for users who belong to a single
organization*, but does NOT respect the tenant-switcher
selection — it always returns the user's primary org.

**Fix:** consume the `<TenantProvider>` (mounted in
`(dashboard)/layout.tsx`) via `useActiveOrgId()`:

```ts
'use client';
import { useActiveOrgId } from '@/components/tenant/TenantContext';

export function MyClientList() {
  const organizationId = useActiveOrgId();
  // …use organizationId in any browser-side supabase query
}
```

When migrating a client page, delete the `auth.getUser()` +
`profiles` lookup block entirely and read the org id from the
hook. Switcher selection now flows correctly through to the
client.

## Migration playbook (legacy routes → safe-by-construction)

For any remaining hand-written routes, the mechanical recipe is:

```diff
- const { data: profile } = await supabase
-   .from('profiles')
-   .select('organization_id, role')
-   .eq('user_id', user.id)
-   .single();
- if (!profile) return ...;

+ import { getActiveTenant } from '@/lib/tenant';
+ const tenant = await getActiveTenant();
+ if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 });
```

Then either:

- Replace `profile.organization_id` with `tenant.organizationId`, **or**
- Replace `supabase.from('table').select(...).eq('organization_id', ...)`
  with `fromTenant('table').select(...)` from `tenantSupabase()`.

---

## Testing the contract

1. **Local sanity:** sign in as a user who is a member of two
   organizations, switch via the top-nav switcher, and confirm
   every dashboard reloads with data scoped to the new org.
2. **Subdomain:** start the dev server with
   `acme.localhost:3002` (add `acme.localhost` to `/etc/hosts`) and
   confirm the app shells into the `acme` tenant.
3. **Negative test:** try to set `dh_active_org` cookie to an org id
   the user does not belong to — the resolver should ignore it.
4. **DB-level:** run `select * from members` as the anon role with
   a JWT for a user — RLS should return zero rows for orgs the
   user is not in.

---

## Reference helpers

| Helper                        | File                             | Purpose                                          |
|-------------------------------|----------------------------------|--------------------------------------------------|
| `extractSubdomain(host)`      | `src/lib/tenant.ts`              | Pure function — parse host → subdomain candidate.|
| `getActiveTenant()`           | `src/lib/tenant.ts`              | Resolve tenant for the current request.          |
| `requireActiveTenant()`       | `src/lib/tenant.ts`              | Throw if no tenant in scope.                     |
| `listMyTenants()`             | `src/lib/tenant.ts`              | Memberships for the switcher UI.                 |
| `setActiveTenantCookie(id)`   | `src/lib/tenant.ts`              | Persist switcher selection.                      |
| `tenantSupabase()`            | `src/lib/tenant-supabase.ts`     | Tenant-scoped Supabase client + `fromTenant()`.  |
| `getAdminProfile()`           | `src/lib/profile.ts`             | Profile with `organization_id` overridden.       |
| `requireAdminRole(supabase)`  | `src/lib/auth.ts`                | Role gate for admin route handlers.              |
| `<TenantProvider>` / `useActiveOrgId()` | `src/components/tenant/TenantContext.tsx` | Client-side access to the active tenant.         |

---

Last updated: 2026-04-26.
