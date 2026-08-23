import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '@crm-eco/lib/rate-limit';
import { requirePinUnlock } from '@/lib/require-pin';
import {
  getServiceClient,
  DOUBLE_HELIX_ORG_ID,
  DOUBLE_HELIX_LEADS_MODULE_ID,
} from '@/lib/supabase';

interface LeadPayload {
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function validate(body: unknown): LeadPayload | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Invalid body' };
  const b = body as Record<string, unknown>;
  const firstName = typeof b.firstName === 'string' ? b.firstName.trim() : '';
  const lastName = typeof b.lastName === 'string' ? b.lastName.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!firstName) return { error: 'firstName is required' };
  if (!lastName) return { error: 'lastName is required' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'A valid email is required' };
  }
  return {
    firstName,
    lastName,
    email,
    company: typeof b.company === 'string' ? b.company.trim() : undefined,
    phone: typeof b.phone === 'string' ? b.phone.trim() : undefined,
    notes: typeof b.notes === 'string' ? b.notes.trim() : undefined,
  };
}

export async function POST(request: NextRequest) {
  const locked = requirePinUnlock(request);
  if (locked) return locked;

  const limited = rateLimit(`cashpay-leads:${clientIp(request)}`, {
    limit: 8,
    windowMs: 60_000,
  });
  if (!limited.success) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const honeypot = (json as { website?: unknown }).website;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  const result = validate(json);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (err) {
    console.error('[cashpay:lead] supabase client unavailable', err);
    return NextResponse.json(
      { error: 'Lead capture is temporarily unavailable. Please email us instead.' },
      { status: 500 },
    );
  }

  const ip = request.headers.get('x-forwarded-for') ?? null;
  const userAgent = request.headers.get('user-agent') ?? null;

  const { error } = await supabase.from('crm_records').insert({
    org_id: DOUBLE_HELIX_ORG_ID,
    module_id: DOUBLE_HELIX_LEADS_MODULE_ID,
    title: `${result.firstName} ${result.lastName}`,
    status: 'new',
    stage: 'inbound',
    email: result.email,
    phone: result.phone ?? null,
    data: {
      first_name: result.firstName,
      last_name: result.lastName,
      email: result.email,
      company: result.company ?? null,
      phone: result.phone ?? null,
      product_interest: 'cashpay',
      notes: result.notes ?? null,
    },
    system: {
      source: 'cashpay.doublehelixhub.com',
      submitted_at: new Date().toISOString(),
      ip,
      user_agent: userAgent,
    },
  });

  if (error) {
    console.error('[cashpay:lead] insert failed', error);
    return NextResponse.json({ error: 'Failed to record lead' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
