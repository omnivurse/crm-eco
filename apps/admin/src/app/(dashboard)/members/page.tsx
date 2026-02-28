import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { Plus, Upload, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { MemberTable } from '@/components/members/MemberTable';
import { PageHeader } from '@/components/ui/PageHeader';

const PAGE_SIZE = 25;

async function getMembers(page: number) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { members: [], total: 0 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return { members: [], total: 0 };

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: members, count } = await (supabase
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
      advisor:advisors(id, first_name, last_name)
    `, { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .range(from, to) as any);

  return { members: members ?? [], total: count ?? 0 };
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function MembersPage({ searchParams }: PageProps) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || '1', 10));
  const { members, total } = await getMembers(page);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildPageUrl = (p: number) => `/members?page=${p}`;

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

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>{total.toLocaleString()} members found</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberTable members={members} />
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
