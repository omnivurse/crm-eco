import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default async function EnrollDonePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { id } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-6 text-3xl font-bold text-gray-900">Enrollment Submitted!</h1>
        <p className="mt-3 text-gray-600">
          Thank you for enrolling. Your application has been submitted successfully and is now being reviewed.
        </p>
        {id && (
          <p className="mt-2 text-xs text-gray-400">
            Reference: <span className="font-mono">{id.slice(0, 8)}</span>
          </p>
        )}
        <p className="mt-4 text-sm text-gray-600">
          You will receive an email confirmation shortly. Our team will reach out within 24-48 hours
          to finalize your enrollment.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href={`/enroll/${slug}`}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
