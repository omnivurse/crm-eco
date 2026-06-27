'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui';
import {
  ArrowLeft,
  CreditCard,
  FileText,
  KeyRound,
  Shield,
  Users,
  Package,
  Activity,
  ClipboardList,
} from 'lucide-react';
import { MemberForm } from '@/components/members/MemberForm';
import { MemberBillingTab } from '@/components/billing/MemberBillingTab';
import { MergeMembersSection } from '@/components/members/command-center/MergeMembersSection';
import { MemberPortalAccess } from '@/app/(dashboard)/members/[id]/MemberPortalAccess';
import { AdminDependentCoveragePanel } from '@/components/members/command-center/AdminDependentCoveragePanel';
import {
  MEMBER_COMMAND_TABS,
  type MemberCommandCenterData,
  type MemberCommandTab,
} from '@/lib/member-command/queries';
import type { PortalAccessStatus } from '@/app/(dashboard)/members/actions';

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function planFromMembership(membership: Record<string, unknown> | null) {
  if (!membership) return null;
  const plans = membership.plans as Record<string, unknown> | null;
  return {
    name: (plans?.name as string) ?? '—',
    code: (plans?.code as string) ?? '',
    type: (plans?.plan_type as string) ?? '',
    amount: (membership.billing_amount as number) ?? (plans?.monthly_share as number),
    effectiveDate: membership.effective_date as string | null,
  };
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (['active', 'approved'].includes(status)) return 'default';
  if (['pending', 'in_progress', 'pending_review', 'submitted'].includes(status)) return 'secondary';
  if (['inactive', 'terminated', 'rejected', 'cancelled'].includes(status)) return 'destructive';
  return 'outline';
}

interface MemberCommandCenterProps {
  data: MemberCommandCenterData;
  portal: PortalAccessStatus;
  organizationId: string;
  profileId: string;
  initialTab?: MemberCommandTab;
}

export function MemberCommandCenter({
  data,
  portal,
  organizationId,
  profileId,
  initialTab = 'overview',
}: MemberCommandCenterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as MemberCommandTab) || initialTab;

  const setTab = useCallback(
    (tab: MemberCommandTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      router.replace(`/members/${data.member.id}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, data.member.id],
  );

  const plan = useMemo(() => planFromMembership(data.activeMembership), [data.activeMembership]);
  const member = data.member;

  const profileInitial = {
    id: member.id,
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    phone: (member.phone as string | null) ?? null,
    date_of_birth: (member.date_of_birth as string | null) ?? null,
    gender: (member.gender as string | null) ?? null,
    address_line1: (member.address_line1 as string | null) ?? null,
    address_line2: (member.address_line2 as string | null) ?? null,
    city: (member.city as string | null) ?? null,
    state: (member.state as string | null) ?? null,
    postal_code: (member.postal_code as string | null) ?? null,
    advisor_id: (member.advisor_id as string | null) ?? null,
    market_type: (member.market_type as string | null) ?? null,
    status: member.status,
    existing_condition: Boolean(member.existing_condition),
    existing_condition_description: (member.existing_condition_description as string | null) ?? null,
    is_smoker: Boolean(member.is_smoker),
    receive_emails: member.receive_emails !== false,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/members">
            <Button variant="ghost" size="icon" type="button">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {member.first_name} {member.last_name}
            </h1>
            <p className="text-slate-500">
              {member.email}
              {member.member_number ? ` · #${member.member_number}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusBadgeVariant(member.status)}>
            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
          </Badge>
          {plan && (
            <Badge variant="outline">
              {plan.name}
              {plan.amount != null ? ` · ${formatCurrency(plan.amount)}/mo` : ''}
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setTab(v as MemberCommandTab)}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {MEMBER_COMMAND_TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active plan</CardDescription>
                <CardTitle className="text-lg">{plan?.name ?? 'No active membership'}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                {plan?.effectiveDate
                  ? `Effective ${format(new Date(plan.effectiveDate), 'MMM d, yyyy')}`
                  : '—'}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Next billing</CardDescription>
                <CardTitle className="text-lg">
                  {data.billingSchedule?.next_billing_date
                    ? format(new Date(data.billingSchedule.next_billing_date as string), 'MMM d, yyyy')
                    : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                {data.billingSchedule?.amount != null
                  ? formatCurrency(data.billingSchedule.amount as number)
                  : 'No active schedule'}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Household</CardDescription>
                <CardTitle className="text-lg">
                  {data.coveredCount} covered · {data.dependents.length} total
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                From <code className="text-xs">dependents</code> + coverage periods
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Enrollments</CardDescription>
                <CardTitle className="text-lg">{data.enrollments.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                Portal: {portal.hasLogin ? 'Linked' : 'Not invited'}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Advisor</CardTitle>
              </CardHeader>
              <CardContent>
                {member.advisor ? (
                  <div>
                    <p className="font-medium">
                      {member.advisor.first_name} {member.advisor.last_name}
                    </p>
                    <p className="text-sm text-slate-500">{member.advisor.email}</p>
                    <Link href={`/agents/${member.advisor.id}`} className="text-sm text-blue-600 hover:underline">
                      View agent →
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Unassigned</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent coverage changes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.recentCoverageChanges.length === 0 ? (
                  <p className="text-slate-500">No recent coverage activity</p>
                ) : (
                  data.recentCoverageChanges.map((change) => (
                    <p key={change.id} className="text-slate-600">
                      {change.dependent_name}: {change.effective_from}
                      {change.effective_to ? ` → ${change.effective_to}` : ' (open)'}
                    </p>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Member profile</CardTitle>
              <CardDescription>
                Writes to <code className="text-xs">members</code> via existing MemberForm + autosave
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MemberForm agents={data.agents} initialData={profileInitial} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="household" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Household summary
              </CardTitle>
              <CardDescription>
                Authoritative: <code className="text-xs">dependents</code> table (not enrollment snapshot)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.dependents.length === 0 ? (
                <p className="text-sm text-slate-500">No dependents on file. Add them in the Dependents tab.</p>
              ) : (
                data.dependents.map((dep) => (
                  <div key={dep.id as string} className="flex justify-between border-b py-2 last:border-0">
                    <div>
                      <p className="font-medium">
                        {dep.first_name as string} {dep.last_name as string}
                      </p>
                      <p className="text-sm text-slate-500">{dep.relationship as string}</p>
                    </div>
                    <Badge variant="outline">{(dep.relationship as string) ?? 'Dependent'}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependents" className="mt-6">
          <AdminDependentCoveragePanel memberId={member.id} />
        </TabsContent>

        <TabsContent value="enrollments" className="mt-6 space-y-4">
          {data.enrollments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                No enrollments. Create via public enroll or CRM wizard; approve in Enrollments queue.
              </CardContent>
            </Card>
          ) : (
            data.enrollments.map((enrollment) => {
              const p = enrollment.plan as Record<string, unknown> | null;
              return (
                <Card key={enrollment.id as string}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {(enrollment.enrollment_number as string) || (enrollment.id as string).slice(0, 8)}
                      </CardTitle>
                      <CardDescription>{(p?.name as string) || 'No plan'}</CardDescription>
                    </div>
                    <Badge variant={statusBadgeVariant(enrollment.status as string)}>
                      {enrollment.status as string}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex justify-between items-center">
                    <p className="text-sm text-slate-600">
                      {formatCurrency((enrollment.total_monthly_cost as number) ?? (enrollment.base_monthly_cost as number))}
                      /mo
                    </p>
                    <Link href={`/enrollments/${enrollment.id as string}`}>
                      <Button variant="outline" size="sm">
                        Open enrollment
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="coverage" className="mt-6">
          <AdminDependentCoveragePanel memberId={member.id} readOnly />
        </TabsContent>

        <TabsContent value="products" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Memberships &amp; plans
              </CardTitle>
              <CardDescription>
                Authoritative: <code className="text-xs">memberships</code> → <code className="text-xs">plans</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.memberships.length === 0 ? (
                <p className="text-sm text-slate-500">No membership rows</p>
              ) : (
                data.memberships.map((m) => {
                  const p = m.plans as Record<string, unknown> | null;
                  return (
                    <div key={m.id as string} className="flex justify-between border rounded-lg p-3">
                      <div>
                        <p className="font-medium">{(p?.name as string) ?? 'Plan'}</p>
                        <p className="text-sm text-slate-500">
                          {m.effective_date
                            ? format(new Date(m.effective_date as string), 'MMM d, yyyy')
                            : '—'}
                          {m.end_date ? ` → ${format(new Date(m.end_date as string), 'MMM d, yyyy')}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={statusBadgeVariant(m.status as string)}>{m.status as string}</Badge>
                        <p className="text-sm mt-1">{formatCurrency(m.billing_amount as number)}/mo</p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <MemberBillingTab memberId={member.id} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoices
              </CardTitle>
              <CardDescription>Table: <code className="text-xs">invoices</code></CardDescription>
            </CardHeader>
            <CardContent>
              {data.invoices.length === 0 ? (
                <p className="text-sm text-slate-500">No invoices for this member</p>
              ) : (
                <div className="space-y-2">
                  {data.invoices.map((inv) => (
                    <div key={inv.id as string} className="flex justify-between border-b py-2 text-sm">
                      <span>{inv.invoice_number as string}</span>
                      <span>{formatCurrency(inv.total as number)} · {inv.status as string}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment-profiles" className="mt-6">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment profiles
              </CardTitle>
              <CardDescription>
                Reuses MemberBillingTab client read on <code className="text-xs">payment_profiles</code>.
                Staff API: <code className="text-xs">/api/billing/payment-profiles</code> (BillingService).
              </CardDescription>
            </CardHeader>
          </Card>
          <MemberBillingTab memberId={member.id} />
        </TabsContent>

        <TabsContent value="portal" className="mt-6 max-w-lg">
          <MemberPortalAccess
            memberId={member.id}
            hasLogin={portal.hasLogin}
            email={portal.email}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Documents &amp; contracts</CardTitle>
              <CardDescription>Table: <code className="text-xs">enrollment_contracts</code></CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.contracts.length === 0 ? (
                <p className="text-sm text-slate-500">No contracts on file</p>
              ) : (
                data.contracts.map((doc) => {
                  const docUrl =
                    (doc.file_url as string | null) ||
                    (doc.pdf_url as string | null) ||
                    null;
                  return (
                  <div key={doc.id as string} className="flex justify-between border-b py-2 text-sm">
                    <span>{(doc.contract_type as string) || 'Contract'}</span>
                    {docUrl ? (
                      <a href={docUrl} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : (
                      <span className="text-slate-400">{doc.status as string}</span>
                    )}
                  </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Admin activity
              </CardTitle>
              <CardDescription>Table: <code className="text-xs">admin_activity_log</code></CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.adminActivity.length === 0 ? (
                <p className="text-slate-500">No logged admin actions for this member</p>
              ) : (
                data.adminActivity.map((row) => (
                  <div key={row.id as string} className="border-b py-2">
                    <p className="font-medium">{row.action as string}</p>
                    <p className="text-slate-500 text-xs">
                      {row.created_at ? format(new Date(row.created_at as string), 'MMM d, yyyy h:mm a') : ''}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Enrollment audit log
              </CardTitle>
              <CardDescription>
                Table: <code className="text-xs">enrollment_audit_log</code> · Decisions via{' '}
                <code className="text-xs">enrollments/actions.ts</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.enrollmentAudit.length === 0 ? (
                <p className="text-slate-500">No enrollment audit entries</p>
              ) : (
                data.enrollmentAudit.map((row) => (
                  <div key={row.id as string} className="border-b py-2">
                    <p className="font-medium">{row.message as string}</p>
                    <p className="text-slate-500 text-xs">
                      {(row.event_type as string) || ''}
                      {row.old_status && row.new_status
                        ? ` · ${row.old_status as string} → ${row.new_status as string}`
                        : ''}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication" className="mt-6">
          <Card>
            <CardContent className="py-8 text-center text-slate-500 text-sm">
              Communication history is not centralized yet. Member prefs live on{' '}
              <code className="text-xs">members.receive_emails</code> /{' '}
              <code className="text-xs">communication_preferences</code> (Settings tab).
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardContent className="py-8 text-center text-slate-500 text-sm">
              No member-scoped tasks module in admin. Pending member requests appear under Settings (
              <code className="text-xs">member_change_requests</code>).
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardContent className="py-8 text-center text-slate-500 text-sm">
              Internal notes are not wired for MMS members yet. Use enrollment review notes or CRM record notes for linked contacts.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Member change requests
              </CardTitle>
              <CardDescription>Table: <code className="text-xs">member_change_requests</code></CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.changeRequests.length === 0 ? (
                <p className="text-slate-500">No change requests</p>
              ) : (
                data.changeRequests.map((req) => (
                  <div key={req.id as string} className="flex justify-between border-b py-2">
                    <span>{req.request_type as string}</span>
                    <Badge variant={statusBadgeVariant(req.status as string)}>{req.status as string}</Badge>
                  </div>
                ))
              )}
              <Link href="/changes/review" className="text-sm text-blue-600 hover:underline inline-block mt-2">
                Open change review queue →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Merge members
              </CardTitle>
              <CardDescription>Reuses existing MergeMembersModal + soft-merge on members</CardDescription>
            </CardHeader>
            <CardContent>
              <MergeMembersSection
                organizationId={organizationId}
                profileId={profileId}
                member={{
                  id: member.id,
                  first_name: member.first_name,
                  last_name: member.last_name,
                  email: member.email,
                  phone: (member.phone as string | null) ?? null,
                  status: member.status,
                  created_at: (member.created_at as string) ?? new Date().toISOString(),
                  effective_date: (member.effective_date as string | null) ?? null,
                  plan_name: (member.plan_name as string | null) ?? null,
                  member_number: (member.member_number as string | null) ?? null,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
