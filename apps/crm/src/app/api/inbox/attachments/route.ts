import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { EMAIL_ATTACHMENT_BUCKET } from '@/lib/email/outbound-attachments';
import {
  fetchReceivedAttachment,
  sanitizeAttachmentFilename,
} from '../../../../../../../supabase/functions/_shared/resend-inbound';

/** Mirrors the bucket's file_size_limit — larger files stream straight from Resend. */
const MAX_CACHED_BYTES = 10 * 1024 * 1024;

interface StoredInboxAttachment {
  filename?: string;
  content_type?: string;
  size?: number;
  url?: string | null;
  file_path?: string | null;
  resend_id?: string | null;
}

/**
 * GET /api/inbox/attachments?message_id=&index=
 *
 * Serves one attachment of an inbox message by redirecting to a short-lived
 * signed URL. Resolution order:
 *   1. `file_path` — the object the intake function stored in the
 *      email-attachments bucket.
 *   2. `resend_id` — self-heal: fetch the bytes from Resend, cache them into
 *      the bucket, patch the message row, then serve. If caching fails the
 *      response falls back to Resend's own pre-signed download URL, so the
 *      user still gets the file.
 *   3. Legacy `url` — old rows that stored a provider URL directly.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messageId = request.nextUrl.searchParams.get('message_id');
    const rawIndex = request.nextUrl.searchParams.get('index');
    // Strict: Number(null) and Number('') are both 0, which would silently
    // serve attachment 0 for a malformed link.
    if (!messageId || rawIndex === null || !/^\d+$/.test(rawIndex)) {
      return NextResponse.json({ error: 'message_id and index are required' }, { status: 400 });
    }
    const index = Number(rawIndex);

    const supabase = await createCrmClient();
    const { data: message, error: messageError } = await supabase
      .from('inbox_messages')
      .select('id, org_id, organization_id, attachments, metadata')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    const orgId = message.organization_id ?? message.org_id;
    if (orgId !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const attachments: StoredInboxAttachment[] = Array.isArray(message.attachments)
      ? message.attachments
      : [];
    const attachment = attachments[index];
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    if (attachment.file_path) {
      return signedRedirect(supabase, attachment.file_path, attachment.filename);
    }

    // Self-heal: the intake didn't (or couldn't) store this one — pull it
    // from Resend now, cache it, and remember the path for next time.
    const metadata = (message.metadata ?? {}) as { resend_email_id?: string };
    const resendEmailId = metadata.resend_email_id;
    const apiKey = process.env.RESEND_API_KEY;
    if (attachment.resend_id && resendEmailId && apiKey) {
      const content = await fetchReceivedAttachment(resendEmailId, attachment.resend_id, apiKey);
      if (content?.download_url) {
        const cachedPath = await cacheAttachmentBytes(
          supabase,
          content.download_url,
          attachment,
          orgId,
        );
        if (cachedPath) {
          // Merge into a FRESH read of the row so this write cannot clobber a
          // file_path another writer (intake's background pass, a concurrent
          // download) set for a different index in the meantime.
          const { data: fresh } = await supabase
            .from('inbox_messages')
            .select('attachments')
            .eq('id', messageId)
            .maybeSingle();
          const current: StoredInboxAttachment[] = Array.isArray(fresh?.attachments)
            ? fresh.attachments
            : attachments;
          if (current[index] && !current[index].file_path) {
            current[index] = { ...current[index], file_path: cachedPath };
            // Best-effort: a failed patch only means the next download re-caches.
            await supabase
              .from('inbox_messages')
              .update({ attachments: current })
              .eq('id', messageId);
          }
          return signedRedirect(supabase, current[index]?.file_path ?? cachedPath, attachment.filename);
        }
        // Could not cache (too large, bucket refusal) — Resend's own signed
        // URL still delivers the file.
        return redirectIfTrusted(content.download_url)
          ?? NextResponse.json({ error: 'Failed to fetch attachment' }, { status: 502 });
      }
    }

    if (attachment.url) {
      const legacy = redirectIfTrusted(attachment.url);
      if (legacy) return legacy;
    }

    return NextResponse.json(
      {
        error:
          'This attachment was received before attachment storage was enabled and is no longer retrievable.',
      },
      { status: 404 },
    );
  } catch (error) {
    console.error('inbox attachment download failed:', error);
    return NextResponse.json({ error: 'Failed to fetch attachment' }, { status: 500 });
  }
}

/**
 * 302 only to hosts this system actually stores/serves attachments on. The
 * URL values come from our own rows and Resend's API, but a redirect endpoint
 * should not be an open one even against stored data.
 */
function redirectIfTrusted(url: string): NextResponse | null {
  try {
    const parsed = new URL(url);
    const trusted =
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('.supabase.co') ||
        parsed.hostname === 'cdn.resend.app' ||
        parsed.hostname.endsWith('.resend.app') ||
        parsed.hostname.endsWith('.resend.com'));
    return trusted ? NextResponse.redirect(parsed.toString()) : null;
  } catch {
    return null;
  }
}

async function signedRedirect(
  supabase: Awaited<ReturnType<typeof createCrmClient>>,
  filePath: string,
  filename?: string,
) {
  const { data, error } = await supabase.storage
    .from(EMAIL_ATTACHMENT_BUCKET)
    .createSignedUrl(filePath, 300, filename ? { download: filename } : undefined);
  if (error || !data?.signedUrl) {
    console.error('signed URL for inbox attachment failed:', error);
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }
  return NextResponse.redirect(data.signedUrl);
}

async function cacheAttachmentBytes(
  supabase: Awaited<ReturnType<typeof createCrmClient>>,
  downloadUrl: string,
  attachment: StoredInboxAttachment,
  orgId: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(downloadUrl, { signal: controller.signal });
    if (!res.ok) return null;
    const declared = Number(res.headers.get('content-length') || '0');
    if (declared > MAX_CACHED_BYTES) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_CACHED_BYTES) return null;

    const path = `${orgId}/inbound/${crypto.randomUUID()}/${sanitizeAttachmentFilename(attachment.filename)}`;
    const { error } = await supabase.storage
      .from(EMAIL_ATTACHMENT_BUCKET)
      .upload(path, bytes, {
        contentType: attachment.content_type || 'application/octet-stream',
        upsert: true,
      });
    if (error) {
      console.error('caching inbox attachment failed:', error);
      return null;
    }
    return path;
  } catch (error) {
    console.error('caching inbox attachment failed:', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
