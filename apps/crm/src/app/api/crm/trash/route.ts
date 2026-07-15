import { NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * GET /api/crm/trash
 *
 * Unified Recycle Bin feed across every soft-deletable CRM entity, for the
 * global Trash console. Admin/manager only. Each entity is queried independently
 * and degrades to an empty group on error (missing table on a lagging env, RLS,
 * etc.) so one failing source never blanks the whole console.
 *
 * Scoping: the authenticated (RLS-scoped) client is used throughout.
 *   - Org-scoped entities (records/tasks/notes/attachments/links/contact-groups/
 *     carrier-contacts) return the whole org's trashed rows to an admin.
 *   - Personal entities (sticky notes, saved views) are owner-scoped by RLS, so
 *     they return only the current admin's own trashed items — intentional: these
 *     are personal and should not be cross-user visible.
 *
 * Restores go through the existing endpoints (records: /api/crm/records/[id]/
 * restore, everything else: /api/crm/trash/restore-item), so this route is
 * read-only.
 */

export const dynamic = 'force-dynamic';

const PER_ENTITY_LIMIT = 200;

type TrashItem = {
  entity: string;
  id: string;
  label: string;
  sublabel: string | null;
  deleted_at: string | null;
  deleted_origin: string | null;
  purgeable: boolean;
};

type TrashGroup = {
  entity: string;
  title: string;
  items: TrashItem[];
  count: number;
};

function excerpt(value: unknown, max = 80): string {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function recordLabel(row: Record<string, unknown>): string {
  const title = (row.title as string | null) ?? '';
  if (title.trim()) return title;
  const data = (row.data ?? {}) as Record<string, unknown>;
  const first = String(data.first_name ?? '').trim();
  const last = String(data.last_name ?? '').trim();
  const name = `${first} ${last}`.trim();
  if (name) return name;
  const groupName = String(data.group_name ?? '').trim();
  if (groupName) return groupName;
  const email = (row.email as string | null)?.trim();
  return email || 'Untitled record';
}

export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const org = profile.organization_id;

    // Gate on the ACTIVE org's CRM role, not the home-org profile.crm_role. A user
    // can switch into any org they're a member of (getAuthProfile overrides
    // organization_id but leaves crm_role as the home-org value), so checking the
    // raw crm_role would let a home-org admin read a switched org's admin-only
    // Trash. has_crm_role resolves the caller's effective role (legacy profile +
    // tenant membership + super-admin) for this exact org — the same DB-side gate
    // the restore/purge RPCs enforce.
    const { data: isCrmAdmin, error: roleError } = await (supabase as any).rpc('has_crm_role', {
      p_org_id: org,
      p_roles: ['crm_admin', 'crm_manager'],
    });
    if (roleError || !isCrmAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // One config per soft-deletable entity. `orgCol` null => rely on RLS
    // (personal, owner-scoped tables). `label` builds the display string.
    const configs: Array<{
      entity: string;
      title: string;
      table: string;
      select: string;
      orgCol: string | null;
      purgeable: boolean;
      label: (row: Record<string, unknown>) => string;
      sublabel?: (row: Record<string, unknown>) => string | null;
    }> = [
      {
        entity: 'record',
        title: 'Records',
        table: 'crm_records',
        select: 'id, title, email, data, deleted_at, deleted_origin',
        orgCol: 'org_id',
        purgeable: true,
        label: recordLabel,
        sublabel: (r) => (r.email as string | null) || null,
      },
      {
        entity: 'task',
        title: 'Tasks & activities',
        table: 'crm_tasks',
        select: 'id, title, activity_type, deleted_at, deleted_origin',
        orgCol: 'org_id',
        purgeable: false,
        label: (r) => (r.title as string | null)?.trim() || 'Untitled task',
        sublabel: (r) => (r.activity_type as string | null) || null,
      },
      {
        entity: 'note',
        title: 'Notes',
        table: 'crm_notes',
        select: 'id, body, deleted_at, deleted_origin',
        orgCol: 'org_id',
        purgeable: false,
        label: (r) => excerpt(r.body) || 'Note',
        sublabel: () => 'Record note',
      },
      {
        entity: 'attachment',
        title: 'Attachments',
        table: 'crm_attachments',
        select: 'id, file_name, mime_type, deleted_at, deleted_origin',
        orgCol: 'org_id',
        purgeable: false,
        label: (r) => (r.file_name as string | null)?.trim() || 'Attachment',
        sublabel: (r) => (r.mime_type as string | null) || null,
      },
      {
        entity: 'record_link',
        title: 'Record links',
        table: 'crm_record_links',
        select: 'id, link_type, deleted_at, deleted_origin',
        orgCol: 'org_id',
        purgeable: false,
        label: (r) => (r.link_type as string | null)?.trim() || 'Record link',
        sublabel: () => 'Link between records',
      },
      {
        entity: 'contact_group',
        title: 'Contact groups',
        table: 'crm_contact_groups',
        select: 'id, group_name, group_type, deleted_at, deleted_origin',
        orgCol: 'organization_id',
        purgeable: false,
        label: (r) => (r.group_name as string | null)?.trim() || 'Contact group',
        sublabel: (r) => (r.group_type as string | null) || null,
      },
      {
        entity: 'carrier_contact',
        title: 'Carrier contacts',
        table: 'carrier_contacts',
        select: 'id, contact_name, label, email, deleted_at, deleted_origin',
        orgCol: 'organization_id',
        purgeable: false,
        label: (r) =>
          (r.contact_name as string | null)?.trim() ||
          (r.label as string | null)?.trim() ||
          (r.email as string | null)?.trim() ||
          'Carrier contact',
        sublabel: (r) => (r.email as string | null) || null,
      },
      // Personal, owner-scoped (RLS returns only the current admin's own):
      {
        entity: 'sticky_note',
        title: 'My sticky notes',
        table: 'notes',
        select: 'id, title, deleted_at, deleted_origin',
        orgCol: null,
        purgeable: false,
        label: (r) => (r.title as string | null)?.trim() || 'Sticky note',
        sublabel: () => 'Personal note',
      },
      {
        entity: 'saved_view',
        title: 'My saved views',
        table: 'saved_views',
        select: 'id, name, page_key, deleted_at, deleted_origin',
        orgCol: null,
        purgeable: false,
        label: (r) => (r.name as string | null)?.trim() || 'Saved view',
        sublabel: (r) => (r.page_key as string | null) || null,
      },
    ];

    const groups = await Promise.all(
      configs.map(async (cfg): Promise<TrashGroup> => {
        try {
          let q = (supabase as any)
            .from(cfg.table)
            .select(cfg.select)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false })
            .limit(PER_ENTITY_LIMIT);
          if (cfg.orgCol) q = q.eq(cfg.orgCol, org);

          const { data, error } = await q;
          if (error || !data) {
            return { entity: cfg.entity, title: cfg.title, items: [], count: 0 };
          }

          const items: TrashItem[] = (data as Array<Record<string, unknown>>).map((row) => ({
            entity: cfg.entity,
            id: row.id as string,
            label: cfg.label(row),
            sublabel: cfg.sublabel ? cfg.sublabel(row) : null,
            deleted_at: (row.deleted_at as string | null) ?? null,
            deleted_origin: (row.deleted_origin as string | null) ?? null,
            purgeable: cfg.purgeable,
          }));

          return { entity: cfg.entity, title: cfg.title, items, count: items.length };
        } catch {
          return { entity: cfg.entity, title: cfg.title, items: [], count: 0 };
        }
      }),
    );

    const total = groups.reduce((sum, g) => sum + g.count, 0);

    return NextResponse.json({ groups, total });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
