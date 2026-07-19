import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShareNetwork,
  Envelope,
  Phone,
  MapPin,
  Calendar,
  Users,
  FileText,
  TrendUp,
} from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getAgentInfo(supabase: any, userId: string) {
  // Get profile first
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single() as { data: { id: string } | null };

  if (!profile) return null;

  // Get advisor using profile_id
  const { data: advisor } = await supabase
    .from('advisors')
    .select('id, organization_id')
    .eq('profile_id', profile.id)
    .single() as { data: { id: string; organization_id: string } | null };
  return advisor;
}

async function getDownlineAgent(
  supabase: any,
  downlineId: string,
  agentId: string,
  organizationId: string,
) {
  // Load the downline advisor scoped to this agent (must be a direct child)
  // and to the same organization for tenant isolation.
  const { data: advisor, error } = await supabase
    .from('advisors')
    .select('*')
    .eq('id', downlineId)
    .eq('parent_advisor_id', agentId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !advisor) {
    return null;
  }

  return advisor;
}

export default async function AgentDownlineDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  const agent = await getAgentInfo(supabase, user.id);
  if (!agent) redirect('/access-denied');

  const downlineAgent = await getDownlineAgent(
    supabase,
    id,
    agent.id,
    agent.organization_id,
  );
  if (!downlineAgent) notFound();

  // Summary counts for the downline agent (their own book of business).
  const [{ count: memberCount }, { count: enrollmentCount }] = await Promise.all([
    supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('advisor_id', downlineAgent.id)
      .eq('organization_id', agent.organization_id),
    supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('advisor_id', downlineAgent.id),
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'inactive': return 'bg-slate-100 text-slate-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agent/downline">
          <Button variant="ghost" size="icon">
            <ArrowLeft weight="light" className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">
            {downlineAgent.first_name} {downlineAgent.last_name}
          </h1>
          <p className="text-slate-500">Downline Agent</p>
        </div>
        <Badge className={getStatusColor(downlineAgent.status)}>
          {downlineAgent.status}
        </Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Members</p>
                <p className="text-2xl font-bold text-[var(--mp-teal)]">{memberCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[rgba(11,109,133,0.1)] flex items-center justify-center">
                <Users weight="light" className="h-5 w-5 text-[var(--mp-teal)]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Enrollments</p>
                <p className="text-2xl font-bold text-[var(--mp-teal)]">{enrollmentCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[rgba(11,109,133,0.1)] flex items-center justify-center">
                <FileText weight="light" className="h-5 w-5 text-[var(--mp-teal)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Agent Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShareNetwork weight="light" className="h-5 w-5" />
              Agent Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-500">Full Name</label>
                <p className="text-slate-900">
                  {downlineAgent.first_name} {downlineAgent.last_name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Agent Code</label>
                <p className="text-slate-900">{downlineAgent.advisor_code || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Enrollment Code</label>
                <p className="text-slate-900">{downlineAgent.enrollment_code || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Agency</label>
                <p className="text-slate-900">{downlineAgent.agency_name || '-'}</p>
              </div>
            </div>

            <hr />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Envelope weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <label className="text-sm font-medium text-slate-500">Email</label>
                  <p className="text-slate-900">{downlineAgent.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <label className="text-sm font-medium text-slate-500">Phone</label>
                  <p className="text-slate-900">
                    {downlineAgent.phone || downlineAgent.mobile_phone || '-'}
                  </p>
                </div>
              </div>
            </div>

            {(downlineAgent.street_address || downlineAgent.city) && (
              <>
                <hr />
                <div className="flex items-start gap-3">
                  <MapPin weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <label className="text-sm font-medium text-slate-500">Address</label>
                    <p className="text-slate-900">
                      {downlineAgent.street_address ? (
                        <>
                          {downlineAgent.street_address}
                          {downlineAgent.apartment && `, ${downlineAgent.apartment}`}
                          <br />
                        </>
                      ) : null}
                      {[downlineAgent.city, downlineAgent.state, downlineAgent.zip_code]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Joined & Production */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar weight="light" className="h-5 w-5" />
                Agent Since
              </CardTitle>
            </CardHeader>
            <CardContent>
              {downlineAgent.created_at ? (
                <>
                  <p className="text-2xl font-bold text-slate-900">
                    {new Date(downlineAgent.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {/* eslint-disable-next-line react-hooks/purity -- Server Component: Date.now() per-request is correct */}
                    {Math.floor((Date.now() - new Date(downlineAgent.created_at).getTime()) / (1000 * 60 * 60 * 24))} days ago
                  </p>
                </>
              ) : (
                <p className="text-slate-500">-</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendUp weight="light" className="h-5 w-5" />
                Production
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Personal</span>
                <span className="font-medium text-slate-900">
                  ${(downlineAgent.personal_production || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Team</span>
                <span className="font-medium text-slate-900">
                  ${(downlineAgent.team_production || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Lifetime</span>
                <span className="font-medium text-slate-900">
                  ${(downlineAgent.lifetime_production || 0).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Contact Actions */}
      <div className="flex gap-4">
        {downlineAgent.email && (
          <Button variant="outline" className="gap-2" asChild>
            <a href={`mailto:${downlineAgent.email}`}>
              <Envelope weight="light" className="h-4 w-4" />
              Send Email
            </a>
          </Button>
        )}
        {(downlineAgent.phone || downlineAgent.mobile_phone) && (
          <Button variant="outline" className="gap-2" asChild>
            <a href={`tel:${downlineAgent.phone || downlineAgent.mobile_phone}`}>
              <Phone weight="light" className="h-4 w-4" />
              Call Agent
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
