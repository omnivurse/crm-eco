import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ResetPasswordBody {
  user_id: string;
  email: string;
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

async function generatePasswordResetLink(userId: string, email: string): Promise<string> {
  const newPassword = crypto.randomUUID();

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      password: newPassword,
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to reset password: ${errorText}`);
  }

  return newPassword;
}

async function sendPasswordResetEmail(to: string, tempPassword: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - skipping email send');
    return false;
  }

  const html = `<!doctype html>
<html>
  <body style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#0f172a; background:#f8fafc; padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <h1 style="margin:0;font-size:20px;">Your Password Has Been Reset</h1>
          <p style="margin:8px 0 0 0;font-size:14px;color:#475569;">An administrator has reset your MPB Health IT account password.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px 24px;">
          <div style="background:#f1f5f9;padding:16px;border-radius:10px;margin:16px 0;">
            <p style="margin:0;font-size:12px;color:#64748b;font-weight:600;">Temporary Password:</p>
            <p style="margin:4px 0 0 0;font-size:16px;color:#0f172a;font-family:monospace;font-weight:bold;">${tempPassword}</p>
          </div>
          <p style="font-size:12px;color:#64748b;margin-top:16px;">Please log in and change your password immediately.</p>
          <p style="font-size:12px;color:#ef4444;margin-top:12px;">Keep this password secure and do not share it with anyone.</p>
        </td>
      </tr>
    </table>
    <p style="font-size:12px;color:#94a3b8;margin-top:12px;">If you did not request this, please contact your administrator immediately.</p>
  </body>
</html>`;

  const text = `Your Password Has Been Reset

An administrator has reset your MPB Health IT account password.

Temporary Password: ${tempPassword}

Please log in and change your password immediately.

Keep this password secure and do not share it with anyone.

If you did not request this, please contact your administrator immediately.`;

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
        subject: 'Password Reset - MPB Health IT',
        html,
        text
      })
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
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
      return new Response(JSON.stringify({ error: 'Unauthorized - missing token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = (await req.json()) as ResetPasswordBody;

    if (!body?.user_id || !body?.email) {
      return new Response(JSON.stringify({ error: 'user_id and email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requesterRole = await getProfileRole(token);
    if (!requesterRole) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isSuper = requesterRole === 'super_admin';
    const isAdmin = requesterRole === 'admin';

    if (!isSuper && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tempPassword = await generatePasswordResetLink(body.user_id, body.email);

    const emailSent = await sendPasswordResetEmail(body.email, tempPassword);

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

    await writeAudit(actorId, body.user_id, 'password_reset_sent', {
      email: body.email,
      email_sent: emailSent,
    });

    const hasResendKey = !!RESEND_API_KEY;

    return new Response(
      JSON.stringify({
        success: true,
        temp_password: emailSent ? null : tempPassword,
        email_sent: emailSent,
        resend_configured: hasResendKey,
        message: emailSent ? 'Password reset email sent successfully' : `Password reset. Temporary password: ${tempPassword}`,
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
    console.error('Admin reset password error:', error);
    return new Response(
      JSON.stringify({ error: `Internal error: ${error}` }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
