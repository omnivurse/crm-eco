import { Plus, UploadSimple, Users } from '@phosphor-icons/react/dist/ssr';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@crm-eco/ui';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';
import { MemberTable } from '@/components/members/MemberTable';
import { MemberFilters } from '@/components/members/MemberFilters';
import { PageHeader } from '@/components/ui/PageHeader';

const PAGE_SIZE = 25;

async function getMembers(page: number, filters: { search?: string; advisor?: string; status?: string; market_type?: string }) {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return { members: [], total: 0, orgId: '' };

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('members')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      status,
      state,
      plan_name,
      effective_date,
      created_at,
      market_type,
      active_plan_type,
      plan_type,
      is_smoker,
      advisor:advisors(id, first_name, last_name)
    `, { count: 'exact' })
    .eq('organization_id', tenant.organizationId);

  if (filters.advisor) {
    query = query.eq('advisor_id', filters.advisor);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search) {
    // RPC searches primary + dependent/spouse/child names.
    const { data: matchedIds } = await supabase.rpc(
      'search_members_with_dependents' as any,
      { p_org_id: tenant.organizationId, p_search: filters.search }
    );
    if (matchedIds && matchedIds.length > 0) {
      query = query.in('id', matchedIds);
    } else {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
  }
  if (filters.market_type) {
    query = query.eq('market_type', filters.market_type);
  }

  const { data: members, count } = await (query
    .order('created_at', { ascending: false })
    .range(from, to) as any);

  return { members: members ?? [], total: count ?? 0, orgId: tenant.organizationId };
}

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string; advisor?: string; status?: string; market_type?: string }>;
}

export default async function MembersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const filters = {
    search: params.search || undefined,
    advisor: params.advisor || undefined,
    status: params.status || undefined,
    market_type: params.market_type || undefined,
  };
  const { members, total, orgId } = await getMembers(page, filters);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Preserve filters in pagination links
  const buildPageUrl = (p: number) => {
    const sp = new URLSearchParams();
    sp.set('page', String(p));
    if (params.search) sp.set('search', params.search);
    if (params.advisor) sp.set('advisor', params.advisor);
    if (params.status) sp.set('status', params.status);
    if (params.market_type) sp.set('market_type', params.market_type);
    return `/members?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Members"
        description="Manage member accounts and information"
        icon={<Users weight="light" className="w-6 h-6" />}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/members/import">
              <Button variant="outline">
                <UploadSimple weight="light" className="h-4 w-4 mr-2" />
                Import
              </Button>
            </Link>
            <Link href="/members/new">
              <Button>
                <Plus weight="light" className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filters */}
      {orgId && <MemberFilters orgId={orgId} />}

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>{total.toLocaleString()} members found</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberTable members={members} orgId={orgId} />
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                {page > 1 ? (
                  <PaginationPrevious href={buildPageUrl(page - 1)} />
                ) : (
                  <PaginationPrevious
                    href="#"
                    aria-disabled
                    className="pointer-events-none opacity-50"
                  />
                )}
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 text-sm text-muted-foreground tabular-nums">
                  Page {page} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                {page < totalPages ? (
                  <PaginationNext href={buildPageUrl(page + 1)} />
                ) : (
                  <PaginationNext
                    href="#"
                    aria-disabled
                    className="pointer-events-none opacity-50"
                  />
                )}
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
