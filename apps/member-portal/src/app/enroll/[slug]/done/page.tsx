import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default async function EnrollDonePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { id } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[var(--mp-canvas)] p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(11,109,133,0.1)]">
          <CheckCircle weight="light" className="h-10 w-10 text-[var(--mp-teal)]" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-[-0.03em] text-[var(--mp-ink)]">Enrollment Submitted!</h1>
        <p className="mt-3 text-slate-600">
          Thank you for enrolling. Your application has been submitted successfully and is now being reviewed.
        </p>
        {id && (
          <p className="mt-2 text-xs text-slate-400">
            Reference: <span className="font-mono">{id.slice(0, 8)}</span>
          </p>
        )}
        <p className="mt-4 text-sm text-slate-600">
          You will receive an email confirmation shortly. Our team will reach out within 24-48 hours
          to finalize your enrollment.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href={`/enroll/${slug}`}
            className="rounded-full border border-[rgba(11,109,133,0.15)] px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-[rgba(11,109,133,0.04)]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
