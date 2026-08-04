'use client';

import { CaretRight, EnvelopeSimple, Eye, Phone, Trophy, UserCircleGear } from '@phosphor-icons/react';
import { Badge, Button } from '@crm-eco/ui';
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

/**
 * Mobile card component for displaying an agent.
 */
function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate">
            {agent.first_name} {agent.last_name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={getStatusBadgeVariant(agent.status)}>
              {getStatusLabel(agent.status)}
            </Badge>
            {agent.commission_tier && (
              <Badge variant="outline" className="text-xs">
                {agent.commission_tier}
              </Badge>
            )}
          </div>
        </div>
        <CaretRight weight="light" className="w-5 h-5 text-slate-400 flex-shrink-0" />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <EnvelopeSimple weight="light" className="w-4 h-4 flex-shrink-0 text-slate-400" />
          <span className="truncate">{agent.email}</span>
        </div>
        {agent.phone && (
          <div className="flex items-center gap-2 text-slate-600">
            <Phone weight="light" className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <span>{agent.phone}</span>
          </div>
        )}
        {agent.license_number && (
          <div className="flex items-center gap-2 text-slate-600">
            <Trophy weight="light" className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <span className="font-mono text-xs">{agent.license_number}</span>
          </div>
        )}
      </div>

      {/* License States */}
      {agent.license_states && agent.license_states.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {agent.license_states.slice(0, 4).map((state) => (
            <Badge key={state} variant="outline" className="text-xs">
              {state}
            </Badge>
          ))}
          {agent.license_states.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{agent.license_states.length - 4}
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <span>
          {agent.parent_advisor
            ? `Upline: ${agent.parent_advisor.first_name} ${agent.parent_advisor.last_name}`
            : 'No upline'}
        </span>
        <span>{format(new Date(agent.created_at), 'MMM d, yyyy')}</span>
      </div>
    </Link>
  );
}

export function AgentTable({ agents }: AgentTableProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-12">
        <UserCircleGear weight="light" className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">No agents found</p>
        <Link href="/agents/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
          Add your first agent
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
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
                <td className="py-[var(--ui-cell-py)]">
                  <p className="text-sm font-medium">
                    {agent.first_name} {agent.last_name}
                  </p>
                </td>
                <td className="py-[var(--ui-cell-py)] text-sm">{agent.email}</td>
                <td className="py-[var(--ui-cell-py)] text-sm">
                  {agent.phone || <span className="text-slate-400">—</span>}
                </td>
                <td className="py-[var(--ui-cell-py)] text-sm font-mono">
                  {agent.license_number || <span className="text-slate-400">—</span>}
                </td>
                <td className="py-[var(--ui-cell-py)] text-sm">
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
                <td className="py-[var(--ui-cell-py)] text-sm">
                  {agent.parent_advisor ? (
                    `${agent.parent_advisor.first_name} ${agent.parent_advisor.last_name}`
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="py-[var(--ui-cell-py)] text-sm">
                  {agent.commission_tier || <span className="text-slate-400">—</span>}
                </td>
                <td className="py-[var(--ui-cell-py)]">
                  <Badge variant={getStatusBadgeVariant(agent.status)}>
                    {getStatusLabel(agent.status)}
                  </Badge>
                </td>
                <td className="py-[var(--ui-cell-py)] text-sm text-slate-500">
                  {format(new Date(agent.created_at), 'MMM d, yyyy')}
                </td>
                <td className="py-[var(--ui-cell-py)]">
                  <Link href={`/agents/${agent.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye weight="light" className="h-4 w-4" />
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
