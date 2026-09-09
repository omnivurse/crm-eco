import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { getConversation, getMessages, updateConversation } from '@/lib/inbox';
import { canCreateRecords } from '@/lib/crm/can-create-records';
import {
  conversationNotePrefixForThread,
  conversationNoteToInsert,
  findThreadParticipant,
  latestInboundSentAt,
} from '@/lib/inbox/inbox-contact-from-thread';

const bodySchema = z.object({
  body: z.string(),
  email: z.string().email().optional(),
  record_id: z.string().uuid().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canCreateRecords(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }

    const conversation = await getConversation(id);
    if (!conversation || conversation.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { messages } = await getMessages(id, 1, 100);
    const prefix = conversationNotePrefixForThread({
      subject: conversation.subject,
      sentAt: latestInboundSentAt(messages),
    });
    const noteBody = conversationNoteToInsert(parsed.data.body, prefix);
    if (!noteBody) {
      return NextResponse.json({ error: 'Write a note about this conversation' }, { status: 400 });
    }

    const supabase = await createClient();
    let recordId = parsed.data.record_id ?? conversation.contact_id ?? null;

    if (parsed.data.email) {
      const participant = findThreadParticipant(conversation, messages, parsed.data.email);
      if (!participant) {
        return NextResponse.json({ error: 'That person is not on this email' }, { status: 400 });
      }

      const { data: moduleRow } = await supabase
        .from('crm_modules')
        .select('id')
        .eq('org_id', profile.organization_id)
        .eq('key', 'contacts')
        .maybeSingle();

      if (!moduleRow) {
        return NextResponse.json({ error: 'Contacts module not found' }, { status: 404 });
      }

      const { data: duplicates } = await (supabase as any).rpc('check_crm_duplicate', {
        p_org_id: profile.organization_id,
        p_module_id: moduleRow.id,
        p_email: parsed.data.email.trim().toLowerCase(),
        p_phone: null,
      });
      const match = Array.isArray(duplicates) ? duplicates[0] : null;
      if (!match?.id) {
        return NextResponse.json({ error: 'No contact for that email yet' }, { status: 404 });
      }
      recordId = match.id as string;
    }

    if (!recordId) {
      return NextResponse.json({ error: 'No contact for this email yet' }, { status: 404 });
    }

    const { data: record, error: recordError } = await supabase
      .from('crm_records')
      .select('id, org_id, email')
      .eq('id', recordId)
      .maybeSingle();

    if (recordError || !record || record.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    if (!parsed.data.email && conversation.contact_id && recordId !== conversation.contact_id) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const { data: note, error: noteError } = await (supabase as any)
      .from('crm_notes')
      .insert({
        org_id: profile.organization_id,
        record_id: recordId,
        body: noteBody,
        is_pinned: false,
        created_by: profile.id,
      })
      .select('id')
      .single();

    if (noteError || !note) {
      return NextResponse.json({ error: 'Failed to save the note' }, { status: 500 });
    }

    let linked = false;
    if (!conversation.contact_id) {
      await updateConversation(id, { contact_id: recordId });
      linked = true;
    }

    return NextResponse.json({ note_id: note.id, record_id: recordId, linked });
  } catch (error) {
    console.error('Error in POST /api/inbox/[id]/notes:', error);
    return NextResponse.json({ error: 'Failed to save the note' }, { status: 500 });
  }
}
