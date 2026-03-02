/**
 * Send Scheduled Emails Edge Function
 *
 * Runs on a cron schedule (every minute) to send emails
 * that have been scheduled via inbox drafts.
 *
 * To set up the cron in Supabase Dashboard:
 *   pg_cron: SELECT cron.schedule('send-scheduled-emails', '* * * * *',
 *     $$SELECT net.http_post(
 *       url := 'https://sffisarikcreyyjzdjvb.supabase.co/functions/v1/send-scheduled-emails',
 *       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
 *     )$$
 *   );
 *
 * Alternatively invoke via Supabase Edge Function Cron (Dashboard → Edge Functions → Cron).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Only allow POST
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@mail.payitforwardhealth.com';
    const fromName = Deno.env.get('RESEND_FROM_NAME') || 'Pay It Forward Health';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find drafts ready to send (scheduled_at <= now)
    const { data: drafts, error: fetchError } = await supabase
      .from('inbox_drafts')
      .select('*')
      .lte('scheduled_at', new Date().toISOString())
      .not('scheduled_at', 'is', null)
      .limit(10); // Process up to 10 per invocation

    if (fetchError) {
      console.error('Failed to fetch scheduled drafts:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!drafts || drafts.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No scheduled emails due' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const draft of drafts) {
      try {
        const toAddresses = (draft.to_addresses || []) as Array<{ email: string; name?: string }>;
        if (toAddresses.length === 0) {
          // Delete invalid draft
          await supabase.from('inbox_drafts').delete().eq('id', draft.id);
          continue;
        }

        // Get author info
        const { data: author } = await supabase
          .from('profiles')
          .select('full_name, email:id')
          .eq('id', draft.author_id)
          .single();

        // Get author email from auth.users
        const { data: authUser } = await supabase.auth.admin.getUserById(draft.author_id);
        const authorEmail = authUser?.user?.email || fromEmail;
        const authorName = author?.full_name || fromName;

        // Send via Resend
        const resendPayload: Record<string, unknown> = {
          from: `${authorName} <${fromEmail}>`,
          to: toAddresses.map(r => r.name ? `${r.name} <${r.email}>` : r.email),
          subject: draft.subject || '(no subject)',
          html: draft.body_html || draft.body_text || '',
        };

        if (draft.cc_addresses && (draft.cc_addresses as unknown[]).length > 0) {
          resendPayload.cc = (draft.cc_addresses as Array<{ email: string }>).map(r => r.email);
        }
        if (draft.bcc_addresses && (draft.bcc_addresses as unknown[]).length > 0) {
          resendPayload.bcc = (draft.bcc_addresses as Array<{ email: string }>).map(r => r.email);
        }

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(resendPayload),
        });

        const resendData = await resendRes.json();

        if (!resendRes.ok) {
          throw new Error(resendData.message || `Resend API error: ${resendRes.status}`);
        }

        const now = new Date().toISOString();
        const messageId = resendData.id
          ? `<${resendData.id}>`
          : `<${crypto.randomUUID()}@mail.payitforwardhealth.com>`;

        // If this is a reply to an existing conversation, add to that thread
        if (draft.conversation_id) {
          await supabase.from('inbox_messages').insert({
            org_id: draft.org_id,
            conversation_id: draft.conversation_id,
            channel: 'email',
            direction: 'outbound',
            from_name: authorName,
            from_address: authorEmail,
            to_address: toAddresses[0].email,
            to_name: toAddresses[0].name || null,
            subject: draft.subject || null,
            body_html: draft.body_html,
            body_text: draft.body_text || draft.body_html?.replace(/<[^>]*>/g, '') || null,
            cc_addresses: draft.cc_addresses || [],
            bcc_addresses: draft.bcc_addresses || [],
            message_id: messageId,
            status: 'sent',
            sent_at: now,
            external_id: resendData.id || null,
            external_provider: 'resend',
            metadata: { scheduled: true },
          });

          // Update conversation
          await supabase
            .from('inbox_conversations')
            .update({
              last_message_at: now,
              preview: (draft.body_text || draft.body_html || '').replace(/<[^>]*>/g, '').slice(0, 200),
            })
            .eq('id', draft.conversation_id);
        } else {
          // New conversation
          const { data: conv } = await supabase
            .from('inbox_conversations')
            .insert({
              org_id: draft.org_id,
              channel: 'email',
              thread_id: messageId,
              subject: draft.subject || null,
              preview: (draft.body_text || draft.body_html || '').replace(/<[^>]*>/g, '').slice(0, 200),
              contact_email: toAddresses[0].email,
              contact_name: toAddresses[0].name || null,
              status: 'open',
              priority: 'normal',
              assigned_to: draft.author_id,
              assigned_at: now,
              unread_count: 0,
              message_count: 1,
              last_message_at: now,
              first_message_at: now,
              tags: [],
              labels: [],
              metadata: {},
            })
            .select()
            .single();

          if (conv) {
            await supabase.from('inbox_messages').insert({
              org_id: draft.org_id,
              conversation_id: conv.id,
              channel: 'email',
              direction: 'outbound',
              from_name: authorName,
              from_address: authorEmail,
              to_address: toAddresses[0].email,
              to_name: toAddresses[0].name || null,
              subject: draft.subject || null,
              body_html: draft.body_html,
              body_text: draft.body_text || draft.body_html?.replace(/<[^>]*>/g, '') || null,
              cc_addresses: draft.cc_addresses || [],
              bcc_addresses: draft.bcc_addresses || [],
              message_id: messageId,
              status: 'sent',
              sent_at: now,
              external_id: resendData.id || null,
              external_provider: 'resend',
              metadata: { scheduled: true },
            });
          }
        }

        // Delete the draft after successful send
        await supabase.from('inbox_drafts').delete().eq('id', draft.id);
        sentCount++;

        console.log(`Scheduled email sent: draft=${draft.id}, to=${toAddresses[0].email}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Draft ${draft.id}: ${msg}`);
        console.error(`Failed to send scheduled draft ${draft.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, errors: errors.length > 0 ? errors : undefined }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-scheduled-emails error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
