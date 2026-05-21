import { NextResponse } from 'next/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireActiveMembership();
  return NextResponse.json({
    profile: {
      id: ctx.profile.id,
      email: ctx.profile.email,
      organization_id: ctx.profile.organization_id,
    },
    member: {
      id: ctx.member.id,
      member_number: ctx.member.member_number,
      first_name: ctx.member.first_name,
      last_name: ctx.member.last_name,
      email: ctx.member.email,
      phone: ctx.member.phone,
      date_of_birth: ctx.member.date_of_birth,
      address_line1: ctx.member.address_line1,
      address_line2: ctx.member.address_line2,
      city: ctx.member.city,
      state: ctx.member.state,
      postal_code: ctx.member.postal_code,
      status: ctx.member.status,
    },
    membership: {
      id: ctx.activeMembershipId,
      status: ctx.activeMembershipStatus,
    },
  });
}
