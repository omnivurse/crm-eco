import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Envelope,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Users,
  Heart,
} from '@phosphor-icons/react/dist/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getMemberDetails(supabase: any, memberId: string, agentId: string) {
  const { data: member, error } = await supabase
    .from('members')
    .select(`
      *,
      dependents (*),
      enrollments (
        id,
        status,
        effective_date,
        base_monthly_cost,
        created_at,
        plans:selected_plan_id (
          id,
          name,
          description
        )
      )
    `)
    .eq('id', memberId)
    .eq('advisor_id', agentId)
    .single();

  if (error || !member) {
    return null;
  }

  return member;
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

export default async function AgentMemberDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  const agent = await getAgentInfo(supabase, user.id);
  if (!agent) redirect('/access-denied');

  const member = await getMemberDetails(supabase, id, agent.id);
  if (!member) notFound();

  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'inactive': return 'bg-slate-100 text-slate-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agent/members">
          <Button variant="ghost" size="icon">
            <ArrowLeft weight="light" className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">
            {member.first_name} {member.last_name}
          </h1>
          <p className="text-slate-500">Member ID: {member.id}</p>
        </div>
        <Badge className={getStatusColor(member.status)}>
          {member.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Personal Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User weight="light" className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-500">Full Name</label>
                <p className="text-slate-900">{member.first_name} {member.last_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Date of Birth</label>
                <p className="text-slate-900">
                  {member.date_of_birth 
                    ? `${new Date(member.date_of_birth).toLocaleDateString()} (Age ${calculateAge(member.date_of_birth)})`
                    : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Gender</label>
                <p className="text-slate-900">{member.gender || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Country</label>
                <p className="text-slate-900">{member.country || 'USA'}</p>
              </div>
            </div>

            <hr />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Envelope weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <label className="text-sm font-medium text-slate-500">Email</label>
                  <p className="text-slate-900">{member.email || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <label className="text-sm font-medium text-slate-500">Phone</label>
                  <p className="text-slate-900">{member.phone || '-'}</p>
                </div>
              </div>
            </div>

            <hr />

            <div className="flex items-start gap-3">
              <MapPin weight="light" className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <label className="text-sm font-medium text-slate-500">Address</label>
                <p className="text-slate-900">
                  {member.address_line1 ? (
                    <>
                      {member.address_line1}
                      {member.address_line2 && `, ${member.address_line2}`}
                      <br />
                      {member.city}, {member.state} {member.postal_code}
                    </>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
            </div>

            {member.existing_condition && (
              <>
                <hr />
                <div className="flex items-start gap-3">
                  <Heart weight="light" className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <label className="text-sm font-medium text-slate-500">Pre-existing Conditions</label>
                    <p className="text-slate-900">{member.existing_condition_description || 'Yes (no details provided)'}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Member Since & Quick Stats */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar weight="light" className="h-5 w-5" />
                Member Since
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {new Date(member.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {/* eslint-disable-next-line react-hooks/purity -- Server Component: Date.now() per-request is correct */}
                {Math.floor((Date.now() - new Date(member.created_at).getTime()) / (1000 * 60 * 60 * 24))} days ago
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users weight="light" className="h-5 w-5" />
                Dependents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {member.dependents?.length > 0 ? (
                <div className="space-y-3">
                  {member.dependents.map((dep: any) => (
                    <div key={dep.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">
                          {dep.first_name} {dep.last_name}
                        </p>
                        <p className="text-sm text-slate-500">{dep.relationship}</p>
                      </div>
                      <span className="text-sm text-slate-600">
                        Age {calculateAge(dep.date_of_birth)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-4">No dependents</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText weight="light" className="h-5 w-5" />
            Enrollments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {member.enrollments?.length > 0 ? (
            <div className="space-y-4">
              {member.enrollments.map((enrollment: any) => (
                <div 
                  key={enrollment.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[rgba(11,109,133,0.1)] flex items-center justify-center">
                      <FileText weight="light" className="h-6 w-6 text-[var(--mp-teal)]" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {enrollment.plans?.name || 'Unknown Plan'}
                      </p>
                      <p className="text-sm text-slate-500">
                        Started: {enrollment.effective_date 
                          ? new Date(enrollment.effective_date).toLocaleDateString()
                          : 'Not started'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {enrollment.base_monthly_cost && (
                      <div className="text-right">
                        <p className="font-medium text-slate-900">
                          ${enrollment.base_monthly_cost}/mo
                        </p>
                      </div>
                    )}
                    <Badge className={getStatusColor(enrollment.status)}>
                      {enrollment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText weight="light" className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">No enrollments yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Actions */}
      <div className="flex gap-4">
        {member.email && (
          <Button variant="outline" className="gap-2" asChild>
            <a href={`mailto:${member.email}`}>
              <Envelope weight="light" className="h-4 w-4" />
              Send Email
            </a>
          </Button>
        )}
        {member.phone && (
          <Button variant="outline" className="gap-2" asChild>
            <a href={`tel:${member.phone}`}>
              <Phone weight="light" className="h-4 w-4" />
              Call Member
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
