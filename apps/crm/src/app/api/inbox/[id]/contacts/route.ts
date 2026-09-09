import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile, getAuthUser } from '@/lib/supabase-server';
import { getConversation, getMessages, updateConversation } from '@/lib/inbox';
import { canCreateRecords } from '@/lib/crm/can-create-records';
import { executeCrmRecordCreate } from '@/lib/crm/record-create-service';
import { proposeContactFromParticipant } from '@/lib/inbox/extract-contact-from-email';
import {
  buildInboxContactData,
  conversationNotePrefixForThread,
  conversationNoteToInsert,
  findThreadParticipant,
  latestInboundSentAt,
  overlayExtractedContact,
  resolveInboxContactCategory,
} from '@/lib/inbox/inbox-contact-from-thread';

const bodySchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  contact_category: z.string().optional(),
  note: z.string().optional(),
  force: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await getAuthUser();
    const profile = await getAuthProfile();
    if (!user || !profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canCreateRecords(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const conversation = await getConversation(id);
    if (!conversation || conversation.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { messages } = await getMessages(id, 1, 100);
    const participant = findThreadParticipant(conversation, messages, parsed.data.email);
    if (!participant) {
      return NextResponse.json({ error: 'That person is not on this email' }, { status: 400 });
    }

    const extracted = proposeContactFromParticipant({
      participant,
      messages,
    });
    const fields = overlayExtractedContact(extracted, parsed.data);
    if (!fields.first_name) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: moduleRow, error: moduleError } = await supabase
      .from('crm_modules')
      .select('id')
      .eq('org_id', profile.organization_id)
      .eq('key', 'contacts')
      .maybeSingle();

    if (moduleError || !moduleRow) {
      return NextResponse.json({ error: 'Contacts module not found' }, { status: 404 });
    }

    const category = resolveInboxContactCategory(parsed.data.contact_category);
    const created = await executeCrmRecordCreate({
      supabase,
      profile,
      user,
      input: {
        org_id: profile.organization_id,
        module_id: moduleRow.id,
        data: buildInboxContactData(fields, category),
        force: parsed.data.force,
      },
    });

    if (!created.ok) {
      return NextResponse.json(created.body, { status: created.status });
    }

    const prefix = conversationNotePrefixForThread({
      subject: conversation.subject,
      sentAt: latestInboundSentAt(messages),
    });
    const noteBody = conversationNoteToInsert(parsed.data.note, prefix);
    let noteId: string | null = null;
    if (noteBody) {
      const { data: note, error: noteError } = await (supabase as any)
        .from('crm_notes')
        .insert({
          org_id: profile.organization_id,
          record_id: created.record.id,
          body: noteBody,
          is_pinned: false,
          created_by: profile.id,
        })
        .select('id')
        .single();
      if (!noteError && note?.id) noteId = note.id as string;
    }

    let linked = false;
    if (!conversation.contact_id) {
      await updateConversation(id, { contact_id: created.record.id });
      linked = true;
    }

    return NextResponse.json({
      record: created.record,
      linked,
      extracted,
      note_id: noteId,
    });
  } catch (error) {
    console.error('Error in POST /api/inbox/[id]/contacts:', error);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
