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
import { Bell, User, LogOut, Settings, ChevronDown, Shield, FileText, CheckCircle, AlertTriangle, Check, ExternalLink } from 'lucide-react';
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
  };
  userId: string;
}

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-[#e1f3f3] text-[#047474]',
  manager: 'bg-[#e0f1ea] text-[#027343]',
  user: 'bg-slate-100 text-slate-700',
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

export function AdminTopNav({ profile, userId }: AdminTopNavProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Create supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

    fetchNotifications();

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
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
      {/* Left side - App Switcher + Title */}
      <div className="flex items-center gap-4">
        <AppSwitcher currentApp="admin" />
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />
        <div className="hidden sm:flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#047474]" />
          <span className="text-sm font-semibold text-[#003560]">System Administration</span>
        </div>
      </div>

      {/* Right side - actions and user menu */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 rounded-xl">
              <Bell className="h-5 w-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#047474] rounded-full ring-2 ring-white text-[10px] font-bold text-white px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-xl shadow-lg border-slate-200">
            <DropdownMenuLabel className="px-4 py-3 flex items-center justify-between">
              <span className="font-semibold text-[#003560]">Notifications</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 px-2 text-xs text-[#047474] hover:text-[#047474] hover:bg-[#e1f3f3]"
                  onClick={handleMarkAllAsRead}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-[320px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Bell className="w-8 h-8 mb-2" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 cursor-pointer focus:bg-slate-50',
                      !notification.is_read && 'bg-[#e1f3f3]/50'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type, notification.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm text-[#003560] truncate',
                        !notification.is_read && 'font-semibold'
                      )}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {notification.href && (
                      <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0 mt-1" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="px-4 py-2.5 cursor-pointer text-center text-sm text-[#047474] font-medium hover:bg-[#e1f3f3] justify-center"
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

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 h-auto py-2 px-3 hover:bg-slate-50 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#047474] to-[#069B9A] flex items-center justify-center text-sm font-semibold text-white ring-2 ring-[#047474]/20">
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
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-[#003560]">{profile.fullName}</p>
                <p className="text-xs text-[#047474] capitalize font-medium">{profile.role}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-lg border-slate-200">
            <DropdownMenuLabel className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-[#003560]">{profile.fullName}</p>
                <Badge className={`${roleColors[profile.role] || roleColors.user} font-semibold`} variant="secondary">
                  {profile.role}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">{profile.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              <Settings className="h-4 w-4 mr-3 text-[#047474]" />
              <span className="font-medium">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/profile')} className="px-4 py-2.5 cursor-pointer hover:bg-slate-50">
              <User className="h-4 w-4 mr-3 text-[#047474]" />
              <span className="font-medium">Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="px-4 py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="h-4 w-4 mr-3" />
              <span className="font-medium">Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
