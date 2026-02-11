import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

const mockGetNotifications = vi.fn();
const mockGetUnreadNotificationCount = vi.fn();
const mockMarkNotificationRead = vi.fn();
const mockMarkAllNotificationsRead = vi.fn();

vi.mock('@/lib/automation', () => ({
  getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
  getUnreadNotificationCount: (...args: unknown[]) => mockGetUnreadNotificationCount(...args),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
  markAllNotificationsRead: (...args: unknown[]) => mockMarkAllNotificationsRead(...args),
}));

import { GET, PATCH } from './route';

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost:3000/api/notifications');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has no CRM role', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: null as any }));
    const req = buildRequest('http://localhost:3000/api/notifications');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns count only when countOnly=true', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    mockGetUnreadNotificationCount.mockResolvedValue(5);
    const req = buildRequest('http://localhost:3000/api/notifications?countOnly=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(5);
    expect(mockGetUnreadNotificationCount).toHaveBeenCalledWith('profile-1');
  });

  it('returns all notifications by default', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    const notifications = [{ id: 'n-1', title: 'Test' }];
    mockGetNotifications.mockResolvedValue(notifications);
    const req = buildRequest('http://localhost:3000/api/notifications');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(notifications);
    expect(mockGetNotifications).toHaveBeenCalledWith('profile-1', false);
  });

  it('returns unread only when unreadOnly=true', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    mockGetNotifications.mockResolvedValue([]);
    const req = buildRequest('http://localhost:3000/api/notifications?unreadOnly=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetNotifications).toHaveBeenCalledWith('profile-1', true);
  });

  it('returns 500 on error', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    mockGetNotifications.mockRejectedValue(new Error('DB error'));
    const req = buildRequest('http://localhost:3000/api/notifications');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost:3000/api/notifications', {
      method: 'PATCH',
      body: { markAllRead: true },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('marks all read when markAllRead=true', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    mockMarkAllNotificationsRead.mockResolvedValue(undefined);
    const req = buildRequest('http://localhost:3000/api/notifications', {
      method: 'PATCH',
      body: { markAllRead: true },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith('profile-1');
  });

  it('marks single notification read', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    mockMarkNotificationRead.mockResolvedValue(undefined);
    const req = buildRequest('http://localhost:3000/api/notifications', {
      method: 'PATCH',
      body: { notificationId: 'notif-1' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mockMarkNotificationRead).toHaveBeenCalledWith('notif-1');
  });

  it('returns 500 on error', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    mockMarkAllNotificationsRead.mockRejectedValue(new Error('DB error'));
    const req = buildRequest('http://localhost:3000/api/notifications', {
      method: 'PATCH',
      body: { markAllRead: true },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(500);
  });
});
