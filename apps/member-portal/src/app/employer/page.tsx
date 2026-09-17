import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireEmployerSponsors } from '@/lib/employer';

export const dynamic = 'force-dynamic';

export default async function EmployerHomePage() {
  const ctx = await requireEmployerSponsors();
  if (!ctx) redirect('/signin?redirect=/employer');
  if (ctx.sponsors.length === 1) redirect(`/employer/${ctx.sponsors[0].id}`);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Your employers</h1>
      <ul className="divide-y rounded-lg border bg-white">
        {ctx.sponsors.map((sponsor) => (
          <li key={sponsor.id}>
            <Link href={`/employer/${sponsor.id}`} className="block px-4 py-3 hover:bg-slate-50">
              <p className="font-medium">{sponsor.name}</p>
              <p className="text-sm text-slate-500">{sponsor.role}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
