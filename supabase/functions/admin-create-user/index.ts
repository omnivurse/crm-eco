import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY'); // optional

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateUserBody {
  email: string;
  password?: string;
  full_name?: string;
  role: 'member' | 'advisor' | 'staff' | 'agent' | 'admin' | 'super_admin' | 'concierge';
}

async function getProfileRole(accessToken: string): Promise<string | null> {
  try {
    // Decode the JWT to get the user ID
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

async function generateInviteLink(email: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'invite',
      email,
    })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to generate invite link: ${errorText}`);
  }
  
  const result = await res.json();
  return result?.properties?.action_link as string;
}

async function sendInviteEmail(to: string, fullName: string, role: string, inviteUrl: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  const html = `<!doctype html>
<html>
  <body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#0f172a; background:#f8fafc; padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <h1 style="margin:0;font-size:20px;">Welcome to MPB Health IT</h1>
          <p style="margin:8px 0 0 0;font-size:14px;color:#475569;">Hello ${fullName || 'there'}, you've been invited as <b>${role}</b>.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px 24px;">
          <a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;">Accept Invite</a>
          <p style="font-size:12px;color:#64748b;margin-top:16px;">If the button doesn't work, copy & paste this link:<br/>${inviteUrl}</p>
        </td>
      </tr>
    </table>
    <p style="font-size:12px;color:#94a3b8;margin-top:12px;">If you did not expect this email, you can ignore it.</p>
  </body>
</html>`;

  const text = `Welcome to MPB Health IT

Hello ${fullName || 'there'}, you've been invited as ${role}.

Accept Invite:
${inviteUrl}

If you did not expect this email, you can ignore it.`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'IT Support <no-reply@support.mympb.com>',
        to: [to],
        subject: 'You have been invited to MPB Health IT',
        html,
        text
      })
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to send invite email:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const body = (await req.json()) as CreateUserBody;
    
    if (!body?.email || !body?.role) {
      return new Response('email and role required', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Check requester permissions
    const requesterRole = await getProfileRole(token);
    if (!requesterRole) {
      return new Response('Unauthorized - invalid token', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const isSuper = requesterRole === 'super_admin';
    const isAdmin = requesterRole === 'admin';

    // Permission enforcement
    if (!isSuper && !isAdmin) {
      return new Response('Forbidden - insufficient permissions', { 
        status: 403, 
        headers: corsHeaders 
      });
    }

    if (body.role === 'super_admin' && !isSuper) {
      return new Response('Only super_admin can create super_admin', { 
        status: 403, 
        headers: corsHeaders 
      });
    }

    // Generate secure password if not provided
    const password = body.password ?? crypto.randomUUID();

    // Create user via Supabase Admin API
    const createUserRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        password: password,
        email_confirm: true, // Auto-confirm email for immediate access
        user_metadata: {
          full_name: body.full_name ?? '',
          invited_by: requesterRole,
        },
      }),
    });

    if (!createUserRes.ok) {
      const errorText = await createUserRes.text();
      return new Response(`Create user failed: ${errorText}`, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const user = await createUserRes.json();

    // Update profile with role
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ 
        role: body.role, 
        full_name: body.full_name ?? '', 
        email: body.email 
      }),
    });

    if (!profileRes.ok) {
      const errorText = await profileRes.text();
      return new Response(`Profile update failed: ${errorText}`, { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Get actor ID from token
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

    // Write audit log
    await writeAudit(actorId, user.id, 'create_user', {
      email: body.email,
      role: body.role,
      invited_by: requesterRole,
    });

    // Generate invite link
    const inviteUrl = await generateInviteLink(body.email);
    
    // Send invite email (optional)
    const emailSent = await sendInviteEmail(
      body.email, 
      body.full_name ?? '', 
      body.role, 
      inviteUrl
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        user: { id: user.id, email: body.email },
        invite_url: inviteUrl,
        email_sent: emailSent,
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
    console.error('Admin create user error:', error);
    return new Response(`Internal error: ${error}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});