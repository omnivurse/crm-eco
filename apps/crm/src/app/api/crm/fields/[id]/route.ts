import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { }
        },
      },
    }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if field is system field
    const { data: field } = await supabase
      .from('crm_fields')
      .select('is_system')
      .eq('id', id)
      .single();

    if (field?.is_system) {
      return NextResponse.json({ error: 'Cannot delete system field' }, { status: 400 });
    }

    const { error } = await supabase
      .from('crm_fields')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, crm_role, organization_id')
      .eq('user_id', user.id)
      .single();

    // Allow managers and admins to pin/unpin fields
    if (!profile || !['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow updating is_pinned through this endpoint
    const { is_pinned } = body;

    if (typeof is_pinned !== 'boolean') {
      return NextResponse.json({ error: 'is_pinned must be a boolean' }, { status: 400 });
    }

    const { data: field, error } = await supabase
      .from('crm_fields')
      .update({ is_pinned })
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, field });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
