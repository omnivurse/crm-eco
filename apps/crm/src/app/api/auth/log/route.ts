import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase-server';
import { logAuthEvent } from '@crm-eco/lib/audit';
import { getClientIp } from '@crm-eco/lib/security/captcha';
import { rateLimitDurable, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';
import { recordDeviceSighting } from '@/lib/security/device';

export const dynamic = 'force-dynamic';

// Actions that can be logged without authentication (pre-login events)
const UNAUTHENTICATED_ACTIONS = ['login_failed', 'password_reset'];

const VALID_ACTIONS = [
  'login_success',
  'login_failed',
  'logout',
  'password_reset',
  'mfa_enabled',
  'mfa_disabled',
] as const;

type AuthLogAction = (typeof VALID_ACTIONS)[number];

function isValidAction(value: string): value is AuthLogAction {
  return (VALID_ACTIONS as readonly string[]).includes(value);
}

// Window and ceilings are unchanged from the previous in-memory limiter; only
// the store moved (per-instance Map → Postgres), so a limit now survives cold
// starts, redeploys, and fan-out across instances.
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_AUTH = 10;
const RATE_LIMIT_MAX_UNAUTH = 5;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request) ?? 'unknown';

    let body: { action?: unknown; email?: unknown; details?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const action = typeof body.action === 'string' ? body.action : '';
    const email = typeof body.email === 'string' ? body.email : '';
    const details = (body.details ?? {}) as Record<string, unknown>;

    // Rate limit *before* validating the payload: otherwise a flood of
    // deliberately-invalid requests short-circuits to 400 without ever being
    // counted. Unrecognised actions get the stricter unauthenticated ceiling.
    const isUnauthAction =
      UNAUTHENTICATED_ACTIONS.includes(action) || !isValidAction(action);

    const decision = await rateLimitDurable(
      `${isUnauthAction ? 'auth-log-unauth' : 'auth-log'}:${ip}`,
      {
        limit: isUnauthAction ? RATE_LIMIT_MAX_UNAUTH : RATE_LIMIT_MAX_AUTH,
        windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
        // Fail open: this endpoint sits on the login path, so a database blip
        // must not stop people signing in. The in-memory fallback still applies
        // a per-instance limit in that window.
        failMode: 'open',
      },
    );

    if (!decision.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: getRateLimitHeaders(decision) },
      );
    }

    if (!isValidAction(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // For unauthenticated actions (login_failed, password_reset), skip auth check
    let userId: string | null = null;
    if (!UNAUTHENTICATED_ACTIONS.includes(action)) {
      const { user } = await getAuthUser();

      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      // Ensure the authenticated user matches the claimed email
      if (user.email !== email) {
        return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });
      }

      userId = user.id;
    }

    // Device recognition, recorded against the verified user only. Reported as
    // metadata on the existing auth event rather than a new event type, so no
    // auth_events constraint changes are required.
    let newDevice: boolean | undefined;
    if (action === 'login_success' && userId) {
      const sighting = await recordDeviceSighting({
        userId,
        headers: request.headers,
        ip,
      });
      if (!sighting.degraded) {
        newDevice = sighting.isNewDevice;
      }
    }

    const result = await logAuthEvent('crm', action, email, {
      ...details,
      ip_address: ip,
      source: 'crm_login_page',
      ...(newDevice === undefined ? {} : { new_device: newDevice }),
      ...(decision.degraded ? { rate_limit_degraded: true } : {}),
    });

    if (!result.success) {
      console.error('[Auth Log] Failed to log event:', result.error);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth Log] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
