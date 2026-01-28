'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from '@crm-eco/ui';
import {
  RefreshCw,
  ArrowRight,
  Users,
  Loader2,
  Play,
  History,
} from 'lucide-react';

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface AssignmentRule {
  id: string;
  name: string;
  strategy: string;
  config: {
    users?: string[];
    cursor?: number;
    fixed_owner?: string;
  };
  is_enabled: boolean;
}

interface AssignmentPreviewProps {
  rule: AssignmentRule;
  agents: Agent[];
  organizationId: string;
}

interface PreviewAssignment {
  position: number;
  advisor_id: string;
  agent?: Agent;
}

export function AssignmentPreview({ rule, agents, organizationId }: AssignmentPreviewProps) {
  const [preview, setPreview] = useState<PreviewAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<Agent | null>(null);

  const supabase = createClient();

  const loadPreview = useCallback(async () => {
    if (rule.strategy !== 'round_robin' || !rule.config.users?.length) {
      return;
    }

    setIsLoading(true);
    try {
      // Try to use the database function if available
      const { data, error } = await (supabase as any)
        .rpc('preview_round_robin_assignments', {
          p_rule_id: rule.id,
          p_count: 5,
        });

      if (error) {
        // Fallback: calculate preview client-side
        const users = rule.config.users;
        const cursor = rule.config.cursor || 0;
        const previewData: PreviewAssignment[] = [];

        for (let i = 0; i < Math.min(5, users.length); i++) {
          const index = (cursor + i) % users.length;
          const agentId = users[index];
          const agent = agents.find(a => a.id === agentId);
          previewData.push({
            position: i + 1,
            advisor_id: agentId,
            agent,
          });
        }

        setPreview(previewData);
      } else if (data) {
        const previewData: PreviewAssignment[] = (data as Array<{ position: number; advisor_id: string }>).map((item) => ({
          ...item,
          agent: agents.find(a => a.id === item.advisor_id),
        }));
        setPreview(previewData);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
      // Fallback calculation
      const users = rule.config.users || [];
      const cursor = rule.config.cursor || 0;
      const previewData: PreviewAssignment[] = [];

      for (let i = 0; i < Math.min(5, users.length); i++) {
        const index = (cursor + i) % users.length;
        const agentId = users[index];
        const agent = agents.find(a => a.id === agentId);
        previewData.push({
          position: i + 1,
          advisor_id: agentId,
          agent,
        });
      }

      setPreview(previewData);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, rule, agents]);

  useEffect(() => {
    if (rule.strategy === 'round_robin') {
      loadPreview();
    }
  }, [loadPreview, rule.strategy]);

  const simulateAssignment = async () => {
    setIsSimulating(true);
    setSimulationResult(null);

    try {
      if (rule.strategy === 'round_robin') {
        const users = rule.config.users || [];
        const cursor = rule.config.cursor || 0;
        const nextAgentId = users[cursor % users.length];
        const agent = agents.find(a => a.id === nextAgentId);
        setSimulationResult(agent || null);
      } else if (rule.strategy === 'fixed') {
        const agent = agents.find(a => a.id === rule.config.fixed_owner);
        setSimulationResult(agent || null);
      } else if (rule.strategy === 'least_loaded') {
        // For demo, just pick first agent
        const users = rule.config.users || [];
        if (users.length > 0) {
          const agent = agents.find(a => a.id === users[0]);
          setSimulationResult(agent || null);
        }
      }
    } finally {
      setIsSimulating(false);
    }
  };

  if (rule.strategy === 'fixed') {
    const fixedAgent = agents.find(a => a.id === rule.config.fixed_owner);
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assignment Preview
          </CardTitle>
          <CardDescription>Fixed assignment to a specific agent</CardDescription>
        </CardHeader>
        <CardContent>
          {fixedAgent ? (
            <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                <span className="text-sm font-medium text-teal-700">
                  {fixedAgent.first_name?.[0]}{fixedAgent.last_name?.[0]}
                </span>
              </div>
              <div>
                <p className="font-medium">{fixedAgent.first_name} {fixedAgent.last_name}</p>
                <p className="text-sm text-slate-500">{fixedAgent.email}</p>
              </div>
              <Badge className="ml-auto">Always Assigned</Badge>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No agent selected</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (rule.strategy !== 'round_robin' && rule.strategy !== 'least_loaded') {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Assignment Preview
            </CardTitle>
            <CardDescription>
              {rule.strategy === 'round_robin'
                ? 'Next assignments in rotation order'
                : 'Assignment based on workload'
              }
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadPreview} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview Queue */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : preview.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            No agents in rotation
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Next in Queue</p>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {preview.map((item, index) => (
                <div key={item.position} className="flex items-center gap-2">
                  <div className={`flex flex-col items-center p-3 rounded-lg border min-w-[120px] ${
                    index === 0 ? 'bg-teal-50 border-teal-200' : 'bg-slate-50'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                      index === 0 ? 'bg-teal-100' : 'bg-slate-200'
                    }`}>
                      <span className={`text-sm font-medium ${
                        index === 0 ? 'text-teal-700' : 'text-slate-600'
                      }`}>
                        {item.agent?.first_name?.[0]}{item.agent?.last_name?.[0]}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-center truncate w-full">
                      {item.agent ? `${item.agent.first_name} ${item.agent.last_name?.[0]}.` : 'Unknown'}
                    </p>
                    <Badge variant={index === 0 ? 'default' : 'outline'} className="text-xs mt-1">
                      #{item.position}
                    </Badge>
                  </div>
                  {index < preview.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simulation */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Play className="h-4 w-4" />
              <span>Test Assignment</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={simulateAssignment}
              disabled={isSimulating || !rule.is_enabled}
            >
              {isSimulating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Simulate
            </Button>
          </div>

          {simulationResult && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-green-600 font-medium mb-2">WOULD BE ASSIGNED TO:</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-green-700">
                    {simulationResult.first_name?.[0]}{simulationResult.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{simulationResult.first_name} {simulationResult.last_name}</p>
                  <p className="text-sm text-slate-500">{simulationResult.email}</p>
                </div>
              </div>
            </div>
          )}

          {!rule.is_enabled && (
            <p className="text-sm text-amber-600 mt-2">
              Enable this rule to test assignments
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
            Rotation Stats
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {rule.config.users?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Agents</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {((rule.config.cursor || 0) % (rule.config.users?.length || 1)) + 1}
              </p>
              <p className="text-xs text-slate-500">Current Position</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {rule.config.cursor || 0}
              </p>
              <p className="text-xs text-slate-500">Total Assigned</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
