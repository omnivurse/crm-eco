'use client';

import { Badge, Button } from '@crm-eco/ui';
import { Eye, UserCog } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  license_number: string | null;
  license_states: string[] | null;
  commission_tier: string | null;
  created_at: string;
  parent_advisor: { id: string; first_name: string; last_name: string } | null;
}

interface AgentTableProps {
  agents: Agent[];
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

function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'active':
      return 'Active';
    case 'inactive':
      return 'Inactive';
    case 'suspended':
      return 'Suspended';
    case 'terminated':
      return 'Terminated';
    default:
      return status;
  }
}

export function AgentTable({ agents }: AgentTableProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-12">
        <UserCog className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">No agents found</p>
        <Link href="/agents/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
          Add your first agent
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-3 font-medium text-slate-500 text-sm">Name</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Email</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Phone</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">License #</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">States</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Upline</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Tier</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Created</th>
            <th className="pb-3 font-medium text-slate-500 text-sm">Actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id} className="border-b hover:bg-slate-50">
              <td className="py-3">
                <p className="text-sm font-medium">
                  {agent.first_name} {agent.last_name}
                </p>
              </td>
              <td className="py-3 text-sm">{agent.email}</td>
              <td className="py-3 text-sm">
                {agent.phone || <span className="text-slate-400">—</span>}
              </td>
              <td className="py-3 text-sm font-mono">
                {agent.license_number || <span className="text-slate-400">—</span>}
              </td>
              <td className="py-3 text-sm">
                {agent.license_states && agent.license_states.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {agent.license_states.slice(0, 3).map((state) => (
                      <Badge key={state} variant="outline" className="text-xs">
                        {state}
                      </Badge>
                    ))}
                    {agent.license_states.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{agent.license_states.length - 3}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="py-3 text-sm">
                {agent.parent_advisor ? (
                  `${agent.parent_advisor.first_name} ${agent.parent_advisor.last_name}`
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="py-3 text-sm">
                {agent.commission_tier || <span className="text-slate-400">—</span>}
              </td>
              <td className="py-3">
                <Badge variant={getStatusBadgeVariant(agent.status)}>
                  {getStatusLabel(agent.status)}
                </Badge>
              </td>
              <td className="py-3 text-sm text-slate-500">
                {format(new Date(agent.created_at), 'MMM d, yyyy')}
              </td>
              <td className="py-3">
                <Link href={`/agents/${agent.id}`}>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
