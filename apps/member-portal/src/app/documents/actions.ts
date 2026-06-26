'use server';

import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export interface IdCardData {
  memberName: string;
  memberNumber: string;
  planName: string;
  effectiveDate: string | null;
  groupNumber: string;
  orgName: string;
}

export interface MemberDoc {
  id: string;
  title: string;
  type: string;
  url: string | null;
  created_at: string;
  status: string;
}

const STANDARD_DOCS: MemberDoc[] = [
  { id: 'guidelines', title: 'Membership Guidelines', type: 'guidelines', url: '/docs/membership-guidelines.pdf', created_at: '', status: 'available' },
  { id: 'sharing-guide', title: 'How Sharing Works Guide', type: 'guide', url: '/docs/sharing-guide.pdf', created_at: '', status: 'available' },
  { id: 'terms', title: 'Terms & Conditions', type: 'legal', url: '/docs/terms-conditions.pdf', created_at: '', status: 'available' },
  { id: 'privacy', title: 'Privacy Policy', type: 'legal', url: '/docs/privacy-policy.pdf', created_at: '', status: 'available' },
];

/**
 * Build the member's documents view + ID-card data.
 *
 * Server-side via the gate + service role (members/memberships/organizations have
 * no member-self RLS), so the card renders reliably for a real member rather than
 * silently coming back empty from a client RLS read. The org name comes from
 * branding.company_name → organizations.name (NEVER a hardcoded string), and the
 * group number from the membership/member number rather than a literal 'WS-001'.
 */
export async function getMemberDocumentsData(): Promise<{
  idCard: IdCardData | null;
  documents: MemberDoc[];
}> {
  const ctx = await requireActiveMembership();
  const service = createServiceRoleClient();
  const orgId = ctx.member.organization_id;
  const member = ctx.member as Record<string, unknown>;

  // Latest membership (table may be empty pre-activation; card still renders from
  // member fields). Plan name prefers the linked plan, then the denormalized
  // members.plan_name.
  const { data: membership } = await (service as any)
    .from('memberships')
    .select('id, effective_date, membership_number, plans:plan_id (name)')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', orgId)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Org name from branding → org name (tenant-true; no hardcoded brand).
  const { data: org } = await (service as any)
    .from('organizations')
    .select('name, branding')
    .eq('id', orgId)
    .maybeSingle();
  const branding = (org?.branding ?? {}) as Record<string, unknown>;
  const orgName =
    (branding.company_name as string) || (branding.name as string) || (org?.name as string) || 'Member Portal';

  // Real enrollment contracts for this member.
  const { data: contracts } = await (service as any)
    .from('enrollment_contracts')
    .select('*')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  const documents: MemberDoc[] = [];
  (contracts ?? []).forEach((c: any) => {
    documents.push({
      id: c.id,
      title: c.contract_type || 'Enrollment Agreement',
      type: 'contract',
      url: c.url ?? null,
      created_at: c.created_at,
      status: c.status,
    });
  });
  documents.push(...STANDARD_DOCS);

  const memberName =
    `${(member.first_name as string) ?? ''} ${(member.last_name as string) ?? ''}`.trim() || 'Member';
  const groupNumber =
    (membership?.membership_number as string) ||
    (member.member_number as string) ||
    `M-${ctx.member.id.slice(0, 8).toUpperCase()}`;
  const planName =
    (membership?.plans?.name as string) || (member.plan_name as string) || 'Membership';
  const effectiveDate =
    (membership?.effective_date as string) || (member.effective_date as string) || null;

  const idCard: IdCardData = {
    memberName,
    memberNumber: (member.member_number as string) || ctx.member.id,
    planName,
    effectiveDate,
    groupNumber,
    orgName,
  };

  return { idCard, documents };
}
