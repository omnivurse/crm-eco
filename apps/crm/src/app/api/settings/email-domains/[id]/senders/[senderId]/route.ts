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
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// PATCH /api/settings/email-domains/[id]/senders/[senderId] - Update sender address
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; senderId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id, senderId } = await params;
    const body = await request.json();
    const { name, isDefault } = body;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify domain and sender belong to org
    const { data: sender } = await supabase
      .from('email_sender_addresses')
      .select('id, domain_id')
      .eq('id', senderId)
      .eq('domain_id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!sender) {
      return NextResponse.json({ error: 'Sender address not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await supabase
        .from('email_sender_addresses')
        .update({ is_default: false })
        .eq('org_id', profile.organization_id);
    }

    // Update sender
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (isDefault !== undefined) updateData.is_default = isDefault;

    const { data: updated, error } = await supabase
      .from('email_sender_addresses')
      .update(updateData)
      .eq('id', senderId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating sender address:', error);
    return NextResponse.json({ error: 'Failed to update sender address' }, { status: 500 });
  }
}

// DELETE /api/settings/email-domains/[id]/senders/[senderId] - Delete sender address
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; senderId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id, senderId } = await params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Delete sender (verifying it belongs to org)
    const { error } = await supabase
      .from('email_sender_addresses')
      .delete()
      .eq('id', senderId)
      .eq('domain_id', id)
      .eq('org_id', profile.organization_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sender address:', error);
    return NextResponse.json({ error: 'Failed to delete sender address' }, { status: 500 });
  }
}
