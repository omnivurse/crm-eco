/**
 * Device recognition for new-device MFA step-up and session forensics.
 *
 * The fingerprint is deliberately *coarse*: user-agent plus language and
 * platform hints, HMAC'd with a server-side secret. It is not a tracking
 * identifier — it never leaves the server, it is keyed per deployment, and it
 * cannot be correlated across users. Client IP is intentionally excluded
 * because mobile networks rotate addresses constantly, which would flag a
 * familiar phone as a new device several times a day.
 *
 * Recognition is best-effort by design: if hashing or the database is
 * unavailable we report "not new" and mark the result degraded rather than
 * blocking a legitimate sign-in.
 */

import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

export interface DeviceSighting {
  deviceHash: string | null;
  /** True only when this (user, device) pair had never been recorded before. */
  isNewDevice: boolean;
  /** Device was explicitly marked trusted by the user. */
  trusted: boolean;
  /** Device was explicitly revoked by the user or an admin. */
  revoked: boolean;
  /** True when hashing or the datastore failed and this verdict is a fallback. */
  degraded: boolean;
}

const UNKNOWN_DEVICE: DeviceSighting = {
  deviceHash: null,
  isNewDevice: false,
  trusted: false,
  revoked: false,
  degraded: true,
};

/**
 * Collapse a request's coarse device signals into a stable string.
 * Exported for tests so the stability contract is pinned.
 */
export function deviceSignalsFromHeaders(headers: Headers): string {
  const parts = [
    headers.get('user-agent') ?? '',
    // Only the primary language — the full ordered list is noisier and changes
    // when users toggle browser preferences.
    (headers.get('accept-language') ?? '').split(',')[0]?.trim() ?? '',
    headers.get('sec-ch-ua-platform') ?? '',
    headers.get('sec-ch-ua-mobile') ?? '',
  ];
  return parts.join('|');
}

function resolveDeviceSecret(): string | null {
  const secret =
    process.env.DEVICE_HASH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return secret.length > 0 ? secret : null;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * HMAC-SHA256 the device signals. Returns null when no secret is configured,
 * which callers treat as "recognition unavailable".
 */
export async function computeDeviceHash(
  signals: string,
  secret: string | null = resolveDeviceSecret(),
): Promise<string | null> {
  if (!secret || signals.length === 0) return null;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signals));
    return toHex(signature);
  } catch (err) {
    console.warn(
      '[device] failed to compute device hash:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

interface TouchKnownDeviceRow {
  is_new_device: boolean;
  trusted: boolean;
  revoked: boolean;
}

/**
 * Types for this RPC land only after the migration is applied and the generated
 * Database types are refreshed, so it is called through a narrow structural type.
 */
interface RpcCapableClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface RecordDeviceSightingInput {
  userId: string;
  headers: Headers;
  ip?: string | null;
}

/**
 * Record that a user was seen on a device, and report whether it is the first
 * time. Never throws.
 */
export async function recordDeviceSighting({
  userId,
  headers,
  ip = null,
}: RecordDeviceSightingInput): Promise<DeviceSighting> {
  const signals = deviceSignalsFromHeaders(headers);
  const deviceHash = await computeDeviceHash(signals);
  if (!deviceHash) return UNKNOWN_DEVICE;

  try {
    const client = createServiceRoleClient() as unknown as RpcCapableClient;
    const { data, error } = await client.rpc('touch_known_device', {
      p_user_id: userId,
      p_device_hash: deviceHash,
      p_user_agent: headers.get('user-agent'),
      p_ip: ip,
    });

    if (error) {
      console.warn('[device] touch_known_device failed:', error.message);
      return { ...UNKNOWN_DEVICE, deviceHash };
    }

    const row = Array.isArray(data)
      ? (data[0] as TouchKnownDeviceRow | undefined)
      : (data as TouchKnownDeviceRow | null);

    if (!row || typeof row.is_new_device !== 'boolean') {
      return { ...UNKNOWN_DEVICE, deviceHash };
    }

    return {
      deviceHash,
      isNewDevice: row.is_new_device,
      trusted: Boolean(row.trusted),
      revoked: Boolean(row.revoked),
      degraded: false,
    };
  } catch (err) {
    console.warn(
      '[device] device recognition unavailable:',
      err instanceof Error ? err.message : String(err),
    );
    return { ...UNKNOWN_DEVICE, deviceHash };
  }
}
