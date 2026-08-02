'use client';

import { ArrowSquareOut, Copy, Eye, Link as LinkIcon, MagnifyingGlass, QrCode, TrendUp, Users } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { toast } from 'sonner';
import { enrollPublicBaseUrl } from '@/lib/enroll-url';
import { PageHeader } from '@/components/ui/PageHeader';

interface Agent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  enrollment_code: string | null;
  is_active: boolean;
  primary_color: string | null;
  logo_url: string | null;
  // Stats
  total_members: number;
  total_enrollments: number;
}

export default function AgentLinksPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function loadAgents() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single() as { data: { organization_id: string } | null };

    if (!profile) return;

    // Load agents with their enrollment codes
    const { data: agentsData } = await supabase
      .from('advisors')
      .select(`
        id,
        first_name,
        last_name,
        email,
        enrollment_code,
        is_active,
        primary_color,
        logo_url
      `)
      .eq('organization_id', profile.organization_id)
      .order('last_name');

    if (agentsData) {
      // Get member counts per agent
      const { data: memberCounts } = await supabase
        .from('members')
        .select('advisor_id')
        .eq('organization_id', profile.organization_id);

      const { data: enrollmentCounts } = await (supabase as any)
        .from('enrollments')
        .select('advisor_id')
        .eq('organization_id', profile.organization_id);

      const membersByAgent: Record<string, number> = {};
      const enrollmentsByAgent: Record<string, number> = {};

      memberCounts?.forEach((m: any) => {
        if (m.advisor_id) {
          membersByAgent[m.advisor_id] = (membersByAgent[m.advisor_id] || 0) + 1;
        }
      });

      enrollmentCounts?.forEach((e: any) => {
        if (e.advisor_id) {
          enrollmentsByAgent[e.advisor_id] = (enrollmentsByAgent[e.advisor_id] || 0) + 1;
        }
      });

      const agentsWithStats = (agentsData as any[]).map((agent: any) => ({
        id: agent.id,
        first_name: agent.first_name,
        last_name: agent.last_name,
        email: agent.email,
        enrollment_code: agent.enrollment_code,
        is_active: agent.is_active,
        primary_color: agent.primary_color,
        logo_url: agent.logo_url,
        total_members: membersByAgent[agent.id] || 0,
        total_enrollments: enrollmentsByAgent[agent.id] || 0,
      }));

      setAgents(agentsWithStats);
      setFilteredAgents(agentsWithStats);
    }

    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => loadAgents());
  }, []);

  useEffect(() => {
    const filtered = searchQuery
      ? agents.filter(agent => {
          const query = searchQuery.toLowerCase();
          return (
            agent.first_name?.toLowerCase().includes(query) ||
            agent.last_name?.toLowerCase().includes(query) ||
            agent.email.toLowerCase().includes(query) ||
            agent.enrollment_code?.includes(query)
          );
        })
      : agents;
    queueMicrotask(() => setFilteredAgents(filtered));
  }, [searchQuery, agents]);

  function getAgentEnrollmentUrl(enrollmentCode: string) {
    const baseUrl = enrollPublicBaseUrl();
    return `${baseUrl}/enroll?agent=${enrollmentCode}`;
  }

  async function copyLink(enrollmentCode: string) {
    const url = getAgentEnrollmentUrl(enrollmentCode);
    await navigator.clipboard.writeText(url);
    toast.success('Agent enrollment link copied');
  }

  async function regenerateCode(agentId: string) {
    // Generate a new 6-digit code
    // eslint-disable-next-line react-hooks/purity -- Math.random() in event handler is correct
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { error } = await (supabase as any)
      .from('advisors')
      .update({ enrollment_code: newCode })
      .eq('id', agentId);

    if (error) {
      toast.error('Failed to regenerate code');
    } else {
      toast.success('Enrollment code regenerated');
      loadAgents();
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        backHref="/enrollment-links"
        backLabel="Enrollment links"
        title="Agent enrollment links"
        description="Manage unique enrollment links for each agent"
        icon={<Users weight="light" className="h-6 w-6" />}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Agents</p>
                <p className="text-2xl font-bold">{agents.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users weight="light" className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Links</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {agents.filter(a => a.is_active && a.enrollment_code).length}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <LinkIcon weight="light" className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Enrollments</p>
                <p className="text-2xl font-bold text-amber-600">
                  {agents.reduce((sum, a) => sum + a.total_enrollments, 0)}
                </p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <TrendUp weight="light" className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MagnifyingGlass */}
      <div className="relative max-w-md">
        <MagnifyingGlass weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="MagnifyingGlass agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Enrollment Codes</CardTitle>
          <CardDescription>
            Each agent has a unique enrollment code that tracks referrals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Enrollment Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Enrollments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No agents found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div>
                        <Link 
                          href={`/agents/${agent.id}`}
                          className="font-medium text-slate-900 hover:text-blue-600"
                        >
                          {agent.first_name} {agent.last_name}
                        </Link>
                        <p className="text-sm text-slate-500">{agent.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {agent.enrollment_code ? (
                        <code className="px-2 py-1 bg-slate-100 rounded text-sm font-mono">
                          {agent.enrollment_code}
                        </code>
                      ) : (
                        <span className="text-slate-400">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{agent.total_members}</TableCell>
                    <TableCell className="text-right">{agent.total_enrollments}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {agent.enrollment_code && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyLink(agent.enrollment_code!)}
                              title="Copy enrollment link"
                            >
                              <Copy weight="light" className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Preview link"
                            >
                              <a
                                href={getAgentEnrollmentUrl(agent.enrollment_code)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ArrowSquareOut weight="light" className="w-4 h-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Generate QR code"
                            >
                              <Link href={`/agents/${agent.id}?tab=enrollment`}>
                                <QrCode weight="light" className="w-4 h-4" />
                              </Link>
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => regenerateCode(agent.id)}
                        >
                          {agent.enrollment_code ? 'Regenerate' : 'Generate'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
