import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/crm/security/sso-config
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('crm_sso_config')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('provider');

    if (error) {
      console.error('[Security/SSO] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch SSO config' }, { status: 500 });
    }

    // Redact sensitive fields for non-admins
    const isAdmin = profile.crm_role === 'crm_admin';
    const configs = (data || []).map((c) => {
      if (!isAdmin) {
        return { ...c, config: '***REDACTED***', client_id: '***' };
      }
      return c;
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('[Security/SSO] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/crm/security/sso-config — upsert SSO provider config
// ---------------------------------------------------------------------------
const ssoSchema = z.object({
  provider: z.enum(['saml', 'oidc', 'google', 'microsoft', 'okta', 'auth0', 'custom']),
  display_name: z.string().optional(),
  is_enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  metadata_url: z.string().url().optional().nullable(),
  client_id: z.string().optional().nullable(),
  enforce_sso: z.boolean().optional(),
  allowed_domains: z.array(z.string()).optional(),
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
    const parsed = ssoSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors }, { status: 400 });

    const { data, error } = await supabase
      .from('crm_sso_config')
      .upsert(
        {
          organization_id: profile.organization_id,
          provider: parsed.data.provider,
          display_name: parsed.data.display_name,
          is_enabled: parsed.data.is_enabled ?? false,
          config: parsed.data.config || {},
          metadata_url: parsed.data.metadata_url,
          client_id: parsed.data.client_id,
          enforce_sso: parsed.data.enforce_sso ?? false,
          allowed_domains: parsed.data.allowed_domains || [],
          created_by: profile.id,
        },
        { onConflict: 'organization_id,provider' }
      )
      .select()
      .single();

    if (error) {
      console.error('[Security/SSO] Upsert error:', error);
      return NextResponse.json({ error: 'Failed to save SSO config' }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('[Security/SSO] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/crm/security/sso-config?id=<uuid>
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
    if (!id) return NextResponse.json({ error: 'Missing config id' }, { status: 400 });

    const { error } = await supabase
      .from('crm_sso_config')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('[Security/SSO] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Security/SSO] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
