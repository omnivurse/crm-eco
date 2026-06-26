import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { Building2, Check, Globe, Palette } from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * Organizations management page.
 * ----------------------------------------------------------------
 * Read-only list of every organization the current user can access.
 * Org membership is resolved exactly like `getActiveTenant` /
 * `listMyTenants` — via the RLS-scoped `my_organizations` view, which
 * only ever returns rows for the authenticated user's memberships.
 * The row matching the request's active tenant is flagged "Active".
 */

type OrganizationRow = {
  id: string | null;
  name: string | null;
  slug: string | null;
  subdomain: string | null;
  domain: string | null;
  plan: string | null;
  status: string | null;
  role: string | null;
  is_default: boolean | null;
  branding: Record<string, unknown> | null;
};

async function getOrganizations() {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return { organizations: [] as OrganizationRow[], activeOrgId: '' };

  const { data, error } = (await (supabase as any)
    .from('my_organizations')
    .select('id, name, slug, subdomain, domain, plan, status, role, is_default, branding')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })) as {
    data: OrganizationRow[] | null;
    error: unknown;
  };

  if (error || !data) return { organizations: [] as OrganizationRow[], activeOrgId: tenant.organizationId };

  return { organizations: data, activeOrgId: tenant.organizationId };
}

function hasBranding(branding: Record<string, unknown> | null): boolean {
  if (!branding) return false;
  return Object.values(branding).some(
    (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
  );
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  trialing: 'secondary',
  suspended: 'destructive',
  cancelled: 'destructive',
};

export default async function OrganizationsPage() {
  const { organizations, activeOrgId } = await getOrganizations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Organizations you have access to"
        icon={<Building2 className="w-6 h-6" />}
        gradient="from-[#0891b2] to-[#06b6d4]"
      />

      <Card>
        <CardHeader>
          <CardTitle>Your Organizations</CardTitle>
          <CardDescription>
            {organizations.length.toLocaleString()}{' '}
            {organizations.length === 1 ? 'organization' : 'organizations'} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-slate-100 p-4 mb-4">
                <Building2 className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No organizations</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                You do not currently belong to any organization. Contact your administrator
                if you believe this is a mistake.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-3 pr-4 font-medium">Name</th>
                    <th className="py-3 pr-4 font-medium">Slug</th>
                    <th className="py-3 pr-4 font-medium">Domain</th>
                    <th className="py-3 pr-4 font-medium">Plan</th>
                    <th className="py-3 pr-4 font-medium">Your Role</th>
                    <th className="py-3 pr-4 font-medium">Branding</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org, idx) => {
                    const isActive = org.id === activeOrgId;
                    const domainLabel = org.domain || org.subdomain || '—';
                    const statusKey = (org.status || '').toLowerCase();
                    return (
                      <tr
                        key={org.id ?? org.slug ?? org.name ?? idx}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{org.name || 'Untitled'}</span>
                            {isActive && (
                              <Badge variant="default" className="gap-1">
                                <Check className="w-3 h-3" />
                                Active
                              </Badge>
                            )}
                            {org.is_default && !isActive && (
                              <Badge variant="outline">Default</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                          {org.slug || '—'}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            {domainLabel !== '—' && <Globe className="w-3.5 h-3.5 text-slate-400" />}
                            <span>{domainLabel}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="capitalize text-slate-700">{org.plan || '—'}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="capitalize text-slate-700">
                            {org.role ? org.role.replace(/_/g, ' ') : '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {hasBranding(org.branding) ? (
                            <Badge variant="secondary" className="gap-1">
                              <Palette className="w-3 h-3" />
                              Customized
                            </Badge>
                          ) : (
                            <span className="text-slate-400">Default</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {org.status ? (
                            <Badge variant={STATUS_VARIANTS[statusKey] ?? 'outline'} className="capitalize">
                              {org.status}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
