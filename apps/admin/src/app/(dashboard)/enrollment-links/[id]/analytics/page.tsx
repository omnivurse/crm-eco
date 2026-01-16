'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  ArrowLeft,
  Eye,
  Users,
  TrendingUp,
  Clock,
  Globe,
  Smartphone,
  Monitor,
  Calendar,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';

interface LandingPage {
  id: string;
  name: string;
  slug: string;
  views: number;
  submissions: number;
  created_at: string;
}

interface Event {
  id: string;
  event_type: string;
  created_at: string;
  device_type: string | null;
  referrer: string | null;
}

interface DailyStats {
  date: string;
  views: number;
  submissions: number;
}

export default function LandingPageAnalyticsPage() {
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  
  const [landingPage, setLandingPage] = useState<LandingPage | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [dateRange, setDateRange] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id, dateRange]);

  async function loadData() {
    setLoading(true);

    // Load landing page
    const { data: page } = await (supabase as any)
      .from('landing_pages')
      .select('*')
      .eq('id', id)
      .single();

    if (page) {
      setLandingPage(page);
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (dateRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    // Load events
    const { data: eventsData } = await (supabase as any)
      .from('landing_page_events')
      .select('*')
      .eq('landing_page_id', id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (eventsData) {
      setEvents(eventsData);
      
      // Calculate daily stats
      const statsByDate: Record<string, DailyStats> = {};
      
      // Initialize all dates in range
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        statsByDate[dateStr] = { date: dateStr, views: 0, submissions: 0 };
      }
      
      // Count events by date
      eventsData.forEach((event: Event) => {
        const dateStr = new Date(event.created_at).toISOString().split('T')[0];
        if (statsByDate[dateStr]) {
          if (event.event_type === 'view') {
            statsByDate[dateStr].views++;
          } else if (event.event_type === 'submit' || event.event_type === 'enrollment_created') {
            statsByDate[dateStr].submissions++;
          }
        }
      });
      
      setDailyStats(Object.values(statsByDate).sort((a, b) => a.date.localeCompare(b.date)));
    }

    setLoading(false);
  }

  function getConversionRate() {
    if (!landingPage || landingPage.views === 0) return '0%';
    return ((landingPage.submissions / landingPage.views) * 100).toFixed(1) + '%';
  }

  function getDeviceStats() {
    const devices: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
    events.forEach(e => {
      const device = e.device_type?.toLowerCase() || 'unknown';
      devices[device] = (devices[device] || 0) + 1;
    });
    return devices;
  }

  function getTopReferrers() {
    const referrers: Record<string, number> = {};
    events.forEach(e => {
      if (e.referrer) {
        try {
          const url = new URL(e.referrer);
          const domain = url.hostname;
          referrers[domain] = (referrers[domain] || 0) + 1;
        } catch {
          referrers['direct'] = (referrers['direct'] || 0) + 1;
        }
      } else {
        referrers['direct'] = (referrers['direct'] || 0) + 1;
      }
    });
    return Object.entries(referrers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!landingPage) {
    return <div className="p-8">Landing page not found</div>;
  }

  const deviceStats = getDeviceStats();
  const topReferrers = getTopReferrers();

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/enrollment-links/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics: {landingPage.name}</h1>
            <p className="text-slate-600">/enroll/{landingPage.slug}</p>
          </div>
        </div>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-40">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Views</p>
                <p className="text-2xl font-bold">{landingPage.views.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Submissions</p>
                <p className="text-2xl font-bold text-emerald-600">{landingPage.submissions}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-amber-600">{getConversionRate()}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Avg. Daily Views</p>
                <p className="text-2xl font-bold">
                  {dailyStats.length > 0
                    ? Math.round(dailyStats.reduce((sum, d) => sum + d.views, 0) / dailyStats.length)
                    : 0}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Daily Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Views & Submissions Over Time</CardTitle>
            <CardDescription>Daily breakdown of page performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end gap-1">
              {dailyStats.map((day, idx) => {
                const maxViews = Math.max(...dailyStats.map(d => d.views), 1);
                const viewHeight = (day.views / maxViews) * 100;
                const subHeight = (day.submissions / maxViews) * 100;
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '200px' }}>
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all"
                        style={{ height: `${viewHeight}%` }}
                        title={`${day.views} views`}
                      />
                      <div
                        className="w-full bg-emerald-500 rounded-t transition-all"
                        style={{ height: `${subHeight}%` }}
                        title={`${day.submissions} submissions`}
                      />
                    </div>
                    {idx % Math.ceil(dailyStats.length / 7) === 0 && (
                      <span className="text-xs text-slate-500 rotate-45 origin-left whitespace-nowrap">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-sm text-slate-600">Views</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded" />
                <span className="text-sm text-slate-600">Submissions</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Device Breakdown</CardTitle>
            <CardDescription>How visitors access your page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-slate-500" />
                <span>Desktop</span>
              </div>
              <span className="font-medium">{deviceStats.desktop}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-500" />
                <span>Mobile</span>
              </div>
              <span className="font-medium">{deviceStats.mobile}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-500" />
                <span>Other</span>
              </div>
              <span className="font-medium">{deviceStats.tablet + deviceStats.unknown}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Referrers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Referrers</CardTitle>
          <CardDescription>Where your visitors come from</CardDescription>
        </CardHeader>
        <CardContent>
          {topReferrers.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No referrer data available</p>
          ) : (
            <div className="space-y-3">
              {topReferrers.map(([domain, count], idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span>{domain === 'direct' ? 'Direct / No Referrer' : domain}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(count / topReferrers[0][1]) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest events on this landing page</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No events recorded yet</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 10).map((event) => (
                <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      event.event_type === 'submit' || event.event_type === 'enrollment_created'
                        ? 'bg-emerald-500'
                        : 'bg-blue-500'
                    }`} />
                    <span className="capitalize">{event.event_type.replace('_', ' ')}</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
