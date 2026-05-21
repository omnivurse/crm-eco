import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { ArrowLeft, Download, FileSignature, RefreshCw, Calendar } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';
import { getActiveTenant } from '@/lib/tenant';

interface AgreementRow {
  id: string;
  agreement_type: string;
  signer_name: string;
  signer_ip: string | null;
  signed_at: string;
  pdf_storage_path: string | null;
  pdf_generated_at: string | null;
  legal_document_id: string | null;
  metadata: Record<string, unknown> | null;
  legal_document?: { document_name: string; version: number } | null;
}

async function getEnrollment(id: string) {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return null;

  const { data } = await supabase
    .from('enrollments')
    .select(`
      id,
      enrollment_number,
      status,
      effective_date,
      organization_id,
      primary_member:members!enrollments_primary_member_id_fkey(first_name, last_name, email)
    `)
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single();

  return data;
}

async function getAgreements(enrollmentId: string): Promise<AgreementRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('agreement_signatures')
    .select(`
      id,
      agreement_type,
      signer_name,
      signer_ip,
      signed_at,
      pdf_storage_path,
      pdf_generated_at,
      legal_document_id,
      metadata,
      legal_document:legal_documents(document_name, version)
    `)
    .eq('enrollment_id', enrollmentId)
    .order('signed_at', { ascending: false });

  return (data || []) as unknown as AgreementRow[];
}

async function getEnrollmentContract(enrollmentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('enrollment_contracts')
    .select('id, pdf_url, generated_at, contract_version, contract_type')
    .eq('enrollment_id', enrollmentId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export default async function AgreementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enrollment = await getEnrollment(id);
  if (!enrollment) notFound();

  const [agreements, contract] = await Promise.all([
    getAgreements(id),
    getEnrollmentContract(id),
  ]);

  // Type assertion since Supabase nested select doesn't always type cleanly
  const member = enrollment.primary_member as unknown as { first_name?: string; last_name?: string; email?: string } | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/enrollments/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Enrollment
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agreements & Contracts</h1>
            <p className="text-sm text-muted-foreground">
              {enrollment.enrollment_number ?? id} · {member?.first_name} {member?.last_name}
            </p>
          </div>
        </div>
        <form action={`/api/enrollments/${id}/regenerate-contract`} method="POST">
          <Button type="submit" variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate Contract
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Generated Contract
          </CardTitle>
          <CardDescription>Latest enrollment contract PDF</CardDescription>
        </CardHeader>
        <CardContent>
          {contract ? (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <FileSignature className="h-8 w-8 text-blue-500" />
                <div>
                  <div className="font-medium">{contract.contract_type ?? 'Enrollment Contract'} v{contract.contract_version ?? 1}</div>
                  <div className="text-xs text-muted-foreground">
                    Generated {contract.generated_at ? format(new Date(contract.generated_at), 'MMM d, yyyy h:mm a') : 'unknown'}
                  </div>
                </div>
              </div>
              {contract.pdf_url && (
                <a href={contract.pdf_url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No contract generated yet. Click &quot;Regenerate Contract&quot; to create one.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Signature Audit Trail
          </CardTitle>
          <CardDescription>{agreements.length} signature{agreements.length !== 1 ? 's' : ''} on file</CardDescription>
        </CardHeader>
        <CardContent>
          {agreements.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No agreements signed yet
            </div>
          ) : (
            <div className="space-y-3">
              {agreements.map((agreement) => (
                <div key={agreement.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <FileSignature className="mt-1 h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">
                        {agreement.legal_document?.document_name ?? agreement.agreement_type}
                        {agreement.legal_document?.version && (
                          <Badge variant="secondary" className="ml-2">v{agreement.legal_document.version}</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Signed by <span className="font-medium">{agreement.signer_name}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(agreement.signed_at), 'MMM d, yyyy h:mm a')}
                        </span>
                        {agreement.signer_ip && <span>IP: {agreement.signer_ip}</span>}
                      </div>
                    </div>
                  </div>
                  {agreement.pdf_storage_path && (
                    <a
                      href={`/api/agreements/${agreement.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
