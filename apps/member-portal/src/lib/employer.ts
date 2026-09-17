import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export interface EmployerSponsor {
  id: string;
  name: string;
  organization_id: string;
  role: string;
}

export async function requireEmployerSponsors(): Promise<{
  userId: string;
  email: string | null;
  sponsors: EmployerSponsor[];
} | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = user.email?.toLowerCase() ?? null;
  const db = supabase as any;

  if (email) {
    await db
      .from('sponsor_admins')
      .update({
        user_id: user.id,
        accepted_at: new Date().toISOString(),
      })
      .is('user_id', null)
      .ilike('email', email);
  }

  const { data: byUser } = await db
    .from('sponsor_admins')
    .select('role, sponsor_id, sponsors ( id, name, organization_id, status )')
    .eq('user_id', user.id);

  const { data: byEmail } = email
    ? await db
        .from('sponsor_admins')
        .select('role, sponsor_id, sponsors ( id, name, organization_id, status )')
        .ilike('email', email)
    : { data: [] };

  const rows = [...(byUser ?? []), ...(byEmail ?? [])];
  const seen = new Set<string>();
  const sponsors: EmployerSponsor[] = [];
  for (const row of rows) {
    const sponsor = Array.isArray(row.sponsors) ? row.sponsors[0] : row.sponsors;
    if (!sponsor || sponsor.status === 'inactive' || seen.has(sponsor.id)) continue;
    seen.add(sponsor.id);
    sponsors.push({
      id: sponsor.id,
      name: sponsor.name,
      organization_id: sponsor.organization_id,
      role: row.role,
    });
  }

  return { userId: user.id, email, sponsors };
}
