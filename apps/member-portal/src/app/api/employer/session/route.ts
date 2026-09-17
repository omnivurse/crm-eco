import { NextResponse } from 'next/server';
import { requireEmployerSponsors } from '@/lib/employer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireEmployerSponsors();
  if (!ctx) return NextResponse.json({ sponsors: [] });
  return NextResponse.json({
    sponsors: ctx.sponsors.map((s) => ({ id: s.id, name: s.name, role: s.role })),
  });
}
