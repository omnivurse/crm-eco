import { NextResponse } from 'next/server';
import { requireCrmApiKey } from '@/lib/public-api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCrmApiKey(request, 'read');
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const { data: sponsor } = await auth.supabase
    .from('sponsors')
    .select('id, name')
    .eq('id', id)
    .eq('organization_id', auth.key.organization_id)
    .maybeSingle();
  if (!sponsor) return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });

  const { data, error } = await auth.supabase
    .from('sponsor_roster')
    .select('id, first_name, last_name, date_of_birth, email, relationship, status, eligible_start, eligible_end')
    .eq('sponsor_id', id)
    .order('last_name')
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sponsor, roster: data ?? [] });
}
