import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { FALLBACK_FROM_EMAIL } from '../_shared/email-sender.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGIN') || '*').split(',').map(s => s.trim());

// Simple in-memory rate limiter: 5 requests per user per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 3600_000; // 1 hour

async function getOrgEmailConfig(organizationId: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/system_settings?organization_id=eq.${organizationId}&category=eq.email&setting_key=in.(%22email_from_address%22,%22email_from_name%22)&select=setting_key,setting_value`,
    {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json',
      },
    }
  );

  const config: Record<string, string> = {};
  if (res.ok) {
    const settings = await res.json();
    (settings || []).forEach((s: any) => { config[s.setting_key] = s.setting_value; });
  }

  return {
    fromEmail: config.email_from_address || Deno.env.get('FROM_EMAIL') || FALLBACK_FROM_EMAIL,
    fromName: config.email_from_name || Deno.env.get('RESEND_FROM_NAME') || 'Double Helix Hub',
  };
}

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

interface ResetPasswordBody {
  user_id: string;
  email: string;
}

async function getProfileRole(accessToken: string): Promise<{ role: string | null; userId: string | null; organizationId: string | null }> {
  try {
    const tokenParts = accessToken.split('.');
    if (tokenParts.length !== 3) return { role: null, userId: null, organizationId: null };

    const payload = JSON.parse(atob(tokenParts[1]));
    const userId = payload?.sub;
    if (!userId) return { role: null, userId: null, organizationId: null };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=role,organization_id&id=eq.${userId}`, {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) return { role: null, userId: null, organizationId: null };

    const rows = await res.json();
    return { role: rows?.[0]?.role ?? null, userId, organizationId: rows?.[0]?.organization_id ?? null };
  } catch (error) {
    console.error('Error fetching profile role:', error);
    return { role: null, userId: null, organizationId: null };
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

async function generateRecoveryLink(email: string): Promise<string> {
  const siteUrl = Deno.env.get('SITE_URL') || 'https://crm.doublehelixhub.com';
  const redirectTo = `${siteUrl}/update-password`;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'recovery',
      email,
      options: { redirectTo },
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to generate recovery link: ${errorText}`);
  }

  const result = await res.json();
  const actionLink = result?.properties?.action_link;
  if (!actionLink) {
    throw new Error('No action_link in generateLink response');
  }
  return actionLink;
}

async function sendPasswordResetEmail(to: string, recoveryLink: string, orgConfig: { fromEmail: string; fromName: string }): Promise<boolean> {
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
          <h1 style="margin:0;font-size:20px;">Reset Your Password</h1>
          <p style="margin:8px 0 0 0;font-size:14px;color:#475569;">An administrator has requested a password reset for your ${orgConfig.fromName} account.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px 24px;">
          <p style="font-size:14px;color:#475569;margin:16px 0;">Click the button below to set a new password:</p>
          <a href="${recoveryLink}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">Reset Password</a>
          <p style="font-size:12px;color:#94a3b8;margin-top:16px;">This link will expire in 1 hour. If you did not request this, you can safely ignore this email.</p>
          <p style="font-size:11px;color:#cbd5e1;margin-top:12px;word-break:break-all;">Or copy this link: ${recoveryLink}</p>
        </td>
      </tr>
    </table>
    <p style="font-size:12px;color:#94a3b8;margin-top:12px;">If you did not request this, please contact your administrator.</p>
  </body>
</html>`;

  const text = `Reset Your Password

An administrator has requested a password reset for your ${orgConfig.fromName} account.

Click this link to set a new password: ${recoveryLink}

This link will expire in 1 hour. If you did not request this, you can safely ignore this email.`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${orgConfig.fromName} <${orgConfig.fromEmail}>`,
        to: [to],
        subject: `Reset Your Password - ${orgConfig.fromName}`,
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

    const body = (await req.json()) as ResetPasswordBody;

    if (!body?.user_id || !body?.email) {
      return new Response(JSON.stringify({ error: 'user_id and email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limit: 5 resets per target user per hour
    if (!checkRateLimit(`reset_${body.user_id}`)) {
      return new Response(JSON.stringify({ error: 'Too many password reset requests. Try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { role: requesterRole, userId: actorId, organizationId } = await getProfileRole(token);
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

    // Get per-org email config
    const orgConfig = organizationId
      ? await getOrgEmailConfig(organizationId)
      : { fromEmail: Deno.env.get('FROM_EMAIL') || FALLBACK_FROM_EMAIL, fromName: 'Double Helix Hub' };

    // Generate a recovery link (does NOT change the user's password)
    const recoveryLink = await generateRecoveryLink(body.email);

    // Send the recovery email via Resend
    const emailSent = await sendPasswordResetEmail(body.email, recoveryLink, orgConfig);

    await writeAudit(actorId || 'system', body.user_id, 'password_reset_sent', {
      email: body.email,
      email_sent: emailSent,
      method: 'recovery_link',
    });

    const hasResendKey = !!RESEND_API_KEY;

    if (!emailSent) {
      return new Response(
        JSON.stringify({
          success: false,
          email_sent: false,
          resend_configured: hasResendKey,
          message: 'Recovery link generated but email delivery failed. Please retry or configure RESEND_API_KEY.',
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: true,
        resend_configured: hasResendKey,
        message: 'Password reset email sent successfully',
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
