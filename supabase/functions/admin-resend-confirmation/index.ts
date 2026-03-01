import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '*').split(',').map(s => s.trim());

// Simple in-memory rate limiter: 5 confirmations per user per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 3600_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes('*') ? '*' : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };
}

interface ResendConfirmationBody {
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

async function checkUserConfirmation(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
    });

    if (!res.ok) return false;

    const user = await res.json();
    return user?.email_confirmed_at !== null;
  } catch (error) {
    console.error('Error checking user confirmation:', error);
    return false;
  }
}

async function confirmUserEmail(userId: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email_confirm: true,
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to confirm email: ${errorText}`);
  }

  return true;
}

async function sendConfirmationEmail(to: string): Promise<boolean> {
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
          <h1 style="margin:0;font-size:20px;">Email Confirmed</h1>
          <p style="margin:8px 0 0 0;font-size:14px;color:#475569;">Your email address has been confirmed by an administrator.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px 24px;">
          <div style="background:#f0fdf4;padding:16px;border-radius:10px;margin:16px 0;border:1px solid #86efac;">
            <p style="margin:0;font-size:14px;color:#166534;font-weight:600;">✓ Your account is now active</p>
          </div>
          <p style="font-size:12px;color:#64748b;margin-top:16px;">You can now access all features of Pay It Forward Health.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `Email Confirmed

Your email address has been confirmed by an administrator.

✓ Your account is now active

You can now access all features of Pay It Forward Health.`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `Pay It Forward Health <${Deno.env.get('FROM_EMAIL') || (() => { throw new Error('FROM_EMAIL not configured') })()}>`,
        to: [to],
        subject: 'Email Confirmed - Pay It Forward Health',
        html,
        text
      })
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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

    const body = (await req.json()) as ResendConfirmationBody;

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

    // Rate limit: 5 confirmations per target user per hour
    if (!checkRateLimit(`confirm_${body.user_id}`)) {
      return new Response(JSON.stringify({ error: 'Too many confirmation requests. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isConfirmed = await checkUserConfirmation(body.user_id);
    if (isConfirmed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Email is already confirmed',
          already_confirmed: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    await confirmUserEmail(body.user_id);

    const emailSent = await sendConfirmationEmail(body.email);

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

    await writeAudit(actorId, body.user_id, 'email_confirmation_resent', {
      email: body.email,
      email_sent: emailSent,
      confirmation_method: 'admin_override',
    });

    const hasResendKey = !!RESEND_API_KEY;

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        resend_configured: hasResendKey,
        message: emailSent ? 'Email confirmed and notification sent' : 'Email confirmed successfully',
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
    console.error('Admin resend confirmation error:', error);
    return new Response(
      JSON.stringify({ error: `Internal error: ${error}` }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
