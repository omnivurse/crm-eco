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
import { Bell, User, LogOut, Settings, ChevronDown, Shield, FileText, CheckCircle, AlertTriangle, Check, ExternalLink, Activity, Menu, X, Wifi, WifiOff } from 'lucide-react';
import { ChangeTickerPopover } from '@crm-eco/ui/components/change-ticker';
import { useChangeFeed, useChangeSubscription } from '@crm-eco/shared/changes';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@crm-eco/ui/lib/utils';

interface Notification {
  id: string;
  title: string;
  body?: string;
  href?: string;
  icon?: string;
  type?: string;
  is_read: boolean;
  created_at: string;
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
}

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30',
  admin: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30',
  manager: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30',
  user: 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-500/30',
};

function getNotificationIcon(type?: string, icon?: string) {
  if (type === 'enrollment') {
    return <FileText className="w-4 h-4 text-blue-500" />;
  }
  if (type === 'success') {
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  }
  if (type === 'warning') {
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  }
  if (icon === 'file-text') {
    return <FileText className="w-4 h-4 text-blue-500" />;
  }
  return <Bell className="w-4 h-4 text-slate-500" />;
}

export function AdminTopNav({ profile, userId, mobileMenuOpen, onMobileMenuToggle }: AdminTopNavProps) {
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
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
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

  const handleMarkAsRead = async (notificationId: string) => {
    await supabase
      .from('admin_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    await supabase
      .from('admin_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.href) {
      router.push(notification.href);
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
    <header className="h-14 flex items-center px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 glass border-b border-slate-200 dark:border-white/5">
      {/* Left side - Mobile Menu + App Switcher + Title */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Mobile Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-10 w-10 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          onClick={onMobileMenuToggle}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>

        <AppSwitcher currentApp="admin" />
        <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />
        <div className="hidden md:flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#047474] dark:text-teal-400" />
          <span className="text-sm font-semibold text-[#003560] dark:text-white">System Administration</span>
        </div>
        
        {/* Live Status Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          {isOnline ? (
            <>
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Live</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <WifiOff className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Spacer to push actions right */}
      <div className="flex-1" />

      {/* Right side - actions and user menu */}
      <div className="flex items-center gap-1 lg:gap-2">
        {/* Change Feed Ticker - hidden on mobile */}
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
              router.push('/settings');
            } else if (event.requiresReview) {
              router.push('/ops');
            }
          }}
        />
        </div>

        {/* Notifications */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#047474] rounded-full ring-2 ring-white dark:ring-slate-900 text-[10px] font-bold text-white px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] rounded-xl shadow-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
            <DropdownMenuLabel className="px-4 py-3 flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">Notifications</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 px-2 text-xs text-[#047474] hover:text-[#047474] hover:bg-[#e1f3f3] dark:hover:bg-teal-500/10"
                  onClick={handleMarkAllAsRead}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
            <ScrollArea className="h-[320px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                  <Bell className="w-8 h-8 mb-2" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 cursor-pointer focus:bg-slate-50 dark:focus:bg-white/5',
                      !notification.is_read && 'bg-teal-50/50 dark:bg-teal-500/5'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type, notification.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm text-slate-900 dark:text-white truncate',
                        !notification.is_read && 'font-semibold'
                      )}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {notification.href && (
                      <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-1" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                <DropdownMenuItem
                  className="px-4 py-2.5 cursor-pointer text-center text-sm text-[#047474] dark:text-teal-400 font-medium hover:bg-teal-50 dark:hover:bg-teal-500/10 justify-center"
                  onClick={() => {
                    handleMarkAllAsRead();
                    setIsOpen(false);
                  }}
                >
                  Mark all as read
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings Gear */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:flex h-9 w-9 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
          onClick={() => router.push('/settings')}
        >
          <Settings className="w-4 h-4" />
        </Button>

        {/* User Menu - compact like CRM */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#047474] to-[#069B9A] flex items-center justify-center text-xs font-semibold text-white border border-teal-500/50">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900',
                  isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                )} />
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
            <DropdownMenuLabel className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#047474] to-[#069B9A] flex items-center justify-center text-sm font-semibold text-white border-2 border-teal-500/50 flex-shrink-0">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{profile.fullName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{profile.email}</p>
                </div>
              </div>
              <div className="mt-3">
                <Badge className={cn('text-[10px] px-2.5 py-1 font-semibold uppercase tracking-wider', roleColors[profile.role] || roleColors.user)} variant="secondary">
                  {profile.role === 'super_admin' ? 'Super Admin' : profile.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
            <DropdownMenuItem
              onClick={() => router.push('/settings')}
              className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2"
            >
              <Settings className="h-4 w-4 mr-3" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push('/profile')}
              className="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer py-2"
            >
              <User className="h-4 w-4 mr-3" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer py-2"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
