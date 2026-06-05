import 'server-only';

import { cache } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export interface NeedAttachmentView {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  download_url: string | null;
}

/**
 * Lists attachments for a need owned by the current member, with short-lived download URLs.
 */
export const listNeedAttachmentsForMember = cache(
  async (needId: string): Promise<NeedAttachmentView[]> => {
    const ctx = await requireActiveMembership();
    const supabase = await createServerSupabaseClient();

    const { data: need } = await supabase
      .from('needs')
      .select('id')
      .eq('id', needId)
      .eq('member_id', ctx.member.id)
      .eq('organization_id', ctx.member.organization_id)
      .maybeSingle();

    if (!need) return [];

    const { data: rows } = await supabase
      .from('need_attachments')
      .select('id, file_name, mime_type, size_bytes, storage_path, created_at')
      .eq('need_id', needId)
      .order('created_at', { ascending: false });

    if (!rows?.length) return [];

    const views: NeedAttachmentView[] = [];
    for (const row of rows) {
      let download_url: string | null = null;
      if (row.storage_path) {
        const { data: signed } = await supabase.storage
          .from('member-needs')
          .createSignedUrl(row.storage_path, 3600);
        download_url = signed?.signedUrl ?? null;
      }
      views.push({
        id: row.id,
        file_name: row.file_name,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        created_at: row.created_at,
        download_url,
      });
    }

    return views;
  },
);
