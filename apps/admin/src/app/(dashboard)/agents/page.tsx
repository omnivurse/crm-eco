import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { Plus, GitBranch, RefreshCw, Users, UserCog, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { AgentTable } from '@/components/agents/AgentTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { getActiveTenant } from '@/lib/tenant';

const PAGE_SIZE = 25;

async function getAgents(page: number) {
  const supabase = await createServerSupabaseClient();

  const tenant = await getActiveTenant();
  if (!tenant) return { agents: [], total: 0 };
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: agents, count } = await (supabase
    .from('advisors')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      status,
      license_number,
      license_states,
      commission_tier,
      created_at,
      parent_advisor:advisors!advisors_parent_advisor_id_fkey(id, first_name, last_name)
    `, { count: 'exact' })
    .eq('organization_id', tenant.organizationId)
    .order('created_at', { ascending: false })
    .range(from, to) as any);

  return { agents: agents ?? [], total: count ?? 0 };
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AgentsPage({ searchParams }: PageProps) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || '1', 10));
  const { agents, total } = await getAgents(page);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildPageUrl = (p: number) => `/agents?page=${p}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Agents"
        description="Manage agent accounts and commissions"
        icon={<UserCog className="w-6 h-6" />}
        gradient="from-[#059669] to-[#34d399]"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/agents/bill-groups">
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Bill Groups</span>
              </Button>
            </Link>
            <Link href="/agents/assignment">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Assignment</span>
              </Button>
            </Link>
            <Link href="/agents/tree">
              <Button variant="outline" size="sm">
                <GitBranch className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tree View</span>
              </Button>
            </Link>
            <Link href="/agents/new">
              <Button size="sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Agent</span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Agents</CardTitle>
          <CardDescription>{total.toLocaleString()} agents found</CardDescription>
        </CardHeader>
        <CardContent>
          <AgentTable agents={agents} />
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
