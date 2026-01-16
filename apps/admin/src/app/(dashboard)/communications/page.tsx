'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Mail,
  FileText,
  Send,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Eye,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';

interface EmailStats {
  totalSent: number;
  delivered: number;
  opened: number;
  failed: number;
  templatesCount: number;
}

interface RecentEmail {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  created_at: string;
}

export default function CommunicationsPage() {
  const [stats, setStats] = useState<EmailStats>({
    totalSent: 0,
    delivered: 0,
    opened: 0,
    failed: 0,
    templatesCount: 0,
  });
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string } | null };

    if (!profile) return;

    // Get email stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: emails } = await (supabase as any)
      .from('sent_emails')
      .select('status')
      .eq('organization_id', profile.organization_id)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { data: templates } = await (supabase as any)
      .from('email_templates')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true);

    if (emails) {
      const emailStats: EmailStats = {
        totalSent: emails.length,
        delivered: emails.filter((e: any) => ['delivered', 'opened', 'clicked'].includes(e.status)).length,
        opened: emails.filter((e: any) => ['opened', 'clicked'].includes(e.status)).length,
        failed: emails.filter((e: any) => ['failed', 'bounced'].includes(e.status)).length,
        templatesCount: templates?.length || 0,
      };
      setStats(emailStats);
    }

    // Get recent emails
    const { data: recent } = await (supabase as any)
      .from('sent_emails')
      .select('id, recipient_email, subject, status, created_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recent) {
      setRecentEmails(recent);
    }

    setLoading(false);
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'delivered':
      case 'opened':
      case 'clicked':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'failed':
      case 'bounced':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
      case 'queued':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <Send className="w-4 h-4 text-blue-500" />;
    }
  }

  function getOpenRate() {
    if (stats.delivered === 0) return '0%';
    return ((stats.opened / stats.delivered) * 100).toFixed(1) + '%';
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

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Communications</h1>
          <p className="text-slate-600 mt-1">
            Manage email templates and track sent communications
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/communications/templates">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </Button>
          </Link>
          <Link href="/communications/compose">
            <Button>
              <Mail className="w-4 h-4 mr-2" />
              Compose Email
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Sent (30d)</p>
                <p className="text-2xl font-bold">{stats.totalSent}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Delivered</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.delivered}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Open Rate</p>
                <p className="text-2xl font-bold text-purple-600">{getOpenRate()}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Templates</p>
                <p className="text-2xl font-bold text-amber-600">{stats.templatesCount}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/communications/templates">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">Email Templates</p>
                <p className="text-sm text-slate-500">Create and manage templates</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/communications/history">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Mail className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold">Email History</p>
                <p className="text-sm text-slate-500">View sent emails and status</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/communications/compose">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Send className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">Send Email</p>
                <p className="text-sm text-slate-500">Compose and send an email</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Emails */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Emails</CardTitle>
              <CardDescription>Last 10 sent emails</CardDescription>
            </div>
            <Link href="/communications/history">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentEmails.length === 0 ? (
            <p className="text-center py-8 text-slate-500">No emails sent yet</p>
          ) : (
            <div className="space-y-3">
              {recentEmails.map((email) => (
                <div
                  key={email.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(email.status)}
                    <div>
                      <p className="font-medium text-slate-900">{email.subject}</p>
                      <p className="text-sm text-slate-500">{email.recipient_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded ${
                      email.status === 'delivered' || email.status === 'opened' 
                        ? 'bg-emerald-100 text-emerald-700'
                        : email.status === 'failed' || email.status === 'bounced'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {email.status}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(email.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
