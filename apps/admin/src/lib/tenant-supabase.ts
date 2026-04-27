import 'server-only';

import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveTenant, type ResolvedTenant } from './tenant';

/**
 * Tables that have an `organization_id` column and therefore must
 * always be scoped to the active tenant when queried from the
 * Admin app.
 *
 * Defense-in-depth note: every one of these tables also has RLS
 * policies that enforce isolation at the database layer. The list
 * below is for the *application* layer guard so that a buggy or
 * impersonated request can never accidentally enumerate another
 * tenant's data — even if RLS is mis-configured for a moment.
 *
 * Keep this list in sync with the database. Generate a fresh list
 * with:
 *
 *   select table_name from information_schema.columns
 *   where column_name = 'organization_id'
 *     and table_schema = 'public'
 *   order by table_name;
 */
export const TENANT_SCOPED_TABLES = new Set<string>([
  'activity_log_entries',
  'admin_audit_log',
  'agents',
  'agent_assignments',
  'agent_bill_groups',
  'agent_commission_rules',
  'agent_licenses',
  'audit_logs',
  'billing_payment_processors',
  'billing_schedules',
  'billing_transactions',
  'bulk_imports',
  'campaigns',
  'change_requests',
  'change_intelligence_events',
  'commission_payouts',
  'commission_records',
  'commission_tiers',
  'communication_templates',
  'communications',
  'contact_groups',
  'contacts',
  'dashboard_widgets',
  'documents',
  'email_sequences',
  'email_templates',
  'enrollments',
  'enrollment_links',
  'imports',
  'invoice_groups',
  'invoices',
  'leads',
  'members',
  'member_changes',
  'member_segments',
  'nacha_batches',
  'oauth_credentials',
  'organization_members',
  'payables',
  'payment_profiles',
  'pricing_matrices',
  'product_features',
  'products',
  'profiles',
  'prospects',
  'rate_settings',
  'recently_viewed',
  'reports',
  'report_executions',
  'report_favorites',
  'report_history',
  'saved_views',
  'scheduling_links',
  'segments',
  'system_settings',
  'tenant_audit_log',
  'territories',
  'todos',
  'vendors',
  'vendor_contacts',
  'workflow_runs',
  'workflows',
]);

/**
 * Tables that are global (carrier directory, network intelligence,
 * platform-level admin tables) and must NOT have an
 * `organization_id` filter applied. We list them explicitly so the
 * helper fails closed for unknown tables.
 */
export const PLATFORM_GLOBAL_TABLES = new Set<string>([
  'carriers',
  'feature_flags',
  'healthcare_networks',
  'healthcare_providers',
  'organizations',
  'platform_announcements',
]);

/**
 * Whether the application-layer tenant guard should be applied to
 * the given table.
 */
export function isTenantScopedTable(table: string): boolean {
  return TENANT_SCOPED_TABLES.has(table);
}

/**
 * Active tenant + a Supabase client + an org-scoped query helper.
 *
 * Usage:
 *
 * ```ts
 * const { tenant, supabase, fromTenant } = await tenantSupabase();
 *
 * // Safe-by-construction — auto-applies .eq('organization_id', ...)
 * const { data } = await fromTenant('members')
 *   .select('*')
 *   .eq('status', 'active');
 *
 * // Inserts auto-stamp organization_id.
 * await fromTenant('todos').insert({ title: 'Follow up with Avery' });
 *
 * // Use `supabase` directly for tables that are global (e.g. `carriers`).
 * await supabase.from('carriers').select('*');
 * ```
 *
 * If you call `fromTenant('not_a_tenant_table')` we throw, because
 * the contract is specifically for tenant-scoped reads/writes.
 */
export async function tenantSupabase() {
  const supabase = await createServerSupabaseClient();
  const tenant = await requireActiveTenant();
  const fromTenant = createTenantQueryFactory(supabase, tenant);

  return { tenant, supabase, fromTenant };
}

type SupabaseLike = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function createTenantQueryFactory(
  supabase: SupabaseLike,
  tenant: ResolvedTenant,
) {
  return function fromTenant<T extends string>(table: T) {
    if (!isTenantScopedTable(table)) {
      throw new Error(
        `tenantSupabase: \`${table}\` is not registered as a tenant-scoped table. ` +
          `Either add it to TENANT_SCOPED_TABLES, or use the underlying \`supabase\` client directly.`,
      );
    }

    const builder: any = (supabase as any).from(table);

    return new Proxy(builder, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);

        // Auto-stamp organization_id on inserts / upserts.
        if (prop === 'insert' || prop === 'upsert') {
          return (rows: any, options?: unknown) => {
            const stamped = Array.isArray(rows)
              ? rows.map((r) => stampOrg(r, tenant.organizationId))
              : stampOrg(rows, tenant.organizationId);

            const result = (target as any)[prop](stamped, options);
            return wrapWithEq(result, tenant.organizationId);
          };
        }

        // Auto-apply organization_id filter on selects / updates / deletes.
        if (prop === 'select' || prop === 'update' || prop === 'delete') {
          return (...args: any[]) => {
            const result = (target as any)[prop](...args);
            return wrapWithEq(result, tenant.organizationId);
          };
        }

        return value;
      },
    });
  };
}

function stampOrg<T extends Record<string, unknown>>(
  row: T,
  organizationId: string,
): T & { organization_id: string } {
  return {
    ...row,
    organization_id: (row as Record<string, unknown>).organization_id ?? organizationId,
  } as T & { organization_id: string };
}

function wrapWithEq(builder: any, organizationId: string): any {
  if (builder && typeof builder.eq === 'function') {
    return builder.eq('organization_id', organizationId);
  }
  return builder;
}
