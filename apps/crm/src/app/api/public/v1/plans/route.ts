import { NextResponse } from 'next/server';
import { requireCrmApiKey } from '@/lib/public-api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireCrmApiKey(request, 'read');
  if ('error' in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from('plans')
    .select('id, name, code, monthly_share, is_active, metadata')
    .eq('organization_id', auth.key.organization_id)
    .eq('is_active', true)
    .order('name')
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}
