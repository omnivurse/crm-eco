import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DeleteUserBody {
  user_id: string;
}

async function getProfileRole(accessToken: string): Promise<string | null> {
  try {
    const tokenParts = accessToken.split('.');
    if (tokenParts.length !== 3) return null;

    const payload = JSON.parse(atob(tokenParts[1]));
    const userId = payload?.sub;
    if (!userId) return null;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${userId}`, {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) return null;

    const rows = await res.json();
    return rows?.[0]?.role ?? null;
  } catch (error) {
    console.error('Error fetching profile role:', error);
    return null;
  }
}

async function writeAudit(actorId: string, targetUserId: string, action: string, details: Record<string, unknown> = {}) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        actor_id: actorId,
        target_user_id: targetUserId,
        action,
        details
      })
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const auth = req.headers.get('Authorization') ?? '';
    const token = auth.replace('Bearer ', '').trim();

    if (!token) {
      return new Response('Unauthorized - missing token', {
        status: 401,
        headers: corsHeaders
      });
    }

    const body = (await req.json()) as DeleteUserBody;

    if (!body?.user_id) {
      return new Response('user_id required', {
        status: 400,
        headers: corsHeaders
      });
    }

    const requesterRole = await getProfileRole(token);
    if (!requesterRole) {
      return new Response('Unauthorized - invalid token', {
        status: 401,
        headers: corsHeaders
      });
    }

    const isSuper = requesterRole === 'super_admin';
    const isAdmin = requesterRole === 'admin';

    if (!isSuper && !isAdmin) {
      return new Response('Forbidden - insufficient permissions', {
        status: 403,
        headers: corsHeaders
      });
    }

    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=email,role&id=eq.${body.user_id}`, {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json',
      },
    });

    if (!profileRes.ok) {
      return new Response('User not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    const profiles = await profileRes.json();
    const targetProfile = profiles?.[0];

    if (!targetProfile) {
      return new Response('User not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    if (targetProfile.role === 'super_admin' && !isSuper) {
      return new Response('Only super_admin can delete super_admin users', {
        status: 403,
        headers: corsHeaders
      });
    }

    // Delete from auth.users - the CASCADE constraint will automatically delete the profile
    const deleteAuthUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${body.user_id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
    });

    if (!deleteAuthUserRes.ok) {
      const errorText = await deleteAuthUserRes.text();
      console.error(`Failed to delete user ${body.user_id} from auth:`, errorText);
      return new Response(`Failed to delete user from auth: ${errorText}`, {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log(`Successfully deleted user ${body.user_id} (${targetProfile.email}) - CASCADE will remove profile`);

    const tokenParts = token.split('.');
    let actorId = 'system';
    try {
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        actorId = payload?.sub || 'system';
      }
    } catch (e) {
      console.warn('Could not decode actor from token');
    }

    await writeAudit(actorId, body.user_id, 'delete_user', {
      email: targetProfile.email,
      role: targetProfile.role,
      deleted_by: requesterRole,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User deleted successfully',
        user_id: body.user_id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Admin delete user error:', error);
    return new Response(`Internal error: ${error}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
