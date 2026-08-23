import { NextRequest, NextResponse } from 'next/server';
import { CSV_UTF8_BOM, toCsvRow } from '@crm-eco/lib/csv/escape';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { memberRateLimit } from '@/lib/api/guard';
import { getOwnedBook, listClips } from '@/lib/rate-book/db';
import { clipRecordToSnapshot } from '@/lib/rate-book/types';

export const dynamic = 'force-dynamic';

const HEADERS = [
  'as_of',
  'facility',
  'city',
  'state',
  'market',
  'metro',
  'specialty',
  'code',
  'description',
  'cash',
  'cms_needle',
  'payment_method',
  'page_high_at_clip',
  'page_median_at_clip',
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireActiveMembership();
  const limited = memberRateLimit(ctx.member.id, 'rate-books:export', { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const supabase = await createServerSupabaseClient();
  const book = await getOwnedBook(supabase, id, ctx.member.id, ctx.member.organization_id);
  if (!book) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: limited.headers });

  const rows = await listClips(supabase, book.id, ctx.member.id, ctx.member.organization_id);
  const lines = [
    toCsvRow(['Published hospital cash. Not a quote. Not insurance.']),
    toCsvRow([]),
    toCsvRow(HEADERS),
    ...rows.map((row) => {
      const clip = clipRecordToSnapshot(row);
      return toCsvRow([
        clip.clippedAt,
        clip.facilityName,
        clip.city,
        clip.state,
        clip.queryStateName,
        clip.queryMsaName,
        clip.querySpecialty,
        clip.procedureCode,
        clip.codeDescription,
        clip.rate,
        clip.cmsRelativity,
        clip.paymentMethod,
        clip.sliceHigh,
        clip.sliceMedian,
      ]);
    }),
  ];

  const slug = book.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tape';
  const body = `${CSV_UTF8_BOM}${lines.join('\n')}\n`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...limited.headers,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rate-book-${slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
