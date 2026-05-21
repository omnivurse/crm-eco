import Link from 'next/link';
import { ChevronLeft, FileText, Users, Edit3, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { getActiveMembership, listAgreementSignatures, listChangeRequests } from '@/lib/data/member';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export const dynamic = 'force-dynamic';

export default async function PlanOverviewPage() {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();

  const [membership, signatures, changeRequests, planDocs] = await Promise.all([
    getActiveMembership(),
    listAgreementSignatures(),
    listChangeRequests(),
    supabase
      .from('legal_documents')
      .select('id, document_name, document_type, version, status')
      .eq('organization_id', ctx.member.organization_id)
      .eq('status', 'active'),
  ]);

  const pendingRequests = changeRequests.filter((r) => r.status === 'pending_review');
  const planRow = membership?.plans;
  const planName = Array.isArray(planRow) ? planRow[0]?.name : planRow?.name;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:underline">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Plan</h1>
        <p className="mt-1 text-sm text-slate-600">Plan details, dependents, documents, and changes.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current plan</CardTitle>
        </CardHeader>
        <CardContent>
          {membership ? (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">Plan</dt>
                <dd className="font-semibold text-slate-900">{planName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="font-semibold text-slate-900 capitalize">{membership.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Effective</dt>
                <dd className="font-semibold text-slate-900">
                  {membership.effective_date
                    ? new Date(membership.effective_date).toLocaleDateString()
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Monthly cost</dt>
                <dd className="font-semibold text-slate-900">
                  ${Number(membership.billing_amount ?? 0).toFixed(2)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">No active membership found.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/dependents"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow"
        >
          <Users className="mb-3 h-6 w-6 text-blue-600" />
          <p className="font-semibold text-slate-900">Dependents</p>
          <p className="mt-1 text-xs text-slate-500">Manage who&apos;s on your plan</p>
        </Link>
        <Link
          href="/plan/change"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow"
        >
          <Edit3 className="mb-3 h-6 w-6 text-amber-600" />
          <p className="font-semibold text-slate-900">Request a change</p>
          <p className="mt-1 text-xs text-slate-500">Plan, IUA, or effective date</p>
        </Link>
        <Link
          href="/plan/cancel"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow"
        >
          <XCircle className="mb-3 h-6 w-6 text-red-600" />
          <p className="font-semibold text-slate-900">Cancel membership</p>
          <p className="mt-1 text-xs text-slate-500">Submit a cancellation request</p>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-blue-600" />
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
