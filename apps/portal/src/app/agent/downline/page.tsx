'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  Network, 
  Users, 
  TrendingUp,
  ChevronRight,
  User,
  Mail,
  Phone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';

interface DownlineAgent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  enrollment_code: string | null;
  created_at: string;
  member_count?: number;
}

export default function AgentDownlinePage() {
  const [downlineAgents, setDownlineAgents] = useState<DownlineAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    fetchDownline();
  }, []);

  const fetchDownline = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: advisor } = await supabase
      .from('advisors')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .single() as { data: { id: string; organization_id: string } | null };

    if (!advisor) return;

    setAgentId(advisor.id);

    // Get downline agents (agents whose parent is this agent)
    const { data: agents, error } = await supabase
      .from('advisors')
      .select('*')
      .eq('parent_agent_id', advisor.id)
      .eq('organization_id', advisor.organization_id)
      .order('created_at', { ascending: false });

    if (!error && agents) {
      // Get member counts for each agent
      const agentsWithCounts = await Promise.all(
        agents.map(async (agent: DownlineAgent) => {
          const { count } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('advisor_id', agent.id);
          
          return {
            ...agent,
            member_count: count || 0,
          };
        })
      );

      setDownlineAgents(agentsWithCounts);
    }
    setLoading(false);
  };

  // Calculate stats
  const stats = {
    totalAgents: downlineAgents.length,
    activeAgents: downlineAgents.filter(a => a.status === 'active').length,
    totalMembers: downlineAgents.reduce((sum, a) => sum + (a.member_count || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      pending: 'bg-amber-100 text-amber-700',
      inactive: 'bg-slate-100 text-slate-700',
      suspended: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-700'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Network className="h-12 w-12 animate-pulse text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Downline</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Agents</p>
                <p className="text-2xl font-bold">{stats.totalAgents}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Network className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Active Agents</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeAgents}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Members (Downline)</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalMembers}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Downline List */}
      <Card>
        <CardHeader>
          <CardTitle>Downline Agents</CardTitle>
        </CardHeader>
        <CardContent>
          {downlineAgents.length === 0 ? (
            <div className="text-center py-12">
              <Network className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No downline agents yet</h3>
              <p className="text-slate-500">
                Agents you recruit will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {downlineAgents.map((agent) => (
                <div 
                  key={agent.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
                      {agent.first_name.charAt(0)}{agent.last_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">
                          {agent.first_name} {agent.last_name}
                        </p>
                        {getStatusBadge(agent.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {agent.email}
                        </span>
                        {agent.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {agent.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium text-slate-900">{agent.member_count}</p>
                      <p className="text-sm text-slate-500">Members</p>
                    </div>
                    <Link href={`/agent/downline/${agent.id}`}>
                      <Button variant="ghost" size="icon">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </Link>
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
