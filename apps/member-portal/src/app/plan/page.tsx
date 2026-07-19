import Link from 'next/link';
import { FileText, Users, Pencil, XCircle } from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import {
  getPlanOverview,
  getFamilyCoverageSummary,
  listAgreementSignatures,
  listChangeRequests,
} from '@/lib/data/member';
import { PlanCoverageCard } from '@/components/plan/PlanCoverageCard';
import { formatCoverageDateRange, formatCoverageReason } from '@crm-eco/lib';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function PlanOverviewPage() {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();

  const [planOverview, familyCoverage, signatures, changeRequests, planDocs] = await Promise.all([
    getPlanOverview(),
    getFamilyCoverageSummary(),
    listAgreementSignatures(),
    listChangeRequests(),
    supabase
      .from('legal_documents')
      .select('id, document_name, document_type, version, status')
      .eq('organization_id', ctx.member.organization_id)
      .eq('status', 'active'),
  ]);

  const pendingRequests = changeRequests.filter((r) => r.status === 'pending_review');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="My Plan"
        description="Plan details, dependents, documents, and changes."
        backHref="/"
        backLabel="Back"
      />

      {planOverview ? (
        <PlanCoverageCard overview={planOverview} />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">No active membership found.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/dependents"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Users weight="light" className="mb-3 h-6 w-6 text-[var(--mp-teal)]" />
          <p className="font-semibold text-slate-900">Dependents</p>
          <p className="mt-1 text-xs text-slate-500">
            {familyCoverage.coveredCount} of {familyCoverage.totalDependents} currently on plan
          </p>
        </Link>
        <Link
          href="/plan/change"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Pencil weight="light" className="mb-3 h-6 w-6 text-amber-600" />
          <p className="font-semibold text-slate-900">Request a change</p>
          <p className="mt-1 text-xs text-slate-500">Plan, IUA, or effective date</p>
        </Link>
        <Link
          href="/plan/cancel"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <XCircle weight="light" className="mb-3 h-6 w-6 text-red-600" />
          <p className="font-semibold text-slate-900">Cancel membership</p>
          <p className="mt-1 text-xs text-slate-500">Submit a cancellation request</p>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users weight="light" className="h-4 w-4 text-[var(--mp-teal)]" />
            Family coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-900">{familyCoverage.coveredCount}</span>{' '}
            family member{familyCoverage.coveredCount === 1 ? '' : 's'} currently covered on your
            membership.
          </p>
          {familyCoverage.recentChanges.length > 0 ? (
            <ul className="space-y-2">
              {familyCoverage.recentChanges.map((change) => (
                <li key={change.id} className="rounded-lg border p-3">
                  <p className="font-medium text-slate-900">{change.dependent_name}</p>
                  <p className="text-xs text-slate-500">
                    {formatCoverageDateRange(change.effective_from, change.effective_to)}
                    {change.reason ? ` · ${formatCoverageReason(change.reason)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">
              No coverage changes logged yet.{' '}
              <Link href="/dependents" className="text-[var(--mp-teal)] hover:underline">
                Manage dependents
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText weight="light" className="h-4 w-4 text-[var(--mp-teal)]" />
            Plan documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(planDocs.data ?? []).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{doc.document_name}</p>
                <p className="text-xs text-slate-500 capitalize">
                  {doc.document_type.replace(/_/g, ' ')} · v{doc.version}
                </p>
              </div>
            </div>
          ))}
          {signatures.length > 0 && (
            <div className="pt-2 text-xs text-slate-500">
              You have {signatures.length} signed agreement
              {signatures.length === 1 ? '' : 's'} on file.
            </div>
          )}
        </CardContent>
      </Card>

      {pendingRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-amber-900">Pending change requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pendingRequests.map((r) => (
              <div key={r.id} className="rounded border border-amber-200 bg-white p-3">
                <p className="font-medium capitalize text-slate-900">
                  {r.request_type.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-slate-500">
                  Submitted {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
