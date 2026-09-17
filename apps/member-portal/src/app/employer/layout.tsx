import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireEmployerSponsors } from '@/lib/employer';

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireEmployerSponsors();
  if (!ctx) redirect('/signin?redirect=/employer');
  if (ctx.sponsors.length === 0) redirect('/access-denied?reason=not_employer');

  return (
    <div className="min-h-screen bg-[var(--mp-canvas,#f8fafc)] text-[var(--mp-ink,#0f172a)]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Employer portal</p>
            <Link href="/employer" className="text-lg font-semibold">
              Sponsors
            </Link>
          </div>
          <Link href="/" className="text-sm text-slate-600 hover:underline">
            Member home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
