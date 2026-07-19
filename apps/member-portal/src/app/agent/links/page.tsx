'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Link as LinkIcon,
  Copy,
  Check,
  ArrowSquareOut,
  QrCode,
  TrendUp,
  Users,
  Cursor,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';

interface LinkStats {
  totalVisits: number;
  totalConversions: number;
  conversionRate: number;
}

export default function AgentLinksPage() {
  const [enrollmentCode, setEnrollmentCode] = useState<string | null>(null);
  const [enrollmentLink, setEnrollmentLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LinkStats>({
    totalVisits: 0,
    totalConversions: 0,
    conversionRate: 0,
  });
  
  const supabase = createClient();

  const fetchAgentData = useCallback(async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile first
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single() as { data: { id: string } | null };

    if (!profile) return;

    // Get advisor using profile_id
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id, enrollment_code, organization_id')
      .eq('profile_id', profile.id)
      .single() as { data: { id: string; enrollment_code: string | null; organization_id: string } | null };

    if (advisor?.enrollment_code) {
      setEnrollmentCode(advisor.enrollment_code);
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      setEnrollmentLink(`${baseUrl}/enroll/${advisor.enrollment_code}`);

      // Try to get link stats. landing_page_events has no advisor_id —
      // filter via the landing pages owned by this advisor's organization
      // and (best-effort) created by them.
      try {
        const { data: events } = await (supabase as any)
          .from('landing_page_events')
          .select('event_type, landing_page:landing_pages!inner(organization_id)')
          .eq('landing_page.organization_id', advisor.organization_id);

        if (events) {
          const visits = events.filter((e: any) => e.event_type === 'view').length;
          const conversions = events.filter((e: any) => e.event_type === 'conversion').length;
          setStats({
            totalVisits: visits,
            totalConversions: conversions,
            conversionRate: visits > 0 ? (conversions / visits) * 100 : 0,
          });
        }
      } catch {
        // Landing page events table may not exist
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => fetchAgentData());
  }, [fetchAgentData]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(enrollmentLink);
    setCopied(true);
    toast.success('Enrollment link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const generateQRCode = () => {
    // Open QR code in new tab using a QR code generator
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(enrollmentLink)}`;
    window.open(qrUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LinkIcon weight="light" className="h-12 w-12 animate-pulse text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Enrollment Links</h1>
      </div>

      {/* Main Enrollment Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon weight="light" className="h-5 w-5" />
            Your Enrollment Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={enrollmentLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button onClick={copyLink} className="gap-2 shrink-0">
              {copied ? (
                <>
                  <Check weight="light" className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy weight="light" className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(enrollmentLink, '_blank')} className="gap-2">
              <ArrowSquareOut weight="light" className="h-4 w-4" />
              Preview Page
            </Button>
            <Button variant="outline" onClick={generateQRCode} className="gap-2">
              <QrCode weight="light" className="h-4 w-4" />
              Generate QR Code
            </Button>
          </div>

          <div className="p-4 bg-[rgba(11,109,133,0.06)] rounded-lg border border-[rgba(11,109,133,0.12)]">
            <p className="text-sm text-[#0a5568]">
              <strong>Tip:</strong> Share this link with potential members. When they enroll through your link, 
              they'll be automatically assigned to you and you'll earn commissions on their enrollment.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Link Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Visits</p>
                <p className="text-2xl font-bold">{stats.totalVisits}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[rgba(11,109,133,0.1)] flex items-center justify-center">
                <Cursor weight="light" className="h-5 w-5 text-[var(--mp-teal)]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Conversions</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalConversions}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Users weight="light" className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Conversion Rate</p>
                <p className="text-2xl font-bold text-[var(--mp-teal)]">
                  {stats.conversionRate.toFixed(1)}%
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[rgba(11,109,133,0.1)] flex items-center justify-center">
                <TrendUp weight="light" className="h-5 w-5 text-[var(--mp-teal)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* UTM Link Builder */}
      <Card>
        <CardHeader>
          <CardTitle>Marketing Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 mb-4">
            Add UTM parameters to track where your enrollments are coming from.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-slate-900 mb-2">Facebook</h4>
              <code className="text-xs bg-slate-100 p-2 rounded block overflow-x-auto">
                {enrollmentLink}?utm_source=facebook&utm_medium=social
              </code>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-slate-900 mb-2">Email Campaign</h4>
              <code className="text-xs bg-slate-100 p-2 rounded block overflow-x-auto">
                {enrollmentLink}?utm_source=email&utm_medium=newsletter
              </code>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-slate-900 mb-2">Business Card</h4>
              <code className="text-xs bg-slate-100 p-2 rounded block overflow-x-auto">
                {enrollmentLink}?utm_source=print&utm_medium=business_card
              </code>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-slate-900 mb-2">Referral</h4>
              <code className="text-xs bg-slate-100 p-2 rounded block overflow-x-auto">
                {enrollmentLink}?utm_source=referral&utm_medium=word_of_mouth
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
