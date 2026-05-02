import { NextResponse } from 'next/server';
import { getAuthProfile } from '@/lib/supabase-server';
import { getConnections, PROVIDER_CONFIGS } from '@/lib/integrations';

/**
 * GET /api/integrations/providers
 * Connected integrations for the current org, shaped for comms / provider-status UIs.
 * (Must live at this path so it is not captured by /api/integrations/[id].)
 */
export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connections } = await getConnections();

    const providers = connections.map((c) => {
      const config = PROVIDER_CONFIGS[c.provider];
      return {
        id: c.id,
        key: c.provider,
        name: c.name || config?.name || c.provider,
        type: c.connection_type,
        channel: c.connection_type,
        status: c.status,
        provider: c.provider,
      };
    });

    return NextResponse.json({ providers });
  } catch (error) {
    console.error('Error in GET /api/integrations/providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integration providers' },
      { status: 500 }
    );
  }
}
