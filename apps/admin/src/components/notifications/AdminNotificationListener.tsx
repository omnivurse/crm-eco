'use client';

import { Bell, CheckCircle, FileText, Info, Warning } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
interface Notification {
  id: string;
  title: string;
  body?: string;
  href?: string;
  icon?: string;
  type?: string;
  meta?: Record<string, unknown>;
}

interface AdminNotificationListenerProps {
  userId: string;
}

function getNotificationIcon(type?: string, icon?: string) {
  if (type === 'enrollment') {
    return <FileText weight="light" className="w-4 h-4 text-blue-500" />;
  }
  if (type === 'success') {
    return <CheckCircle weight="light" className="w-4 h-4 text-green-500" />;
  }
  if (type === 'warning') {
    return <Warning weight="light" className="w-4 h-4 text-amber-500" />;
  }
  if (icon === 'file-text') {
    return <FileText weight="light" className="w-4 h-4 text-blue-500" />;
  }
  return <Bell weight="light" className="w-4 h-4 text-slate-500" />;
}

export function AdminNotificationListener({ userId }: AdminNotificationListenerProps) {
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Subscribe via broadcast instead of postgres_changes
    // This eliminates WAL polling overhead
    // Channel name must match server-side: `admin-notifications:${userId}`
    const channel = supabase
      .channel(`admin-notifications:${userId}`)
      .on(
        'broadcast',
        { event: 'notification' },
        (payload: { payload: Notification }) => {
          const notification = payload.payload;

          // Show toast notification
          toast(notification.title, {
            description: notification.body,
            icon: getNotificationIcon(notification.type, notification.icon),
            duration: 8000,
            action: notification.href
              ? {
                  label: 'View',
                  onClick: () => {
                    window.location.href = notification.href!;
                  },
                }
              : undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // This component doesn't render anything visible
  return null;
}
