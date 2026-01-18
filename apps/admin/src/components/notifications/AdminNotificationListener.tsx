'use client';

import { useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import { FileText, Bell, CheckCircle, AlertTriangle, Info } from 'lucide-react';

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

export function AdminNotificationListener({ userId }: AdminNotificationListenerProps) {
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Subscribe to new notifications for this user
    const channel = supabase
      .channel(`admin-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as Notification;

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
