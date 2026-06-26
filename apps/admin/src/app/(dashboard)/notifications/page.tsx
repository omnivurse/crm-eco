import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import {
  Bell,
  FileText,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';
import { PageHeader } from '@/components/ui/PageHeader';

const PAGE_SIZE = 25;

interface NotificationRow {
  id: string;
  title: string | null;
  message: string;
  type: string | null;
  is_read: boolean | null;
  created_at: string;
}

async function getNotifications(page: number) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { notifications: [] as NotificationRow[], total: 0, unread: 0 };

  const tenant = await getActiveTenant();
  if (!tenant) return { notifications: [] as NotificationRow[], total: 0, unread: 0 };

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Mirrors the AdminTopNav dropdown source: admin_notifications scoped to the
  // current user, additionally constrained to the active organization.
  const { data: notifications, count } = await (supabase
    .from('admin_notifications')
    .select('id, title, message, type, is_read, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('organization_id', tenant.organizationId)
    .order('created_at', { ascending: false })
    .range(from, to) as any);

  const { count: unread } = await (supabase
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('organization_id', tenant.organizationId)
    .eq('is_read', false) as any);

  return {
    notifications: (notifications ?? []) as NotificationRow[],
    total: count ?? 0,
    unread: unread ?? 0,
  };
}

function NotificationIcon({ type }: { type: string | null }) {
  if (type === 'enrollment') {
    return <FileText className="w-4 h-4 text-blue-500" />;
  }
  if (type === 'success') {
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  }
  if (type === 'warning') {
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  }
  return <Bell className="w-4 h-4 text-slate-500" />;
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const { notifications, total, unread } = await getNotifications(page);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildPageUrl = (p: number) => `/notifications?page=${p}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Notifications"
        description="All notifications and alerts for your account"
        icon={<Bell className="w-6 h-6" />}
        gradient="from-[#0891b2] to-[#06b6d4]"
      />

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
          <CardDescription>
            {total.toLocaleString()} total
            {unread > 0 ? ` · ${unread.toLocaleString()} unread` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
              <Bell className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                No notifications yet
              </p>
              <p className="text-xs mt-1">
                You&apos;re all caught up — new notifications will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-white/10">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={
                    'flex items-start gap-3 py-4 px-1' +
                    (!notification.is_read
                      ? ' bg-teal-50/40 dark:bg-teal-500/5 rounded-lg'
                      : '')
                  }
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <NotificationIcon type={notification.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={
                          'text-sm text-slate-900 dark:text-white' +
                          (!notification.is_read ? ' font-semibold' : '')
                        }
                      >
                        {notification.title || 'Notification'}
                      </p>
                      {!notification.is_read && (
                        <span className="inline-block w-2 h-2 rounded-full bg-[#0891b2] flex-shrink-0" />
                      )}
                    </div>
                    {notification.message && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1} to{' '}
            {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
              {page > 1 ? (
                <Link href={buildPageUrl(page - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Link>
              ) : (
                <span>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </span>
              )}
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              asChild={page < totalPages}
            >
              {page < totalPages ? (
                <Link href={buildPageUrl(page + 1)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              ) : (
                <span>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
