import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui';
import { ArrowLeft, Edit, Mail, Phone, MapPin, Calendar, Users, Palette, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { format } from 'date-fns';
import { AgentCommissionTab } from '@/components/commissions/AgentCommissionTab';

async function getAgent(id: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const { data: agent } = await (supabase
    .from('advisors')
    .select(`
      *,
      parent_advisor:advisors!advisors_parent_advisor_id_fkey(id, first_name, last_name, email),
      commission_tier:commission_tiers(id, name, code, base_rate_pct, bonus_rate_pct, override_rate_pct)
    `)
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single() as any);

  return { agent, organizationId: profile.organization_id };
}

async function getAgentMembers(agentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, status')
    .eq('advisor_id', agentId)
    .order('created_at', { ascending: false })
    .limit(10);

  return members ?? [];
}

async function getDownlineAgents(agentId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: downline } = await supabase
    .from('advisors')
    .select('id, first_name, last_name, email, status')
    .eq('parent_advisor_id', agentId)
    .order('created_at', { ascending: false });

  return downline ?? [];
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'inactive':
    case 'suspended':
    case 'terminated':
      return 'destructive';
    default:
      return 'outline';
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getAgent(id);

  if (!result || !result.agent) {
    notFound();
  }

  const { agent, organizationId } = result;

  const [members, downline] = await Promise.all([
    getAgentMembers(id),
    getDownlineAgents(id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/agents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {agent.first_name} {agent.last_name}
            </h1>
            <p className="text-slate-500">{agent.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(agent.status)}>
            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          </Badge>
          <Link href={`/agents/${agent.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Agent
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <Users className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="commissions">
            <DollarSign className="h-4 w-4 mr-2" />
            Commissions
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Full Name</p>
                    <p className="font-medium">{agent.first_name} {agent.last_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Enrollment Code</p>
                    <p className="font-mono font-medium">{agent.enrollment_code || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">License Number</p>
                    <p className="font-mono font-medium">{agent.license_number || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Licensed States</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {agent.license_states && agent.license_states.length > 0 ? (
                        agent.license_states.map((state: string) => (
                          <Badge key={state} variant="outline" className="text-xs">
                            {state}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Commission Tier</p>
                    <p className="font-medium">
                      {agent.commission_tier ? (
                        <Link href={`/commissions/tiers/${agent.commission_tier.id}`} className="text-blue-600 hover:underline">
                          {agent.commission_tier.name} ({agent.commission_tier.base_rate_pct}%)
                        </Link>
                      ) : (
                        '—'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Commission Eligible</p>
                    <Badge variant={agent.commission_eligible ? 'success' : 'secondary'}>
                      {agent.commission_eligible ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>{agent.email}</span>
                  </div>
                  {agent.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{agent.phone}</span>
                    </div>
                  )}
                  {agent.street_address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div>
                        <p>{agent.street_address}</p>
                        {agent.apartment && <p>{agent.apartment}</p>}
                        <p>
                          {agent.city}, {agent.state} {agent.zip_code}
                        </p>
                        <p>{agent.country}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Branding */}
              {(agent.company_name || agent.logo_url || agent.primary_color) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Branding
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {agent.company_name && (
                      <div>
                        <p className="text-sm text-slate-500">Company Name</p>
                        <p className="font-medium">{agent.company_name}</p>
                      </div>
                    )}
                    {agent.website_url && (
                      <div>
                        <p className="text-sm text-slate-500">Website</p>
                        <a
                          href={agent.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {agent.website_url}
                        </a>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-slate-500 mb-2">Colors</p>
                      <div className="flex gap-2">
                        <div
                          className="w-8 h-8 rounded border"
                          style={{ backgroundColor: agent.primary_color || '#1e40af' }}
                          title="Primary"
                        />
                        <div
                          className="w-8 h-8 rounded border"
                          style={{ backgroundColor: agent.secondary_color || '#3b82f6' }}
                          title="Secondary"
                        />
                        <div
                          className="w-8 h-8 rounded border"
                          style={{ backgroundColor: agent.header_bg_color || '#1e3a8a' }}
                          title="Header Background"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Assigned Members
                  </CardTitle>
                  <CardDescription>
                    {members.length} member(s) assigned
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {members.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">
                      No members assigned to this agent
                    </p>
                  ) : (
                    <div className="divide-y">
                      {members.map((member: any) => (
                        <Link
                          key={member.id}
                          href={`/members/${member.id}`}
                          className="py-3 flex items-center justify-between hover:bg-slate-50 -mx-2 px-2 rounded"
                        >
                          <div>
                            <p className="font-medium">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-sm text-slate-500">{member.email}</p>
                          </div>
                          <Badge variant={getStatusBadgeVariant(member.status)}>
                            {member.status}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Upline */}
              <Card>
                <CardHeader>
                  <CardTitle>Upline (Parent Agent)</CardTitle>
                </CardHeader>
                <CardContent>
                  {agent.parent_advisor ? (
                    <div>
                      <p className="font-medium">
                        {agent.parent_advisor.first_name} {agent.parent_advisor.last_name}
                      </p>
                      <p className="text-sm text-slate-500">{agent.parent_advisor.email}</p>
                      <Link
                        href={`/agents/${agent.parent_advisor.id}`}
                        className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                      >
                        View Agent Profile →
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No upline (top-level agent)</p>
                  )}
                </CardContent>
              </Card>

              {/* Downline */}
              <Card>
                <CardHeader>
                  <CardTitle>Downline Agents</CardTitle>
                  <CardDescription>{downline.length} agent(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  {downline.length === 0 ? (
                    <p className="text-sm text-slate-500">No downline agents</p>
                  ) : (
                    <div className="space-y-2">
                      {downline.map((downlineAgent: any) => (
                        <Link
                          key={downlineAgent.id}
                          href={`/agents/${downlineAgent.id}`}
                          className="block p-2 rounded border hover:bg-slate-50"
                        >
                          <p className="font-medium text-sm">
                            {downlineAgent.first_name} {downlineAgent.last_name}
                          </p>
                          <p className="text-xs text-slate-500">{downlineAgent.email}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle>Record Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Created {format(new Date(agent.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <p className="text-slate-400 font-mono text-xs">{agent.id}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Commissions Tab */}
        <TabsContent value="commissions">
          <AgentCommissionTab agentId={agent.id} organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
