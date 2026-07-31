import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const createServiceRoleClient = vi.fn();

vi.mock('@crm-eco/lib/supabase/server', () => ({
  createServiceRoleClient: () => createServiceRoleClient(),
}));

import {
  computeDeviceHash,
  deviceSignalsFromHeaders,
  recordDeviceSighting,
} from './device';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

beforeEach(() => {
  createServiceRoleClient.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deviceSignalsFromHeaders', () => {
  it('collapses the coarse signals into a stable delimited string', () => {
    const signals = deviceSignalsFromHeaders(
      headers({
        'user-agent': CHROME_MAC,
        'accept-language': 'en-US,en;q=0.9',
        'sec-ch-ua-platform': '"macOS"',
        'sec-ch-ua-mobile': '?0',
      }),
    );

    expect(signals).toBe(`${CHROME_MAC}|en-US|"macOS"|?0`);
  });

  it('uses only the primary language so preference reordering is not a new device', () => {
    const a = deviceSignalsFromHeaders(
      headers({ 'user-agent': CHROME_MAC, 'accept-language': 'en-US,en;q=0.9,fr;q=0.8' }),
    );
    const b = deviceSignalsFromHeaders(
      headers({ 'user-agent': CHROME_MAC, 'accept-language': 'en-US,de;q=0.7' }),
    );

    expect(a).toBe(b);
  });

  it('excludes IP, so a rotating mobile address is not a new device', () => {
    const signals = deviceSignalsFromHeaders(
      headers({ 'user-agent': CHROME_MAC, 'x-forwarded-for': '203.0.113.9' }),
    );

    expect(signals).not.toContain('203.0.113.9');
  });

  it('tolerates a request with no device headers at all', () => {
    expect(deviceSignalsFromHeaders(headers({}))).toBe('|||');
  });
});

describe('computeDeviceHash', () => {
  it('is deterministic for identical signals and secret', async () => {
    const a = await computeDeviceHash('signals', 'secret');
    const b = await computeDeviceHash('signals', 'secret');

    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it('produces a 64-char hex SHA-256 digest', async () => {
    const hash = await computeDeviceHash('signals', 'secret');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs across devices and across deployment secrets', async () => {
    const deviceA = await computeDeviceHash('device-a', 'secret');
    const deviceB = await computeDeviceHash('device-b', 'secret');
    const otherSecret = await computeDeviceHash('device-a', 'other-secret');

    expect(deviceA).not.toBe(deviceB);
    // Keyed per deployment: the same device cannot be correlated across envs.
    expect(deviceA).not.toBe(otherSecret);
  });

  it('returns null when recognition is unavailable', async () => {
    expect(await computeDeviceHash('signals', null)).toBeNull();
    expect(await computeDeviceHash('', 'secret')).toBeNull();
  });

  it('never leaks the secret into the hash', async () => {
    const hash = await computeDeviceHash('signals', 'super-secret-value');
    expect(hash).not.toContain('super-secret');
  });
});

describe('recordDeviceSighting', () => {
  const requestHeaders = headers({
    'user-agent': CHROME_MAC,
    'accept-language': 'en-US,en;q=0.9',
  });

  function mockRpc(result: { data: unknown; error: { message: string } | null }) {
    const rpc = vi.fn().mockResolvedValue(result);
    createServiceRoleClient.mockReturnValue({ rpc });
    return rpc;
  }

  it('reports a first-time device', async () => {
    mockRpc({
      data: [{ is_new_device: true, trusted: false, revoked: false }],
      error: null,
    });

    const sighting = await recordDeviceSighting({
      userId: 'user-1',
      headers: requestHeaders,
      ip: '203.0.113.9',
    });

    expect(sighting.isNewDevice).toBe(true);
    expect(sighting.degraded).toBe(false);
    expect(sighting.deviceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reports a returning device and passes the sighting metadata through', async () => {
    const rpc = mockRpc({
      data: [{ is_new_device: false, trusted: true, revoked: false }],
      error: null,
    });

    const sighting = await recordDeviceSighting({
      userId: 'user-1',
      headers: requestHeaders,
      ip: '203.0.113.9',
    });

    expect(sighting.isNewDevice).toBe(false);
    expect(sighting.trusted).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      'touch_known_device',
      expect.objectContaining({ p_user_id: 'user-1', p_ip: '203.0.113.9' }),
    );
  });

  it('fails soft (never "new") when the datastore errors, so sign-in is not blocked', async () => {
    mockRpc({ data: null, error: { message: 'connection reset' } });

    const sighting = await recordDeviceSighting({
      userId: 'user-1',
      headers: requestHeaders,
    });

    expect(sighting.isNewDevice).toBe(false);
    expect(sighting.degraded).toBe(true);
  });

  it('never throws when the service-role client is unavailable', async () => {
    createServiceRoleClient.mockImplementation(() => {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    });

    const sighting = await recordDeviceSighting({
      userId: 'user-1',
      headers: requestHeaders,
    });

    expect(sighting.degraded).toBe(true);
    expect(sighting.isNewDevice).toBe(false);
  });
});
