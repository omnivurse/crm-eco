import { NextResponse } from 'next/server';
import { redeemMemberPackage } from '@crm-eco/lib';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { ADMIN_TENANT_ROLES, requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, ADMIN_TENANT_ROLES);
  if (error || !profile) return error;

  await params;
  const body = (await request.json().catch(() => null)) as {
    memberPackageId?: string;
    units?: number;
    notes?: string;
  } | null;
  if (!body?.memberPackageId || !(Number(body.units) > 0)) {
    return NextResponse.json({ error: 'memberPackageId and units are required' }, { status: 400 });
  }

  try {
    const result = await redeemMemberPackage(createServiceRoleClient() as any, {
      organizationId: profile.organization_id,
      memberPackageId: body.memberPackageId,
      units: Number(body.units),
      notes: body.notes ?? null,
      redeemedBy: profile.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not redeem' },
      { status: 400 },
    );
  }
}
