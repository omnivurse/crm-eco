'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@crm-eco/lib/supabase/client';
import { SignaturePad } from '@/components/SignaturePad';

interface LegalDocument {
  id: string;
  content_html: string;
  document_name: string;
}

export default function AgreementPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [legalDoc, setLegalDoc] = useState<LegalDocument | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocument() {
      const { data } = await supabase
        .from('legal_documents')
        .select('id, content_html, document_name')
        .eq('document_type', 'enrollment_agreement')
        .eq('status', 'active')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setLegalDoc(data as LegalDocument);
      }
      setLoading(false);
    }
    loadDocument();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signature || !signerName || !agreed || !legalDoc) return;

    setSubmitting(true);
    setError(null);

    try {
      const draftRes = await fetch(`/api/enroll/draft?slug=${encodeURIComponent(slug)}`);
      const draftBody = await draftRes.json();
      const enrollmentId = draftBody?.draft?.data?.enrollment_id as string | undefined;

      if (!enrollmentId) {
        setError('No active enrollment found. Please start the enrollment process again.');
        return;
      }

      const { error: insertErr } = await supabase.from('agreement_signatures').insert({
        organization_id: draftBody.draft.organizationId,
        enrollment_id: enrollmentId,
        legal_document_id: legalDoc.id,
        agreement_type: 'enrollment_agreement',
        signature_png: signature,
        signer_name: signerName,
        signed_at: new Date().toISOString(),
      });

      if (insertErr) throw insertErr;

      await supabase.functions.invoke('generate-enrollment-contract', {
        body: { enrollment_id: enrollmentId },
      });

      router.push(`/enroll/${slug}/payment`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save signature');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading agreement...</div>
      </div>
    );
  }

  if (!legalDoc) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          No active enrollment agreement found. Please contact support.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Enrollment Agreement</h1>

      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">{legalDoc.document_name}</h2>
        <div
          className="prose prose-sm max-h-96 overflow-y-auto rounded border bg-gray-50 p-4"
          dangerouslySetInnerHTML={{ __html: legalDoc.content_html }}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Full Legal Name
          </label>
          <input
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            required
            className="w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Enter your full legal name"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Your Signature
          </label>
          <SignaturePad onSignatureChange={setSignature} />
        </div>

        <label className="flex items-start gap-3 rounded-lg border p-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">
            I have read and agree to the terms of the enrollment agreement. I understand that
            my signature above constitutes a legal signature confirming my acceptance of these terms.
          </span>
        </label>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!signature || !signerName || !agreed || submitting}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Processing...' : 'Sign & Continue'}
        </button>
      </form>
    </div>
  );
}
