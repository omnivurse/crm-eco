import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { Plus, Upload, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { MemberTable } from '@/components/members/MemberTable';
import { MemberFilters } from '@/components/members/MemberFilters';
import { PageHeader } from '@/components/ui/PageHeader';

const PAGE_SIZE = 25;

async function getMembers(page: number, filters: { search?: string; advisor?: string; status?: string; market_type?: string }) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { members: [], total: 0, orgId: '' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return { members: [], total: 0, orgId: '' };

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
    .eq('organization_id', profile.organization_id);

  // Apply filters
  if (filters.advisor) {
    query = query.eq('advisor_id', filters.advisor);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search) {
    query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }
  if (filters.market_type) {
    query = query.eq('market_type', filters.market_type);
  }

  const { data: members, count } = await (query
    .order('created_at', { ascending: false })
    .range(from, to) as any);

  return { members: members ?? [], total: count ?? 0, orgId: profile.organization_id };
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
        icon={<Users className="w-6 h-6" />}
        gradient="from-[#047474] to-[#069B9A]"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/members/import">
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </Link>
            <Link href="/members/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
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
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
              {page > 1 ? (
                <Link href={buildPageUrl(page - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Link>
              ) : (
                <span><ChevronLeft className="w-4 h-4 mr-1" /> Previous</span>
              )}
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
              {page < totalPages ? (
                <Link href={buildPageUrl(page + 1)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              ) : (
                <span>Next <ChevronRight className="w-4 h-4 ml-1" /></span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
