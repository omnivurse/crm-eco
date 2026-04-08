import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';

export const dynamic = 'force-dynamic';

const API_SCOPES = [
  'crm.read', 'crm.write', 'crm.admin',
  'records.read', 'records.write', 'records.delete',
  'contacts.read', 'contacts.write',
  'pipelines.read', 'pipelines.write',
  'automations.read', 'automations.write',
  'analytics.read',
  'import.execute', 'export.execute',
  'webhooks.manage',
  'extensions.read', 'extensions.manage',
] as const;

const ENVIRONMENTS = ['production', 'staging', 'development', 'test'] as const;

function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  const fullKey = `dhh_k_${raw}`;
  const prefix = fullKey.slice(0, 12);
  const hash = createHash('sha256').update(fullKey).digest('hex');
  return { fullKey, prefix, hash };
}

// ---------------------------------------------------------------------------
// GET /api/crm/developer/api-keys
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get('status');
    const environment = request.nextUrl.searchParams.get('environment');

    let query = supabase
      .from('crm_api_keys')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (environment) query = query.eq('environment', environment);

    const { data, error } = await query;
    if (error) {
      console.error('[ApiKeys] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
    }

    // Never return key_hash in list responses
    const keys = (data || []).map(({ key_hash: _hash, ...rest }) => rest);

    return NextResponse.json({ api_keys: keys });
  } catch (error) {
    console.error('[ApiKeys] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/crm/developer/api-keys — create a new API key
// ---------------------------------------------------------------------------
const createKeySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
  allowed_ips: z.array(z.string()).optional(),
  allowed_origins: z.array(z.string()).optional(),
  rate_limit_rpm: z.number().int().min(1).max(10000).optional(),
  environment: z.enum(ENVIRONMENTS).optional(),
  expires_at: z.string().datetime().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { fullKey, prefix, hash } = generateApiKey();

    const { data, error } = await supabase
      .from('crm_api_keys')
      .insert({
        organization_id: profile.organization_id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        key_prefix: prefix,
        key_hash: hash,
        scopes: parsed.data.scopes,
        allowed_ips: parsed.data.allowed_ips || [],
        allowed_origins: parsed.data.allowed_origins || [],
        rate_limit_rpm: parsed.data.rate_limit_rpm || 60,
        environment: parsed.data.environment || 'production',
        expires_at: parsed.data.expires_at || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[ApiKeys] Insert error:', error);
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
    }

    // Return full key ONLY on creation (never shown again)
    const { key_hash: _hash, ...safeData } = data;

    return NextResponse.json({
      api_key: {
        ...safeData,
        key: fullKey,  // Only returned once
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[ApiKeys] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/developer/api-keys — update key name, scopes, or status
// ---------------------------------------------------------------------------
const updateKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  scopes: z.array(z.enum(API_SCOPES)).min(1).optional(),
  allowed_ips: z.array(z.string()).optional(),
  allowed_origins: z.array(z.string()).optional(),
  rate_limit_rpm: z.number().int().min(1).max(10000).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateKeySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { id, ...updates } = parsed.data;

    const { data, error } = await supabase
      .from('crm_api_keys')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[ApiKeys] Update error:', error);
      return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
    }

    const { key_hash: _hash, ...safeData } = data;
    return NextResponse.json({ api_key: safeData });
  } catch (error) {
    console.error('[ApiKeys] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/developer/api-keys?id=<uuid> — revoke a key
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing key id' }, { status: 400 });

    // Revoke rather than hard delete (preserves audit trail)
    const { data, error } = await supabase
      .from('crm_api_keys')
      .update({
        status: 'revoked',
        revoked_by: profile.id,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select()
      .single();

    if (error) {
      console.error('[ApiKeys] Revoke error:', error);
      return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
    }

    const { key_hash: _hash, ...safeData } = data;
    return NextResponse.json({ api_key: safeData });
  } catch (error) {
    console.error('[ApiKeys] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
