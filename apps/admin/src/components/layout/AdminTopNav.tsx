'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AppSwitcher,
  Badge,
  ScrollArea,
} from '@crm-eco/ui';
import {
  Bell,
  User,
  SignOut,
  GearSix,
  CaretDown,
  ShieldCheck,
  FileText,
  CheckCircle,
  Warning,
  Check,
  ArrowSquareOut,
  List,
  X,
  WifiHigh,
  WifiSlash,
  ArrowUpRight,
} from '@phosphor-icons/react';
import { ChangeTickerPopover } from '@crm-eco/ui/components/change-ticker';
import { useChangeFeed, useChangeSubscription } from '@crm-eco/shared/changes';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@crm-eco/ui/lib/utils';
import { OrganizationSwitcher, type SwitcherTenant } from './OrganizationSwitcher';
import { ThemeToggle } from './ThemeToggle';
import Link from 'next/link';

interface Notification {
  id: string;
  title: string;
  /** Mapped from DB `message` for display. */
  body?: string;
  message?: string;
  href?: string;
  icon?: string;
  type?: string;
  is_read: boolean;
  created_at: string;
  meta?: { href?: string; ticket_id?: string; member_id?: string } | Record<string, unknown> | null;
}

function resolveNotificationHref(n: Notification): string | undefined {
  if (typeof n.href === 'string' && n.href) return n.href;
  const metaHref = n.meta && typeof n.meta === 'object' ? (n.meta as { href?: unknown }).href : undefined;
  return typeof metaHref === 'string' && metaHref ? metaHref : undefined;
}

interface AdminTopNavProps {
  profile: {
    fullName: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
    organizationId: string;
  };
  userId: string;
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
  /** Optional list of tenants the user belongs to (drives the OrganizationSwitcher). */
  tenants?: SwitcherTenant[];
  /** Active organization id for the switcher. Defaults to profile.organizationId. */
  activeTenantId?: string;
}

const roleColors: Record<string, string> = {
  super_admin: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30',
  admin: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30',
  manager: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30',
  user: 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10',
};

function getNotificationIcon(type?: string, icon?: string) {
  if (type === 'enrollment') {
    return <FileText weight="light" className="h-4 w-4 text-[var(--adm-cyan)]" />;
  }
  if (type === 'success') {
    return <CheckCircle weight="light" className="h-4 w-4 text-[var(--adm-emerald)]" />;
  }
  if (type === 'warning') {
    return <Warning weight="light" className="h-4 w-4 text-[var(--adm-amber)]" />;
  }
  if (icon === 'file-text') {
    return <FileText weight="light" className="h-4 w-4 text-[var(--adm-cyan)]" />;
  }
  return <Bell weight="light" className="h-4 w-4 text-[var(--adm-muted)]" />;
}

export function AdminTopNav({
  profile,
  userId,
  mobileMenuOpen,
  onMobileMenuToggle,
  tenants,
  activeTenantId,
}: AdminTopNavProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    queueMicrotask(() => setIsOnline(navigator.onLine));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Create supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Change feed for ticker (admin sees all changes)
  const changeFeed = useChangeFeed({
    orgId: profile.organizationId,
    minSeverity: 'low',
    maxEvents: 30,
    realtime: true,
  });

  // Subscribe to Supabase realtime for change events
  useChangeSubscription(supabase, profile.organizationId);

  // Convert change feed events to ticker format
  const tickerEvents = changeFeed.events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description || undefined,
    severity: event.severity,
    entityType: event.entity_type,
    entityTitle: event.entity_title || undefined,
    actorName: event.actor_full_name || undefined,
    sourceName: event.source_name || undefined,
    sourceType: event.source_type,
    requiresReview: event.requires_review,
    syncStatus: event.sync_status,
    createdAt: event.created_at,
  }));

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('admin_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      const mapped: Notification[] = data.map((n) => {
        const meta = (n as { meta?: Notification['meta'] }).meta ?? null;
        const href = resolveNotificationHref({
          ...(n as Notification),
          meta,
        });
        return {
          ...(n as Notification),
          meta,
          href,
          body: (n as { message?: string }).message ?? (n as Notification).body,
        };
      });
      setNotifications(mapped);
      setUnreadCount(mapped.filter((n) => !n.is_read).length);
    }
  }, [userId, supabase]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    queueMicrotask(() => fetchNotifications());

    const channel = supabase
      .channel(`admin-notifications-nav-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, fetchNotifications]);

  // admin_notifications has no `read_at` column — only `is_read` (boolean).
  const handleMarkAsRead = async (notificationId: string) => {
    await supabase
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    await supabase
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    const href = resolveNotificationHref(notification);
    if (href) {
      router.push(href);
    }
    setIsOpen(false);
  };

  const handleSignOut = async () => {
    // Log logout event before signing out
    try {
      await fetch('/api/auth/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout', email: profile.email }),
      });
    } catch (err) {
      console.error('Failed to log logout:', err);
    }
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = profile.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="adm-cmd sticky top-0 z-40 w-full">
      <div className="flex min-w-0 items-center gap-2 lg:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full text-[var(--adm-muted)] hover:bg-[rgba(11,109,133,0.08)] hover:text-[var(--adm-ink)] lg:hidden"
          onClick={onMobileMenuToggle}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X weight="light" className="h-5 w-5" /> : <List weight="light" className="h-5 w-5" />}
        </Button>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="text-[0.9rem] font-bold tracking-tight text-[var(--adm-ink)]">
            Command
            <em className="ml-1.5 not-italic text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-[var(--adm-cyan)]">
              Live
            </em>
          </span>
        </div>

        <AppSwitcher currentApp="admin" />

        {tenants && tenants.length > 1 ? (
          <OrganizationSwitcher
            tenants={tenants}
            activeTenantId={activeTenantId ?? profile.organizationId}
            compact
          />
        ) : null}

        <div className="hidden items-center gap-1.5 md:flex">
          <ShieldCheck weight="light" className="h-4 w-4 text-[var(--adm-cyan)]" />
          <span className="text-sm font-semibold text-[var(--adm-ink)]">Admin</span>
        </div>

        <div className="hidden items-center gap-1.5 rounded-full border border-[var(--adm-hairline)] bg-[rgba(11,109,133,0.04)] px-2.5 py-1 lg:flex dark:bg-white/5">
          {isOnline ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <WifiHigh weight="light" className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Live</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <WifiSlash weight="light" className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400">Offline</span>
            </>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1 lg:gap-1.5">
        <div className="hidden md:block">
          <ChangeTickerPopover
            events={tickerEvents}
            isPaused={changeFeed.isPaused}
            newEventCount={changeFeed.newEventCount}
            isLoading={changeFeed.isLoading}
            syncStatus={tickerEvents.length === 0 ? 'synced' : 'pending'}
            showSyncStatus={true}
            onPause={changeFeed.pause}
            onResume={changeFeed.resume}
            onClear={changeFeed.clear}
            onRefresh={changeFeed.refresh}
            onEventClick={(event) => {
              if (event.entityType === 'enrollment') {
                router.push('/enrollments');
              } else if (event.entityType === 'member') {
                router.push('/members');
              } else if (event.entityType === 'organization') {
                router.push('/organizations');
              } else if (event.requiresReview) {
                router.push('/changes/review');
              }
            }}
          />
        </div>

        <ThemeToggle />

        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Notifications"
              className="relative h-9 w-9 rounded-full text-[var(--adm-muted)] hover:bg-[rgba(11,109,133,0.08)] hover:text-[var(--adm-ink)]"
            >
              <Bell weight="light" className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--adm-rose)] px-1 text-[10px] font-bold text-white ring-2 ring-[var(--adm-panel)]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border-[var(--adm-hairline)] bg-[var(--adm-panel)] shadow-lg"
          >
            <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
              <span className="font-semibold text-[var(--adm-ink)]">Notifications</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs text-[var(--adm-cyan)] hover:bg-[rgba(11,109,133,0.08)]"
                  onClick={handleMarkAllAsRead}
                >
                  <Check weight="light" className="mr-1 h-3 w-3" />
                  Mark all read
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[var(--adm-hairline)]" />
            <ScrollArea className="h-[320px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--adm-muted)]">
                  <Bell weight="light" className="mb-2 h-8 w-8" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 px-4 py-3 focus:bg-[rgba(11,109,133,0.06)]',
                      !notification.is_read && 'bg-[rgba(11,109,133,0.05)]',
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {getNotificationIcon(notification.type, notification.icon)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-sm text-[var(--adm-ink)]',
                          !notification.is_read && 'font-semibold',
                        )}
                      >
                        {notification.title}
                      </p>
                      {(notification.body || notification.message) && (
                        <p className="mt-0.5 truncate text-xs text-[var(--adm-muted)]">
                          {notification.body || notification.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-[var(--adm-muted)]">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {resolveNotificationHref(notification) && (
                      <ArrowSquareOut weight="light" className="mt-1 h-3 w-3 flex-shrink-0 text-[var(--adm-muted)]" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator className="bg-[var(--adm-hairline)]" />
                <DropdownMenuItem
                  className="cursor-pointer justify-center px-4 py-2.5 text-center text-sm font-medium text-[var(--adm-cyan)] hover:bg-[rgba(11,109,133,0.08)]"
                  onClick={() => {
                    router.push('/notifications');
                    setIsOpen(false);
                  }}
                >
                  View all notifications
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          title="Settings"
          className="hidden h-9 w-9 rounded-full text-[var(--adm-muted)] hover:bg-[rgba(11,109,133,0.08)] hover:text-[var(--adm-ink)] sm:flex"
          onClick={() => router.push('/settings')}
        >
          <GearSix weight="light" className="h-4 w-4" />
        </Button>

        <Link href="/members/new" className="adm-btn-island hidden sm:inline-flex">
          New member
          <span className="adm-btn-ico">
            <ArrowUpRight weight="light" className="h-3.5 w-3.5" />
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-9 items-center gap-2 rounded-full px-2 hover:bg-[rgba(11,109,133,0.08)]"
            >
              <div className="relative">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--adm-cyan)] to-[var(--adm-teal)] text-xs font-semibold text-white">
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--adm-panel)]',
                    isOnline ? 'bg-emerald-500' : 'bg-slate-400',
                  )}
                />
              </div>
              <CaretDown weight="light" className="hidden h-3 w-3 text-[var(--adm-muted)] sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 rounded-2xl border-[var(--adm-hairline)] bg-[var(--adm-panel)]"
          >
            <DropdownMenuLabel className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--adm-cyan)] to-[var(--adm-teal)] text-sm font-semibold text-white">
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--adm-ink)]">{profile.fullName}</p>
                  <p className="truncate text-xs text-[var(--adm-muted)]">{profile.email}</p>
                </div>
              </div>
              <div className="mt-3">
                <Badge
                  className={cn(
                    'px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
                    roleColors[profile.role] || roleColors.user,
                  )}
                  variant="secondary"
                >
                  {profile.role === 'super_admin' ? 'Super Admin' : profile.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[var(--adm-hairline)]" />
            <DropdownMenuItem
              onClick={() => router.push('/settings')}
              className="cursor-pointer py-2 text-[var(--adm-ink)]"
            >
              <GearSix weight="light" className="mr-3 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push('/profile')}
              className="cursor-pointer py-2 text-[var(--adm-ink)]"
            >
              <User weight="light" className="mr-3 h-4 w-4" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[var(--adm-hairline)]" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer py-2 text-red-600 dark:text-red-400"
            >
              <SignOut weight="light" className="mr-3 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
