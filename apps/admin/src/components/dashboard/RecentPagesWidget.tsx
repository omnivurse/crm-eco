'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import {
  Users,
  UserCheck,
  FileText,
  Package,
  DollarSign,
  Mail,
  BarChart3,
  Settings,
  Building2,
  Link2,
  Clock,
  History,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface PageVisit {
  id: string;
  page_path: string;
  page_title: string | null;
  page_icon: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  visited_at: string;
}

interface RecentPagesWidgetProps {
  profileId: string;
  organizationId: string;
}

// Icon mapping for page types
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  UserCheck,
  FileText,
  Package,
  DollarSign,
  Mail,
  BarChart3,
  Settings,
  Building2,
  Link2,
};

// Determine icon based on path
function getIconForPath(path: string, iconName?: string | null): React.ReactNode {
  if (iconName && iconMap[iconName]) {
    const Icon = iconMap[iconName];
    return <Icon className="w-4 h-4" />;
  }

  if (path.includes('/members')) return <Users className="w-4 h-4" />;
  if (path.includes('/agents')) return <UserCheck className="w-4 h-4" />;
  if (path.includes('/enrollments')) return <FileText className="w-4 h-4" />;
  if (path.includes('/products')) return <Package className="w-4 h-4" />;
  if (path.includes('/billing') || path.includes('/commissions')) return <DollarSign className="w-4 h-4" />;
  if (path.includes('/communications')) return <Mail className="w-4 h-4" />;
  if (path.includes('/reports') || path.includes('/analytics')) return <BarChart3 className="w-4 h-4" />;
  if (path.includes('/settings')) return <Settings className="w-4 h-4" />;
  if (path.includes('/vendors')) return <Building2 className="w-4 h-4" />;
  if (path.includes('/enrollment-links')) return <Link2 className="w-4 h-4" />;

  return <FileText className="w-4 h-4" />;
}

// Generate title from path
function getTitleFromPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';

  // Handle specific patterns
  if (segments[segments.length - 1] === 'new') {
    const parent = segments[segments.length - 2];
    return `New ${parent?.slice(0, -1) || 'Item'}`;
  }

  // Check if last segment is a UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    segments[segments.length - 1]
  );

  if (isUuid && segments.length >= 2) {
    const parent = segments[segments.length - 2];
    return `${parent.charAt(0).toUpperCase() + parent.slice(1, -1)} Details`;
  }

  const lastSegment = segments[segments.length - 1];
  return lastSegment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function RecentPagesWidget({ profileId, organizationId }: RecentPagesWidgetProps) {
  const [visits, setVisits] = useState<PageVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const supabase = createClient();

  // Fetch recent visits
  const fetchVisits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('recent_page_visits')
        .select('*')
        .eq('profile_id', profileId)
        .order('visited_at', { ascending: false })
        .limit(8);

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
          setVisits([]);
          return;
        }
        throw error;
      }
      setVisits(data || []);
    } catch (error) {
      console.error('Error fetching page visits:', error);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, profileId]);

  // Track current page visit
  const trackVisit = useCallback(async () => {
    // Don't track dashboard itself
    if (pathname === '/dashboard' || pathname === '/') return;
    // Don't track API routes
    if (pathname.startsWith('/api/')) return;

    try {
      const title = getTitleFromPath(pathname);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('recent_page_visits').upsert(
        {
          profile_id: profileId,
          organization_id: organizationId,
          page_path: pathname,
          page_title: title,
          visited_at: new Date().toISOString(),
        },
        {
          onConflict: 'profile_id,page_path',
        }
      );

      // Refetch to update the list
      fetchVisits();
    } catch (error) {
      // Silently fail - tracking is not critical
      console.error('Error tracking page visit:', error);
    }
  }, [pathname, profileId, organizationId, supabase, fetchVisits]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  useEffect(() => {
    // Track visit after a short delay to avoid tracking rapid navigations
    const timer = setTimeout(() => {
      trackVisit();
    }, 1000);

    return () => clearTimeout(timer);
  }, [trackVisit]);

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />

      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500">
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">Recently Visited</CardTitle>
            <p className="text-sm text-slate-500">Quick access to recent pages</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : visits.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 rounded-2xl flex items-center justify-center">
              <Clock className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-medium text-slate-600 mb-1">No recent pages</p>
            <p className="text-sm text-slate-400">Your navigation history will appear here</p>
          </div>
        ) : (
          <div className="space-y-1">
            {visits.map((visit) => (
              <Link
                key={visit.id}
                href={visit.page_path}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-teal-100 group-hover:text-teal-600 transition-colors">
                  {getIconForPath(visit.page_path, visit.page_icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {visit.entity_name || visit.page_title || getTitleFromPath(visit.page_path)}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {visit.page_path}
                  </p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {formatDistanceToNow(new Date(visit.visited_at), { addSuffix: true })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
