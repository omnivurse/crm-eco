import { NextRequest, NextResponse } from 'next/server';
import { inboundReplyTo } from '@crm-eco/lib/email';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

// PATCH /api/settings/email-domains/[id]/senders/[senderId] - Update sender address
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; senderId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { id, senderId } = await params;
    const body = await request.json();
    const { name, isDefault, reply_to: replyTo } = body;

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
    if (typeof replyTo === 'string' && replyTo.trim()) {
      updateData.reply_to = inboundReplyTo(replyTo);
    }

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
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { id, senderId } = await params;

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
