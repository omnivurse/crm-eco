'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
} from '@crm-eco/ui';
import {
  ChevronRight,
  ChevronDown,
  User,
  Users,
  Search,
  Loader2,
  Building2,
  Phone,
  Mail,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import Link from 'next/link';

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  commission_tier: string | null;
  agency_name: string | null;
  parent_advisor_id: string | null;
  children?: Agent[];
  childCount?: number;
}

interface AgentNodeProps {
  agent: Agent;
  level: number;
  onToggle: (id: string) => void;
  expandedIds: Set<string>;
  selectedId: string | null;
  onSelect: (agent: Agent) => void;
}

function AgentNode({ agent, level, onToggle, expandedIds, selectedId, onSelect }: AgentNodeProps) {
  const isExpanded = expandedIds.has(agent.id);
  const hasChildren = (agent.childCount ?? 0) > 0 || (agent.children?.length ?? 0) > 0;
  const isSelected = selectedId === agent.id;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-[#047474]/10 border border-[#047474]'
            : 'hover:bg-slate-50'
        }`}
        style={{ marginLeft: `${level * 24}px` }}
        onClick={() => onSelect(agent)}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(agent.id);
          }}
          className={`p-1 rounded ${hasChildren ? 'hover:bg-slate-200' : 'opacity-0'}`}
          disabled={!hasChildren}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
          agent.status === 'active' ? 'bg-[#047474]' : 'bg-slate-400'
        }`}>
          {agent.first_name[0]}{agent.last_name[0]}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 truncate">
              {agent.first_name} {agent.last_name}
            </span>
            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="text-xs">
              {agent.status}
            </Badge>
            {agent.commission_tier && (
              <Badge variant="outline" className="text-xs">
                {agent.commission_tier}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{agent.email}</span>
            {hasChildren && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {agent.childCount ?? agent.children?.length ?? 0} downline
              </span>
            )}
          </div>
        </div>

        {/* Link to Details */}
        <Link
          href={`/agents/${agent.id}`}
          onClick={(e) => e.stopPropagation()}
          className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Children */}
      {isExpanded && agent.children && (
        <div>
          {agent.children.map((child) => (
            <AgentNode
              key={child.id}
              agent={child}
              level={level + 1}
              onToggle={onToggle}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentTreePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const supabase = createClient();

  // Build tree from flat list
  const buildTree = useCallback((flatAgents: Agent[]): Agent[] => {
    const agentMap = new Map<string, Agent>();
    const rootAgents: Agent[] = [];

    // First pass: create map and initialize children arrays
    flatAgents.forEach(agent => {
      agentMap.set(agent.id, { ...agent, children: [], childCount: 0 });
    });

    // Second pass: build tree structure
    flatAgents.forEach(agent => {
      const agentNode = agentMap.get(agent.id)!;
      if (agent.parent_advisor_id && agentMap.has(agent.parent_advisor_id)) {
        const parent = agentMap.get(agent.parent_advisor_id)!;
        parent.children!.push(agentNode);
        parent.childCount = (parent.childCount || 0) + 1;
      } else {
        rootAgents.push(agentNode);
      }
    });

    // Sort by name
    const sortAgents = (agents: Agent[]): Agent[] => {
      return agents
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
        .map(agent => ({
          ...agent,
          children: agent.children ? sortAgents(agent.children) : [],
        }));
    };

    return sortAgents(rootAgents);
  }, []);

  const fetchAgents = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('advisors')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          commission_tier,
          agency_name,
          parent_advisor_id
        `)
        .eq('organization_id', organizationId)
        .order('first_name');

      if (searchQuery) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const tree = buildTree((data || []) as Agent[]);
      setAgents(tree);

      // Auto-expand first level if not too many
      if (tree.length <= 10) {
        setExpandedIds(new Set(tree.map(a => a.id)));
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, organizationId, searchQuery, buildTree]);

  // Get organization ID
  useEffect(() => {
    async function getOrgId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setOrganizationId(profile.organization_id);
      }
    }

    getOrgId();
  }, [supabase]);

  useEffect(() => {
    if (organizationId) {
      fetchAgents();
    }
  }, [organizationId, fetchAgents]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (agents: Agent[]) => {
      agents.forEach(agent => {
        if (agent.children && agent.children.length > 0) {
          allIds.add(agent.id);
          collectIds(agent.children);
        }
      });
    };
    collectIds(agents);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  // Count total agents in tree
  const countAgents = (agents: Agent[]): number => {
    return agents.reduce((sum, agent) => {
      return sum + 1 + (agent.children ? countAgents(agent.children) : 0);
    }, 0);
  };

  const totalAgents = countAgents(agents);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/agents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Agent Tree</h1>
            <p className="text-slate-500">View agent hierarchy and relationships</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tree View */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>Hierarchy</CardTitle>
                  <Badge variant="secondary">{totalAgents} agents</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll}>
                    <ZoomIn className="w-4 h-4 mr-1" />
                    Expand All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll}>
                    <ZoomOut className="w-4 h-4 mr-1" />
                    Collapse All
                  </Button>
                </div>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500">No agents found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {agents.map((agent) => (
                    <AgentNode
                      key={agent.id}
                      agent={agent}
                      level={0}
                      onToggle={toggleExpand}
                      expandedIds={expandedIds}
                      selectedId={selectedAgent?.id ?? null}
                      onSelect={setSelectedAgent}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Agent Details Panel */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Agent Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedAgent ? (
                <div className="space-y-4">
                  {/* Avatar and Name */}
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold ${
                      selectedAgent.status === 'active' ? 'bg-[#047474]' : 'bg-slate-400'
                    }`}>
                      {selectedAgent.first_name[0]}{selectedAgent.last_name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {selectedAgent.first_name} {selectedAgent.last_name}
                      </h3>
                      <Badge variant={selectedAgent.status === 'active' ? 'default' : 'secondary'}>
                        {selectedAgent.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <a href={`mailto:${selectedAgent.email}`} className="hover:text-[#047474]">
                        {selectedAgent.email}
                      </a>
                    </div>
                    {selectedAgent.phone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <a href={`tel:${selectedAgent.phone}`} className="hover:text-[#047474]">
                          {selectedAgent.phone}
                        </a>
                      </div>
                    )}
                    {selectedAgent.agency_name && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {selectedAgent.agency_name}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Commission Tier</p>
                      <p className="font-semibold text-slate-900">
                        {selectedAgent.commission_tier || '-'}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Downline</p>
                      <p className="font-semibold text-slate-900">
                        {selectedAgent.childCount ?? selectedAgent.children?.length ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4">
                    <Link href={`/agents/${selectedAgent.id}`}>
                      <Button className="w-full">
                        View Full Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select an agent to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
