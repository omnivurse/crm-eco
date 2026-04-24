import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ingestRequestSchema, type IngestResponse } from '@olyron/migrate-contract';
import { verifyOlyronMigrateRequest } from '@/lib/olyron-migrate-verify';

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const v = verifyOlyronMigrateRequest(request, raw);
  if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = ingestRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: mod } = await admin
    .from('crm_modules')
    .select('id')
    .eq('org_id', parsed.data.orgId)
    .eq('key', 'contacts')
    .maybeSingle();

  if (!mod?.id) {
    return NextResponse.json({ error: 'contacts_module_not_found' }, { status: 400 });
  }

  const results: IngestResponse['results'] = [];

  for (const rec of parsed.data.records) {
    const d = rec.data as Record<string, unknown>;
    const email = (d.email as string | undefined)?.toLowerCase()?.trim() || null;
    const title =
      [d.first_name, d.last_name].filter(Boolean).join(' ').trim() ||
      (email ?? 'Imported contact');

    try {
      let existing = null as { id: string } | null;
      if (email) {
        const { data } = await admin
          .from('crm_records')
          .select('id')
          .eq('org_id', parsed.data.orgId)
          .eq('module_id', mod.id)
          .eq('email', email)
          .maybeSingle();
        existing = data;
      }
      if (!existing) {
        const { data: byExt } = await admin
          .from('crm_records')
          .select('id')
          .eq('org_id', parsed.data.orgId)
          .eq('module_id', mod.id)
          .filter('system->migrate_external_id', 'eq', rec.externalId)
          .maybeSingle();
        existing = byExt;
      }

      const system = {
        migrate_external_id: rec.externalId,
        migrate_source: rec.source,
      };
      const row = {
        org_id: parsed.data.orgId,
        module_id: mod.id,
        title,
        email,
        phone: (d.phone as string | undefined) ?? null,
        status: 'active',
        data: {
          first_name: d.first_name ?? null,
          last_name: d.last_name ?? null,
          job_title: d.title ?? d.job_title ?? null,
          notes: d.notes ?? null,
        },
        system,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id && parsed.data.mode === 'upsert') {
        const { error } = await admin.from('crm_records').update(row).eq('id', existing.id);
        if (error) {
          results.push({ externalId: rec.externalId, status: 'failed', error: { code: 'db', message: error.message } });
        } else {
          results.push({ externalId: rec.externalId, status: 'updated', targetId: existing.id });
        }
      } else if (!existing) {
        const { data: ins, error } = await admin.from('crm_records').insert(row).select('id').single();
        if (error) {
          results.push({ externalId: rec.externalId, status: 'failed', error: { code: 'db', message: error.message } });
        } else {
          results.push({ externalId: rec.externalId, status: 'created', targetId: ins!.id });
        }
      } else {
        results.push({ externalId: rec.externalId, status: 'skipped' });
      }
    } catch (e) {
      results.push({
        externalId: rec.externalId,
        status: 'failed',
        error: { code: 'exception', message: e instanceof Error ? e.message : 'error' },
      });
    }
  }

  return NextResponse.json({ results } satisfies IngestResponse);
}
